import json
import os
import tempfile
import unittest

from importlib import import_module
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "aggregate_usage",
    os.path.join(os.path.dirname(__file__), "aggregate-usage.py"),
)
agg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(agg)


def _write(path, lines):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for obj in lines:
            f.write(json.dumps(obj) + "\n")


class AggregateTest(unittest.TestCase):
    def test_claude_io_sum_and_skip(self):
        with tempfile.TemporaryDirectory() as root:
            claude = os.path.join(root, ".claude")
            codex = os.path.join(root, ".codex")
            _write(os.path.join(claude, "projects", "p", "a.jsonl"), [
                {"timestamp": "2026-05-01T10:00:00Z",
                 "message": {"usage": {"input_tokens": 100, "output_tokens": 50}}},
                {"timestamp": "2026-05-01T11:00:00Z",
                 "message": {"usage": {"input_tokens": 30, "output_tokens": 20}}},
                {"timestamp": "2026-05-01T12:00:00Z", "message": {}},  # 无 usage，跳过
            ])
            os.makedirs(codex)
            acc = agg.aggregate(claude, codex)
            self.assertEqual(acc["2026-05-01"]["claude"], 200)
            self.assertEqual(acc["2026-05-01"]["codex"], 0)

    def test_codex_subtracts_cached_and_skips_null_info(self):
        with tempfile.TemporaryDirectory() as root:
            claude = os.path.join(root, ".claude")
            codex = os.path.join(root, ".codex")
            os.makedirs(claude)
            _write(os.path.join(codex, "sessions", "s", "rollout-1.jsonl"), [
                {"timestamp": "2026-05-02T09:00:00Z",
                 "payload": {"type": "token_count", "info": {
                     "last_token_usage": {
                         "input_tokens": 1000, "cached_input_tokens": 600,
                         "output_tokens": 200, "reasoning_output_tokens": 50}}}},
                {"timestamp": "2026-05-02T09:05:00Z",
                 "payload": {"type": "token_count", "info": None}},  # info=null，跳过
                {"timestamp": "2026-05-02T09:06:00Z",
                 "payload": {"type": "agent_message"}},  # 非 token_count，跳过
            ])
            acc = agg.aggregate(claude, codex)
            # (1000-600) + 200 + 50 = 650
            self.assertEqual(acc["2026-05-02"]["codex"], 650)
            self.assertEqual(acc["2026-05-02"]["claude"], 0)

    def test_since_filters_out_older_days(self):
        with tempfile.TemporaryDirectory() as root:
            claude = os.path.join(root, ".claude")
            codex = os.path.join(root, ".codex")
            _write(os.path.join(claude, "projects", "p", "a.jsonl"), [
                {"timestamp": "2026-05-01T10:00:00Z",
                 "message": {"usage": {"input_tokens": 100, "output_tokens": 0}}},
                {"timestamp": "2026-05-05T10:00:00Z",
                 "message": {"usage": {"input_tokens": 200, "output_tokens": 0}}},
            ])
            os.makedirs(codex)
            # since 之前的天被剔除；since 当天（含）保留
            acc = agg.aggregate(claude, codex, since="2026-05-05")
            self.assertNotIn("2026-05-01", acc)
            self.assertEqual(acc["2026-05-05"]["claude"], 200)

    def test_since_is_inclusive_of_boundary(self):
        with tempfile.TemporaryDirectory() as root:
            claude = os.path.join(root, ".claude")
            codex = os.path.join(root, ".codex")
            _write(os.path.join(claude, "projects", "p", "a.jsonl"), [
                {"timestamp": "2026-05-03T10:00:00Z",
                 "message": {"usage": {"input_tokens": 50, "output_tokens": 0}}},
            ])
            os.makedirs(codex)
            acc = agg.aggregate(claude, codex, since="2026-05-03")
            self.assertEqual(acc["2026-05-03"]["claude"], 50)

    def test_no_since_keeps_all_days(self):
        with tempfile.TemporaryDirectory() as root:
            claude = os.path.join(root, ".claude")
            codex = os.path.join(root, ".codex")
            _write(os.path.join(claude, "projects", "p", "a.jsonl"), [
                {"timestamp": "2025-01-01T10:00:00Z",
                 "message": {"usage": {"input_tokens": 7, "output_tokens": 0}}},
                {"timestamp": "2026-05-05T10:00:00Z",
                 "message": {"usage": {"input_tokens": 9, "output_tokens": 0}}},
            ])
            os.makedirs(codex)
            acc = agg.aggregate(claude, codex)
            self.assertEqual(acc["2025-01-01"]["claude"], 7)
            self.assertEqual(acc["2026-05-05"]["claude"], 9)

    def test_parse_since_cli_forms(self):
        # collect-usage.mjs 与 ssh `python3 -` 真正经过的传参接缝
        self.assertEqual(agg._parse_since(["--since", "2026-05-05"]), "2026-05-05")
        self.assertEqual(agg._parse_since(["--since=2026-05-05"]), "2026-05-05")
        self.assertIsNone(agg._parse_since([]))
        self.assertIsNone(agg._parse_since(["-"]))  # 多余占位参数，不当作 since

    def test_missing_roots_yield_empty(self):
        with tempfile.TemporaryDirectory() as root:
            acc = agg.aggregate(os.path.join(root, "nope1"), os.path.join(root, "nope2"))
            self.assertEqual(acc, {})


if __name__ == "__main__":
    unittest.main()
