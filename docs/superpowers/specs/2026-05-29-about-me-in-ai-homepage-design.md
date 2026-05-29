# AboutMeinAI 首页 —— 设计文档

> 日期：2026-05-29 · 状态：待评审

## 1. 概述

做一个**公开的个人主页**，主题 "About Me in AI"——把 Wasmir（独立开发者）和 AI 协作、成长的轨迹摊开给人看。第一版只做**首页一个长页面**，由三块仪表盘组成：

1. **Token 热力图** —— 类似 GitHub 贡献图，展示每天和 AI 互动消耗的 token 量（合并 **Claude Code + Codex**、两台电脑）。
2. **Project Progress** —— "我用 AI 做了哪些事"，带状态（todo / doing / finish / dropped）。
3. **Learning Progress** —— "学过 / 在学哪些 AI 知识点"，带进度条。

视觉与结构已在 claude-design 中完成高保真设计（见 `design/`，含 `index.html` 原型、`styles/tokens.css` 设计系统、`README.md` 交付说明）。本项目把它**用 Astro 落地**，并补齐设计稿没覆盖的工程部分：数据管道、数据驱动渲染、部署。

## 2. 范围

**v1 做：**
- 首页（Intro + 三块仪表盘 + Colophon），完全静态。
- Token 数据管道：从两台电脑读 **Claude Code + Codex** 本地用量，合并成每日数据。
- 部署到 GitHub Pages。

**v1 不做（架构预留，以后再加）：**
- 博客文章列表 / 详情（`/posts`）。
- 关于页（`/about`）。
- Logo（设计系统里有 `logo-mark.svg`，暂不用）。
- Token 采集的全自动定时（v1 先手动跑脚本）。

## 3. 技术栈与架构

- **框架**：Astro，构建为纯静态文件（无重客户端框架；仅一段 vanilla JS 做 scroll-reveal，JS 关闭时优雅降级）。
- **语言**：前端 + 编排用 Node/JS；**采集器用 Python**。原因：mac mini 上**没有 node 但有 `python3`（3.9.6）**，采集器写成纯 stdlib Python 才能"一个脚本本地 + 远端都直接跑"，无需在远端安装任何东西。
- **数据**：内容用手写文件（YAML）；token 用采集脚本生成的 JSON。三者都进 git，CI 构建时直接读。

### 目录结构

```
wasmir-blog/                   # 仓库根（GitHub 仓库名同此）
  astro.config.mjs
  package.json
  design/                      # claude-design 交付包（参考用，勿直接上线）
  docs/superpowers/specs/      # 本设计文档
  src/
    styles/
      tokens.css               # 设计系统（从 design/styles/tokens.css 移入，全局引入）
    layouts/
      Base.astro               # <html> 骨架，引入 tokens.css、字体、reveal 脚本
    pages/
      index.astro              # 首页：组装四个区块
    components/
      Intro.astro
      TokenHeatmap.astro
      ProjectProgress.astro
      LearningProgress.astro
      Colophon.astro
    data/
      projects.yaml            # 手动维护
      learning.yaml            # 手动维护
      usage.json               # 采集脚本生成（勿手改）
    lib/
      usage.ts                 # 读 usage.json，算汇总指标、热力图分级与网格
      content.ts               # 读 projects/learning YAML，排序
  scripts/
    aggregate-usage.py         # Python(纯 stdlib)：读某台机的 ~/.claude + ~/.codex，输出 {date:{claude,codex}}
    collect-usage.mjs          # Node 编排：本地 python3 + ssh 远端 python3，合并 → src/data/usage.json
    machines.json              # 机器配置（本地标识 + 远端 ssh host）
  .github/workflows/deploy.yml # build + 部署到 GitHub Pages
```

YAML 读取可用 Astro 内容集合（content collections 的 `data` 类型）或 `js-yaml` 简单加载；本设计选**后者**（最直接，符合"手动改一份文件"）。

## 4. 视觉与设计系统

**设计系统 = 唯一视觉真相源：`design/styles/tokens.css`**（"Playful Neutral"：暖灰/奶油底 + 一抹青柠 lime）。落地时把它移入 `src/styles/tokens.css` 全局引入，组件里**只用 CSS 变量，不写死 hex**。字体三套：Bricolage Grotesque（display）、Hanken Grotesk（text）、Space Mono（mono），经 Google Fonts `@import`（后续可自托管优化）。

**像素级规格以 `design/README.md` 为准**，本文不复述。落地要点：
- 居中版心 `max-width: 712px`，每块 `padding-top: 72px`；每块用 mono 微标签（`.kicker`，带 7×7 lime 方块）。
- 把 `index.html` 的每个 `<section>` 拆成一个 `.astro` 组件；列表/网格改为对数据 `.map()` 渲染，**不手写节点**。
- **删掉原型里的死 CSS**：切换变体那套（`.vswitch / .seg / .variant* / .proj-card* / .proj-row* / .pill* / .learn-group* / #pv-* / #lv-*`）。保留 `.badge* / .pj-* / .heat-* / .cell* / .prog-* / .pi-* / .pc-head / .lg-dot / .intro* / .module* / .kicker / .colophon`。
- 交互：scroll-reveal（IntersectionObserver，JS 关闭照常显示）、热力图格 hover scale 1.45 + 原生 `title` tooltip、`prefers-reduced-motion` 全部关掉动效。

## 5. 数据模型

### projects.yaml
```yaml
- name: AboutMeinAI
  blurb: 你正在看的这个站。把我和 AI 协作的轨迹摊开来给人看。
  status: doing        # todo | doing | finish | dropped
  progress: 70         # 0–100，仅 doing 有意义；其余可省略
```
**显示顺序**：`doing → todo → finish → dropped`（dropped 置底）；同组内按文件顺序。`doing` 显示进度条与百分比；`todo/finish` 无条无百分比；`dropped` 整行 0.55 透明 + 名称删除线，无条。

### learning.yaml
```yaml
- topic: Prompt Engineering
  status: done         # done | learning
  progress: 100        # learning 用 0–100；done 视为 100
```
分两组渲染：**已完成（done）** 在上、**学习中（learning）** 在下。每条是进度条（done 填 `--ink-800`，learning 填 `--pop`）。

### machines.json（机器配置，手动维护）
```json
{
  "local": { "id": "macbook" },
  "remotes": [
    { "id": "mac-mini", "ssh": "user@<your-tailscale-ip>" }
  ]
}
```

### usage.json（采集脚本生成，原始 token 数，非 M）
```json
{
  "meta": {
    "lastSync": "2026-05-29T12:00:00.000Z",
    "metric": "io_no_cache",
    "tools": ["claude", "codex"],
    "machines": ["macbook", "mac-mini"]
  },
  "byDay": {
    "2026-04-16": { "macbook": { "claude": 1200000, "codex": 50000 },
                    "mac-mini": { "claude": 300000, "codex": 0 } },
    "2026-04-17": { "macbook": { "claude": 2345678, "codex": 0 } }
  }
}
```
按「日期 → 机器 → 工具 → token」分桶存。**按机器+工具分桶**保证重跑幂等（重跑某台只覆盖它自己的值，不重复累加），也为以后"Claude vs Codex 占比"留口。前端按日期对所有机器、所有工具求和得当日总量。

## 6. 数据管道（核心）

**口径**：每天 token = "去 cache 的 io"（衡量"做了多少事"，而非"上下文多大"——实测含 cache 时 cache_read 占 ~99%，会把热力图变成上下文体积图）。两个工具 cache 字段处理不同，**分开解析、归一到同一口径**：

| 工具 | 数据位置 | 每条记录 | io 计算（去 cache） |
|---|---|---|---|
| **Claude Code** | `~/.claude/projects/**/*.jsonl` | 含 `message.usage` 的行 | `input_tokens + output_tokens`（Claude 的 input 本就不含 cache，cache 在独立字段） |
| **Codex** | `~/.codex/sessions/**/rollout-*.jsonl` | `payload.type == "token_count"` 且 `info` 非空，取 `info.last_token_usage`（每轮增量） | `(input_tokens − cached_input_tokens) + output_tokens + reasoning_output_tokens`（Codex 的 input **已含** cached，需减掉） |

两者都取记录的 `timestamp` 前 10 位为日期。

**运行模型**：中心化拉取——编排脚本只在当前这台机器跑。

1. `aggregate-usage.py`（**Python 纯 stdlib**）：扫描本机 `~/.claude` 与 `~/.codex`，按上表归一，输出 `{ "YYYY-MM-DD": { "claude": n, "codex": n } }` 到 stdout。用 `os.path.expanduser("~")` 解析路径，**本地、远端都能直接跑**（远端只有 python3、没有 node）。须兼容 **Python 3.9**（避免 3.10+ 语法）。
2. `collect-usage.mjs`（**Node 编排**，对应 `npm run collect`）：
   - 本地：`python3 scripts/aggregate-usage.py` → 本机 `{date:{claude,codex}}`。
   - 每个远端：`ssh <host> "python3 -" < scripts/aggregate-usage.py`（把脚本经 stdin 喂给远端 python3，读远端的 `~/.claude`+`~/.codex`，无需在远端装任何东西；要求远端有 python3 + 免密 SSH——已验证 `user@<your-tailscale-ip>` 可用）。捕获 stdout JSON。
   - 合并：写 `src/data/usage.json` 的 `byDay[date][machineId][tool] = tokens`（覆盖式，幂等），更新 `meta.lastSync`。
   - 远端不可达 / 无 python3 时：打印警告，**降级为只采集本地**，不报错中断。

**初始化/回填**：脚本天然全量扫描现存会话文件，第一次跑即把所有历史天回填。**保留限制（按工具不同）**：
- Claude Code 本地 JSONL 仅回溯约 6 周（实测最早 2026-04-16，更早被清理）。
- Codex 历史更长，能回到 **2025-10**（rollout 文件未被清理）。

所以热力图近半年（尤其有 Codex 的天）会比较实，更早的逐步变空——之后每天自动填满，对"成长档案"可接受。

**更新流程（v1 手动）**：
1. 在本机跑 `node scripts/collect-usage.mjs` → 更新 `src/data/usage.json`。
2. 按需改 `projects.yaml` / `learning.yaml`。
3. `git commit && git push` → CI 自动构建部署。

（CI 构建环境读不到 `~/.claude`，所以 `usage.json` 必须提交进仓库；采集是本地步骤。后续可用 launchd/cron 自动化第 1 步，v1 不做。）

## 7. 派生指标与热力图渲染（`lib/usage.ts`，构建时计算）

读 `usage.json`，按日期对**所有机器、所有工具**求和得每日总 token，再算：

- **累计 token** = 全部天求和。
- **单日峰值** = 最大单日。
- **本月 token** = 当月各天之和。
- **最长 streak** = 最长连续活跃天数（token 高于安静下限的连续天）。
- 全部格式化为 M（`/1e6`，保留 1 位小数）。设计稿里 4 个硬编码数字**改为从此计算**；Colophon 的"最后同步"取 `meta.lastSync`。

**热力图网格**：53 列 × 7 行，结束于"今天"，Sun→Sat 自上而下。从每日数据生成（**不手写 371 个格**）；今天之后的格渲染为 `.cell.empty`（透明）。

**自适应分级（替代设计稿写死的绝对阈值）**：取所有活跃天 token 值，算分位数 P50/P75/P90：
- `l0`：< 安静下限（如 0 或 < 0.1×P50）—— quiet
- `l1`：< P50 · `l2`：< P75 · `l3`：< P90 · `l4`：≥ P90

颜色沿用设计：l0 `#ECE8DF` / l1 `#DEE6C4` / l2 `#CAE889` / l3 `--pop #C6F24D` / l4 `#A6CE34`。tooltip：`"2026-03-14 · 2.3M tokens"`，空天 `"… · 安静的一天"`。（分位法保证不论口径深浅对比都好看；具体切点可微调。）

## 8. 部署

- **GitHub Pages**：项目即 git 仓库；`.github/workflows/deploy.yml` 在 push 到 `main` 时用 Astro 官方 action 构建并发布到 Pages。
- `astro.config.mjs` 配 `site`（及 project page 情况下的 `base`）。
- 数据/内容文件已进仓库，CI 直接构建，无需运行期外部依赖。

## 9. 组件拆分

| 组件 | 职责 | 依赖 |
|---|---|---|
| `Base.astro` | HTML 骨架、引 tokens.css + 字体 + reveal 脚本 | tokens.css |
| `Intro.astro` | 名字 + tagline（静态文案） | — |
| `TokenHeatmap.astro` | 汇总数字 + 热力图网格 + 图例 | `lib/usage.ts` |
| `ProjectProgress.astro` | 项目列表（4 态 + 进度条） | `lib/content.ts` ← projects.yaml |
| `LearningProgress.astro` | 两组进度条 | `lib/content.ts` ← learning.yaml |
| `Colophon.astro` | © + 最后同步时间 | `lib/usage.ts`（lastSync） |

每个组件可单独理解、单独测；列表组件纯由数据驱动。

## 10. 测试与验收

- **单元**：
  - `aggregate-usage.py`：给定 Claude 与 Codex 的 fixture，按日、按工具 io 求和正确；Codex 正确减掉 `cached_input_tokens`；无 usage / info=null 的行被跳过；Python 3.9 下可跑。
  - `collect` 合并：两台机 × 两工具数据按 `machine→tool` 分桶合并、重跑幂等；远端缺失时降级。
  - `usage.ts`：跨机器+工具求和正确；累计/峰值/本月/streak 在 fixture 上正确；分级单调、安静天为 l0。
- **构建**：`astro build` 成功；首页在 712px 版心**无横向滚动**。
- **视觉**：与 `design/index.html` 对照一致（人工核对；可选 Playwright 截图）。
- **降级**：JS 关闭时内容照常可见；`prefers-reduced-motion` 下无动效。

## 11. 风险与注记

- **历史保留**：Claude 本地 JSONL 仅约 6 周；Codex 可回到 2025-10。全年图前段偏空——预期内，会随时间填满。
- **SSH 依赖**：拉第二台需免密 SSH + 远端有 **python3**（已验证 mac mini 满足；远端**没有 node**，故采集器必须是 Python）；不满足时降级为只采本地。
- **Codex token_count**：部分事件 `info` 为 null（无 token 明细），跳过即可；以 `last_token_usage` 增量求和，勿用 `total_token_usage`（那是会话累计，会重复计）。
- **隐私**：公开页只暴露"每日 io token 总量"（活跃强度），不含会话内容，可接受。
- **死 CSS**：务必按 §4 清单删除原型遗留样式。
- **字体**：先用 Google Fonts `@import`，后续可自托管提性能。
- **tagline**：`fuck that, we are going to get it done` 暂保留为静态文案，随时可改。

## 12. 里程碑（供后续 writing-plans 拆分）

1. Astro 脚手架 + tokens.css + Base 布局 + 字体。
2. 三个展示组件（用占位数据先跑通视觉，对齐设计稿）。
3. 数据管道：Python 聚合器（Claude + Codex 双源）+ Node 编排器（本地 + ssh mac mini）+ usage.ts，接真实数据。
4. 内容数据化：projects/learning YAML + content.ts。
5. 派生指标 + 自适应热力图分级接真实数据。
6. GitHub Pages 部署工作流。
