# Spec：增量 token 用量更新 + `/update-token-usage` skill

**日期**：2026-05-31
**状态**：已批准，待实现

## 背景与问题

首页「Token activity」热力图的数据源是 `src/data/usage.json`，由 `npm run collect`
（`scripts/collect-usage.mjs`）生成：本地跑 `aggregate-usage.py`、ssh 到 mac-mini 跑同一脚本，
再经 `merge.mjs` 按「机器桶覆盖式」合并写入。

现状缺陷：`aggregate-usage.py` **全量**扫描 `~/.claude/projects/**` 与 `~/.codex/sessions/**`
的所有历史。一旦某台机器的老 session 日志被清理/轮转，全量重扫会把那台机器对应天数也覆盖为缺失——
而 `usage.json` 是唯一的持久聚合记录，历史会就此丢失。

## 目标

1. 更新逻辑改为**增量**：只重算「上次同步那天往前 3 天」到今天的窗口，旧的天完全不动。
   - 既补全「最后同步那天没跑完」的残缺（lastSync 通常发生在当天午间），
   - 又能兜住「某台机器跨天离线、几天后才恢复」的漏数据，
   - 并彻底保护历史（老日志被清理也不丢）。
2. 把「更新 token 用量」全流程封装为 project-scope skill `/update-token-usage`。

## Part A — 增量聚合

### `scripts/aggregate-usage.py`
- `aggregate(claude_root, codex_root, since=None)` 新增 `since` 形参；`since` 非空时只累计
  `date >= since` 的记录（在 `_add` 内过滤）。
- `main()` 手写解析 `--since YYYY-MM-DD`（兼容 `ssh host python3 - --since ...`，即 `argv[0]='-'`），
  不引入 argparse，保持纯 stdlib / Python 3.9 兼容。
- 不传 `--since` → 全量（首次运行 / 无历史时使用）。

### `scripts/since.mjs`（新，纯函数）
- `computeSince(lastSync, marginDays = 3)`：取 `lastSync` 日期部分（UTC，`slice(0,10)`），
  往前推 `marginDays` 天，返回 `'YYYY-MM-DD'`；`lastSync` 为空/无效 → 返回 `null`。
- 抽独立模块以便单测日期数学（含跨月边界）。

### `scripts/collect-usage.mjs`
- 调整顺序：**先**读现有 `usage.json` → 取 `meta.lastSync` → `computeSince` 得 `since`
  → 把 `--since`（若非 null）同时传给本地与远端聚合 → 再 merge 写回。
- 日志打印「增量自 X」或「全量」。

### `merge.mjs` 不变
先整体拷贝 `existing.byDay`，再用 `perMachine` 按机器+日期覆盖。只输出最近几天 ⇒ 仅覆盖最近几天；
旧天保留、最后同步那天被完整重算覆盖、新天补上。lastSync 刷新为当前时间。

## Part B — `/update-token-usage` skill

存 `.claude/skills/update-token-usage/SKILL.md`（project-scope）。流程：
1. 仓库根运行 `npm run collect`（增量），报告同步的机器与 since。
2. 展示 `git diff src/data/usage.json`（变化的天）+ node 片段读 `usage.json` 算首页 4 数
   （累计 / 最长 streak / 单日峰值 / 本月，口径对齐 `index.astro` 的 `DATA_START=2026-04-16`）。
3. 无改动 → 报告「无新增」，**跳过**提交/push。
4. 有改动 → 中文 commit message 提交（如 `chore(usage): 增量更新 token 用量至 <today>`）。
5. **push 到 main**（部署 = push main → GitHub Pages 自动重建；刻意直接推 main、不另开分支）。

## 测试（TDD 先行）
- `test_aggregate_usage.py`：新增 `--since` / `since=` 过滤用例（旧于 since 的天被剔除）。
- `since.test.mjs`（新）：日期数学，含无 lastSync→null、跨月边界（如 2026-03-01 → 2026-02-26）。
- `merge.test.mjs`：新增「existing 里的旧天，在 perMachine 不含它时仍被保留」用例，锁死增量契约。

## 受影响文件
1. `scripts/aggregate-usage.py`（改）
2. `scripts/since.mjs`（新）
3. `scripts/collect-usage.mjs`（改）
4. `scripts/test_aggregate_usage.py`（改）
5. `scripts/since.test.mjs`（新）
6. `scripts/merge.test.mjs`（改）
7. `.claude/skills/update-token-usage/SKILL.md`（新）
8. `src/data/usage.json`（数据更新，由 skill 流程产出）
