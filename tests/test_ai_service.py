import importlib.util
import pathlib
import unittest


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


if __name__ == "__main__":
    unittest.main()
