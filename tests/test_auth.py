import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from server.auth import AuthError, AuthService, SupabaseOtpProvider, normalise_phone, validate_password, verify_password


class FakeSms:
    configured = True

    def __init__(self):
        self.messages = []

    def send(self, phone, code):
        self.messages.append((phone, code))


class FakeExternalOtp:
    configured = True
    external_verification = True

    def __init__(self):
        self.started = []
        self.verified = []

    def start(self, phone, purpose):
        self.started.append((phone, purpose))

    def verify(self, phone, code, purpose):
        self.verified.append((phone, code, purpose))
        if code != "654321":
            raise AuthError(401, "OTP_INVALID", "验证码错误或已过期。")


class AuthServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / "auth.sqlite3"
        self.now = [1_800_000_000]
        self.sms = FakeSms()
        self.service = AuthService(
            self.database,
            environ={
                "TIANJI_AUTH_SECRET": "test-secret-that-is-long-enough",
                "TIANJI_TRIAL_HOURS": "24",
                "TIANJI_TRIAL_MARKER_DAYS": "365",
                "TIANJI_AUTH_SESSION_DAYS": "30",
                "TIANJI_OWNER_PHONE": "13800138000",
            },
            sms_sender=self.sms,
            clock=lambda: self.now[0],
        )

    def tearDown(self):
        self.temp.cleanup()

    def register(self, phone="17606669594", password="Password8"):
        self.service.start_otp(phone, "register")
        code = self.sms.messages[-1][1]
        return self.service.register(phone, code, password)

    def test_phone_and_password_validation(self):
        self.assertEqual(normalise_phone("176-0666-9594"), "+8617606669594")
        self.assertEqual(normalise_phone("0086 176 0666 9594"), "+8617606669594")
        with self.assertRaises(AuthError):
            normalise_phone("123")
        self.assertEqual(validate_password("Password8"), "Password8")
        with self.assertRaises(AuthError):
            validate_password("onlyletters")

    def test_register_password_login_and_logout(self):
        result = self.register()
        token = result["session_token"]
        self.assertTrue(self.service.status(token, "")["authenticated"])
        self.assertEqual(result["account"]["phone_hint"], "176****9594")
        self.service.logout(token)
        self.assertFalse(self.service.status(token, "")["authenticated"])
        with self.assertRaises(AuthError) as context:
            self.service.login("17606669594", "WrongPassword8")
        self.assertEqual(context.exception.code, "INVALID_CREDENTIALS")
        login = self.service.login("+86 176 0666 9594", "Password8")
        self.assertTrue(self.service.status(login["session_token"], "")["authenticated"])

    def test_password_recovery_revokes_old_sessions(self):
        registration = self.register()
        old_token = registration["session_token"]
        self.now[0] += 61
        self.service.start_otp("17606669594", "recover")
        code = self.sms.messages[-1][1]
        reset = self.service.reset_password("17606669594", code, "NewPassword9")
        self.assertFalse(self.service.status(old_token, "")["authenticated"])
        self.assertTrue(self.service.status(reset["session_token"], "")["authenticated"])
        with self.assertRaises(AuthError):
            self.service.login("17606669594", "Password8")
        self.assertTrue(self.service.login("17606669594", "NewPassword9")["ok"])

    def test_otp_limits_and_single_use(self):
        self.service.start_otp("17606669594", "register")
        code = self.sms.messages[-1][1]
        with self.assertRaises(AuthError) as context:
            self.service.start_otp("17606669594", "register")
        self.assertEqual(context.exception.code, "OTP_COOLDOWN")
        self.service.register("17606669594", code, "Password8")
        with self.assertRaises(AuthError):
            self.service.register("17606669594", code, "Password8")

    def test_anonymous_trial_then_account_membership_gate(self):
        access = self.service.authorise_ai("", "")
        self.assertEqual(access["tier"], "trial")
        trial_token = access["trial_token"]
        self.assertTrue(self.service.status("", trial_token)["trial"]["active"])
        self.assertEqual(self.service.authorise_ai("", trial_token)["tier"], "trial")
        self.now[0] += 24 * 3600 + 1
        expired = self.service.status("", trial_token)["trial"]
        self.assertTrue(expired["started"])
        self.assertFalse(expired["active"])
        with self.assertRaises(AuthError) as context:
            self.service.start_trial("", trial_token)
        self.assertEqual(context.exception.code, "AUTH_REQUIRED")
        with self.assertRaises(AuthError) as context:
            self.service.authorise_ai("", trial_token)
        self.assertEqual(context.exception.code, "AUTH_REQUIRED")

        registration = self.register()
        session = registration["session_token"]
        with self.assertRaises(AuthError) as context:
            self.service.authorise_ai(session, "")
        self.assertEqual(context.exception.code, "MEMBERSHIP_REQUIRED")

        connection = sqlite3.connect(self.database)
        connection.execute(
            "UPDATE auth_users SET plan='monthly', plan_expires=?", (self.now[0] + 30 * 86400,),
        )
        connection.commit()
        connection.close()
        self.assertEqual(self.service.authorise_ai(session, "")["tier"], "pro")

    def test_owner_has_permanent_access_without_membership_charge(self):
        owner = self.register(phone="13800138000")
        account = owner["account"]
        self.assertTrue(account["active"])
        self.assertTrue(account["is_owner"])
        self.assertEqual(account["plan"], "owner")
        self.assertEqual(account["plan_expires"], 0)
        self.assertEqual(self.service.authorise_ai(owner["session_token"], "")["tier"], "pro")
        with self.assertRaises(AuthError) as context:
            self.service.create_membership_order(
                owner["session_token"], "monthly", "wechat", "202607200001", "站主",
            )
        self.assertEqual(context.exception.code, "OWNER_ALREADY_ACTIVE")

    def test_manual_membership_order_requires_owner_review(self):
        member = self.register()
        order = self.service.create_membership_order(
            member["session_token"], "monthly", "wechat", "202607200001", "测试付款人",
        )["order"]
        self.assertEqual(order["amount_cny"], 39)
        self.assertEqual(order["status"], "pending")
        own_orders = self.service.list_membership_orders(member["session_token"])
        self.assertFalse(own_orders["owner"])
        self.assertEqual([item["id"] for item in own_orders["orders"]], [order["id"]])
        with self.assertRaises(AuthError) as context:
            self.service.create_membership_order(
                member["session_token"], "yearly", "wechat", "202607200001", "测试付款人",
            )
        self.assertEqual(context.exception.code, "PAYMENT_ALREADY_SUBMITTED")
        with self.assertRaises(AuthError) as context:
            self.service.review_membership_order(member["session_token"], order["id"], True)
        self.assertEqual(context.exception.code, "OWNER_REQUIRED")

        owner = self.register(phone="13800138000")
        owner_orders = self.service.list_membership_orders(owner["session_token"])
        self.assertTrue(owner_orders["owner"])
        self.assertEqual(owner_orders["orders"][0]["phone_hint"], "176****9594")
        reviewed = self.service.review_membership_order(
            owner["session_token"], order["id"], True, "已核对到账",
        )["order"]
        self.assertEqual(reviewed["status"], "approved")
        account = self.service.status(member["session_token"], "")["account"]
        self.assertTrue(account["active"])
        self.assertEqual(account["plan"], "monthly")
        self.assertEqual(account["plan_expires"], self.now[0] + 30 * 86400)
        self.assertEqual(self.service.authorise_ai(member["session_token"], "")["tier"], "pro")
        with self.assertRaises(AuthError) as context:
            self.service.review_membership_order(owner["session_token"], order["id"], False)
        self.assertEqual(context.exception.code, "ORDER_ALREADY_REVIEWED")

        renewal = self.service.create_membership_order(
            member["session_token"], "yearly", "alipay", "202607200002", "测试付款人",
        )["order"]
        self.service.review_membership_order(owner["session_token"], renewal["id"], True)
        renewed = self.service.status(member["session_token"], "")["account"]
        self.assertEqual(renewed["plan"], "yearly")
        self.assertEqual(renewed["plan_expires"], self.now[0] + (30 + 365) * 86400)

    def test_password_hash_is_not_plaintext(self):
        result = self.register(password="Password8")
        connection = sqlite3.connect(self.database)
        encoded = connection.execute("SELECT password_hash FROM auth_users").fetchone()[0]
        connection.close()
        self.assertNotIn("Password8", encoded)
        self.assertTrue(verify_password("Password8", encoded))
        self.assertFalse(verify_password("Password9", encoded))
        self.assertTrue(result["ok"])

    def test_external_supabase_otp_verification(self):
        external = FakeExternalOtp()
        service = AuthService(
            self.database,
            environ={"TIANJI_AUTH_SECRET": "external-test-secret-that-is-long-enough"},
            sms_sender=external,
            clock=lambda: self.now[0],
        )
        service.start_otp("17606669594", "register")
        self.assertEqual(external.started, [("+8617606669594", "register")])
        with self.assertRaises(AuthError):
            service.register("17606669594", "111111", "Password8")
        result = service.register("17606669594", "654321", "Password8")
        self.assertTrue(result["ok"])
        self.assertEqual(external.verified[-1], ("+8617606669594", "654321", "register"))

    def test_supabase_provider_requests_otp_and_verifies_user(self):
        calls = []

        def transport(url, headers, payload):
            calls.append((url, headers, payload))
            if url.endswith("/verify"):
                return 200, {"user": {"id": "test-user"}}
            return 200, {}

        provider = SupabaseOtpProvider("https://example.supabase.co", "anon-key", transport=transport)
        provider.start("17606669594", "register")
        provider.verify("17606669594", "123456", "register")
        self.assertEqual(calls[0][2]["phone"], "+8617606669594")
        self.assertEqual(calls[1][2]["token"], "123456")
        self.assertNotIn("anon-key", json.dumps([call[2] for call in calls]))


if __name__ == "__main__":
    unittest.main()
