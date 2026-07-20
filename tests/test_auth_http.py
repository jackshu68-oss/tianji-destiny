import base64
import http.client
import json
import pathlib
import tempfile
import threading
import unittest

from server.auth import AuthService
from server.billing import BillingService
from server import ai_service as service


class FakeSms:
    configured = True

    def __init__(self):
        self.messages = []

    def send(self, phone, code):
        self.messages.append((phone, code))


class AuthHttpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = pathlib.Path(self.temp.name) / "service.sqlite3"
        self.now = [1_800_000_000]
        self.sms = FakeSms()
        self.original_auth = service.AUTH
        self.original_billing = service.BILLING
        self.original_hosts = service.ALLOWED_HOSTS
        self.original_run_job = service.run_job
        self.original_payment_qr_dir = service.PAYMENT_QR_DIR
        service.AUTH = AuthService(
            self.database,
            environ={
                "TIANJI_AUTH_SECRET": "http-test-secret-that-is-long-enough",
                "TIANJI_TRIAL_HOURS": "24",
                "TIANJI_TRIAL_MARKER_DAYS": "365",
                "TIANJI_AUTH_SESSION_DAYS": "30",
                "TIANJI_OWNER_PHONE": "13800138000",
            },
            sms_sender=self.sms,
            clock=lambda: self.now[0],
        )
        service.BILLING = BillingService(self.database, environ={"TIANJI_WEB_CHECKOUT_ENABLED": "0"})
        service.ALLOWED_HOSTS = {"127.0.0.1", "localhost"}
        service.run_job = lambda *_args: None
        service.PAYMENT_QR_DIR = pathlib.Path(self.temp.name) / "payment_qr"
        with service.LOCK:
            service.CACHE.clear()
            service.JOBS.clear()
            service.PENDING_BY_DIGEST.clear()
            service.IP_REQUESTS.clear()
            service.GLOBAL_REQUESTS.clear()
            service.STORAGE_REQUESTS.clear()
        self.server = service.ThreadingHTTPServer(("127.0.0.1", 0), service.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        service.AUTH = self.original_auth
        service.BILLING = self.original_billing
        service.ALLOWED_HOSTS = self.original_hosts
        service.run_job = self.original_run_job
        service.PAYMENT_QR_DIR = self.original_payment_qr_dir
        self.temp.cleanup()

    def request(self, method, path, body=None, cookie=""):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {}
        payload = None
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if cookie:
            headers["Cookie"] = cookie
        connection.request(method, path, body=payload, headers=headers)
        response = connection.getresponse()
        data = json.loads(response.read().decode("utf-8"))
        headers = response.getheaders()
        connection.close()
        return response.status, data, headers

    @staticmethod
    def session_cookie(headers, name="tianji_session"):
        prefix = name + "="
        for header, value in headers:
            if header.lower() == "set-cookie" and value.startswith(prefix):
                return value.split(";", 1)[0]
        return ""

    def register(self, phone):
        status, _payload, _headers = self.request(
            "POST", "/api/auth/otp/start", {"phone": phone, "purpose": "register"},
        )
        self.assertEqual(status, 200)
        code = self.sms.messages[-1][1]
        status, payload, headers = self.request(
            "POST", "/api/auth/register", {"phone": phone, "code": code, "password": "Password8"},
        )
        self.assertEqual(status, 200)
        return payload, self.session_cookie(headers)

    def test_register_login_logout_and_password_reset_routes(self):
        status, payload, _headers = self.request("GET", "/api/auth/status")
        self.assertEqual(status, 200)
        self.assertFalse(payload["authenticated"])
        self.assertTrue(payload["sms_enabled"])

        phone = "17606669594"
        status, _payload, _headers = self.request(
            "POST", "/api/auth/otp/start", {"phone": phone, "purpose": "register"},
        )
        self.assertEqual(status, 200)
        code = self.sms.messages[-1][1]
        status, payload, headers = self.request(
            "POST", "/api/auth/register", {"phone": phone, "code": code, "password": "Password8"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["account"]["phone_hint"], "176****9594")
        cookie = self.session_cookie(headers)
        self.assertTrue(cookie)

        status, payload, _headers = self.request("GET", "/api/auth/status", cookie=cookie)
        self.assertEqual(status, 200)
        self.assertTrue(payload["authenticated"])

        status, _payload, headers = self.request("POST", "/api/auth/logout", {}, cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(self.session_cookie(headers), "tianji_session=")

        status, _payload, headers = self.request(
            "POST", "/api/auth/login", {"phone": phone, "password": "Password8"},
        )
        self.assertEqual(status, 200)
        old_cookie = self.session_cookie(headers)
        self.now[0] += 61
        self.request("POST", "/api/auth/otp/start", {"phone": phone, "purpose": "recover"})
        code = self.sms.messages[-1][1]
        status, _payload, headers = self.request(
            "POST", "/api/auth/password/reset", {"phone": phone, "code": code, "password": "NewPassword9"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(self.session_cookie(headers))
        status, payload, _headers = self.request("GET", "/api/auth/status", cookie=old_cookie)
        self.assertEqual(status, 200)
        self.assertFalse(payload["authenticated"])

    def test_first_ai_request_starts_trial_and_expiry_requires_account(self):
        body = {"title": "综合全盘分析报告", "context": "这是一段长度足够的确定性排盘结果，用于测试匿名体验访问控制。"}
        status, payload, headers = self.request("POST", "/api/ai/interpret", body)
        self.assertEqual(status, 202)
        self.assertEqual(payload["access"], "trial")
        trial_cookie = self.session_cookie(headers, "tianji_trial")
        self.assertTrue(trial_cookie)
        trial_set_cookie = next(
            value for header, value in headers
            if header.lower() == "set-cookie" and value.startswith("tianji_trial=")
        )
        self.assertIn("Max-Age=31536000", trial_set_cookie)

        self.now[0] += 24 * 3600 + 1
        status, payload, _headers = self.request("POST", "/api/ai/interpret", body, cookie=trial_cookie)
        self.assertEqual(status, 401)
        self.assertEqual(payload["code"], "AUTH_REQUIRED")
        status, payload, _headers = self.request("POST", "/api/auth/trial/start", {}, cookie=trial_cookie)
        self.assertEqual(status, 401)
        self.assertEqual(payload["code"], "AUTH_REQUIRED")

    def test_manual_payment_routes_require_login_and_owner_review(self):
        status, payload, _headers = self.request(
            "POST", "/api/billing/manual/order",
            {"plan": "monthly", "provider": "wechat", "payment_reference": "202607200123"},
        )
        self.assertEqual(status, 401)
        self.assertEqual(payload["code"], "AUTH_REQUIRED")

        _member, member_cookie = self.register("17606669594")
        status, payload, _headers = self.request(
            "POST", "/api/billing/manual/order",
            {"plan": "monthly", "provider": "wechat", "payment_reference": "202607200123"},
            cookie=member_cookie,
        )
        self.assertEqual(status, 200)
        order_id = payload["order"]["id"]
        status, payload, _headers = self.request(
            "POST", "/api/billing/manual/approve", {"order_id": order_id}, cookie=member_cookie,
        )
        self.assertEqual(status, 403)
        self.assertEqual(payload["code"], "OWNER_REQUIRED")

        owner, owner_cookie = self.register("13800138000")
        self.assertTrue(owner["account"]["is_owner"])
        fake_png = b"\x89PNG\r\n\x1a\n" + b"\0" * 1024
        status, payload, _headers = self.request(
            "POST", "/api/billing/manual/qr/upload",
            {"provider": "wechat", "image_base64": base64.b64encode(fake_png).decode("ascii")},
            cookie=owner_cookie,
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["provider"], "wechat")
        status, payload, _headers = self.request("GET", "/api/billing/config")
        self.assertEqual(status, 200)
        self.assertEqual(payload["manual_payment_methods"], ["wechat"])

        status, payload, _headers = self.request(
            "POST", "/api/billing/manual/approve", {"order_id": order_id}, cookie=owner_cookie,
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["order"]["status"], "approved")
        status, payload, _headers = self.request("GET", "/api/auth/status", cookie=member_cookie)
        self.assertEqual(status, 200)
        self.assertTrue(payload["account"]["active"])
        self.assertEqual(payload["account"]["plan"], "monthly")


if __name__ == "__main__":
    unittest.main()
