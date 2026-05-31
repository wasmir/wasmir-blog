#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描某台机器的 ~/.claude 与 ~/.codex，按「去 cache 的 io」口径
聚合每日 token，输出 {"YYYY-MM-DD": {"claude": n, "codex": n}} 到 stdout。
纯 stdlib，兼容 Python 3.9，本地与远端均可直接运行。"""

import glob
import json
import os
import sys


def _add(acc, date, tool, nocache, cache, since=None):
    # cache（含缓存总量）>= nocache >= 0；cache<=0 即整条无量，跳过。
    if not date or cache <= 0:
        return
    if since and date < since:  # 增量：只收 since（含）及以后的天
        return
    day = acc.get(date)
    if day is None:
        day = {"claude": {"nocache": 0, "cache": 0}, "codex": {"nocache": 0, "cache": 0}}
        acc[date] = day
    day[tool]["nocache"] += nocache
    day[tool]["cache"] += cache


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


def parse_claude(acc, claude_root, since=None):
    pattern = os.path.join(claude_root, "projects", "**", "*.jsonl")
    for path in glob.glob(pattern, recursive=True):
        for rec in _iter_json_lines(path):
            usage = (rec.get("message") or {}).get("usage")
            if not usage:
                continue
            date = (rec.get("timestamp") or "")[:10]
            nocache = (usage.get("input_tokens") or 0) + (usage.get("output_tokens") or 0)
            cache = (nocache + (usage.get("cache_creation_input_tokens") or 0)
                     + (usage.get("cache_read_input_tokens") or 0))
            _add(acc, date, "claude", nocache, cache, since)


def parse_codex(acc, codex_root, since=None):
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
            inp = u.get("input_tokens") or 0
            cached = u.get("cached_input_tokens") or 0
            out = u.get("output_tokens") or 0
            rea = u.get("reasoning_output_tokens") or 0
            nocache = inp - cached + out + rea  # 减掉缓存命中的输入
            cache = inp + out + rea             # 含缓存：不减
            date = (rec.get("timestamp") or "")[:10]
            _add(acc, date, "codex", nocache, cache, since)


def aggregate(claude_root, codex_root, since=None):
    acc = {}
    parse_claude(acc, claude_root, since)
    parse_codex(acc, codex_root, since)
    return acc


def _parse_since(argv):
    # 极简解析 `--since YYYY-MM-DD` / `--since=YYYY-MM-DD`，兼容 ssh `python3 -`（argv[0]='-'）。
    for i, a in enumerate(argv):
        if a == "--since" and i + 1 < len(argv):
            return argv[i + 1]
        if a.startswith("--since="):
            return a[len("--since="):]
    return None


def main():
    home = os.path.expanduser("~")
    since = _parse_since(sys.argv[1:])
    acc = aggregate(os.path.join(home, ".claude"), os.path.join(home, ".codex"), since)
    json.dump(acc, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
