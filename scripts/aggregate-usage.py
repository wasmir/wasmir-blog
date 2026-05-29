#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描某台机器的 ~/.claude 与 ~/.codex，按「去 cache 的 io」口径
聚合每日 token，输出 {"YYYY-MM-DD": {"claude": n, "codex": n}} 到 stdout。
纯 stdlib，兼容 Python 3.9，本地与远端均可直接运行。"""

import glob
import json
import os
import sys


def _add(acc, date, tool, tokens):
    if not date or tokens <= 0:
        return
    day = acc.get(date)
    if day is None:
        day = {"claude": 0, "codex": 0}
        acc[date] = day
    day[tool] += tokens


def _iter_json_lines(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except ValueError:
                    continue
    except (IOError, OSError):
        return


def parse_claude(acc, claude_root):
    pattern = os.path.join(claude_root, "projects", "**", "*.jsonl")
    for path in glob.glob(pattern, recursive=True):
        for rec in _iter_json_lines(path):
            usage = (rec.get("message") or {}).get("usage")
            if not usage:
                continue
            date = (rec.get("timestamp") or "")[:10]
            io = (usage.get("input_tokens") or 0) + (usage.get("output_tokens") or 0)
            _add(acc, date, "claude", io)


def parse_codex(acc, codex_root):
    pattern = os.path.join(codex_root, "sessions", "**", "rollout-*.jsonl")
    for path in glob.glob(pattern, recursive=True):
        for rec in _iter_json_lines(path):
            payload = rec.get("payload") or {}
            if payload.get("type") != "token_count":
                continue
            info = payload.get("info")
            if not info:
                continue
            u = info.get("last_token_usage") or {}
            io = ((u.get("input_tokens") or 0) - (u.get("cached_input_tokens") or 0)
                  + (u.get("output_tokens") or 0)
                  + (u.get("reasoning_output_tokens") or 0))
            date = (rec.get("timestamp") or "")[:10]
            _add(acc, date, "codex", io)


def aggregate(claude_root, codex_root):
    acc = {}
    parse_claude(acc, claude_root)
    parse_codex(acc, codex_root)
    return acc


def main():
    home = os.path.expanduser("~")
    acc = aggregate(os.path.join(home, ".claude"), os.path.join(home, ".codex"))
    json.dump(acc, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
