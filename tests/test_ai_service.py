import importlib.util
import json
import pathlib
import unittest
import urllib.error
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).parents[1] / "server" / "ai_service.py"
SPEC = importlib.util.spec_from_file_location("tianji_ai_service", MODULE_PATH)
SERVICE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVICE)


class AiServiceTests(unittest.TestCase):
    def setUp(self):
        with SERVICE.LOCK:
            SERVICE.CACHE.clear()
            SERVICE.JOBS.clear()
            SERVICE.PENDING_BY_DIGEST.clear()

    def test_module_selection(self):
        self.assertEqual(SERVICE.module_for("梅花易数 · 完整详解"), "meihua")
        self.assertEqual(SERVICE.module_for("奇门遁甲 · 全局详解"), "qimen")
        self.assertEqual(SERVICE.module_for("八字合婚 · 详解"), "hehun")
        self.assertEqual(SERVICE.module_for("流年运程 · 详解"), "dayun")
        self.assertEqual(SERVICE.module_for("塔罗牌 · 完整牌阵详解"), "tarot")
        self.assertEqual(SERVICE.module_for("雷诺曼 · 完整连线详解"), "lenormand")

    def test_fenced_json_response_is_normalized(self):
        result = SERVICE.parse_model_json(
            '```json\n{"overview":"清晰","evidence":["依据"],"actions":["行动"]}\n```'
        )
        self.assertEqual(result["overview"], "清晰")
        self.assertEqual(result["evidence"], ["依据"])
        self.assertEqual(result["actions"], ["行动"])
        self.assertIn("传统术数", result["caveat"])

    def test_prompt_forbids_recalculation(self):
        prompt = SERVICE.system_prompt("qimen")
        self.assertIn("绝不能重算", prompt)
        self.assertIn("只返回一个 JSON 对象", prompt)

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
