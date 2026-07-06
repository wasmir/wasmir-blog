---
name: update-token-usage
description: 当需要更新 / 刷新 wasmir 首页「Token activity」热力图的 token 用量数据（src/data/usage.json）时使用。触发短语：「更新 token 用量」「刷新 usage」「同步 token 统计」「collect usage」「更新热力图数据」「跑一下 token」等。
---

# 更新首页 Token 用量

把本地 + mac-mini 的 Claude/Codex token 用量**增量**同步进 `src/data/usage.json`，
再提交并 push（触发 GitHub Pages 重建）。所有输出用中文。

## 增量原理（为什么不全量）

`usage.json` 是唯一的持久聚合记录。每个 tool 存**双口径** `{nocache, cache}`：`cache` 含缓存
（Codex 加 `cache_creation`+`cache_read`；Codex 不减 `cached_input_tokens`），首页可切换显示。
`scripts/aggregate-usage.py` 全量扫描会在老 session 日志被清理/轮转时，把那台机器对应的历史天数也
覆盖为缺失 → 丢历史。

所以 `collect-usage.mjs` 先读现有 `meta.lastSync`，经 `scripts/since.mjs` 的 `computeSince`
算出 `since`（= lastSync 当天往前留 **3 天**缓冲），只用 `--since` 重算最近几天：
- 补全「最后同步那天没跑完」的残缺（lastSync 多发生在当天午间）；
- 3 天缓冲兜住「某台机器跨天离线、几天后才恢复」的漏数据；
- 旧天由 `merge.mjs` 原样保留，不会丢历史。
首次 / 无 lastSync 时 `since=null`，自动降级全量扫描；`collect-usage.mjs` 仍以现有
`usage.json` 为合并基底，只覆盖本次扫到的日期，避免老日志轮转后把持久历史删掉。

> ⚠️ 缓冲只有 **3 天**：若某台机器离线**超过 3 天**才恢复，超出窗口的那几天会被**永久漏掉**、
> 不会自动补回。需要补时手动触发更大范围/全量（见下方「常见问题 · 想全量重算」）。

## 步骤

1. **跑增量同步**（在仓库根）：
   ```bash
   npm run collect
   ```
   留意输出：`[mode] 增量自 …` / `[ok] local …` / `[ok] remote mac-mini …`。
   远端不可达会打 `[warn] … 降级跳过`——**不报错**，那台机器历史照常保留，可继续。

2. **看改动**：
   ```bash
   git --no-pager diff --stat src/data/usage.json
   git --no-pager diff src/data/usage.json
   ```
   **若无任何改动** → 报告「token 用量无新增，跳过提交」，到此结束。

3. **报告首页两套口径各 4 个数字**（口径/取整与 `src/components/TokenHeatmap.astro` 一致；
   指标逻辑在 `src/lib/usage.ts`。数据每个 tool 是 `{nocache, cache}` 双口径）：
   ```bash
   node --input-type=module -e '
   import data from "./src/data/usage.json" with { type: "json" };
   const DATA_START = "2026-04-16"; // 必须与 src/components/TokenHeatmap.astro 保持一致
   const fmt = (n,d) => n>=1e9 ? (n/1e9).toFixed(1)+"B" : (n/1e6).toFixed(d)+"M"; // = usage.ts formatTokens
   const tot = (b,m) => Object.values(b).reduce((s,t)=>s+((t.claude&&t.claude[m])||0)+((t.codex&&t.codex[m])||0),0);
   const month = new Date().toISOString().slice(0,7); // 同 TokenHeatmap.astro：按「今天」的月份
   for (const metric of ["cache","nocache"]) {
     const days = Object.entries(data.byDay).filter(([d])=>d>=DATA_START).map(([d,b])=>[d,tot(b,metric)]).sort();
     const cum = days.reduce((s,[,v])=>s+v,0);
     const thisMonth = days.filter(([d])=>d.slice(0,7)===month).reduce((s,[,v])=>s+v,0);
     const peak = Math.max(0,...days.map(([,v])=>v));
     let best=0,run=0,prev=null;
     for (const [d,v] of days){ if(v<=0){run=0;prev=d;continue;}
       const p=new Date(d+"T00:00:00Z"); p.setUTCDate(p.getUTCDate()-1);
       run = (prev===p.toISOString().slice(0,10))?run+1:1; if(run>best)best=run; prev=d; }
     const tag = metric==="cache" ? "Total " : "No-cache";
     console.log(`[${tag}] 累计 ${fmt(cum,0)} · 最长 streak ${best} 天 · 单日峰值 ${fmt(peak,1)} · 本月 ${fmt(thisMonth,0)}`);
   }
   '
   ```

4. **提交**（中文 message，`<日期>` 用 `git diff` 里最新的数据日）：
   ```bash
   git add src/data/usage.json
   git commit -m "chore(usage): 增量更新 token 用量至 <日期>

   Co-Authored-By: Codex Opus 4.8 (1M context) <noreply@anthropic.com>"
   ```

5. **push 触发部署**（部署 = push `main` → GitHub Pages 自动重建，**刻意直接推 main、不另开分支**）：
   ```bash
   git push origin main
   ```
   报告：已 push，GitHub Pages 将自动重建上线。

## 常见问题

| 现象 | 处理 |
|---|---|
| `[warn] 远端 … 不可达，降级跳过` | 正常降级。该机历史保留，本次只更新可达机器，继续提交即可。 |
| `git diff` 无改动 | 上次同步后无新 token。报告「无新增」，**不要**空提交。 |
| 想全量重算（如改了口径） | 把 `usage.json` 的 `meta.lastSync` 清空/删掉再 `npm run collect`（since=null → 全量扫描并写回）。注意：全量扫描仍保留现有 `byDay` 里扫不到的历史天，只覆盖扫到的日期；裸跑 `python3 scripts/aggregate-usage.py` 只把单机聚合 dump 到 stdout，不写文件、不合多机。 |
| 改了聚合/合并逻辑 | 先跑测试：`npm test` + `npm run test:py`，全绿再 collect。 |
