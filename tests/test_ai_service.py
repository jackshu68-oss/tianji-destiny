import importlib.util
import json
import pathlib
import tempfile
import unittest
import urllib.error
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).parents[1] / "server" / "ai_service.py"
SPEC = importlib.util.spec_from_file_location("tianji_ai_service", MODULE_PATH)
SERVICE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVICE)


class AiServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        SERVICE.DATA_DIR = pathlib.Path(self.temp_dir.name)
        SERVICE.DATABASE_PATH = SERVICE.DATA_DIR / "private_store.sqlite3"
        with SERVICE.LOCK:
            SERVICE.CACHE.clear()
            SERVICE.JOBS.clear()
            SERVICE.PENDING_BY_DIGEST.clear()
            SERVICE.STORAGE_REQUESTS.clear()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_module_selection(self):
        self.assertEqual(SERVICE.module_for("梅花易数 · 完整详解"), "meihua")
        self.assertEqual(SERVICE.module_for("奇门遁甲 · 全局详解"), "qimen")
        self.assertEqual(SERVICE.module_for("八字合婚 · 详解"), "hehun")
        self.assertEqual(SERVICE.module_for("流年运程 · 详解"), "dayun")
        self.assertEqual(SERVICE.module_for("塔罗牌 · 完整牌阵详解"), "tarot")
        self.assertEqual(SERVICE.module_for("雷诺曼 · 完整连线详解"), "lenormand")
        self.assertEqual(SERVICE.module_for("太阳星座 · 详解"), "astrology")
        self.assertEqual(SERVICE.module_for("综合全盘分析报告"), "integrated")

    def test_fenced_json_response_is_normalized(self):
        result = SERVICE.parse_model_json(
            '```json\n{"overview":"清晰","evidence":["依据"],"actions":["行动"]}\n```'
        )
        self.assertEqual(result["overview"], "清晰")
        self.assertEqual(result["evidence"], ["依据"])
        self.assertEqual(result["actions"], ["行动"])
        self.assertEqual(result["reality"], [])
        self.assertEqual(result["timing"], [])
        self.assertEqual(result["risks"], [])
        self.assertIn("传统术数", result["caveat"])

    def test_prompt_forbids_recalculation(self):
        prompt = SERVICE.system_prompt("qimen")
        self.assertIn("绝不能重算", prompt)
        self.assertIn("只返回一个 JSON 对象", prompt)
        self.assertIn("直接回答用户问题", prompt)

    def test_integrated_prompt_requires_sources_and_missing_data_boundaries(self):
        prompt = SERVICE.system_prompt("integrated")
        self.assertIn("已提供的资料来源", prompt)
        self.assertIn("未生成的模块", prompt)
        self.assertIn("未来 30 天行动", prompt)

    def test_anonymous_share_sanitizer_excludes_identity_and_birth_data(self):
        result = SERVICE.sanitize_share_payload({
            "name": "不应保存",
            "birth": "1990-06-15 10:30",
            "city": "佛山",
            "core": [{"label": "事业", "conclusion": "先聚焦", "action": "验证一项目标", "birth": "secret"}],
            "today": {"level": "稳中有进", "best": "完成重点事项", "avoid": "避免分心", "reminder": "以现实证据为准"},
            "created": "2026-07-18",
        })
        serialized = json.dumps(result, ensure_ascii=False)
        self.assertNotIn("不应保存", serialized)
        self.assertNotIn("1990-06-15", serialized)
        self.assertNotIn("佛山", serialized)
        self.assertNotIn("secret", serialized)
        self.assertEqual(result["brand"], "道法自然")

    def test_encrypted_payload_validation_and_storage_tables(self):
        payload = SERVICE.validate_encrypted_payload({
            "version": 1,
            "salt": "A" * 24,
            "iv": "B" * 16,
            "ciphertext": "C" * 32,
            "plaintext": "must be ignored",
        })
        self.assertEqual(set(payload), {"version", "salt", "iv", "ciphertext"})
        connection = SERVICE.storage_connection()
        try:
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        finally:
            connection.close()
        self.assertIn("shares", tables)
        self.assertIn("syncs", tables)

    def test_invalid_encrypted_payload_is_rejected(self):
        with self.assertRaises(ValueError):
            SERVICE.validate_encrypted_payload({"version": 1, "salt": "short", "iv": "short", "ciphertext": "plain text"})

    def test_transient_network_error_is_retried_once(self):
        class FakeResponse(object):
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return json.dumps({
                    "model": "test-model",
                    "choices": [{"message": {"content": '{"overview":"已恢复"}'}}],
                    "usage": {"total_tokens": 12},
                }).encode("utf-8")

        original_key = SERVICE.API_KEY
        SERVICE.API_KEY = "test-key"
        try:
            with mock.patch.object(
                SERVICE.urllib.request,
                "urlopen",
                side_effect=[urllib.error.URLError("temporary"), FakeResponse()],
            ) as urlopen, mock.patch.object(SERVICE.time, "sleep"):
                analysis, model, usage = SERVICE.call_deepseek("梅花详解", "本卦与体用资料完整", "meihua")
        finally:
            SERVICE.API_KEY = original_key

        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(analysis["overview"], "已恢复")
        self.assertEqual(model, "test-model")
        self.assertEqual(usage["total_tokens"], 12)

    def test_background_job_stores_result_and_cache(self):
        job_id = "job-success"
        digest = "digest-success"
        with SERVICE.LOCK:
            SERVICE.JOBS[job_id] = {
                "status": "pending",
                "created": 1,
                "updated": 1,
                "digest": digest,
            }
            SERVICE.PENDING_BY_DIGEST[digest] = job_id

        analysis = SERVICE.normalize_analysis({"overview": "后台完成"})
        with mock.patch.object(
            SERVICE,
            "call_deepseek",
            return_value=(analysis, "test-model", {"total_tokens": 21}),
        ):
            SERVICE.run_job(job_id, "奇门详解", "完整排盘资料", "qimen", digest)

        with SERVICE.LOCK:
            job = dict(SERVICE.JOBS[job_id])
            cached = SERVICE.CACHE[digest][1]
        self.assertEqual(job["status"], "done")
        self.assertEqual(job["status_code"], 200)
        self.assertEqual(job["payload"]["analysis"]["overview"], "后台完成")
        self.assertEqual(cached["usage"]["total_tokens"], 21)
        self.assertNotIn(digest, SERVICE.PENDING_BY_DIGEST)

    def test_background_job_records_upstream_failure(self):
        job_id = "job-error"
        digest = "digest-error"
        with SERVICE.LOCK:
            SERVICE.JOBS[job_id] = {
                "status": "pending",
                "created": 1,
                "updated": 1,
                "digest": digest,
            }
            SERVICE.PENDING_BY_DIGEST[digest] = job_id

        with mock.patch.object(
            SERVICE,
            "call_deepseek",
            side_effect=RuntimeError("UPSTREAM_UNAVAILABLE"),
        ):
            SERVICE.run_job(job_id, "梅花详解", "完整排盘资料", "meihua", digest)

        with SERVICE.LOCK:
            job = dict(SERVICE.JOBS[job_id])
        self.assertEqual(job["status"], "error")
        self.assertEqual(job["status_code"], 502)
        self.assertFalse(job["payload"]["ok"])
        self.assertNotIn(digest, SERVICE.PENDING_BY_DIGEST)


if __name__ == "__main__":
    unittest.main()
