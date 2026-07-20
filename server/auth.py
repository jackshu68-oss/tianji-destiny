"""Phone authentication, SMS verification and anonymous trial access."""

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone


PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")
PASSWORD_LETTER = re.compile(r"[A-Za-z]")
PASSWORD_DIGIT = re.compile(r"\d")
ACTIVE_PLANS = {"monthly", "yearly"}
WELCOME_PLAN = "welcome"
FULL_ACCESS_PLANS = ACTIVE_PLANS | {WELCOME_PLAN}
PLAN_DAYS = {"monthly": 30, "yearly": 365}
PLAN_PRICES_CNY = {"monthly": 39, "yearly": 299}
PAYMENT_PROVIDERS = {"wechat", "alipay"}
DEFAULT_OWNER_PHONE = "+8617606669594"


class AuthError(Exception):
    def __init__(self, status, code, message):
        super().__init__(code)
        self.status = int(status)
        self.code = str(code)
        self.message = str(message)


def normalise_phone(value):
    compact = re.sub(r"[\s()-]", "", str(value or "").strip())
    if compact.startswith("0086"):
        compact = compact[4:]
    elif compact.startswith("+86"):
        compact = compact[3:]
    if not PHONE_PATTERN.fullmatch(compact):
        raise AuthError(400, "INVALID_PHONE", "请输入有效的中国大陆手机号码。")
    return "+86{}".format(compact)


def validate_password(value):
    password = str(value or "")
    if not 8 <= len(password) <= 72:
        raise AuthError(400, "INVALID_PASSWORD", "密码须为 8 至 72 个字符。")
    if not PASSWORD_LETTER.search(password) or not PASSWORD_DIGIT.search(password):
        raise AuthError(400, "INVALID_PASSWORD", "密码须同时包含英文字母和数字。")
    return password


def password_hash(password, iterations=310000):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.urlsafe_b64encode(salt).decode("ascii").rstrip("="),
        base64.urlsafe_b64encode(digest).decode("ascii").rstrip("="),
    )


def verify_password(password, encoded):
    try:
        algorithm, iterations, salt_text, digest_text = str(encoded or "").split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_text + "=" * (-len(salt_text) % 4))
        expected = base64.urlsafe_b64decode(digest_text + "=" * (-len(digest_text) % 4))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (TypeError, ValueError):
        return False


class AliyunSmsSender:
    host = "dypnsapi.aliyuncs.com"
    action = "SendSmsVerifyCode"
    version = "2017-05-25"
    algorithm = "ACS3-HMAC-SHA256"

    def __init__(self, access_key_id, access_key_secret, sign_name, template_code, transport=None):
        self.access_key_id = str(access_key_id or "").strip()
        self.access_key_secret = str(access_key_secret or "").strip()
        self.sign_name = str(sign_name or "").strip()
        self.template_code = str(template_code or "").strip()
        self.transport = transport

    @property
    def configured(self):
        return all((self.access_key_id, self.access_key_secret, self.sign_name, self.template_code))

    @staticmethod
    def _percent_encode(value):
        return urllib.parse.quote(str(value), safe="").replace("~", "%7E")

    @classmethod
    def _canonical_query(cls, params):
        return "&".join(
            "{}={}".format(cls._percent_encode(key), cls._percent_encode(params[key]))
            for key in sorted(params)
        )

    def send(self, phone, code):
        if not self.configured:
            raise AuthError(503, "SMS_NOT_CONFIGURED", "短信服务仍在配置中，请稍后再试。")
        domestic_phone = normalise_phone(phone)[3:]
        now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        nonce = str(uuid.uuid4())
        query_values = {
            "CountryCode": "86",
            "PhoneNumber": domestic_phone,
            "SignName": self.sign_name,
            "TemplateCode": self.template_code,
            "TemplateParam": json.dumps({"code": code, "min": "5"}, ensure_ascii=False, separators=(",", ":")),
            "ValidTime": "300",
            "Interval": "60",
            "DuplicatePolicy": "1",
            "ReturnVerifyCode": "false",
        }
        hashed_payload = hashlib.sha256(b"").hexdigest()
        signed_headers = {
            "host": self.host,
            "x-acs-action": self.action,
            "x-acs-content-sha256": hashed_payload,
            "x-acs-date": now,
            "x-acs-signature-nonce": nonce,
            "x-acs-version": self.version,
        }
        header_names = sorted(signed_headers)
        canonical_headers = "".join("{}:{}\n".format(name, signed_headers[name]) for name in header_names)
        signed_header_names = ";".join(header_names)
        query = self._canonical_query(query_values)
        canonical_request = "\n".join((
            "POST", "/", query, canonical_headers, signed_header_names, hashed_payload,
        ))
        string_to_sign = "{}\n{}".format(
            self.algorithm,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        )
        signature = hmac.new(
            self.access_key_secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha256,
        ).hexdigest()
        authorization = "{} Credential={},SignedHeaders={},Signature={}".format(
            self.algorithm, self.access_key_id, signed_header_names, signature,
        )
        headers = {
            "Authorization": authorization,
            "x-acs-action": self.action,
            "x-acs-content-sha256": hashed_payload,
            "x-acs-date": now,
            "x-acs-signature-nonce": nonce,
            "x-acs-version": self.version,
        }
        if self.transport:
            result = self.transport("https://{}/?{}".format(self.host, query), headers)
        else:
            request = urllib.request.Request(
                "https://{}/?{}".format(self.host, query), data=b"", headers=headers, method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    result = json.loads(response.read().decode("utf-8"))
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as error:
                raise AuthError(502, "SMS_DELIVERY_FAILED", "短信验证码发送失败，请稍后再试。") from error
        if not isinstance(result, dict) or result.get("Code") != "OK":
            raise AuthError(502, "SMS_DELIVERY_FAILED", "短信验证码发送失败，请稍后再试。")
        return True


class SupabaseOtpProvider:
    """Use an existing Supabase Auth phone flow and its configured SMS hook."""

    external_verification = True

    def __init__(self, url, anon_key, transport=None):
        self.url = str(url or "").strip().rstrip("/")
        self.anon_key = str(anon_key or "").strip()
        self.transport = transport

    @property
    def configured(self):
        return self.url.startswith("https://") and bool(self.anon_key)

    def _request(self, path, payload):
        if not self.configured:
            raise AuthError(503, "SMS_NOT_CONFIGURED", "短信服务仍在配置中，请稍后再试。")
        target = "{}{}".format(self.url, path)
        headers = {
            "apikey": self.anon_key,
            "Authorization": "Bearer {}".format(self.anon_key),
            "Content-Type": "application/json",
        }
        if self.transport:
            return self.transport(target, headers, payload)
        request = urllib.request.Request(
            target,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return int(response.status), json.loads(response.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as error:
            try:
                body = json.loads(error.read().decode("utf-8") or "{}")
            except (UnicodeDecodeError, ValueError):
                body = {}
            return int(error.code), body
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            raise AuthError(502, "SMS_DELIVERY_FAILED", "短信服务暂时不可用，请稍后再试。") from error

    def start(self, phone, _purpose):
        status, _result = self._request("/auth/v1/otp", {
            "phone": normalise_phone(phone),
            "create_user": True,
            "data": {"source": "daofainsight"},
        })
        if status == 429:
            raise AuthError(429, "OTP_RATE_LIMIT", "验证码发送次数过多，请稍后再试。")
        if not 200 <= status < 300:
            raise AuthError(502, "SMS_DELIVERY_FAILED", "短信验证码发送失败，请稍后再试。")
        return True

    def verify(self, phone, code, _purpose):
        status, result = self._request("/auth/v1/verify", {
            "phone": normalise_phone(phone),
            "token": str(code or "").strip(),
            "type": "sms",
        })
        if status == 429:
            raise AuthError(429, "OTP_RATE_LIMIT", "验证码尝试次数过多，请稍后再试。")
        if not 200 <= status < 300 or not isinstance(result, dict) or not result.get("user"):
            raise AuthError(401, "OTP_INVALID", "验证码错误或已过期。")
        return True


class AuthService:
    def __init__(self, database_path, environ=None, sms_sender=None, clock=None):
        env = environ if environ is not None else os.environ
        self.database_path = str(database_path)
        self.secret = str(env.get("TIANJI_AUTH_SECRET", "")).strip() or secrets.token_urlsafe(48)
        self.session_seconds = max(3600, int(env.get("TIANJI_AUTH_SESSION_DAYS", "30")) * 86400)
        self.trial_seconds = max(3600, int(env.get("TIANJI_TRIAL_HOURS", "24")) * 3600)
        self.welcome_seconds = max(86400, int(env.get("TIANJI_WELCOME_TRIAL_DAYS", "3")) * 86400)
        self.trial_marker_seconds = max(
            self.trial_seconds,
            int(env.get("TIANJI_TRIAL_MARKER_DAYS", "365")) * 86400,
        )
        self.otp_seconds = max(120, int(env.get("TIANJI_OTP_SECONDS", "300")))
        self.plan_prices_cny = {}
        for plan, env_name in (("monthly", "TIANJI_PRICE_30D_CNY"), ("yearly", "TIANJI_PRICE_365D_CNY")):
            raw_price = str(env.get(env_name, PLAN_PRICES_CNY[plan])).strip()
            match = re.search(r"\d+", raw_price)
            self.plan_prices_cny[plan] = max(1, int(match.group(0))) if match else PLAN_PRICES_CNY[plan]
        try:
            self.owner_phone = normalise_phone(env.get("TIANJI_OWNER_PHONE", DEFAULT_OWNER_PHONE))
        except AuthError:
            self.owner_phone = DEFAULT_OWNER_PHONE
        self._clock = clock or time.time
        provider = str(env.get("TIANJI_SMS_PROVIDER", "aliyun")).strip().lower()
        if sms_sender:
            self.sms = sms_sender
        elif provider == "supabase":
            self.sms = SupabaseOtpProvider(
                env.get("TIANJI_SUPABASE_URL"),
                env.get("TIANJI_SUPABASE_ANON_KEY"),
            )
        else:
            self.sms = AliyunSmsSender(
                env.get("ALIYUN_PNVS_ACCESS_KEY_ID"),
                env.get("ALIYUN_PNVS_ACCESS_KEY_SECRET"),
                env.get("ALIYUN_PNVS_SIGN_NAME"),
                env.get("ALIYUN_PNVS_TEMPLATE_CODE"),
            )

    @property
    def sms_enabled(self):
        return bool(getattr(self.sms, "configured", True))

    def _connection(self):
        directory = os.path.dirname(self.database_path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        connection = sqlite3.connect(self.database_path, timeout=8)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(
            """CREATE TABLE IF NOT EXISTS auth_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                plan TEXT NOT NULL DEFAULT 'free',
                plan_expires INTEGER NOT NULL DEFAULT 0,
                created INTEGER NOT NULL,
                updated INTEGER NOT NULL,
                last_login INTEGER NOT NULL DEFAULT 0
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS auth_otps (
                phone TEXT NOT NULL,
                purpose TEXT NOT NULL,
                code_hash TEXT NOT NULL,
                expires INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                sent_at INTEGER NOT NULL,
                PRIMARY KEY(phone, purpose)
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS auth_otp_limits (
                phone TEXT PRIMARY KEY,
                window_start INTEGER NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                last_sent INTEGER NOT NULL DEFAULT 0
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created INTEGER NOT NULL,
                expires INTEGER NOT NULL,
                last_seen INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE
            )"""
        )
        connection.execute("CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id)")
        connection.execute(
            """CREATE TABLE IF NOT EXISTS auth_trials (
                token_hash TEXT PRIMARY KEY,
                created INTEGER NOT NULL,
                expires INTEGER NOT NULL,
                last_seen INTEGER NOT NULL
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS membership_orders (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                plan TEXT NOT NULL,
                provider TEXT NOT NULL,
                amount_cny INTEGER NOT NULL,
                payment_reference TEXT NOT NULL,
                payer_name TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                created INTEGER NOT NULL,
                updated INTEGER NOT NULL,
                reviewed_by INTEGER,
                reviewed_at INTEGER NOT NULL DEFAULT 0,
                review_note TEXT NOT NULL DEFAULT '',
                FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
                FOREIGN KEY(reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL
            )"""
        )
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS membership_order_reference_idx ON membership_orders(provider,payment_reference)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS membership_order_user_idx ON membership_orders(user_id,created DESC)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS membership_order_status_idx ON membership_orders(status,created ASC)"
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS membership_grants (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                plan TEXT NOT NULL,
                days INTEGER NOT NULL,
                source TEXT NOT NULL DEFAULT 'support',
                note TEXT NOT NULL DEFAULT '',
                previous_expires INTEGER NOT NULL DEFAULT 0,
                new_expires INTEGER NOT NULL,
                created INTEGER NOT NULL,
                granted_by INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
                FOREIGN KEY(granted_by) REFERENCES auth_users(id) ON DELETE RESTRICT
            )"""
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS membership_grant_user_idx ON membership_grants(user_id,created DESC)"
        )
        connection.commit()
        return connection

    @staticmethod
    def _token_hash(token):
        return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()

    def _otp_hash(self, phone, purpose, code):
        message = "{}\0{}\0{}".format(phone, purpose, code).encode("utf-8")
        return hmac.new(self.secret.encode("utf-8"), message, hashlib.sha256).hexdigest()

    @staticmethod
    def _purpose(value):
        purpose = str(value or "").strip().lower()
        if purpose not in ("register", "recover"):
            raise AuthError(400, "INVALID_PURPOSE", "验证码用途无效。")
        return purpose

    @staticmethod
    def _phone_hint(phone):
        domestic = str(phone or "").replace("+86", "", 1)
        return "{}****{}".format(domestic[:3], domestic[-4:])

    def start_otp(self, raw_phone, raw_purpose):
        phone = normalise_phone(raw_phone)
        purpose = self._purpose(raw_purpose)
        now = int(self._clock())
        connection = self._connection()
        try:
            user = connection.execute("SELECT id FROM auth_users WHERE phone = ?", (phone,)).fetchone()
            if purpose == "register" and user:
                raise AuthError(409, "ACCOUNT_EXISTS", "该手机号已注册，请直接登录。")
            if purpose == "recover" and not user:
                return {"ok": True, "masked": self._phone_hint(phone), "message": "如账号存在，验证码将发送到该手机。"}
            limit = connection.execute("SELECT * FROM auth_otp_limits WHERE phone = ?", (phone,)).fetchone()
            if limit:
                if now - int(limit["last_sent"]) < 60:
                    raise AuthError(429, "OTP_COOLDOWN", "请等待一分钟后再发送验证码。")
                if now - int(limit["window_start"]) < 3600 and int(limit["count"]) >= 5:
                    raise AuthError(429, "OTP_RATE_LIMIT", "本小时验证码发送次数已达上限。")
            if getattr(self.sms, "external_verification", False):
                code = ""
                self.sms.start(phone, purpose)
            else:
                code = "{:06d}".format(secrets.randbelow(1000000))
                self.sms.send(phone, code)
            if not limit or now - int(limit["window_start"]) >= 3600:
                connection.execute(
                    "INSERT OR REPLACE INTO auth_otp_limits(phone,window_start,count,last_sent) VALUES(?,?,1,?)",
                    (phone, now, now),
                )
            else:
                connection.execute(
                    "UPDATE auth_otp_limits SET count=count+1,last_sent=? WHERE phone=?", (now, phone),
                )
            connection.execute(
                "INSERT OR REPLACE INTO auth_otps(phone,purpose,code_hash,expires,attempts,sent_at) VALUES(?,?,?,?,0,?)",
                (phone, purpose, self._otp_hash(phone, purpose, code) if code else "external", now + self.otp_seconds, now),
            )
            connection.commit()
        finally:
            connection.close()
        return {"ok": True, "masked": self._phone_hint(phone), "message": "验证码已发送。"}

    def _consume_otp(self, connection, phone, purpose, raw_code, now):
        code = str(raw_code or "").strip()
        if not re.fullmatch(r"\d{6}", code):
            raise AuthError(400, "INVALID_OTP", "请输入六位验证码。")
        record = connection.execute(
            "SELECT * FROM auth_otps WHERE phone=? AND purpose=?", (phone, purpose),
        ).fetchone()
        if not record or int(record["expires"]) < now or int(record["attempts"]) >= 5:
            raise AuthError(401, "OTP_EXPIRED", "验证码错误或已过期。")
        if getattr(self.sms, "external_verification", False):
            try:
                self.sms.verify(phone, code, purpose)
            except AuthError as error:
                if error.code == "OTP_INVALID":
                    connection.execute(
                        "UPDATE auth_otps SET attempts=attempts+1 WHERE phone=? AND purpose=?", (phone, purpose),
                    )
                    connection.commit()
                raise
        elif not hmac.compare_digest(record["code_hash"], self._otp_hash(phone, purpose, code)):
            connection.execute(
                "UPDATE auth_otps SET attempts=attempts+1 WHERE phone=? AND purpose=?", (phone, purpose),
            )
            connection.commit()
            raise AuthError(401, "OTP_INVALID", "验证码错误或已过期。")
        connection.execute("DELETE FROM auth_otps WHERE phone=? AND purpose=?", (phone, purpose))

    def _new_session(self, connection, user_id, now):
        token = secrets.token_urlsafe(36)
        connection.execute(
            "INSERT INTO auth_sessions(token_hash,user_id,created,expires,last_seen) VALUES(?,?,?,?,?)",
            (self._token_hash(token), int(user_id), now, now + self.session_seconds, now),
        )
        return token

    def register(self, raw_phone, raw_code, raw_password):
        phone = normalise_phone(raw_phone)
        password = validate_password(raw_password)
        now = int(self._clock())
        connection = self._connection()
        try:
            connection.execute("BEGIN IMMEDIATE")
            if connection.execute("SELECT 1 FROM auth_users WHERE phone=?", (phone,)).fetchone():
                raise AuthError(409, "ACCOUNT_EXISTS", "该手机号已注册，请直接登录。")
            self._consume_otp(connection, phone, "register", raw_code, now)
            cursor = connection.execute(
                "INSERT INTO auth_users(phone,password_hash,plan,plan_expires,created,updated,last_login) VALUES(?,?,?,?,?,?,?)",
                (phone, password_hash(password), WELCOME_PLAN, now + self.welcome_seconds, now, now, now),
            )
            token = self._new_session(connection, cursor.lastrowid, now)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
        return {"ok": True, "session_token": token, "account": self.status(token, "")["account"]}

    def login(self, raw_phone, raw_password):
        phone = normalise_phone(raw_phone)
        password = str(raw_password or "")
        now = int(self._clock())
        connection = self._connection()
        try:
            user = connection.execute("SELECT * FROM auth_users WHERE phone=?", (phone,)).fetchone()
            if not user or not verify_password(password, user["password_hash"]):
                raise AuthError(401, "INVALID_CREDENTIALS", "手机号或密码不正确。")
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM auth_sessions WHERE expires < ?", (now,))
            token = self._new_session(connection, user["id"], now)
            connection.execute("UPDATE auth_users SET last_login=?,updated=? WHERE id=?", (now, now, user["id"]))
            connection.commit()
        finally:
            connection.close()
        return {"ok": True, "session_token": token, "account": self.status(token, "")["account"]}

    def reset_password(self, raw_phone, raw_code, raw_password):
        phone = normalise_phone(raw_phone)
        password = validate_password(raw_password)
        now = int(self._clock())
        connection = self._connection()
        try:
            connection.execute("BEGIN IMMEDIATE")
            user = connection.execute("SELECT * FROM auth_users WHERE phone=?", (phone,)).fetchone()
            if not user:
                raise AuthError(401, "OTP_INVALID", "验证码错误或已过期。")
            self._consume_otp(connection, phone, "recover", raw_code, now)
            connection.execute(
                "UPDATE auth_users SET password_hash=?,updated=? WHERE id=?",
                (password_hash(password), now, user["id"]),
            )
            connection.execute("DELETE FROM auth_sessions WHERE user_id=?", (user["id"],))
            token = self._new_session(connection, user["id"], now)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
        return {"ok": True, "session_token": token, "account": self.status(token, "")["account"]}

    def _session_user(self, session_token):
        token = str(session_token or "").strip()
        if len(token) < 24:
            return None
        now = int(self._clock())
        connection = self._connection()
        try:
            row = connection.execute(
                """SELECT u.* FROM auth_sessions s
                   JOIN auth_users u ON u.id=s.user_id
                   WHERE s.token_hash=? AND s.expires>=?""",
                (self._token_hash(token), now),
            ).fetchone()
            if row:
                connection.execute(
                    "UPDATE auth_sessions SET last_seen=? WHERE token_hash=?", (now, self._token_hash(token)),
                )
                connection.commit()
            return row
        finally:
            connection.close()

    def logout(self, session_token):
        token = str(session_token or "").strip()
        if token:
            connection = self._connection()
            try:
                connection.execute("DELETE FROM auth_sessions WHERE token_hash=?", (self._token_hash(token),))
                connection.commit()
            finally:
                connection.close()
        return {"ok": True}

    def _public_account(self, user):
        if not user:
            return None
        now = int(self._clock())
        owner = str(user["phone"] or "") == self.owner_phone
        plan = "owner" if owner else str(user["plan"] or "free")
        expires = 0 if owner else int(user["plan_expires"] or 0)
        active = owner or (plan in FULL_ACCESS_PLANS and expires > now)
        welcome = not owner and plan == WELCOME_PLAN and active
        return {
            "id": int(user["id"]),
            "phone_hint": self._phone_hint(user["phone"]),
            "plan": "free" if welcome else (plan if active else "free"),
            "active": active,
            "plan_expires": expires if active and not welcome else 0,
            "role": "owner" if owner else ("member" if active and not welcome else "free"),
            "is_owner": owner,
        }

    def _trial(self, trial_token):
        token = str(trial_token or "").strip()
        if len(token) < 24:
            return None
        now = int(self._clock())
        connection = self._connection()
        try:
            row = connection.execute(
                "SELECT * FROM auth_trials WHERE token_hash=?", (self._token_hash(token),),
            ).fetchone()
            if row and int(row["expires"]) >= now:
                connection.execute(
                    "UPDATE auth_trials SET last_seen=? WHERE token_hash=?", (now, self._token_hash(token)),
                )
                connection.commit()
                return row
            return None
        finally:
            connection.close()

    def status(self, session_token, trial_token):
        user = self._session_user(session_token)
        account = self._public_account(user)
        if account:
            return {"ok": True, "authenticated": True, "account": account, "trial": None, "sms_enabled": self.sms_enabled}
        trial = self._trial(trial_token)
        return {
            "ok": True,
            "authenticated": False,
            "account": None,
            "trial": {
                "active": bool(trial),
                "expires": int(trial["expires"]) if trial else 0,
                "started": bool(str(trial_token or "").strip()),
            },
            "sms_enabled": self.sms_enabled,
        }

    def start_trial(self, session_token, trial_token):
        user = self._session_user(session_token)
        account = self._public_account(user)
        if account:
            return {"ok": True, "authenticated": True, "account": account, "trial_token": ""}
        trial = self._trial(trial_token)
        if trial:
            return {
                "ok": True,
                "authenticated": False,
                "trial": {"active": True, "expires": int(trial["expires"]), "started": True},
                "trial_token": "",
            }
        if str(trial_token or "").strip():
            raise AuthError(401, "AUTH_REQUIRED", "免费体验已结束，请使用手机号注册或登录。")
        now = int(self._clock())
        token = secrets.token_urlsafe(36)
        connection = self._connection()
        try:
            connection.execute(
                "INSERT INTO auth_trials(token_hash,created,expires,last_seen) VALUES(?,?,?,?)",
                (self._token_hash(token), now, now + self.trial_seconds, now),
            )
            connection.commit()
        finally:
            connection.close()
        return {
            "ok": True,
            "authenticated": False,
            "trial": {"active": True, "expires": now + self.trial_seconds, "started": True},
            "trial_token": token,
        }

    def authorise_ai(self, session_token, trial_token):
        user = self._session_user(session_token)
        account = self._public_account(user)
        if account:
            if account["active"]:
                return {"allowed": True, "tier": "pro", "account": account, "trial_token": ""}
            raise AuthError(402, "MEMBERSHIP_REQUIRED", "免费版可使用基础查询；详细解读需要会员。")
        trial = self._trial(trial_token)
        if trial:
            return {
                "allowed": False,
                "tier": "guest",
                "code": "DETAIL_LOGIN_REQUIRED",
                "message": "详细解读需要先使用手机号注册或登录。",
                "account": None,
                "trial_token": "",
                "trial_expires": int(trial["expires"]),
            }
        if str(trial_token or "").strip():
            raise AuthError(401, "AUTH_REQUIRED", "免费体验已结束，请使用手机号注册或登录。")
        started = self.start_trial(session_token, trial_token)
        token = started["trial_token"]
        expires = int(started["trial"]["expires"])
        return {
            "allowed": False,
            "tier": "guest",
            "code": "DETAIL_LOGIN_REQUIRED",
            "message": "详细解读需要先使用手机号注册或登录。",
            "account": None,
            "trial_token": token,
            "trial_expires": expires,
        }

    def _require_user(self, session_token):
        user = self._session_user(session_token)
        if not user:
            raise AuthError(401, "AUTH_REQUIRED", "请先使用手机号登录。")
        return user

    def _require_owner(self, session_token):
        user = self._require_user(session_token)
        if str(user["phone"] or "") != self.owner_phone:
            raise AuthError(403, "OWNER_REQUIRED", "只有站主可以审核会员申请。")
        return user

    @staticmethod
    def _public_order(row):
        if not row:
            return None
        return {
            "id": str(row["id"]),
            "plan": str(row["plan"]),
            "provider": str(row["provider"]),
            "amount_cny": int(row["amount_cny"]),
            "payment_reference": str(row["payment_reference"]),
            "payer_name": str(row["payer_name"] or ""),
            "status": str(row["status"]),
            "created": int(row["created"]),
            "updated": int(row["updated"]),
            "reviewed_at": int(row["reviewed_at"] or 0),
            "review_note": str(row["review_note"] or ""),
        }

    def _public_grant(self, row, include_phone=False):
        if not row:
            return None
        grant = {
            "id": str(row["id"]),
            "plan": str(row["plan"]),
            "days": int(row["days"]),
            "source": str(row["source"] or "support"),
            "note": str(row["note"] or ""),
            "previous_expires": int(row["previous_expires"] or 0),
            "new_expires": int(row["new_expires"] or 0),
            "created": int(row["created"]),
        }
        if include_phone and "phone" in row.keys():
            grant["phone_hint"] = self._phone_hint(row["phone"])
        return grant

    def create_membership_order(self, session_token, raw_plan, raw_provider, raw_reference, raw_payer_name=""):
        user = self._require_user(session_token)
        account = self._public_account(user)
        if account.get("is_owner"):
            raise AuthError(409, "OWNER_ALREADY_ACTIVE", "站主账号已经永久拥有全部权限，无需付款。")
        plan = str(raw_plan or "").strip().lower()
        provider = str(raw_provider or "").strip().lower()
        reference = re.sub(r"\s+", "", str(raw_reference or "").strip())
        payer_name = str(raw_payer_name or "").strip()[:40]
        if plan not in PLAN_DAYS:
            raise AuthError(400, "INVALID_PLAN", "请选择有效的会员方案。")
        if provider not in PAYMENT_PROVIDERS:
            raise AuthError(400, "INVALID_PAYMENT_PROVIDER", "请选择微信或支付宝。")
        if not re.fullmatch(r"[A-Za-z0-9_-]{6,64}", reference):
            raise AuthError(400, "INVALID_PAYMENT_REFERENCE", "请输入付款详情中的交易单号。")
        now = int(self._clock())
        order_id = "DF{}{}".format(time.strftime("%y%m%d", time.gmtime(now)), secrets.token_hex(4).upper())
        connection = self._connection()
        try:
            connection.execute("BEGIN IMMEDIATE")
            duplicate = connection.execute(
                "SELECT id FROM membership_orders WHERE provider=? AND payment_reference=?",
                (provider, reference),
            ).fetchone()
            if duplicate:
                raise AuthError(409, "PAYMENT_ALREADY_SUBMITTED", "这个交易单号已经提交过。")
            connection.execute(
                """INSERT INTO membership_orders(
                    id,user_id,plan,provider,amount_cny,payment_reference,payer_name,status,created,updated
                ) VALUES(?,?,?,?,?,?,?,'pending',?,?)""",
                (order_id, int(user["id"]), plan, provider, self.plan_prices_cny[plan], reference, payer_name, now, now),
            )
            row = connection.execute("SELECT * FROM membership_orders WHERE id=?", (order_id,)).fetchone()
            connection.commit()
        except sqlite3.IntegrityError:
            connection.rollback()
            raise AuthError(409, "PAYMENT_ALREADY_SUBMITTED", "这个交易单号已经提交过。")
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
        return {"ok": True, "order": self._public_order(row)}

    def list_membership_orders(self, session_token):
        user = self._require_user(session_token)
        owner = str(user["phone"] or "") == self.owner_phone
        connection = self._connection()
        try:
            if owner:
                rows = connection.execute(
                    """SELECT o.*, u.phone FROM membership_orders o
                       JOIN auth_users u ON u.id=o.user_id
                       ORDER BY CASE o.status WHEN 'pending' THEN 0 ELSE 1 END, o.created DESC LIMIT 100"""
                ).fetchall()
                grant_rows = connection.execute(
                    """SELECT g.*, u.phone FROM membership_grants g
                       JOIN auth_users u ON u.id=g.user_id
                       ORDER BY g.created DESC, g.rowid DESC LIMIT 50"""
                ).fetchall()
            else:
                rows = connection.execute(
                    "SELECT * FROM membership_orders WHERE user_id=? ORDER BY created DESC LIMIT 20",
                    (int(user["id"]),),
                ).fetchall()
                grant_rows = []
        finally:
            connection.close()
        orders = []
        for row in rows:
            item = self._public_order(row)
            if owner:
                item["phone_hint"] = self._phone_hint(row["phone"])
            orders.append(item)
        grants = [self._public_grant(row, include_phone=True) for row in grant_rows]
        return {"ok": True, "owner": owner, "orders": orders, "grants": grants}

    def grant_membership(self, session_token, raw_phone, raw_plan, raw_note=""):
        owner = self._require_owner(session_token)
        phone = normalise_phone(raw_phone)
        plan = str(raw_plan or "").strip().lower()
        note = str(raw_note or "").strip()[:160]
        if plan not in PLAN_DAYS:
            raise AuthError(400, "INVALID_PLAN", "请选择 30 天或 365 天会员。")
        if phone == self.owner_phone:
            raise AuthError(409, "OWNER_ALREADY_ACTIVE", "站主账号已经永久拥有全部权限。")
        now = int(self._clock())
        grant_id = "DFG{}{}".format(time.strftime("%y%m%d", time.gmtime(now)), secrets.token_hex(4).upper())
        connection = self._connection()
        try:
            connection.execute("BEGIN IMMEDIATE")
            target = connection.execute("SELECT * FROM auth_users WHERE phone=?", (phone,)).fetchone()
            if not target:
                raise AuthError(404, "ACCOUNT_NOT_FOUND", "没有找到这个手机号对应的已注册账号。")
            previous_expires = int(target["plan_expires"] or 0)
            base = max(now, previous_expires if str(target["plan"] or "") in FULL_ACCESS_PLANS else 0)
            days = PLAN_DAYS[plan]
            new_expires = base + days * 86400
            connection.execute(
                "UPDATE auth_users SET plan=?,plan_expires=?,updated=? WHERE id=?",
                (plan, new_expires, now, int(target["id"])),
            )
            connection.execute(
                """INSERT INTO membership_grants(
                    id,user_id,plan,days,source,note,previous_expires,new_expires,created,granted_by
                ) VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (
                    grant_id, int(target["id"]), plan, days, "support", note,
                    previous_expires, new_expires, now, int(owner["id"]),
                ),
            )
            updated = connection.execute("SELECT * FROM auth_users WHERE id=?", (int(target["id"]),)).fetchone()
            grant_row = connection.execute(
                """SELECT g.*, u.phone FROM membership_grants g
                   JOIN auth_users u ON u.id=g.user_id WHERE g.id=?""",
                (grant_id,),
            ).fetchone()
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
        return {
            "ok": True,
            "account": self._public_account(updated),
            "grant": self._public_grant(grant_row, include_phone=True),
        }

    def review_membership_order(self, session_token, raw_order_id, approve, raw_note=""):
        owner = self._require_owner(session_token)
        order_id = str(raw_order_id or "").strip().upper()
        note = str(raw_note or "").strip()[:160]
        if not re.fullmatch(r"DF\d{6}[A-F0-9]{8}", order_id):
            raise AuthError(400, "INVALID_ORDER", "会员申请编号无效。")
        now = int(self._clock())
        connection = self._connection()
        try:
            connection.execute("BEGIN IMMEDIATE")
            order = connection.execute("SELECT * FROM membership_orders WHERE id=?", (order_id,)).fetchone()
            if not order:
                raise AuthError(404, "ORDER_NOT_FOUND", "没有找到这项会员申请。")
            if str(order["status"]) != "pending":
                raise AuthError(409, "ORDER_ALREADY_REVIEWED", "这项会员申请已经处理。")
            status = "approved" if approve else "rejected"
            if approve:
                target = connection.execute("SELECT * FROM auth_users WHERE id=?", (int(order["user_id"]),)).fetchone()
                if not target:
                    raise AuthError(404, "ACCOUNT_NOT_FOUND", "申请账号已经不存在。")
                current_expires = int(target["plan_expires"] or 0)
                base = max(now, current_expires if str(target["plan"] or "") in FULL_ACCESS_PLANS else 0)
                expires = base + PLAN_DAYS[str(order["plan"])] * 86400
                connection.execute(
                    "UPDATE auth_users SET plan=?,plan_expires=?,updated=? WHERE id=?",
                    (str(order["plan"]), expires, now, int(order["user_id"])),
                )
            connection.execute(
                """UPDATE membership_orders SET status=?,updated=?,reviewed_by=?,reviewed_at=?,review_note=?
                   WHERE id=?""",
                (status, now, int(owner["id"]), now, note, order_id),
            )
            reviewed = connection.execute("SELECT * FROM membership_orders WHERE id=?", (order_id,)).fetchone()
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
        return {"ok": True, "order": self._public_order(reviewed)}
