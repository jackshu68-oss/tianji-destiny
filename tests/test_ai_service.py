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
    def test_module_selection(self):
        self.assertEqual(SERVICE.module_for("梅花易数 · 完整详解"), "meihua")
        self.assertEqual(SERVICE.module_for("奇门遁甲 · 全局详解"), "qimen")
        self.assertEqual(SERVICE.module_for("八字合婚 · 详解"), "hehun")
        self.assertEqual(SERVICE.module_for("流年运程 · 详解"), "dayun")

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


if __name__ == "__main__":
    unittest.main()
