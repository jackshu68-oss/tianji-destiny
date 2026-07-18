"""Membership billing and entitlement support for the Tianji web app."""

import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage


ACTIVE_STATUSES = {"active", "trialing"}
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class BillingError(Exception):
    def __init__(self, status, code, message):
        super().__init__(code)
        self.status = int(status)
        self.code = str(code)
        self.message = str(message)


class BillingService:
    def __init__(self, database_path, environ=None, stripe_transport=None, mail_sender=None):
        env = environ if environ is not None else os.environ
        self.database_path = str(database_path)
        self.provider = str(env.get("TIANJI_PAYMENT_PROVIDER", "apple_iap_pending")).strip().lower()
        self.web_checkout_enabled = str(env.get("TIANJI_WEB_CHECKOUT_ENABLED", "0")).strip().lower() in ("1", "true", "yes")
        self.secret_key = str(env.get("STRIPE_SECRET_KEY", "")).strip()
        self.webhook_secret = str(env.get("STRIPE_WEBHOOK_SECRET", "")).strip()
        self.price_monthly = str(env.get("STRIPE_PRICE_MONTHLY_CAD", "")).strip()
        self.price_yearly = str(env.get("STRIPE_PRICE_YEARLY_CAD", "")).strip()
        self.public_origin = str(env.get("TIANJI_PUBLIC_ORIGIN", "https://daofainsight.com")).strip().rstrip("/")
        self.api_version = str(env.get("STRIPE_API_VERSION", "2025-06-30.basil")).strip()
        if self.provider == "stripe":
            self.currency = str(env.get("TIANJI_BILLING_CURRENCY", "CAD")).strip().upper() or "CAD"
            self.monthly_display = str(env.get("TIANJI_PRICE_MONTHLY_DISPLAY", "CA$9.99")).strip()
            self.yearly_display = str(env.get("TIANJI_PRICE_YEARLY_DISPLAY", "CA$79")).strip()
        else:
            self.currency = "CNY"
            self.monthly_display = str(env.get("TIANJI_PRICE_30D_CNY", "¥39")).strip()
            self.yearly_display = str(env.get("TIANJI_PRICE_365D_CNY", "¥299")).strip()
        self.pro_ai_day = max(1, int(env.get("TIANJI_AI_PRO_DAY", "100")))
        self.recovery_secret = str(env.get("TIANJI_RECOVERY_SECRET", self.webhook_secret or self.secret_key)).strip()
        self.smtp_host = str(env.get("SMTP_HOST", "")).strip()
        self.smtp_port = int(env.get("SMTP_PORT", "587"))
        self.smtp_user = str(env.get("SMTP_USER", "")).strip()
        self.smtp_password = str(env.get("SMTP_PASSWORD", "")).strip()
        self.smtp_from = str(env.get("SMTP_FROM", "")).strip()
        self.smtp_starttls = str(env.get("SMTP_STARTTLS", "1")).strip() not in ("0", "false", "False")
        self._stripe_transport = stripe_transport
        self._mail_sender = mail_sender

    @property
    def enabled(self):
        return self.web_checkout_enabled and self.provider == "stripe" and bool(
            self.secret_key and self.webhook_secret and self.price_monthly and self.price_yearly
        )

    @property
    def recovery_enabled(self):
        return self.provider == "stripe" and bool(
            self.recovery_secret and ((self.smtp_host and self.smtp_from) or self._mail_sender)
        )

    def public_config(self):
        apple_mode = self.provider != "stripe"
        return {
            "ok": True,
            "enabled": self.enabled,
            "recovery_enabled": self.recovery_enabled,
            "currency": self.currency,
            "provider": "apple_iap" if apple_mode else "stripe",
            "recurring": False if apple_mode else True,
            "payment_methods": [],
            "plans": [
                {"id": "monthly", "price": self.monthly_display, "period": "30_days" if apple_mode else "month", "product_id": "com.daofainsight.pro.30days" if apple_mode else ""},
                {"id": "yearly", "price": self.yearly_display, "period": "365_days" if apple_mode else "year", "product_id": "com.daofainsight.pro.365days" if apple_mode else ""},
            ],
        }

    def _connection(self):
        directory = os.path.dirname(self.database_path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        connection = sqlite3.connect(self.database_path, timeout=8)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(
            """CREATE TABLE IF NOT EXISTS billing_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                plan TEXT NOT NULL DEFAULT 'free',
                status TEXT NOT NULL DEFAULT 'inactive',
                current_period_end INTEGER NOT NULL DEFAULT 0,
                access_hash TEXT,
                created INTEGER NOT NULL,
                updated INTEGER NOT NULL
            )"""
        )
        connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS billing_customer_idx ON billing_accounts(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id != ''")
        connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS billing_subscription_idx ON billing_accounts(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id != ''")
        connection.execute("CREATE INDEX IF NOT EXISTS billing_access_idx ON billing_accounts(access_hash)")
        connection.execute(
            """CREATE TABLE IF NOT EXISTS billing_claims (
                session_id TEXT PRIMARY KEY,
                claim_hash TEXT NOT NULL,
                email TEXT NOT NULL,
                plan TEXT NOT NULL,
                created INTEGER NOT NULL,
                claimed INTEGER NOT NULL DEFAULT 0
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS billing_events (
                event_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                created INTEGER NOT NULL
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS billing_recovery (
                email TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                updated INTEGER NOT NULL
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS billing_usage (
                account_id INTEGER NOT NULL,
                kind TEXT NOT NULL,
                day TEXT NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(account_id, kind, day)
            )"""
        )
        connection.commit()
        return connection

    @staticmethod
    def _token_hash(token):
        return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()

    @staticmethod
    def _normalise_email(value):
        email = str(value or "").strip().lower()[:254]
        if not EMAIL_PATTERN.match(email):
            raise BillingError(400, "INVALID_EMAIL", "请填写有效的邮箱地址。")
        return email

    def _plan_price(self, plan):
        key = str(plan or "").strip().lower()
        prices = {"monthly": self.price_monthly, "yearly": self.price_yearly}
        if key not in prices or not prices[key]:
            raise BillingError(400, "INVALID_PLAN", "请选择有效的会员方案。")
        return key, prices[key]

    def _plan_from_price(self, price_id, fallback="monthly"):
        if price_id and price_id == self.price_yearly:
            return "yearly"
        if price_id and price_id == self.price_monthly:
            return "monthly"
        return fallback if fallback in ("monthly", "yearly") else "monthly"

    def _stripe(self, method, path, params=None):
        if self._stripe_transport:
            return self._stripe_transport(method, path, params or {})
        if not self.secret_key:
            raise BillingError(503, "BILLING_NOT_CONFIGURED", "支付商户仍在配置中，请稍后再试。")
        fields = params or {}
        encoded = urllib.parse.urlencode(fields, doseq=True)
        url = "https://api.stripe.com{}".format(path)
        data = None
        if method.upper() == "GET" and encoded:
            url = "{}?{}".format(url, encoded)
        elif method.upper() != "GET":
            data = encoded.encode("utf-8")
        request = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": "Bearer {}".format(self.secret_key),
                "Content-Type": "application/x-www-form-urlencoded",
                "Stripe-Version": self.api_version,
                "User-Agent": "Tianji-Billing/1.0",
            },
            method=method.upper(),
        )
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            try:
                detail = json.loads(error.read().decode("utf-8"))
                message = ((detail.get("error") or {}).get("message") or "Stripe request failed")[:240]
            except (ValueError, UnicodeDecodeError):
                message = "Stripe request failed"
            raise BillingError(502, "PAYMENT_PROVIDER_ERROR", message) from error
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            raise BillingError(502, "PAYMENT_PROVIDER_UNAVAILABLE", "支付服务暂时无法连接，请稍后再试。") from error

    def create_checkout(self, plan, email, payment_method=None):
        if self.provider != "stripe":
            plan = str(plan or "").strip().lower()
            if plan not in ("monthly", "yearly"):
                raise BillingError(400, "INVALID_PLAN", "请选择有效的会员方案。")
            self._normalise_email(email)
            raise BillingError(409, "APPLE_IAP_REQUIRED", "网页付款已关闭；iOS 数字会员仅通过 Apple App 内购买。")
        if not self.enabled:
            raise BillingError(503, "BILLING_NOT_CONFIGURED", "支付商户仍在审核或配置中。")
        plan, price_id = self._plan_price(plan)
        email = self._normalise_email(email)
        claim_token = secrets.token_urlsafe(32)
        success_url = "{}/pricing/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}&claim={}".format(
            self.public_origin, urllib.parse.quote(claim_token, safe="")
        )
        payload = self._stripe("POST", "/v1/checkout/sessions", {
            "mode": "subscription",
            "line_items[0][price]": price_id,
            "line_items[0][quantity]": "1",
            "customer_email": email,
            "success_url": success_url,
            "cancel_url": "{}/pricing/?checkout=cancelled".format(self.public_origin),
            "allow_promotion_codes": "true",
            "metadata[plan]": plan,
            "subscription_data[metadata][plan]": plan,
        })
        session_id = str(payload.get("id") or "")
        checkout_url = str(payload.get("url") or "")
        if not session_id.startswith("cs_") or not checkout_url.startswith("https://"):
            raise BillingError(502, "INVALID_CHECKOUT_SESSION", "支付服务没有返回有效的结账页面。")
        now = int(time.time())
        connection = self._connection()
        try:
            connection.execute(
                "INSERT OR REPLACE INTO billing_claims(session_id,claim_hash,email,plan,created,claimed) VALUES(?,?,?,?,?,0)",
                (session_id, self._token_hash(claim_token), email, plan, now),
            )
            connection.commit()
        finally:
            connection.close()
        return {"ok": True, "url": checkout_url, "session_id": session_id}

    def _upsert_account(self, connection, email, customer_id, subscription_id, plan, status, period_end, access_hash=None):
        now = int(time.time())
        row = None
        if customer_id:
            row = connection.execute("SELECT * FROM billing_accounts WHERE stripe_customer_id = ?", (customer_id,)).fetchone()
        if not row and subscription_id:
            row = connection.execute("SELECT * FROM billing_accounts WHERE stripe_subscription_id = ?", (subscription_id,)).fetchone()
        if not row and email:
            row = connection.execute("SELECT * FROM billing_accounts WHERE email = ?", (email,)).fetchone()
        if row:
            connection.execute(
                """UPDATE billing_accounts SET email=?, stripe_customer_id=?, stripe_subscription_id=?,
                   plan=?, status=?, current_period_end=?, access_hash=COALESCE(?,access_hash), updated=? WHERE id=?""",
                (email or row["email"], customer_id or row["stripe_customer_id"], subscription_id or row["stripe_subscription_id"],
                 plan or row["plan"], status or row["status"], int(period_end or row["current_period_end"] or 0), access_hash, now, row["id"]),
            )
            return int(row["id"])
        cursor = connection.execute(
            """INSERT INTO billing_accounts(email,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end,access_hash,created,updated)
               VALUES(?,?,?,?,?,?,?,?,?)""",
            (email, customer_id or None, subscription_id or None, plan or "monthly", status or "inactive", int(period_end or 0), access_hash, now, now),
        )
        return int(cursor.lastrowid)

    def _subscription_details(self, session, fallback_plan):
        subscription = session.get("subscription")
        if isinstance(subscription, dict):
            details = subscription
        elif subscription:
            details = self._stripe("GET", "/v1/subscriptions/{}".format(urllib.parse.quote(str(subscription), safe="")))
        else:
            details = {}
        items = (((details.get("items") or {}).get("data")) or []) if isinstance(details, dict) else []
        price_id = ""
        if items and isinstance(items[0], dict):
            price = items[0].get("price") or {}
            price_id = str(price.get("id") if isinstance(price, dict) else price or "")
        return {
            "id": str(details.get("id") or subscription or ""),
            "status": str(details.get("status") or ("active" if session.get("payment_status") == "paid" else "inactive")),
            "period_end": int(details.get("current_period_end") or 0),
            "plan": self._plan_from_price(price_id, fallback_plan),
        }

    def claim_checkout(self, session_id, claim_token):
        session_id = str(session_id or "").strip()
        claim_token = str(claim_token or "").strip()
        if not session_id.startswith("cs_") or len(claim_token) < 24:
            raise BillingError(400, "INVALID_CLAIM", "付款确认资料无效。")
        connection = self._connection()
        try:
            claim = connection.execute("SELECT * FROM billing_claims WHERE session_id = ?", (session_id,)).fetchone()
        finally:
            connection.close()
        if not claim or not hmac.compare_digest(claim["claim_hash"], self._token_hash(claim_token)):
            raise BillingError(403, "INVALID_CLAIM", "付款确认资料无效或已过期。")
        if claim["claimed"]:
            raise BillingError(409, "ALREADY_CLAIMED", "该付款已领取；可使用邮箱恢复会员权限。")
        session = self._stripe("GET", "/v1/checkout/sessions/{}".format(urllib.parse.quote(session_id, safe="")), {"expand[]": "subscription"})
        if session.get("status") != "complete" or session.get("payment_status") not in ("paid", "no_payment_required"):
            raise BillingError(409, "PAYMENT_NOT_COMPLETE", "付款尚未完成，请返回支付页面确认。")
        customer_details = session.get("customer_details") if isinstance(session.get("customer_details"), dict) else {}
        email = self._normalise_email(customer_details.get("email") or session.get("customer_email") or claim["email"])
        customer_id = str(session.get("customer") or "")
        subscription = self._subscription_details(session, claim["plan"])
        if subscription["status"] not in ACTIVE_STATUSES:
            raise BillingError(409, "SUBSCRIPTION_NOT_ACTIVE", "订阅尚未生效，请稍后再检查。")
        access_token = secrets.token_urlsafe(36)
        connection = self._connection()
        try:
            connection.execute("BEGIN IMMEDIATE")
            current_claim = connection.execute(
                "SELECT claim_hash, claimed FROM billing_claims WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            if (
                not current_claim
                or not hmac.compare_digest(current_claim["claim_hash"], self._token_hash(claim_token))
                or current_claim["claimed"]
            ):
                connection.rollback()
                raise BillingError(409, "ALREADY_CLAIMED", "该付款已领取；可使用邮箱恢复会员权限。")
            self._upsert_account(
                connection, email, customer_id, subscription["id"], subscription["plan"],
                subscription["status"], subscription["period_end"], self._token_hash(access_token),
            )
            cursor = connection.execute(
                "UPDATE billing_claims SET claimed = 1 WHERE session_id = ? AND claimed = 0",
                (session_id,),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise BillingError(409, "ALREADY_CLAIMED", "该付款已领取；可使用邮箱恢复会员权限。")
            connection.commit()
        finally:
            connection.close()
        return {"ok": True, "access_token": access_token, "entitlement": self.status(access_token)["entitlement"]}

    def _account_for_token(self, access_token):
        token = str(access_token or "").strip()
        if len(token) < 24:
            return None
        connection = self._connection()
        try:
            return connection.execute("SELECT * FROM billing_accounts WHERE access_hash = ?", (self._token_hash(token),)).fetchone()
        finally:
            connection.close()

    def _public_entitlement(self, row):
        if not row:
            return {"authenticated": False, "active": False, "plan": "free", "status": "inactive", "current_period_end": 0}
        active = row["status"] in ACTIVE_STATUSES and row["plan"] in ("monthly", "yearly")
        return {
            "authenticated": True,
            "active": active,
            "plan": row["plan"] if active else "free",
            "status": row["status"],
            "current_period_end": int(row["current_period_end"] or 0),
            "email_hint": self._email_hint(row["email"]),
        }

    @staticmethod
    def _email_hint(email):
        name, domain = str(email or "").split("@", 1)
        visible = name[:2] if len(name) > 2 else name[:1]
        return "{}***@{}".format(visible, domain)

    def status(self, access_token):
        return {"ok": True, "enabled": self.enabled, "entitlement": self._public_entitlement(self._account_for_token(access_token))}

    def create_portal(self, access_token):
        if self.provider != "stripe":
            raise BillingError(409, "NO_RECURRING_BILLING", "人民币会员到期不会自动扣款，无需取消续费。")
        account = self._account_for_token(access_token)
        if not account or account["status"] not in ACTIVE_STATUSES or not account["stripe_customer_id"]:
            raise BillingError(403, "NO_ACTIVE_SUBSCRIPTION", "未找到可管理的有效订阅。")
        payload = self._stripe("POST", "/v1/billing_portal/sessions", {
            "customer": account["stripe_customer_id"],
            "return_url": "{}/pricing/".format(self.public_origin),
        })
        url = str(payload.get("url") or "")
        if not url.startswith("https://"):
            raise BillingError(502, "INVALID_PORTAL_SESSION", "暂时无法打开订阅管理页面。")
        return {"ok": True, "url": url}

    def _verify_webhook(self, raw_body, signature_header, now=None):
        if not self.webhook_secret:
            raise BillingError(503, "WEBHOOK_NOT_CONFIGURED", "Webhook 尚未配置。")
        values = {}
        for part in str(signature_header or "").split(","):
            if "=" not in part:
                continue
            key, value = part.split("=", 1)
            values.setdefault(key.strip(), []).append(value.strip())
        try:
            timestamp = int((values.get("t") or [""])[0])
        except ValueError as error:
            raise BillingError(400, "INVALID_WEBHOOK_SIGNATURE", "Webhook 签名无效。") from error
        current = int(time.time() if now is None else now)
        if abs(current - timestamp) > 300:
            raise BillingError(400, "STALE_WEBHOOK", "Webhook 已超过有效时间。")
        signed = str(timestamp).encode("ascii") + b"." + raw_body
        expected = hmac.new(self.webhook_secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
        if not any(hmac.compare_digest(expected, candidate) for candidate in values.get("v1", [])):
            raise BillingError(400, "INVALID_WEBHOOK_SIGNATURE", "Webhook 签名无效。")

    def handle_webhook(self, raw_body, signature_header, now=None):
        if self.provider != "stripe":
            raise BillingError(404, "UNSUPPORTED_PAYMENT_PROVIDER", "该支付回调未启用。")
        self._verify_webhook(raw_body, signature_header, now)
        try:
            event = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise BillingError(400, "INVALID_WEBHOOK_BODY", "Webhook 内容无效。") from error
        event_id = str(event.get("id") or "")[:160]
        event_type = str(event.get("type") or "")[:120]
        obj = ((event.get("data") or {}).get("object") or {}) if isinstance(event, dict) else {}
        if not event_id or not event_type or not isinstance(obj, dict):
            raise BillingError(400, "INVALID_WEBHOOK_BODY", "Webhook 内容无效。")
        connection = self._connection()
        try:
            if connection.execute("SELECT 1 FROM billing_events WHERE event_id = ?", (event_id,)).fetchone():
                return {"ok": True, "duplicate": True}
            if event_type == "checkout.session.completed":
                details = obj.get("customer_details") if isinstance(obj.get("customer_details"), dict) else {}
                raw_email = details.get("email") or obj.get("customer_email")
                if raw_email:
                    email = self._normalise_email(raw_email)
                    metadata = obj.get("metadata") if isinstance(obj.get("metadata"), dict) else {}
                    payment_status = str(obj.get("payment_status") or "")
                    self._upsert_account(
                        connection, email, str(obj.get("customer") or ""), str(obj.get("subscription") or ""),
                        str(metadata.get("plan") or "monthly"),
                        "active" if payment_status in ("paid", "no_payment_required") else "incomplete",
                        0,
                    )
            elif event_type in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
                customer_id = str(obj.get("customer") or "")
                row = connection.execute("SELECT * FROM billing_accounts WHERE stripe_customer_id = ?", (customer_id,)).fetchone()
                if row:
                    items = (((obj.get("items") or {}).get("data")) or [])
                    price = (items[0].get("price") or {}) if items and isinstance(items[0], dict) else {}
                    price_id = str(price.get("id") if isinstance(price, dict) else "")
                    metadata = obj.get("metadata") if isinstance(obj.get("metadata"), dict) else {}
                    plan = self._plan_from_price(price_id, str(metadata.get("plan") or row["plan"]))
                    status = "canceled" if event_type.endswith("deleted") else str(obj.get("status") or row["status"])
                    self._upsert_account(connection, row["email"], customer_id, str(obj.get("id") or ""), plan, status, int(obj.get("current_period_end") or 0))
            elif event_type in ("invoice.paid", "invoice.payment_failed"):
                status = "active" if event_type == "invoice.paid" else "past_due"
                connection.execute("UPDATE billing_accounts SET status=?, updated=? WHERE stripe_customer_id=?", (status, int(time.time()), str(obj.get("customer") or "")))
            connection.execute("INSERT INTO billing_events(event_id,event_type,created) VALUES(?,?,?)", (event_id, event_type, int(time.time())))
            connection.commit()
        finally:
            connection.close()
        return {"ok": True, "duplicate": False}

    def _recovery_hash(self, email, code):
        return hashlib.sha256("{}\0{}\0{}".format(self.recovery_secret, email, code).encode("utf-8")).hexdigest()

    def _send_recovery(self, email, code):
        if self._mail_sender:
            self._mail_sender(email, code)
            return
        message = EmailMessage()
        message["Subject"] = "道法自然会员恢复验证码 / DAOFA recovery code"
        message["From"] = self.smtp_from
        message["To"] = email
        message.set_content("您的验证码是：{}\n10 分钟内有效。\n\nYour recovery code is {} and expires in 10 minutes.".format(code, code))
        context = ssl.create_default_context()
        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20) as client:
            if self.smtp_starttls:
                client.starttls(context=context)
            if self.smtp_user:
                client.login(self.smtp_user, self.smtp_password)
            client.send_message(message)

    def start_recovery(self, raw_email):
        if not self.recovery_enabled:
            raise BillingError(503, "RECOVERY_NOT_CONFIGURED", "邮箱恢复服务仍在配置中。")
        email = self._normalise_email(raw_email)
        now = int(time.time())
        connection = self._connection()
        try:
            existing = connection.execute("SELECT * FROM billing_recovery WHERE email = ?", (email,)).fetchone()
            if existing and now - int(existing["updated"]) < 60:
                raise BillingError(429, "RECOVERY_RATE_LIMIT", "请稍候一分钟再重新发送。")
            account = connection.execute("SELECT * FROM billing_accounts WHERE email = ? AND status IN ('active','trialing')", (email,)).fetchone()
            if account:
                code = "{:06d}".format(secrets.randbelow(1000000))
                connection.execute(
                    "INSERT OR REPLACE INTO billing_recovery(email,code_hash,expires,attempts,updated) VALUES(?,?,?,?,?)",
                    (email, self._recovery_hash(email, code), now + 600, 0, now),
                )
                connection.commit()
                self._send_recovery(email, code)
        finally:
            connection.close()
        return {"ok": True, "message": "如果该邮箱有有效订阅，验证码会在几分钟内送达。"}

    def verify_recovery(self, raw_email, raw_code):
        if not self.recovery_enabled:
            raise BillingError(503, "RECOVERY_NOT_CONFIGURED", "邮箱恢复服务仍在配置中。")
        email = self._normalise_email(raw_email)
        code = str(raw_code or "").strip()
        if not (len(code) == 6 and code.isdigit()):
            raise BillingError(400, "INVALID_RECOVERY_CODE", "请输入六位验证码。")
        now = int(time.time())
        connection = self._connection()
        try:
            record = connection.execute("SELECT * FROM billing_recovery WHERE email = ?", (email,)).fetchone()
            if not record or int(record["expires"]) < now or int(record["attempts"]) >= 5:
                raise BillingError(400, "RECOVERY_EXPIRED", "验证码无效或已过期。")
            if not hmac.compare_digest(record["code_hash"], self._recovery_hash(email, code)):
                connection.execute("UPDATE billing_recovery SET attempts = attempts + 1 WHERE email = ?", (email,))
                connection.commit()
                raise BillingError(400, "INVALID_RECOVERY_CODE", "验证码无效或已过期。")
            account = connection.execute("SELECT * FROM billing_accounts WHERE email = ? AND status IN ('active','trialing')", (email,)).fetchone()
            if not account:
                raise BillingError(403, "NO_ACTIVE_SUBSCRIPTION", "未找到有效订阅。")
            access_token = secrets.token_urlsafe(36)
            connection.execute("UPDATE billing_accounts SET access_hash=?, updated=? WHERE id=?", (self._token_hash(access_token), now, account["id"]))
            connection.execute("DELETE FROM billing_recovery WHERE email = ?", (email,))
            connection.commit()
        finally:
            connection.close()
        return {"ok": True, "access_token": access_token, "entitlement": self.status(access_token)["entitlement"]}

    def consume_pro_usage(self, access_token, kind="ai"):
        account = self._account_for_token(access_token)
        if not account or account["status"] not in ACTIVE_STATUSES or account["plan"] not in ("monthly", "yearly"):
            return False, None
        day = time.strftime("%Y-%m-%d", time.gmtime())
        connection = self._connection()
        try:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT count FROM billing_usage WHERE account_id=? AND kind=? AND day=?", (account["id"], kind, day)).fetchone()
            count = int(row["count"] if row else 0)
            if count >= self.pro_ai_day:
                connection.rollback()
                return False, int(account["id"])
            connection.execute(
                "INSERT INTO billing_usage(account_id,kind,day,count) VALUES(?,?,?,1) ON CONFLICT(account_id,kind,day) DO UPDATE SET count=count+1",
                (account["id"], kind, day),
            )
            connection.commit()
            return True, int(account["id"])
        finally:
            connection.close()
