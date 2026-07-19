import sqlite3
import tempfile
import unittest
from pathlib import Path

from server.auth import AuthError, AuthService, normalise_phone, validate_password, verify_password


class FakeSms:
    configured = True

    def __init__(self):
        self.messages = []

    def send(self, phone, code):
        self.messages.append((phone, code))


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
                "TIANJI_AUTH_SESSION_DAYS": "30",
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

    def test_password_hash_is_not_plaintext(self):
        result = self.register(password="Password8")
        connection = sqlite3.connect(self.database)
        encoded = connection.execute("SELECT password_hash FROM auth_users").fetchone()[0]
        connection.close()
        self.assertNotIn("Password8", encoded)
        self.assertTrue(verify_password("Password8", encoded))
        self.assertFalse(verify_password("Password9", encoded))
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
