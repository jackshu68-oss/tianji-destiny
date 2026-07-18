#!/usr/bin/env python3
"""Small same-origin AI interpretation service for the Tianji static site."""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


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
        "tianji.47-86-31-98.sslip.io,127.0.0.1,localhost",
    ).split(",")
    if item.strip()
}
MAX_BODY_BYTES = 48 * 1024
MAX_CONTEXT_CHARS = 12000
CACHE_TTL = 12 * 60 * 60
PER_IP_HOUR = int(os.environ.get("TIANJI_AI_PER_IP_HOUR", "20"))
GLOBAL_DAY = int(os.environ.get("TIANJI_AI_GLOBAL_DAY", "200"))

LOCK = threading.Lock()
CACHE: dict[str, tuple[float, dict]] = {}
IP_REQUESTS: dict[str, list[float]] = defaultdict(list)
GLOBAL_REQUESTS: dict[str, int] = defaultdict(int)


def module_for(title: str) -> str:
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
    return "bazi"


def normalize_analysis(value: object) -> dict:
    if not isinstance(value, dict):
        return {
            "overview": str(value or "AI 暂未返回有效内容。"),
            "evidence": [],
            "stages": [],
            "actions": [],
            "caveat": "传统术数解读仅供文化研究与娱乐参考。",
        }
    result = {
        "overview": str(value.get("overview") or value.get("summary") or "").strip(),
        "evidence": value.get("evidence") if isinstance(value.get("evidence"), list) else [],
        "stages": value.get("stages") if isinstance(value.get("stages"), list) else [],
        "actions": value.get("actions") if isinstance(value.get("actions"), list) else [],
        "caveat": str(value.get("caveat") or "传统术数解读仅供文化研究与娱乐参考。").strip(),
    }
    for key in ("evidence", "stages", "actions"):
        result[key] = [str(item).strip() for item in result[key] if str(item).strip()][:6]
    return result


def parse_model_json(content: str) -> dict:
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


def system_prompt(module: str) -> str:
    entry = KNOWLEDGE[module]
    rules = "\n".join(f"- {item}" for item in entry["rules"])
    return f"""你是传统术数文化研究助手，当前模块是「{entry['name']}」。
排盘和计算已经由确定性引擎完成。你只能解释用户提供的数据，绝不能重算、修改或补造干支、卦象、星曜、宫位和分数。
本地知识规则：
{rules}

输出要求：
1. 使用清晰、克制的简体中文，避免宿命论和确定性预言。
2. 每条判断都要对应输入中的具体依据；没有依据就明确说资料不足。
3. 给出可执行、可验证的现实建议，不制造恐惧。
4. 涉及健康、法律、投资或人身安全时，不给专业结论。
5. 只返回一个 JSON 对象，不使用 Markdown，结构必须为：
{{"overview":"核心判断","evidence":["依据1"],"stages":["阶段或时间层次"],"actions":["现实建议"],"caveat":"使用边界"}}"""


def call_deepseek(title: str, context: str, module: str) -> tuple[dict, str, dict]:
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
        "max_tokens": 1200,
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
    try:
        with urllib.request.urlopen(request, timeout=50) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"UPSTREAM_HTTP_{error.code}:{detail}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError("UPSTREAM_UNAVAILABLE") from error

    choices = raw.get("choices") or []
    if not choices:
        raise RuntimeError("UPSTREAM_EMPTY")
    content = (choices[0].get("message") or {}).get("content") or ""
    usage = raw.get("usage") if isinstance(raw.get("usage"), dict) else {}
    safe_usage = {key: usage.get(key) for key in ("prompt_tokens", "completion_tokens", "total_tokens") if usage.get(key) is not None}
    return parse_model_json(content), str(raw.get("model") or MODEL), safe_usage


def allow_request(client: str) -> tuple[bool, str]:
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


class Handler(BaseHTTPRequestHandler):
    server_version = "TianjiAI/1.0"

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def valid_host(self) -> bool:
        host = self.headers.get("Host", "").split(":", 1)[0].lower()
        return host in ALLOWED_HOSTS

    def do_GET(self) -> None:
        if self.path not in ("/healthz", "/api/ai/health"):
            self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
            return
        self.send_json(200, {"ok": True, "configured": bool(API_KEY), "model": MODEL})

    def do_POST(self) -> None:
        if self.path != "/api/ai/interpret":
            self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
            return
        if not self.valid_host():
            self.send_json(403, {"ok": False, "message": "请求来源无效。"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(413, {"ok": False, "message": "提交内容过长。"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"ok": False, "message": "提交格式无效。"})
            return

        title = str(body.get("title") or "").strip()[:120]
        context = str(body.get("context") or "").strip()[:MAX_CONTEXT_CHARS]
        if not title or len(context) < 20:
            self.send_json(400, {"ok": False, "message": "请先完成排盘，再生成 AI 详解。"})
            return
        module = module_for(title)
        digest = hashlib.sha256(f"{MODEL}\0{module}\0{title}\0{context}".encode("utf-8")).hexdigest()
        now = time.time()
        with LOCK:
            cached = CACHE.get(digest)
            if cached and now - cached[0] < CACHE_TTL:
                self.send_json(200, {**cached[1], "cached": True})
                return
            CACHE.pop(digest, None)

        forwarded = self.headers.get("X-Forwarded-For", "")
        client = (forwarded.split(",", 1)[0].strip() or self.client_address[0])[:80]
        allowed, message = allow_request(client)
        if not allowed:
            self.send_json(429, {"ok": False, "message": message})
            return
        try:
            analysis, model, usage = call_deepseek(title, context, module)
        except RuntimeError as error:
            code = str(error)
            if code == "AI_SERVICE_NOT_CONFIGURED":
                self.send_json(503, {"ok": False, "message": "AI 服务尚未完成配置。"})
            elif "UPSTREAM_HTTP_429" in code:
                self.send_json(503, {"ok": False, "message": "AI 服务当前繁忙，请稍后再试。"})
            else:
                self.send_json(502, {"ok": False, "message": "AI 暂时没有返回结果，请稍后重试。"})
            return

        result = {"ok": True, "analysis": analysis, "model": model, "usage": usage, "cached": False}
        with LOCK:
            CACHE[digest] = (now, result)
            if len(CACHE) > 300:
                oldest = min(CACHE, key=lambda key: CACHE[key][0])
                CACHE.pop(oldest, None)
        self.send_json(200, result)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
