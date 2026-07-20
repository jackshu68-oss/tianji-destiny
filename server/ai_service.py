#!/usr/bin/env python3
"""Small same-origin AI interpretation service for the Tianji static site."""

import hashlib
import base64
import binascii
import json
import os
import pathlib
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

try:
    from billing import BillingError, BillingService
    from auth import AuthError, AuthService
except ModuleNotFoundError:
    from server.billing import BillingError, BillingService
    from server.auth import AuthError, AuthService


ROOT = pathlib.Path(__file__).resolve().parent
KNOWLEDGE = json.loads((ROOT / "knowledge.json").read_text(encoding="utf-8"))
API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash").strip()
BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
PORT = int(os.environ.get("TIANJI_AI_PORT", "8788"))
ALLOWED_HOSTS = {
    item.strip().lower()
    for item in os.environ.get(
        "TIANJI_ALLOWED_HOSTS",
        "tianji.47-86-31-98.sslip.io,daofainsight.com,www.daofainsight.com,127.0.0.1,localhost",
    ).split(",")
    if item.strip()
}
MAX_BODY_BYTES = 48 * 1024
MAX_CONTEXT_CHARS = 12000
MAX_STORAGE_BODY = 420 * 1024
MAX_QR_UPLOAD_BODY = 900 * 1024
CACHE_TTL = 12 * 60 * 60
JOB_TTL = 15 * 60
PER_IP_HOUR = int(os.environ.get("TIANJI_AI_PER_IP_HOUR", "20"))
GLOBAL_DAY = int(os.environ.get("TIANJI_AI_GLOBAL_DAY", "200"))

LOCK = threading.Lock()
CACHE = {}
JOBS = {}
PENDING_BY_DIGEST = {}
IP_REQUESTS = defaultdict(list)
GLOBAL_REQUESTS = defaultdict(int)
STORAGE_REQUESTS = defaultdict(list)
DATA_DIR = pathlib.Path(os.environ.get("TIANJI_DATA_DIR", "/tmp/tianji-ai-data"))
DATABASE_PATH = DATA_DIR / "private_store.sqlite3"
PAYMENT_QR_DIR = DATA_DIR / "payment_qr"
BILLING = BillingService(DATABASE_PATH)
AUTH = AuthService(DATABASE_PATH)
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def module_for(title):
    if "综合全盘" in title or "综合报告" in title or "全局报告" in title:
        return "integrated"
    if "星座" in title or "占星" in title:
        return "astrology"
    if "合婚" in title or "姻缘" in title:
        return "hehun"
    if "大运" in title or "流年" in title:
        return "dayun"
    if "紫微" in title:
        return "ziwei"
    if "梅花" in title:
        return "meihua"
    if "奇门" in title:
        return "qimen"
    if "塔罗" in title:
        return "tarot"
    if "雷诺曼" in title or "吉卜赛" in title:
        return "lenormand"
    return "bazi"


def normalize_analysis(value):
    if not isinstance(value, dict):
        return {
            "overview": str(value or "AI 暂未返回有效内容。"),
            "evidence": [],
            "reality": [],
            "timing": [],
            "risks": [],
            "stages": [],
            "actions": [],
            "caveat": "传统术数解读仅供文化研究与娱乐参考。",
        }
    result = {
        "overview": str(value.get("overview") or value.get("summary") or "").strip(),
        "evidence": value.get("evidence") if isinstance(value.get("evidence"), list) else [],
        "reality": value.get("reality") if isinstance(value.get("reality"), list) else [],
        "timing": value.get("timing") if isinstance(value.get("timing"), list) else [],
        "risks": value.get("risks") if isinstance(value.get("risks"), list) else [],
        "stages": value.get("stages") if isinstance(value.get("stages"), list) else [],
        "actions": value.get("actions") if isinstance(value.get("actions"), list) else [],
        "caveat": str(value.get("caveat") or "传统术数解读仅供文化研究与娱乐参考。").strip(),
    }
    for key in ("evidence", "reality", "timing", "risks", "stages", "actions"):
        result[key] = [str(item).strip() for item in result[key] if str(item).strip()][:6]
    return result


def parse_model_json(content):
    text = (content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if len(lines) > 2 else lines).strip()
        if text.startswith("json"):
            text = text[4:].lstrip()
    try:
        return normalize_analysis(json.loads(text))
    except (json.JSONDecodeError, TypeError):
        return normalize_analysis({"overview": text})


def system_prompt(module):
    entry = KNOWLEDGE[module]
    rules = "\n".join(f"- {item}" for item in entry["rules"])
    return f"""你是传统术数文化研究助手，当前模块是「{entry['name']}」。
排盘和计算已经由确定性引擎完成。你只能解释用户提供的数据，绝不能重算、修改或补造干支、卦象、星曜、宫位和分数。
本地知识规则：
{rules}

输出要求：
1. 按用户资料中标明的输出语言作答；未标明时使用清晰、克制的简体中文，避免宿命论和确定性预言。
2. 每条判断都要对应输入中的具体依据；没有依据就明确说资料不足。
3. 给出可执行、可验证的现实建议，不制造恐惧。
4. 涉及健康、法律、投资或人身安全时，不给专业结论。
5. 直接回答用户问题，不重复介绍网站，不输出通用心理鸡汤。
6. 只返回一个 JSON 对象，不使用 Markdown，结构必须为：
{{"overview":"直接结论","evidence":["具体命盘依据"],"reality":["现实表现"],"timing":["当前时机"],"risks":["风险提示"],"actions":["可执行建议"],"caveat":"分析限制与使用边界"}}"""


def call_deepseek(title, context, module):
    if not API_KEY:
        raise RuntimeError("AI_SERVICE_NOT_CONFIGURED")
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt(module)},
            {
                "role": "user",
                "content": f"详解标题：{title}\n\n以下是排盘引擎和本地知识层已经生成的结果：\n{context}",
            },
        ],
        "stream": False,
        "temperature": 0.25,
        "max_tokens": 1800 if module == "integrated" else 1200,
        "thinking": {"type": "disabled"},
    }
    request = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "Tianji-AI/1.0",
        },
        method="POST",
    )
    raw = None
    last_error = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = json.loads(response.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as error:
            last_error = RuntimeError("UPSTREAM_HTTP_{}".format(error.code))
            if attempt == 0 and error.code in (408, 429, 500, 502, 503, 504):
                time.sleep(1.2)
                continue
            raise last_error from error
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            last_error = RuntimeError("UPSTREAM_UNAVAILABLE")
            if attempt == 0:
                time.sleep(1.2)
                continue
            raise last_error from error

    if raw is None:
        raise last_error or RuntimeError("UPSTREAM_UNAVAILABLE")

    choices = raw.get("choices") or []
    if not choices:
        raise RuntimeError("UPSTREAM_EMPTY")
    content = (choices[0].get("message") or {}).get("content") or ""
    usage = raw.get("usage") if isinstance(raw.get("usage"), dict) else {}
    safe_usage = {key: usage.get(key) for key in ("prompt_tokens", "completion_tokens", "total_tokens") if usage.get(key) is not None}
    return parse_model_json(content), str(raw.get("model") or MODEL), safe_usage


def allow_request(client):
    now = time.time()
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with LOCK:
        recent = [stamp for stamp in IP_REQUESTS[client] if now - stamp < 3600]
        IP_REQUESTS[client] = recent
        if len(recent) >= PER_IP_HOUR:
            return False, "本小时 AI 详解次数已用完，请稍后再试。"
        if GLOBAL_REQUESTS[day] >= GLOBAL_DAY:
            return False, "今日 AI 详解额度已用完，请明天再试。"
        recent.append(now)
        GLOBAL_REQUESTS[day] += 1
    return True, ""


def public_error(code):
    if code == "AI_SERVICE_NOT_CONFIGURED":
        return 503, {"ok": False, "code": code, "message": "AI 服务尚未完成配置。"}
    if code in ("UPSTREAM_HTTP_401", "UPSTREAM_HTTP_402", "UPSTREAM_HTTP_403"):
        return 503, {"ok": False, "code": code, "message": "AI 账户或余额暂时不可用，管理员正在检查。"}
    if code == "UPSTREAM_HTTP_429":
        return 503, {"ok": False, "code": code, "message": "DeepSeek 当前繁忙，系统自动重试后仍未响应，请稍后再按一次。"}
    if code == "UPSTREAM_HTTP_400":
        return 502, {"ok": False, "code": code, "message": "当前排盘内容未能完成 AI 解读，请换一个问题后重试。"}
    if code == "INTERNAL_ERROR":
        return 500, {"ok": False, "code": code, "message": "AI 任务处理出现异常，请重新生成。"}
    return 502, {"ok": False, "code": code, "message": "网络出现短暂波动，系统自动重试后仍未返回，请稍后再按一次。"}


def cleanup_jobs(now):
    expired = [job_id for job_id, job in JOBS.items() if now - job["created"] > JOB_TTL]
    for job_id in expired:
        digest = JOBS[job_id].get("digest")
        JOBS.pop(job_id, None)
        if digest and PENDING_BY_DIGEST.get(digest) == job_id:
            PENDING_BY_DIGEST.pop(digest, None)


def storage_connection():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DATABASE_PATH), timeout=8)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        "CREATE TABLE IF NOT EXISTS shares (code TEXT PRIMARY KEY, payload TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, revoke_hash TEXT NOT NULL)"
    )
    connection.execute(
        "CREATE TABLE IF NOT EXISTS syncs (code TEXT PRIMARY KEY, payload TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, expires INTEGER NOT NULL, revoke_hash TEXT NOT NULL)"
    )
    connection.commit()
    return connection


def random_code(length):
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def token_hash(token):
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def iso_time(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace("+00:00", "Z")


def valid_code(value, minimum=8, maximum=24):
    text = str(value or "").strip().upper()
    return text if minimum <= len(text) <= maximum and all(char in CODE_ALPHABET for char in text) else ""


def allow_storage_request(client):
    now = time.time()
    with LOCK:
        recent = [stamp for stamp in STORAGE_REQUESTS[client] if now - stamp < 3600]
        STORAGE_REQUESTS[client] = recent
        if len(recent) >= 40:
            return False
        recent.append(now)
    return True


def sanitize_share_payload(value):
    if not isinstance(value, dict):
        raise ValueError("INVALID_SHARE")
    core = []
    for item in value.get("core") or []:
        if not isinstance(item, dict) or len(core) >= 4:
            continue
        core.append({
            "label": str(item.get("label") or "").strip()[:40],
            "conclusion": str(item.get("conclusion") or "").strip()[:180],
            "action": str(item.get("action") or "").strip()[:240],
        })
    today = value.get("today") if isinstance(value.get("today"), dict) else {}
    clean = {
        "brand": "道法自然",
        "core": core,
        "today": {
            "level": str(today.get("level") or "").strip()[:40],
            "best": str(today.get("best") or "").strip()[:220],
            "avoid": str(today.get("avoid") or "").strip()[:220],
            "reminder": str(today.get("reminder") or "").strip()[:260],
        },
        "created": str(value.get("created") or "").strip()[:20],
    }
    if not core or not clean["today"]["best"]:
        raise ValueError("INVALID_SHARE")
    return clean


def validate_encrypted_payload(value):
    if not isinstance(value, dict):
        raise ValueError("INVALID_SYNC")
    clean = {
        "version": int(value.get("version") or 0),
        "salt": str(value.get("salt") or ""),
        "iv": str(value.get("iv") or ""),
        "ciphertext": str(value.get("ciphertext") or ""),
    }
    if clean["version"] != 1 or not (16 <= len(clean["salt"]) <= 64) or not (12 <= len(clean["iv"]) <= 48) or not (24 <= len(clean["ciphertext"]) <= 380000):
        raise ValueError("INVALID_SYNC")
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
    if any(char not in allowed for field in ("salt", "iv", "ciphertext") for char in clean[field]):
        raise ValueError("INVALID_SYNC")
    return clean


def run_job(job_id, title, context, module, digest):
    try:
        analysis, model, usage = call_deepseek(title, context, module)
        result = {"ok": True, "analysis": analysis, "model": model, "usage": usage, "cached": False}
        with LOCK:
            CACHE[digest] = (time.time(), result)
            if len(CACHE) > 300:
                oldest = min(CACHE, key=lambda key: CACHE[key][0])
                CACHE.pop(oldest, None)
            job = JOBS.get(job_id)
            if job:
                job.update({"status": "done", "updated": time.time(), "status_code": 200, "payload": result})
            if PENDING_BY_DIGEST.get(digest) == job_id:
                PENDING_BY_DIGEST.pop(digest, None)
        print("AI job completed: {} module={} tokens={}".format(job_id[:8], module, usage.get("total_tokens", 0)), flush=True)
    except Exception as error:
        code = str(error).split(":", 1)[0] if isinstance(error, RuntimeError) else "INTERNAL_ERROR"
        status, payload = public_error(code)
        with LOCK:
            job = JOBS.get(job_id)
            if job:
                job.update({"status": "error", "updated": time.time(), "status_code": status, "payload": payload})
            if PENDING_BY_DIGEST.get(digest) == job_id:
                PENDING_BY_DIGEST.pop(digest, None)
        print("AI job failed: {} module={} code={}".format(job_id[:8], module, code), flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "TianjiAI/1.1"

    def log_message(self, _format, *_args):
        return

    def send_json(self, status, payload, headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for name, value in headers or []:
            self.send_header(name, value)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            # Mobile browsers may close a response early; background jobs must continue.
            pass

    def send_binary(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Content-Disposition", "inline")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    @staticmethod
    def payment_qr_path(provider):
        name = str(provider or "").strip().lower()
        return PAYMENT_QR_DIR / "{}.img".format(name) if name in ("wechat", "alipay") else None

    @staticmethod
    def payment_qr_type(data):
        if data.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        return ""

    def valid_host(self):
        host = self.headers.get("Host", "").split(":", 1)[0].lower()
        return host in ALLOWED_HOSTS

    def client_id(self):
        forwarded = self.headers.get("X-Forwarded-For", "")
        return (forwarded.split(",", 1)[0].strip() or self.client_address[0])[:80]

    def bearer_token(self):
        authorization = self.headers.get("Authorization", "")
        scheme, separator, token = authorization.partition(" ")
        return token.strip() if separator and scheme.lower() == "bearer" else ""

    def cookie_value(self, name):
        try:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            value = cookie.get(name)
            return value.value if value else ""
        except Exception:
            return ""

    def session_token(self):
        return self.cookie_value("tianji_session")

    def trial_token(self):
        return self.cookie_value("tianji_trial")

    def cookie_header(self, name, value, max_age):
        host = self.headers.get("Host", "").split(":", 1)[0].lower()
        parts = ["{}={}".format(name, value), "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age={}".format(int(max_age))]
        if host not in ("127.0.0.1", "localhost"):
            parts.append("Secure")
        return "; ".join(parts)

    def read_raw_body(self, maximum=MAX_BODY_BYTES):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > maximum:
            self.send_json(413, {"ok": False, "message": "提交内容过长。"})
            return None
        return self.rfile.read(length)

    def read_json_body(self, maximum=MAX_BODY_BYTES):
        raw = self.read_raw_body(maximum)
        if raw is None:
            return None
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"ok": False, "message": "提交格式无效。"})
            return None

    def send_billing_error(self, error):
        self.send_json(error.status, {"ok": False, "code": error.code, "message": error.message})

    def send_auth_error(self, error):
        self.send_json(error.status, {"ok": False, "code": error.code, "message": error.message})

    def handle_auth_get(self, path):
        if path == "/api/auth/status":
            self.send_json(200, AUTH.status(self.session_token(), self.trial_token()))
            return
        self.send_json(404, {"ok": False, "error": "NOT_FOUND"})

    def handle_auth_post(self, path):
        try:
            if not allow_storage_request(self.client_id()):
                raise AuthError(429, "AUTH_RATE_LIMIT", "本小时账户操作过多，请稍后再试。")
            body = self.read_json_body(16 * 1024)
            if body is None:
                return
            if not isinstance(body, dict):
                raise AuthError(400, "INVALID_BODY", "提交格式无效。")
            headers = []
            if path == "/api/auth/otp/start":
                result = AUTH.start_otp(body.get("phone"), body.get("purpose"))
            elif path == "/api/auth/trial/start":
                result = AUTH.start_trial(self.session_token(), self.trial_token())
                token = result.pop("trial_token", "")
                if token:
                    headers.append((
                        "Set-Cookie",
                        self.cookie_header("tianji_trial", token, AUTH.trial_marker_seconds),
                    ))
            elif path == "/api/auth/register":
                result = AUTH.register(body.get("phone"), body.get("code"), body.get("password"))
                token = result.pop("session_token")
                headers.append(("Set-Cookie", self.cookie_header("tianji_session", token, AUTH.session_seconds)))
            elif path == "/api/auth/login":
                result = AUTH.login(body.get("phone"), body.get("password"))
                token = result.pop("session_token")
                headers.append(("Set-Cookie", self.cookie_header("tianji_session", token, AUTH.session_seconds)))
            elif path == "/api/auth/password/reset":
                result = AUTH.reset_password(body.get("phone"), body.get("code"), body.get("password"))
                token = result.pop("session_token")
                headers.append(("Set-Cookie", self.cookie_header("tianji_session", token, AUTH.session_seconds)))
            elif path == "/api/auth/logout":
                result = AUTH.logout(self.session_token())
                headers.append(("Set-Cookie", self.cookie_header("tianji_session", "", 0)))
            else:
                self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
                return
            self.send_json(200, result, headers)
        except AuthError as error:
            self.send_auth_error(error)
        except Exception as error:
            print("Auth request failed: {} {}".format(path, type(error).__name__), flush=True)
            self.send_json(500, {"ok": False, "code": "AUTH_INTERNAL_ERROR", "message": "账户服务暂时不可用，请稍后再试。"})

    def handle_billing_get(self, path):
        try:
            if path == "/api/billing/config":
                result = BILLING.public_config()
                result["manual_review"] = True
                result["manual_payment_methods"] = [
                    provider for provider in ("wechat", "alipay")
                    if self.payment_qr_path(provider).is_file()
                ]
                self.send_json(200, result)
                return
            if path.startswith("/api/billing/manual/qr/"):
                AUTH._require_user(self.session_token())
                provider = path.rsplit("/", 1)[-1]
                qr_path = self.payment_qr_path(provider)
                if not qr_path or not qr_path.is_file():
                    self.send_json(404, {"ok": False, "code": "QR_NOT_CONFIGURED", "message": "这个收款渠道暂未配置。"})
                    return
                data = qr_path.read_bytes()
                content_type = self.payment_qr_type(data)
                if not content_type:
                    self.send_json(500, {"ok": False, "code": "QR_INVALID", "message": "收款码文件无效。"})
                    return
                self.send_binary(200, data, content_type)
                return
            if path == "/api/billing/manual/orders":
                self.send_json(200, AUTH.list_membership_orders(self.session_token()))
                return
            if path == "/api/billing/status":
                result = BILLING.status(self.bearer_token())
                auth = AUTH.status(self.session_token(), self.trial_token())
                result["auth"] = auth
                if not result["entitlement"].get("active"):
                    account = auth.get("account") or {}
                    trial = auth.get("trial") or {}
                    if account.get("active"):
                        result["entitlement"] = {
                            "authenticated": True,
                            "active": True,
                            "plan": account.get("plan"),
                            "status": "active",
                            "current_period_end": account.get("plan_expires", 0),
                            "phone_hint": account.get("phone_hint", ""),
                            "role": account.get("role", "member"),
                            "is_owner": bool(account.get("is_owner")),
                        }
                    elif trial.get("active"):
                        result["entitlement"].update({
                            "plan": "trial", "status": "trialing", "trial_expires": trial.get("expires", 0),
                        })
                    elif auth.get("authenticated"):
                        result["entitlement"].update({
                            "authenticated": True,
                            "phone_hint": account.get("phone_hint", ""),
                            "role": account.get("role", "free"),
                            "is_owner": bool(account.get("is_owner")),
                        })
                self.send_json(200, result)
                return
            self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
        except AuthError as error:
            self.send_auth_error(error)

    def handle_billing_post(self, path):
        try:
            if path == "/api/billing/webhook":
                raw = self.read_raw_body(MAX_STORAGE_BODY)
                if raw is not None:
                    self.send_json(200, BILLING.handle_webhook(raw, self.headers.get("Stripe-Signature", "")))
                return
            if not allow_storage_request(self.client_id()):
                self.send_json(429, {"ok": False, "message": "本小时账户操作过多，请稍后再试。"})
                return
            body = self.read_json_body(MAX_QR_UPLOAD_BODY if path == "/api/billing/manual/qr/upload" else 16 * 1024)
            if body is None:
                return
            if not isinstance(body, dict):
                raise BillingError(400, "INVALID_BODY", "提交格式无效。")
            if path == "/api/billing/checkout":
                result = BILLING.create_checkout(body.get("plan"), body.get("email"), body.get("method"))
            elif path == "/api/billing/manual/qr/upload":
                AUTH._require_owner(self.session_token())
                provider = str(body.get("provider") or "").strip().lower()
                qr_path = self.payment_qr_path(provider)
                encoded = str(body.get("image_base64") or "")
                if not qr_path or len(encoded) > 850000:
                    raise AuthError(400, "INVALID_QR_UPLOAD", "收款码文件无效或过大。")
                try:
                    data = base64.b64decode(encoded, validate=True)
                except (binascii.Error, ValueError):
                    raise AuthError(400, "INVALID_QR_UPLOAD", "收款码文件无法读取。")
                if not 1024 <= len(data) <= 600 * 1024 or not self.payment_qr_type(data):
                    raise AuthError(400, "INVALID_QR_UPLOAD", "只支持不超过 600KB 的 JPEG 或 PNG 收款码。")
                PAYMENT_QR_DIR.mkdir(parents=True, exist_ok=True)
                temporary = qr_path.with_suffix(".tmp")
                temporary.write_bytes(data)
                os.chmod(temporary, 0o600)
                os.replace(temporary, qr_path)
                result = {"ok": True, "provider": provider}
            elif path == "/api/billing/manual/order":
                result = AUTH.create_membership_order(
                    self.session_token(), body.get("plan"), body.get("provider"),
                    body.get("payment_reference"), body.get("payer_name"),
                )
            elif path == "/api/billing/manual/approve":
                result = AUTH.review_membership_order(
                    self.session_token(), body.get("order_id"), True, body.get("note"),
                )
            elif path == "/api/billing/manual/reject":
                result = AUTH.review_membership_order(
                    self.session_token(), body.get("order_id"), False, body.get("note"),
                )
            elif path == "/api/billing/manual/grant":
                result = AUTH.grant_membership(
                    self.session_token(), body.get("phone"), body.get("plan"), body.get("note"),
                )
            elif path == "/api/billing/claim":
                result = BILLING.claim_checkout(body.get("session_id"), body.get("claim"))
            elif path == "/api/billing/portal":
                result = BILLING.create_portal(self.bearer_token())
            elif path == "/api/billing/recovery/start":
                result = BILLING.start_recovery(body.get("email"))
            elif path == "/api/billing/recovery/verify":
                result = BILLING.verify_recovery(body.get("email"), body.get("code"))
            else:
                self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
                return
            self.send_json(200, result)
        except BillingError as error:
            self.send_billing_error(error)
        except AuthError as error:
            self.send_auth_error(error)
        except Exception as error:
            print("Billing request failed: {} {}".format(path, type(error).__name__), flush=True)
            self.send_json(500, {"ok": False, "code": "BILLING_INTERNAL_ERROR", "message": "账户服务暂时不可用，请稍后再试。"})

    def handle_storage_get(self):
        now = int(time.time())
        if self.path.startswith("/api/share/"):
            kind, code = "shares", valid_code(self.path[len("/api/share/"):].split("?", 1)[0])
        elif self.path.startswith("/api/sync/"):
            kind, code = "syncs", valid_code(self.path[len("/api/sync/"):].split("?", 1)[0])
        else:
            self.send_json(404, {"ok": False, "message": "资料不存在或已过期。"})
            return
        if not code:
            self.send_json(404, {"ok": False, "message": "资料不存在或已过期。"})
            return
        connection = storage_connection()
        try:
            connection.execute("DELETE FROM {} WHERE expires <= ?".format(kind), (now,))
            row = connection.execute("SELECT payload, expires FROM {} WHERE code = ?".format(kind), (code,)).fetchone()
            connection.commit()
        finally:
            connection.close()
        if not row:
            self.send_json(404, {"ok": False, "message": "资料不存在、已过期或已被撤销。"})
            return
        self.send_json(200, {"ok": True, "code": code, "payload": json.loads(row[0]), "expires_at": iso_time(row[1])})

    def handle_storage_post(self, body):
        if not isinstance(body, dict):
            self.send_json(400, {"ok": False, "message": "提交格式无效。"})
            return
        path = self.path
        now = int(time.time())
        if path == "/api/share/create":
            try:
                payload = sanitize_share_payload(body.get("payload"))
            except (ValueError, TypeError):
                self.send_json(400, {"ok": False, "message": "分享内容不符合匿名分享规则。"})
                return
            hours = int(body.get("expires_hours") or 168)
            if hours not in (24, 168, 720):
                hours = 168
            code, token = random_code(10), secrets.token_urlsafe(24)
            connection = storage_connection()
            try:
                for _attempt in range(4):
                    try:
                        connection.execute(
                            "INSERT INTO shares(code,payload,created,expires,revoke_hash) VALUES(?,?,?,?,?)",
                            (code, json.dumps(payload, ensure_ascii=False), now, now + hours * 3600, token_hash(token)),
                        )
                        connection.commit()
                        break
                    except sqlite3.IntegrityError:
                        code = random_code(10)
                else:
                    raise RuntimeError("CODE_COLLISION")
            finally:
                connection.close()
            self.send_json(201, {"ok": True, "code": code, "revoke_token": token, "expires_at": iso_time(now + hours * 3600)})
            return

        if path == "/api/share/revoke":
            code, token = valid_code(body.get("code")), str(body.get("revoke_token") or "")
            connection = storage_connection()
            try:
                cursor = connection.execute("DELETE FROM shares WHERE code = ? AND revoke_hash = ?", (code, token_hash(token)))
                still_exists = connection.execute("SELECT 1 FROM shares WHERE code = ?", (code,)).fetchone()
                connection.commit()
                changed = cursor.rowcount
            finally:
                connection.close()
            if not changed and still_exists:
                self.send_json(403, {"ok": False, "message": "撤销凭证无效或分享已不存在。"})
            else:
                self.send_json(200, {"ok": True, "already_gone": not bool(changed)})
            return

        if path == "/api/sync/create":
            try:
                payload = validate_encrypted_payload(body.get("payload"))
            except (ValueError, TypeError):
                self.send_json(400, {"ok": False, "message": "加密同步资料格式无效。"})
                return
            code, token = random_code(12), secrets.token_urlsafe(24)
            expires = now + 180 * 86400
            connection = storage_connection()
            try:
                for _attempt in range(4):
                    try:
                        connection.execute(
                            "INSERT INTO syncs(code,payload,created,updated,expires,revoke_hash) VALUES(?,?,?,?,?,?)",
                            (code, json.dumps(payload), now, now, expires, token_hash(token)),
                        )
                        connection.commit()
                        break
                    except sqlite3.IntegrityError:
                        code = random_code(12)
                else:
                    raise RuntimeError("CODE_COLLISION")
            finally:
                connection.close()
            self.send_json(201, {"ok": True, "code": code, "revoke_token": token, "expires_at": iso_time(expires)})
            return

        if path == "/api/sync/update":
            code, token = valid_code(body.get("code")), str(body.get("revoke_token") or "")
            try:
                payload = validate_encrypted_payload(body.get("payload"))
            except (ValueError, TypeError):
                self.send_json(400, {"ok": False, "message": "加密同步资料格式无效。"})
                return
            expires = now + 180 * 86400
            connection = storage_connection()
            try:
                cursor = connection.execute(
                    "UPDATE syncs SET payload = ?, updated = ?, expires = ? WHERE code = ? AND revoke_hash = ?",
                    (json.dumps(payload), now, expires, code, token_hash(token)),
                )
                connection.commit()
                changed = cursor.rowcount
            finally:
                connection.close()
            if not changed:
                self.send_json(403, {"ok": False, "message": "同步码或更新凭证无效。"})
            else:
                self.send_json(200, {"ok": True, "code": code, "expires_at": iso_time(expires)})
            return

        if path == "/api/sync/revoke":
            code, token = valid_code(body.get("code")), str(body.get("revoke_token") or "")
            connection = storage_connection()
            try:
                cursor = connection.execute("DELETE FROM syncs WHERE code = ? AND revoke_hash = ?", (code, token_hash(token)))
                still_exists = connection.execute("SELECT 1 FROM syncs WHERE code = ?", (code,)).fetchone()
                connection.commit()
                changed = cursor.rowcount
            finally:
                connection.close()
            if not changed and still_exists:
                self.send_json(403, {"ok": False, "message": "撤销凭证无效或同步资料已不存在。"})
            else:
                self.send_json(200, {"ok": True, "already_gone": not bool(changed)})
            return

        self.send_json(404, {"ok": False, "error": "NOT_FOUND"})

    def do_GET(self):
        if self.path in ("/healthz", "/api/ai/health"):
            self.send_json(200, {"ok": True, "configured": bool(API_KEY), "model": MODEL})
            return
        if not self.valid_host():
            self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
            return
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/auth/"):
            self.handle_auth_get(path)
            return
        if path.startswith("/api/billing/"):
            self.handle_billing_get(path)
            return
        if self.path.startswith("/api/share/") or self.path.startswith("/api/sync/"):
            self.handle_storage_get()
            return
        prefix = "/api/ai/result/"
        if not self.path.startswith(prefix):
            self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
            return
        job_id = self.path[len(prefix):].split("?", 1)[0]
        with LOCK:
            cleanup_jobs(time.time())
            job = JOBS.get(job_id)
            snapshot = dict(job) if job else None
        if not snapshot:
            self.send_json(404, {"ok": False, "code": "JOB_NOT_FOUND", "message": "AI 任务已过期，请重新生成。"})
            return
        if snapshot["status"] == "pending":
            self.send_json(202, {"ok": True, "pending": True, "job_id": job_id, "poll_after_ms": 1600})
            return
        self.send_json(snapshot.get("status_code", 500), snapshot.get("payload") or {"ok": False, "message": "AI 任务没有返回结果。"})

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/auth/"):
            if not self.valid_host():
                self.send_json(403, {"ok": False, "message": "请求来源无效。"})
                return
            self.handle_auth_post(path)
            return
        if path.startswith("/api/billing/"):
            if not self.valid_host():
                self.send_json(403, {"ok": False, "message": "请求来源无效。"})
                return
            self.handle_billing_post(path)
            return
        if self.path.startswith("/api/share/") or self.path.startswith("/api/sync/"):
            if not self.valid_host():
                self.send_json(403, {"ok": False, "message": "请求来源无效。"})
                return
            if not allow_storage_request(self.client_id()):
                self.send_json(429, {"ok": False, "message": "本小时存储操作过多，请稍后再试。"})
                return
            body = self.read_json_body(MAX_STORAGE_BODY)
            if body is not None:
                self.handle_storage_post(body)
            return
        if self.path != "/api/ai/interpret":
            self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
            return
        if not self.valid_host():
            self.send_json(403, {"ok": False, "message": "请求来源无效。"})
            return
        body = self.read_json_body()
        if body is None:
            return
        if not isinstance(body, dict):
            self.send_json(400, {"ok": False, "message": "提交格式无效。"})
            return

        title = str(body.get("title") or "").strip()[:120]
        context = str(body.get("context") or "").strip()[:MAX_CONTEXT_CHARS]
        if not title or len(context) < 20:
            self.send_json(400, {"ok": False, "message": "请先完成排盘，再生成 AI 详解。"})
            return
        response_headers = []
        billing_entitlement = BILLING.status(self.bearer_token()).get("entitlement") or {}
        access_tier = "pro" if billing_entitlement.get("active") else ""
        if not access_tier:
            try:
                access = AUTH.authorise_ai(self.session_token(), self.trial_token())
            except AuthError as error:
                self.send_auth_error(error)
                return
            access_tier = access.get("tier") or "trial"
            if access.get("trial_token"):
                response_headers.append((
                    "Set-Cookie",
                    self.cookie_header("tianji_trial", access["trial_token"], AUTH.trial_marker_seconds),
                ))
            if not access.get("allowed"):
                self.send_json(401, {
                    "ok": False,
                    "code": access.get("code") or "DETAIL_LOGIN_REQUIRED",
                    "message": access.get("message") or "详细解读需要先注册或登录。",
                }, response_headers)
                return
        module = module_for(title)
        digest = hashlib.sha256(f"{MODEL}\0{module}\0{title}\0{context}".encode("utf-8")).hexdigest()
        now = time.time()
        cached_payload = None
        pending_job_id = None
        with LOCK:
            cleanup_jobs(now)
            cached = CACHE.get(digest)
            if cached and now - cached[0] < CACHE_TTL:
                cached_payload = dict(cached[1])
                cached_payload["cached"] = True
            else:
                CACHE.pop(digest, None)
                candidate = PENDING_BY_DIGEST.get(digest)
                if candidate and JOBS.get(candidate, {}).get("status") == "pending":
                    pending_job_id = candidate
        if cached_payload:
            cached_payload["access"] = access_tier
            self.send_json(200, cached_payload, response_headers)
            return
        if pending_job_id:
            self.send_json(202, {"ok": True, "pending": True, "job_id": pending_job_id, "poll_after_ms": 1600, "deduplicated": True, "access": access_tier}, response_headers)
            return

        if billing_entitlement.get("active"):
            pro_allowed, pro_account_id = BILLING.consume_pro_usage(self.bearer_token())
            if pro_account_id and not pro_allowed:
                self.send_json(429, {"ok": False, "message": "今日 Pro AI 详解额度已用完，请明天再试。"})
                return
        elif access_tier == "trial":
            allowed, message = allow_request(self.client_id())
            if not allowed:
                self.send_json(429, {"ok": False, "message": message})
                return
        job_id = secrets.token_urlsafe(18)
        with LOCK:
            candidate = PENDING_BY_DIGEST.get(digest)
            if candidate and JOBS.get(candidate, {}).get("status") == "pending":
                job_id = candidate
                duplicate = True
            else:
                JOBS[job_id] = {"status": "pending", "created": now, "updated": now, "digest": digest}
                PENDING_BY_DIGEST[digest] = job_id
                duplicate = False
        if not duplicate:
            worker = threading.Thread(target=run_job, args=(job_id, title, context, module, digest))
            worker.daemon = True
            worker.start()
            print("AI job accepted: {} module={}".format(job_id[:8], module), flush=True)
        self.send_json(202, {"ok": True, "pending": True, "job_id": job_id, "poll_after_ms": 1600, "deduplicated": duplicate, "access": access_tier}, response_headers)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
