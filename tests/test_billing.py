import hashlib
import hmac
import json
import pathlib
import tempfile
import time
import unittest
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

from server.billing import BillingError, BillingService


class FakeStripe:
    def __init__(self):
        self.calls = []
        self.claim = ""

    def __call__(self, method, path, params):
        self.calls.append((method, path, params))
        if method == "POST" and path == "/v1/checkout/sessions":
            success = urllib.parse.urlparse(params["success_url"])
            self.claim = urllib.parse.parse_qs(success.query)["claim"][0]
            return {"id": "cs_test_123", "url": "https://checkout.stripe.test/session"}
        if method == "GET" and path == "/v1/checkout/sessions/cs_test_123":
            return {
                "id": "cs_test_123",
                "status": "complete",
                "payment_status": "paid",
                "customer": "cus_test_123",
                "customer_details": {"email": "member@example.com"},
                "subscription": {
                    "id": "sub_test_123",
                    "status": "active",
                    "current_period_end": 2000000000,
                    "items": {"data": [{"price": {"id": "price_monthly"}}]},
                },
            }
        if method == "POST" and path == "/v1/billing_portal/sessions":
            return {"url": "https://billing.stripe.test/portal"}
        raise AssertionError("Unexpected Stripe request: {} {}".format(method, path))


class BillingTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = pathlib.Path(self.temp_dir.name) / "billing.sqlite3"
        self.stripe = FakeStripe()
        self.sent_codes = []
        self.environ = {
            "TIANJI_PAYMENT_PROVIDER": "stripe",
            "STRIPE_SECRET_KEY": "sk_test_secret",
            "STRIPE_WEBHOOK_SECRET": "whsec_test_secret",
            "STRIPE_PRICE_MONTHLY_CAD": "price_monthly",
            "STRIPE_PRICE_YEARLY_CAD": "price_yearly",
            "TIANJI_PUBLIC_ORIGIN": "https://example.test",
            "TIANJI_RECOVERY_SECRET": "recovery-test-secret",
            "TIANJI_AI_PRO_DAY": "2",
        }
        self.service = BillingService(
            self.database,
            environ=self.environ,
            stripe_transport=self.stripe,
            mail_sender=lambda email, code: self.sent_codes.append((email, code)),
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def checkout_and_claim(self):
        checkout = self.service.create_checkout("monthly", "Member@Example.com")
        claimed = self.service.claim_checkout(checkout["session_id"], self.stripe.claim)
        return checkout, claimed

    def test_china_pending_configuration_never_pretends_to_checkout(self):
        service = BillingService(self.database, environ={})
        config = service.public_config()
        self.assertFalse(config["enabled"])
        self.assertEqual(config["provider"], "china")
        self.assertEqual(config["currency"], "CNY")
        self.assertFalse(config["recurring"])
        self.assertEqual([plan["price"] for plan in config["plans"]], ["¥39", "¥299"])
        self.assertEqual([method["id"] for method in config["payment_methods"]], ["alipay", "wechat_pay"])
        with self.assertRaises(BillingError) as context:
            service.create_checkout("monthly", "member@example.com", "alipay")
        self.assertEqual(context.exception.code, "CHINA_MERCHANT_PENDING")

    def test_stripe_keys_do_not_enable_china_pending_mode(self):
        service = BillingService(self.database, environ={
            "STRIPE_SECRET_KEY": "sk_live_should_not_activate",
            "STRIPE_WEBHOOK_SECRET": "whsec_should_not_activate",
            "STRIPE_PRICE_MONTHLY_CAD": "price_monthly",
            "STRIPE_PRICE_YEARLY_CAD": "price_yearly",
            "TIANJI_BILLING_CURRENCY": "CAD",
            "TIANJI_PRICE_MONTHLY_DISPLAY": "CA$9.99",
        })
        self.assertFalse(service.enabled)
        config = service.public_config()
        self.assertEqual(config["provider"], "china")
        self.assertEqual(config["currency"], "CNY")
        self.assertEqual(config["plans"][0]["price"], "¥39")

    def test_checkout_claim_status_and_portal(self):
        checkout, claimed = self.checkout_and_claim()
        self.assertEqual(checkout["url"], "https://checkout.stripe.test/session")
        self.assertTrue(claimed["entitlement"]["active"])
        self.assertEqual(claimed["entitlement"]["plan"], "monthly")
        status = self.service.status(claimed["access_token"])
        self.assertEqual(status["entitlement"]["email_hint"], "me***@example.com")
        portal = self.service.create_portal(claimed["access_token"])
        self.assertEqual(portal["url"], "https://billing.stripe.test/portal")

    def test_checkout_claim_is_one_time(self):
        checkout, _claimed = self.checkout_and_claim()
        with self.assertRaises(BillingError) as context:
            self.service.claim_checkout(checkout["session_id"], self.stripe.claim)
        self.assertEqual(context.exception.code, "ALREADY_CLAIMED")

    def test_concurrent_claim_and_quota_are_atomic(self):
        checkout = self.service.create_checkout("monthly", "member@example.com")

        def claim_once():
            try:
                result = self.service.claim_checkout(checkout["session_id"], self.stripe.claim)
                return "ok", result["access_token"]
            except BillingError as error:
                return error.code, ""

        with ThreadPoolExecutor(max_workers=2) as pool:
            claims = list(pool.map(lambda _index: claim_once(), range(2)))
        self.assertEqual([status for status, _token in claims].count("ok"), 1)
        self.assertEqual([status for status, _token in claims].count("ALREADY_CLAIMED"), 1)

        token = next(token for status, token in claims if status == "ok")
        with ThreadPoolExecutor(max_workers=6) as pool:
            usage = list(pool.map(lambda _index: self.service.consume_pro_usage(token)[0], range(6)))
        self.assertEqual(usage.count(True), 2)
        self.assertEqual(usage.count(False), 4)

    def sign_event(self, event, timestamp=None):
        raw = json.dumps(event, separators=(",", ":")).encode("utf-8")
        stamp = int(time.time() if timestamp is None else timestamp)
        digest = hmac.new(
            self.environ["STRIPE_WEBHOOK_SECRET"].encode("utf-8"),
            str(stamp).encode("ascii") + b"." + raw,
            hashlib.sha256,
        ).hexdigest()
        return raw, "t={},v1={}".format(stamp, digest)

    def test_webhook_signature_and_idempotency(self):
        event = {
            "id": "evt_checkout_123",
            "type": "checkout.session.completed",
            "data": {"object": {
                "customer": "cus_webhook_123",
                "subscription": "sub_webhook_123",
                "payment_status": "paid",
                "customer_details": {"email": "webhook@example.com"},
                "metadata": {"plan": "yearly"},
            }},
        }
        raw, signature = self.sign_event(event)
        first = self.service.handle_webhook(raw, signature)
        second = self.service.handle_webhook(raw, signature)
        self.assertFalse(first["duplicate"])
        self.assertTrue(second["duplicate"])

        with self.assertRaises(BillingError) as context:
            self.service.handle_webhook(raw, "t=1,v1=wrong", now=1)
        self.assertEqual(context.exception.code, "INVALID_WEBHOOK_SIGNATURE")

    def test_recovery_rotates_device_token_without_disclosing_account(self):
        _checkout, claimed = self.checkout_and_claim()
        response = self.service.start_recovery("member@example.com")
        self.assertTrue(response["ok"])
        self.assertEqual(len(self.sent_codes), 1)
        email, code = self.sent_codes[0]
        recovered = self.service.verify_recovery(email, code)
        self.assertTrue(recovered["entitlement"]["active"])
        self.assertNotEqual(recovered["access_token"], claimed["access_token"])
        self.assertFalse(self.service.status(claimed["access_token"])["entitlement"]["authenticated"])

        unknown = self.service.start_recovery("unknown@example.com")
        self.assertEqual(unknown["message"], response["message"])
        self.assertEqual(len(self.sent_codes), 1)

    def test_pro_usage_has_independent_daily_limit(self):
        _checkout, claimed = self.checkout_and_claim()
        token = claimed["access_token"]
        self.assertEqual(self.service.consume_pro_usage(token)[0], True)
        self.assertEqual(self.service.consume_pro_usage(token)[0], True)
        allowed, account_id = self.service.consume_pro_usage(token)
        self.assertFalse(allowed)
        self.assertIsNotNone(account_id)
        self.assertEqual(self.service.consume_pro_usage("invalid"), (False, None))


if __name__ == "__main__":
    unittest.main()
