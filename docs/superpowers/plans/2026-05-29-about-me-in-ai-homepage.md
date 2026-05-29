# AboutMeinAI 首页实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Astro 把 `design/` 高保真原型落地成一个公开、纯静态的个人主页（Intro + Token 热力图 + Project/Learning 进度 + Colophon），数据由本地脚本采集 Claude Code + Codex 的 token 用量驱动，部署到 GitHub Pages。

**Architecture:** Astro 静态站；`design/styles/tokens.css` 作为唯一视觉真相源全局引入，每个 `<section>` 拆成一个 `.astro` 组件，列表/热力图由数据 `.map()` 渲染（不手写节点）。纯逻辑（YAML 排序/分组、热力图分级与网格、token 聚合、合并）抽成可单测的纯函数，用 TDD 驱动；组件层只做渲染，靠 `astro build` + 人工对照设计稿验证。数据管道：Python 纯 stdlib 聚合器（本地 + 经 ssh 喂给远端 python3）→ Node 编排合并 → `src/data/usage.json`（进 git，CI 直接读）。

**Tech Stack:** Astro（静态输出）、TypeScript、`js-yaml`、Vitest（TS 单测）、Python 3.9 stdlib（`unittest`）、GitHub Actions（`withastro/action` + `actions/deploy-pages`）。

**关键文档（实现时随时查）：**
- 设计/技术 spec：`docs/superpowers/specs/2026-05-29-about-me-in-ai-homepage-design.md`
- 像素级交付说明：`design/README.md`
- 原型（视觉真相源 + 待移植的 CSS/markup）：`design/index.html`、`design/styles/tokens.css`

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `package.json` / `astro.config.mjs` / `tsconfig.json` | 工程配置；`site`/`base` 指向 GitHub Pages |
| `src/styles/tokens.css` | 设计系统（从 `design/styles/tokens.css` 原样移入），全局引入 |
| `src/styles/app.css` | 页面级组件 CSS（从 `design/index.html` 的 `<style>` 移入，删掉死 CSS），全局引入 |
| `src/layouts/Base.astro` | `<html>` 骨架，引两份 CSS + scroll-reveal 脚本 |
| `src/pages/index.astro` | 首页：按顺序组装 5 个组件 |
| `src/components/Intro.astro` | 名字 + tagline（静态） |
| `src/components/TokenHeatmap.astro` | 汇总数字 + 热力图网格 + 图例（数据驱动） |
| `src/components/ProjectProgress.astro` | 项目列表（4 态 + 进度条，数据驱动） |
| `src/components/LearningProgress.astro` | 两组学习进度条（数据驱动） |
| `src/components/Colophon.astro` | © + 最后同步时间 |
| `src/lib/usage.ts` | 纯函数：读 byDay → 每日总量、派生指标、分位分级、53×7 网格、月标签、格式化 |
| `src/lib/content.ts` | 纯函数：projects 排序 / learning 分组；+ YAML 加载器 |
| `src/data/projects.yaml` / `learning.yaml` | 手写内容数据 |
| `src/data/usage.json` | 采集脚本生成（先放种子数据） |
| `scripts/aggregate-usage.py` | Python 纯 stdlib：扫某台机的 `~/.claude`+`~/.codex`，输出 `{date:{claude,codex}}` |
| `scripts/merge.mjs` | 纯函数 `mergeUsage()`：按 `machine→tool` 分桶幂等合并 |
| `scripts/collect-usage.mjs` | Node 编排：本地 python3 + ssh 远端 → 合并 → 写 `usage.json` |
| `scripts/machines.json` | 机器配置（本地 id + 远端 ssh host） |
| `scripts/test_aggregate_usage.py` / `scripts/merge.test.mjs` | 管道单测 |
| `src/lib/usage.test.ts` / `src/lib/content.test.ts` | 逻辑单测 |
| `.github/workflows/deploy.yml` | build + 部署到 GitHub Pages |

---

## Task 1: Astro 脚手架 + git 初始化 + 依赖 + 工程配置

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `src/pages/index.astro`（临时占位）

- [ ] **Step 1: 在仓库根用最小模板初始化 Astro**

`design/` 与 `docs/` 已存在，必须用「当前目录、空模板、不覆盖」的方式脚手架。运行：

```bash
cd /Users/wasmir/Documents/wasmir-blog
npm create astro@latest -- --template minimal --no-install --no-git --skip-houston --yes .
```

预期：生成 `package.json`、`astro.config.mjs`、`tsconfig.json`、`.gitignore`、`src/pages/index.astro`、`public/`。不会动 `design/`、`docs/`。

- [ ] **Step 2: 安装依赖（含本计划新增的）**

```bash
npm install
npm install js-yaml
npm install -D vitest @types/js-yaml
```

预期：`node_modules/` 生成；`package.json` 出现 `astro`、`js-yaml`、`vitest`、`@types/js-yaml`。

- [ ] **Step 3: 写入 npm scripts**

把 `package.json` 的 `"scripts"` 整段替换为：

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "collect": "node scripts/collect-usage.mjs",
    "test": "vitest run",
    "test:py": "python3 -m unittest discover -s scripts -p 'test_*.py'"
  }
```

- [ ] **Step 4: 配置 `astro.config.mjs`（GitHub Pages）**

整文件替换为（`site`/`base` 见下方注意）：

```js
import { defineConfig } from 'astro/config';

// GitHub Pages（项目页）：仓库名 = wasmir-blog。
// 若改用用户页仓库 <user>.github.io，则删掉 base、site 改成 https://<user>.github.io。
export default defineConfig({
  site: 'https://wasmir.github.io',
  base: '/wasmir-blog',
});
```

> 注意：`site` 里的 GitHub 用户名是按 `wasmir` 推断的，Task 11 部署前需向用户确认真实用户名与仓库形态（项目页 vs 用户页）。

- [ ] **Step 5: git 初始化并首次提交**

```bash
cd /Users/wasmir/Documents/wasmir-blog
git init
git add -A
git commit -m "chore: 初始化 Astro 脚手架与工程配置

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

预期：仓库建立，首个提交包含脚手架 + `design/` + `docs/`。

- [ ] **Step 6: 验证脚手架能构建**

```bash
npm run build
```

预期：构建成功，生成 `dist/index.html`（此时是模板占位页，内容无所谓）。

---

## Task 2: 全局样式（移入 tokens.css + 抽取 app.css）+ Base 布局 + 种子数据

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/app.css`, `src/layouts/Base.astro`, `src/data/usage.json`

- [ ] **Step 1: 原样移入设计系统 tokens**

把 `design/styles/tokens.css` 原封不动复制到 `src/styles/tokens.css`（含顶部 Google Fonts 的 `@import`，保持不变）：

```bash
cp design/styles/tokens.css src/styles/tokens.css
```

预期：`src/styles/tokens.css` 与 `design/styles/tokens.css` 内容一致。

- [ ] **Step 2: 抽取页面级 CSS 到 `src/styles/app.css`，删掉死 CSS**

新建 `src/styles/app.css`，内容 = 复制 `design/index.html` 内 `<style>`（第 14–516 行，即从 `* { box-sizing: border-box; }` 到 `@media (max-width: 560px)` 块结束的 `}`），**但删除以下死 CSS 区段**（依据 `design/README.md` §Implementation notes 与 spec §4）：

- `SEGMENTED TOGGLE` 整块：`.vswitch / .seg / .seg label / .variant / #pv-* / #lv-*`（原型第 216–258 行）
- `CARD variant`：`.variant--cards / .proj-card*`（原型第 283–319 行）
- `LIST / changelog variant`：`.variant--list / .proj-row*`（原型第 353–378 行）
- `PILLS variant`：`.learn-group* / .pill*`（原型第 383–435 行）
- `.variant--prog` 单行（原型第 439 行）与空规则 `.prog-col { }`（第 440 行）
- 窄屏媒体查询里引用已删类的两行：`.variant--cards { grid-template-columns: 1fr; }` 和 `.hero .lead { font-size: 16px; }`（页面无 `.hero`）

**必须保留**：`* / html / body / ::selection / .page / .module* / .kicker / .intro* / .heat-* / .cell* / .badge*（含 .badge.todo/.dropped）/ .pj-* / .prog-board / .prog-col .pc-head / .prog-item / .pi-* / .colophon / .reveal / @media(prefers-reduced-motion) / @media(max-width:560px) 中保留的 .heat-summary 与 .pi-name 两条`。

- [ ] **Step 3: 创建种子 `src/data/usage.json`**

后续 Task 7（热力图）和 Task 5（Colophon）会 `import` 这个文件，必须先存在且结构合法。先放最小种子（Task 10 会被真实数据覆盖）：

```json
{
  "meta": {
    "lastSync": "2026-05-29T12:00:00.000Z",
    "metric": "io_no_cache",
    "tools": ["claude", "codex"],
    "machines": ["macbook"]
  },
  "byDay": {
    "2026-05-26": { "macbook": { "claude": 3200000, "codex": 0 } },
    "2026-05-27": { "macbook": { "claude": 900000, "codex": 0 } },
    "2026-05-28": { "macbook": { "claude": 2500000, "codex": 0 } },
    "2026-05-29": { "macbook": { "claude": 3000000, "codex": 0 } }
  }
}
```

- [ ] **Step 4: 创建 `src/layouts/Base.astro`**

整文件内容（reveal 脚本逐字取自原型第 670–685 行，用 `is:inline` 保证不被改写、JS 关闭时优雅降级）：

```astro
---
import '../styles/tokens.css';
import '../styles/app.css';
---
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wasmir</title>
</head>
<body>
  <main class="page">
    <slot />
  </main>
  <script is:inline>
    (function () {
      var els = document.querySelectorAll('.reveal');
      if (!('IntersectionObserver' in window)) {
        els.forEach(function (e) { e.classList.add('in'); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      els.forEach(function (e) { io.observe(e); });
    })();
  </script>
</body>
</html>
```

- [ ] **Step 5: 验证构建仍通过**

```bash
npm run build
```

预期：构建成功（Base 暂未被页面使用，但 CSS/JSON 已就位，无报错）。

- [ ] **Step 6: 提交**

```bash
git add src/styles src/layouts src/data/usage.json
git commit -m "feat: 引入设计系统全局样式、Base 布局与种子用量数据

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Intro + Colophon 组件 + index 组装（首屏跑通）

**Files:**
- Create: `src/components/Intro.astro`, `src/components/Colophon.astro`
- Modify: `src/pages/index.astro`（替换脚手架占位）

- [ ] **Step 1: 创建 `src/components/Intro.astro`**

markup 取自原型第 523–528 行：

```astro
---
---
<header class="intro">
  <div class="intro-id">
    <span class="name">Wasmir<span class="dot">.</span></span>
    <span class="tagline-inline">fuck that, we are going to <mark>get it done</mark></span>
  </div>
</header>
```

- [ ] **Step 2: 创建 `src/components/Colophon.astro`**

读种子 `usage.json` 的 `meta.lastSync` 取前 10 位作日期（markup 取自原型第 663–666 行）：

```astro
---
import usageData from '../data/usage.json';
import type { UsageData } from '../lib/usage';

const data = usageData as unknown as UsageData;
const lastSync = data.meta.lastSync.slice(0, 10);
---
<div class="colophon">
  <span>© 2026 Wasmir</span>
  <span>最后同步 · {lastSync}</span>
</div>
```

> `UsageData` 类型在 Task 6 定义于 `src/lib/usage.ts`。本计划按依赖顺序执行（Task 6 在 Task 7 前），但 Colophon 在 Task 3 就 import 它——所以 **Task 6 的 Step 1 已提前要求先建 `src/lib/usage.ts` 的类型骨架**。若执行顺序导致此处类型缺失，先到 Task 6 Step 1 建好类型再回来。

- [ ] **Step 3: 替换 `src/pages/index.astro` 为真实组装**

```astro
---
import Base from '../layouts/Base.astro';
import Intro from '../components/Intro.astro';
import Colophon from '../components/Colophon.astro';
---
<Base>
  <Intro />
  <Colophon />
</Base>
```

（TokenHeatmap / ProjectProgress / LearningProgress 会在后续 Task 插入到 Intro 与 Colophon 之间。）

- [ ] **Step 4: 构建并起 dev 服务器人工核对**

```bash
npm run build
```
预期：构建成功，`dist/index.html` 含 `Wasmir.`、tagline、colophon。

```bash
npm run dev
```
预期：浏览器打开 dev 地址，Intro 的名字（`.` 为青柠色）、tagline（`get it done` 青柠高亮且不换行）、底部 colophon 与 `design/index.html` 对应部分一致。核对后停掉 dev。

- [ ] **Step 5: 提交**

```bash
git add src/components/Intro.astro src/components/Colophon.astro src/pages/index.astro
git commit -m "feat: 落地 Intro 与 Colophon 组件并组装首页骨架

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `content.ts` 排序/分组逻辑（TDD）+ 内容 YAML

**Files:**
- Create: `src/lib/content.ts`, `src/lib/content.test.ts`, `src/data/projects.yaml`, `src/data/learning.yaml`

- [ ] **Step 1: 先写失败测试 `src/lib/content.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { sortProjects, groupLearning, type Project, type Learning } from './content';

describe('sortProjects', () => {
  it('按 doing → todo → finish → dropped 排序，组内保持原序', () => {
    const input: Project[] = [
      { name: 'a', blurb: '', status: 'finish' },
      { name: 'b', blurb: '', status: 'doing', progress: 70 },
      { name: 'c', blurb: '', status: 'dropped' },
      { name: 'd', blurb: '', status: 'todo' },
      { name: 'e', blurb: '', status: 'doing', progress: 40 },
    ];
    expect(sortProjects(input).map(p => p.name)).toEqual(['b', 'e', 'd', 'a', 'c']);
  });
});

describe('groupLearning', () => {
  it('拆成 done / learning 两组，组内保持原序', () => {
    const input: Learning[] = [
      { topic: 'RAG', status: 'done', progress: 100 },
      { topic: 'Evals', status: 'learning', progress: 45 },
      { topic: 'MCP', status: 'done', progress: 100 },
    ];
    const { done, learning } = groupLearning(input);
    expect(done.map(l => l.topic)).toEqual(['RAG', 'MCP']);
    expect(learning.map(l => l.topic)).toEqual(['Evals']);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/lib/content.test.ts`
预期：FAIL（`content` 模块/导出不存在）。

- [ ] **Step 3: 实现 `src/lib/content.ts`**

```ts
import fs from 'node:fs';
import yaml from 'js-yaml';

export type ProjectStatus = 'todo' | 'doing' | 'finish' | 'dropped';
export interface Project {
  name: string;
  blurb: string;
  status: ProjectStatus;
  progress?: number;
}

export type LearningStatus = 'done' | 'learning';
export interface Learning {
  topic: string;
  status: LearningStatus;
  progress?: number;
}

const PROJECT_ORDER: Record<ProjectStatus, number> = {
  doing: 0,
  todo: 1,
  finish: 2,
  dropped: 3,
};

export function sortProjects(list: Project[]): Project[] {
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => PROJECT_ORDER[a.p.status] - PROJECT_ORDER[b.p.status] || a.i - b.i)
    .map((x) => x.p);
}

export function groupLearning(list: Learning[]): { done: Learning[]; learning: Learning[] } {
  return {
    done: list.filter((l) => l.status === 'done'),
    learning: list.filter((l) => l.status === 'learning'),
  };
}

export function loadProjects(): Project[] {
  const raw = fs.readFileSync(new URL('../data/projects.yaml', import.meta.url), 'utf8');
  return sortProjects((yaml.load(raw) as Project[]) ?? []);
}

export function loadLearning(): { done: Learning[]; learning: Learning[] } {
  const raw = fs.readFileSync(new URL('../data/learning.yaml', import.meta.url), 'utf8');
  return groupLearning((yaml.load(raw) as Learning[]) ?? []);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/lib/content.test.ts`
预期：PASS（4 个断言）。

- [ ] **Step 5: 写 `src/data/projects.yaml`**

数据取自 `design/README.md` 当前原型数据：

```yaml
- name: AboutMeinAI
  blurb: 你正在看的这个站。把我和 AI 协作的轨迹摊开来给人看。
  status: doing
  progress: 70
- name: 滴答清单会话沉淀
  blurb: 把对话自动归档成结构化笔记，沉到滴答清单里随时翻。
  status: doing
  progress: 40
- name: 本地笔记 RAG 问答
  blurb: 把这些年的笔记接进本地检索，问它就行 —— 还没动手。
  status: todo
- name: Coze 工作流批量生图
  blurb: 用 API 批量生成封面图，一次跑完一整批，不用手点。
  status: finish
- name: 英语沉浸式陪练
  blurb: i+1 渐进式英文对话，难度跟着我的水平一点点往上走。
  status: finish
- name: 自动追更脚本
  blurb: 想自动抓更新，做一半发现没必要，先搁置了。
  status: dropped
```

- [ ] **Step 6: 写 `src/data/learning.yaml`**

```yaml
- topic: Prompt Engineering
  status: done
  progress: 100
- topic: RAG
  status: done
  progress: 100
- topic: Agent / 工具调用
  status: done
  progress: 100
- topic: MCP
  status: done
  progress: 100
- topic: Claude Code
  status: done
  progress: 100
- topic: 多 Agent 编排
  status: learning
  progress: 55
- topic: Fine-tuning
  status: learning
  progress: 35
- topic: Evals 评测
  status: learning
  progress: 45
- topic: 上下文工程
  status: learning
  progress: 60
```

- [ ] **Step 7: 提交**

```bash
git add src/lib/content.ts src/lib/content.test.ts src/data/projects.yaml src/data/learning.yaml
git commit -m "feat: content.ts 排序/分组逻辑与内容 YAML（TDD）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: ProjectProgress + LearningProgress 组件（数据驱动）

**Files:**
- Create: `src/components/ProjectProgress.astro`, `src/components/LearningProgress.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 创建 `src/components/ProjectProgress.astro`**

结构对照原型第 583–636 行；列表改为对 `loadProjects()` 结果 `.map()`。badge 文案/类、`doing` 才显示百分比与进度条：

```astro
---
import { loadProjects, type ProjectStatus } from '../lib/content';

const projects = loadProjects();
const BADGE: Record<ProjectStatus, { cls: string; label: string }> = {
  doing:   { cls: 'doing',   label: 'DOING' },
  todo:    { cls: 'todo',    label: 'TODO' },
  finish:  { cls: 'done',    label: 'DONE' },
  dropped: { cls: 'dropped', label: 'DROPPED' },
};
---
<section class="module reveal" id="projects">
  <div class="module-head">
    <span class="kicker">Project progress</span>
  </div>
  <div class="pj-list">
    {projects.map((p) => (
      <div class={`pj-item ${p.status}`}>
        <div class="pj-head">
          <span class={`badge ${BADGE[p.status].cls}`}>{BADGE[p.status].label}</span>
          <span class="pj-name">{p.name}</span>
          {p.status === 'doing' && <span class="pj-pct">{p.progress}</span>}
        </div>
        <p class="pj-blurb">{p.blurb}</p>
        {p.status === 'doing' && (
          <div class="pj-track"><div class="pj-fill" style={`width:${p.progress}%`}></div></div>
        )}
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 2: 创建 `src/components/LearningProgress.astro`**

对照原型第 639–661 行；两组分别 `.map()`，done 固定 100%：

```astro
---
import { loadLearning } from '../lib/content';

const { done, learning } = loadLearning();
---
<section class="module reveal" id="learning">
  <div class="module-head">
    <span class="kicker">Learning progress</span>
  </div>
  <div class="prog-board">
    <div class="prog-col">
      <div class="pc-head"><span class="lg-dot" style="background:var(--ink-800)"></span> 已完成</div>
      {done.map((l) => (
        <div class="prog-item done">
          <span class="pi-name">{l.topic}</span>
          <span class="pi-track"><span class="pi-fill" style="width:100%"></span></span>
          <span class="pi-pct">100</span>
        </div>
      ))}
    </div>
    <div class="prog-col">
      <div class="pc-head"><span class="lg-dot" style="background:var(--pop);box-shadow:0 0 0 3px var(--pop-soft)"></span> 学习中</div>
      {learning.map((l) => (
        <div class="prog-item wip">
          <span class="pi-name">{l.topic}</span>
          <span class="pi-track"><span class="pi-fill" style={`width:${l.progress}%`}></span></span>
          <span class="pi-pct">{l.progress}</span>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 3: 把两个组件插入首页（Intro 之后、Colophon 之前）**

把 `src/pages/index.astro` 改为：

```astro
---
import Base from '../layouts/Base.astro';
import Intro from '../components/Intro.astro';
import ProjectProgress from '../components/ProjectProgress.astro';
import LearningProgress from '../components/LearningProgress.astro';
import Colophon from '../components/Colophon.astro';
---
<Base>
  <Intro />
  <ProjectProgress />
  <LearningProgress />
  <Colophon />
</Base>
```

（TokenHeatmap 会在 Task 7 插入到 Intro 与 ProjectProgress 之间。）

- [ ] **Step 4: 构建 + dev 人工核对**

```bash
npm run build
```
预期：成功。`dist/index.html` 含 6 个 `pj-item`（顺序：2 个 DOING → 1 TODO → 2 DONE → 1 DROPPED），9 个 `prog-item`（5 done + 4 wip）。

```bash
npm run dev
```
预期：项目列表顺序、badge 配色、`doing` 才有进度条与百分比、`dropped` 行半透明+删除线；学习两组进度条（done 深色填满、wip 青柠按百分比）——与 `design/index.html` 对应部分一致。核对后停掉 dev。

- [ ] **Step 5: 提交**

```bash
git add src/components/ProjectProgress.astro src/components/LearningProgress.astro src/pages/index.astro
git commit -m "feat: 数据驱动的 Project/Learning 进度组件

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `usage.ts` 派生指标与热力图渲染逻辑（TDD）

**Files:**
- Create: `src/lib/usage.ts`, `src/lib/usage.test.ts`

- [ ] **Step 1: 先建类型 + 函数签名骨架 `src/lib/usage.ts`**

（Colophon 在 Task 3 已 import `UsageData`；本步把类型与空实现先放好，便于测试驱动。）

```ts
export type Tool = 'claude' | 'codex';
export type MachineBucket = Record<string, Partial<Record<Tool, number>>>;
export type ByDay = Record<string, MachineBucket>;

export interface UsageMeta {
  lastSync: string;
  metric: string;
  tools: string[];
  machines: string[];
}
export interface UsageData {
  meta: UsageMeta;
  byDay: ByDay;
}

export type Level = 0 | 1 | 2 | 3 | 4;
export interface Cell {
  date: string;
  tokens: number;
  level: Level;
  empty: boolean;
}
export interface Thresholds {
  quiet: number;
  p50: number;
  p75: number;
  p90: number;
}
export interface Metrics {
  cumulative: number;
  peak: number;
  thisMonth: number;
  streak: number;
}
```

- [ ] **Step 2: 写失败测试 `src/lib/usage.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  dayTotal, dailyTotals, computeThresholds, gradeLevel,
  computeMetrics, buildGrid, monthLabels, formatM, cellTitle,
  type ByDay,
} from './usage';

const SAMPLE: ByDay = {
  '2026-05-26': { macbook: { claude: 3_000_000, codex: 200_000 }, 'mac-mini': { claude: 0, codex: 0 } },
  '2026-05-27': { macbook: { claude: 900_000 } },
  '2026-05-28': { macbook: { claude: 2_500_000 }, 'mac-mini': { codex: 100_000 } },
  '2026-05-29': { macbook: { claude: 3_000_000 } },
};

describe('dayTotal / dailyTotals', () => {
  it('跨机器+工具求和', () => {
    expect(dayTotal(SAMPLE['2026-05-26'])).toBe(3_200_000);
    expect(dailyTotals(SAMPLE)).toEqual({
      '2026-05-26': 3_200_000,
      '2026-05-27': 900_000,
      '2026-05-28': 2_600_000,
      '2026-05-29': 3_000_000,
    });
  });
});

describe('gradeLevel', () => {
  it('安静天为 l0，分级单调不降', () => {
    const t = computeThresholds(SAMPLE);
    expect(gradeLevel(0, t)).toBe(0);
    const vals = [0, t.quiet + 1, t.p50, t.p75, t.p90];
    const levels = vals.map((v) => gradeLevel(v, t));
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
    expect(gradeLevel(t.p90 + 1, t)).toBe(4);
  });
});

describe('computeMetrics', () => {
  it('累计/峰值/本月/streak 正确', () => {
    const m = computeMetrics(SAMPLE, '2026-05-29');
    expect(m.cumulative).toBe(9_700_000);
    expect(m.peak).toBe(3_200_000);
    expect(m.thisMonth).toBe(9_700_000); // 全在 2026-05
    expect(m.streak).toBe(4); // 26→29 连续 4 天均高于安静下限
  });
});

describe('buildGrid', () => {
  it('371 格、列优先、起于周日，今天之后为 empty', () => {
    const cells = buildGrid(SAMPLE, '2026-05-29');
    expect(cells.length).toBe(53 * 7);
    // 第一格是周日
    expect(new Date(cells[0].date + 'T00:00:00Z').getUTCDay()).toBe(0);
    // 最后一列含今天；今天(2026-05-29 周五)之后的格 empty
    const today = cells.find((c) => c.date === '2026-05-29')!;
    expect(today.empty).toBe(false);
    const future = cells.filter((c) => c.date > '2026-05-29');
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((c) => c.empty)).toBe(true);
  });
});

describe('monthLabels', () => {
  it('返回 53 个标签，非空者为三字母大写月名', () => {
    const labels = monthLabels(buildGrid(SAMPLE, '2026-05-29'));
    expect(labels.length).toBe(53);
    const nonEmpty = labels.filter(Boolean);
    expect(nonEmpty.length).toBeGreaterThan(0);
    expect(nonEmpty.every((m) => /^[A-Z]{3}$/.test(m))).toBe(true);
  });
});

describe('formatM / cellTitle', () => {
  it('M 格式化与 tooltip 文案', () => {
    expect(formatM(3_200_000, 1)).toBe('3.2');
    expect(formatM(180_000_000, 0)).toBe('180');
    expect(cellTitle({ date: '2026-05-29', tokens: 3_000_000, level: 4, empty: false }))
      .toBe('2026-05-29 · 3.0M tokens');
    expect(cellTitle({ date: '2026-06-01', tokens: 0, level: 0, empty: false }))
      .toBe('2026-06-01 · 安静的一天');
    expect(cellTitle({ date: '2026-06-02', tokens: 0, level: 0, empty: true })).toBe('');
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/lib/usage.test.ts`
预期：FAIL（函数未实现）。

- [ ] **Step 4: 实现 `src/lib/usage.ts`（在 Step 1 类型之后追加）**

```ts
// ---------- 日期工具（UTC，作用于 'YYYY-MM-DD'）----------
function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUTC(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}
function addDays(date: string, n: number): string {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}
function weekday(date: string): number {
  return toUTC(date).getUTCDay(); // 0=Sun .. 6=Sat
}

// ---------- 求和 ----------
export function dayTotal(bucket: MachineBucket): number {
  let sum = 0;
  for (const tools of Object.values(bucket)) {
    sum += (tools.claude ?? 0) + (tools.codex ?? 0);
  }
  return sum;
}
export function dailyTotals(byDay: ByDay): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [date, bucket] of Object.entries(byDay)) {
    out[date] = dayTotal(bucket);
  }
  return out;
}

// ---------- 分位与分级 ----------
function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}
export function computeThresholds(byDay: ByDay): Thresholds {
  const totals = Object.values(dailyTotals(byDay))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const p50 = quantile(totals, 0.5);
  const p75 = quantile(totals, 0.75);
  const p90 = quantile(totals, 0.9);
  return { quiet: 0.1 * p50, p50, p75, p90 };
}
export function gradeLevel(tokens: number, t: Thresholds): Level {
  if (tokens <= 0 || tokens < t.quiet) return 0;
  if (tokens < t.p50) return 1;
  if (tokens < t.p75) return 2;
  if (tokens < t.p90) return 3;
  return 4;
}

// ---------- 派生指标 ----------
function longestStreak(totals: Record<string, number>, quiet: number): number {
  const active = Object.keys(totals).filter((d) => totals[d] > quiet).sort();
  let best = 0, run = 0;
  let prev: string | null = null;
  for (const d of active) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}
export function computeMetrics(byDay: ByDay, today: string): Metrics {
  const totals = dailyTotals(byDay);
  const t = computeThresholds(byDay);
  const month = today.slice(0, 7);
  let cumulative = 0, peak = 0, thisMonth = 0;
  for (const [date, val] of Object.entries(totals)) {
    cumulative += val;
    if (val > peak) peak = val;
    if (date.slice(0, 7) === month) thisMonth += val;
  }
  return { cumulative, peak, thisMonth, streak: longestStreak(totals, t.quiet) };
}

// ---------- 53×7 网格（列优先，周日在上）----------
export function buildGrid(byDay: ByDay, today: string): Cell[] {
  const totals = dailyTotals(byDay);
  const t = computeThresholds(byDay);
  const gridEnd = addDays(today, 6 - weekday(today)); // 本周周六
  const gridStart = addDays(gridEnd, -(53 * 7 - 1));  // 53 周前的周日
  const cells: Cell[] = [];
  let cur = gridStart;
  for (let i = 0; i < 53 * 7; i++) {
    const future = cur > today;
    const tokens = totals[cur] ?? 0;
    cells.push({
      date: cur,
      tokens,
      level: future ? 0 : gradeLevel(tokens, t),
      empty: future,
    });
    cur = addDays(cur, 1);
  }
  return cells;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function monthLabels(cells: Cell[]): string[] {
  const cols = 53;
  const labels: string[] = new Array(cols).fill('');
  let lastLabelCol = -3;
  let lastLabeledMonth = -1;
  for (let c = 0; c < cols; c++) {
    const top = cells[c * 7]; // 该列周日格
    const m = toUTC(top.date).getUTCMonth();
    if (m !== lastLabeledMonth && c - lastLabelCol >= 3) {
      labels[c] = MONTHS[m];
      lastLabelCol = c;
      lastLabeledMonth = m;
    }
  }
  return labels;
}

// ---------- 格式化 ----------
export function formatM(tokens: number, decimals = 1): string {
  return (tokens / 1e6).toFixed(decimals);
}
export function cellTitle(cell: Cell): string {
  if (cell.empty) return '';
  if (cell.tokens <= 0) return `${cell.date} · 安静的一天`;
  return `${cell.date} · ${formatM(cell.tokens, 1)}M tokens`;
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/lib/usage.test.ts`
预期：PASS（全部用例）。若 `monthLabels` 或 `streak` 个别断言因样本太小不稳，依实现语义微调测试期望，但不得放宽核心不变量（371 格、周日起、future=empty、单调分级）。

- [ ] **Step 6: 全量测试 + 构建**

```bash
npm test
npm run build
```
预期：所有 TS 测试通过；构建成功。

- [ ] **Step 7: 提交**

```bash
git add src/lib/usage.ts src/lib/usage.test.ts
git commit -m "feat: usage.ts 派生指标、自适应分级与热力图网格（TDD）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: TokenHeatmap 组件（接 usage.ts + usage.json）

**Files:**
- Create: `src/components/TokenHeatmap.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 创建 `src/components/TokenHeatmap.astro`**

结构对照原型第 531–580 行；汇总数字、月标签、371 格全部由 `usage.ts` 生成。`today` 用构建时本地日期：

```astro
---
import usageData from '../data/usage.json';
import {
  buildGrid, monthLabels, computeMetrics, formatM, cellTitle,
  type UsageData,
} from '../lib/usage';

const data = usageData as unknown as UsageData;
const today = new Date().toISOString().slice(0, 10);

const cells = buildGrid(data.byDay, today);
const months = monthLabels(cells);
const m = computeMetrics(data.byDay, today);

const summary = [
  { num: formatM(m.cumulative, 0), unit: 'M', label: '累计 token', peak: false },
  { num: String(m.streak),         unit: '天', label: '最长连续 streak', peak: false },
  { num: formatM(m.peak, 1),       unit: 'M', label: '单日峰值', peak: true },
  { num: formatM(m.thisMonth, 0),  unit: 'M', label: '本月 token', peak: false },
];
const weekdays = ['', '一', '', '三', '', '五', ''];
---
<section class="module reveal" id="tokens">
  <div class="module-head">
    <span class="kicker">Token activity</span>
  </div>
  <div class="heat-card">
    <div class="heat-summary">
      {summary.map((s) => (
        <div class={s.peak ? 'summary-item peak' : 'summary-item'}>
          <div class="s-num">{s.num}<span class="unit">{s.unit}</span></div>
          <div class="s-lbl">{s.label}</div>
        </div>
      ))}
    </div>

    <div class="heat-scroll">
      <div class="heat-board">
        <div class="heat-weekdays">
          {weekdays.map((w) => <span>{w}</span>)}
        </div>
        <div class="heat-main">
          <div class="heat-months">
            {months.map((label) => <span>{label}</span>)}
          </div>
          <div class="heat-cells">
            {cells.map((cell) => (
              <div class={cell.empty ? 'cell empty' : `cell l${cell.level}`} title={cellTitle(cell)}></div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div class="heat-legend">
      <span>少</span>
      <div class="swatches">
        <div class="cell l0"></div>
        <div class="cell l1"></div>
        <div class="cell l2"></div>
        <div class="cell l3"></div>
        <div class="cell l4"></div>
      </div>
      <span>多</span>
    </div>
  </div>
</section>
```

- [ ] **Step 2: 把 TokenHeatmap 插入首页（Intro 之后、ProjectProgress 之前）**

```astro
---
import Base from '../layouts/Base.astro';
import Intro from '../components/Intro.astro';
import TokenHeatmap from '../components/TokenHeatmap.astro';
import ProjectProgress from '../components/ProjectProgress.astro';
import LearningProgress from '../components/LearningProgress.astro';
import Colophon from '../components/Colophon.astro';
---
<Base>
  <Intro />
  <TokenHeatmap />
  <ProjectProgress />
  <LearningProgress />
  <Colophon />
</Base>
```

- [ ] **Step 3: 构建 + dev 人工核对**

```bash
npm run build
```
预期：成功。`dist/index.html` 的 `.heat-cells` 恰含 371 个 `div.cell`，`.heat-months` 含 53 个 `span`，4 个 `summary-item`（第 3 个含 `peak`）。

```bash
npm run dev
```
预期：种子数据下，热力图在 712px 版心内**无横向滚动**；最近几天（5/26、5/28、5/29）为较亮格、hover 放大、原生 tooltip 显示「日期 · xM tokens」或「安静的一天」；图例 `少…多` 在右下。与 `design/index.html` 结构一致（数字会因种子数据不同，属正常）。核对后停掉 dev。

- [ ] **Step 4: 提交**

```bash
git add src/components/TokenHeatmap.astro src/pages/index.astro
git commit -m "feat: 数据驱动的 Token 热力图组件

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: `aggregate-usage.py` Python 聚合器（TDD）

**Files:**
- Create: `scripts/aggregate-usage.py`, `scripts/test_aggregate_usage.py`

> 约束：**纯 stdlib、兼容 Python 3.9**（避免 3.10+ 语法）。本地与远端（仅有 python3）都要能直接跑。

- [ ] **Step 1: 写失败测试 `scripts/test_aggregate_usage.py`**

```python
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

    def test_missing_roots_yield_empty(self):
        with tempfile.TemporaryDirectory() as root:
            acc = agg.aggregate(os.path.join(root, "nope1"), os.path.join(root, "nope2"))
            self.assertEqual(acc, {})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `python3 -m unittest scripts/test_aggregate_usage.py -v`
预期：FAIL/ERROR（`aggregate-usage.py` 不存在或无 `aggregate`）。

- [ ] **Step 3: 实现 `scripts/aggregate-usage.py`**

```python
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `python3 -m unittest scripts/test_aggregate_usage.py -v`
预期：3 个用例全 PASS。

- [ ] **Step 5: 冒烟跑一次本机真实数据（只看输出形状，不入库）**

```bash
python3 scripts/aggregate-usage.py | python3 -m json.tool | head -20
```
预期：打印形如 `{"2026-04-16": {"claude": 1234567, "codex": 0}, ...}` 的 JSON（日期数量取决于本机历史保留）。

- [ ] **Step 6: 提交**

```bash
git add scripts/aggregate-usage.py scripts/test_aggregate_usage.py
git commit -m "feat: Python 纯 stdlib token 聚合器，双源去 cache（TDD）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: `merge.mjs` 合并逻辑（TDD）+ `machines.json`

**Files:**
- Create: `scripts/merge.mjs`, `scripts/merge.test.mjs`, `scripts/machines.json`

- [ ] **Step 1: 写失败测试 `scripts/merge.test.mjs`**

```js
import { describe, it, expect } from 'vitest';
import { mergeUsage } from './merge.mjs';

const EMPTY = { meta: {}, byDay: {} };
const SYNC = '2026-05-29T12:00:00.000Z';

describe('mergeUsage', () => {
  it('按 machine→tool 分桶写入', () => {
    const out = mergeUsage(EMPTY, {
      macbook: { '2026-05-01': { claude: 100, codex: 0 } },
    }, SYNC);
    expect(out.byDay['2026-05-01'].macbook).toEqual({ claude: 100, codex: 0 });
    expect(out.meta.machines).toEqual(['macbook']);
    expect(out.meta.lastSync).toBe(SYNC);
  });

  it('两台机同一天并存，互不覆盖', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-05-01': { claude: 100 } } }, SYNC);
    const b = mergeUsage(a, { 'mac-mini': { '2026-05-01': { codex: 50 } } }, SYNC);
    expect(b.byDay['2026-05-01'].macbook).toEqual({ claude: 100, codex: 0 });
    expect(b.byDay['2026-05-01']['mac-mini']).toEqual({ claude: 0, codex: 50 });
    expect(b.meta.machines.sort()).toEqual(['mac-mini', 'macbook']);
  });

  it('重跑同一台机幂等（覆盖而非累加）', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-05-01': { claude: 100 } } }, SYNC);
    const again = mergeUsage(a, { macbook: { '2026-05-01': { claude: 100 } } }, SYNC);
    expect(again.byDay['2026-05-01'].macbook).toEqual({ claude: 100, codex: 0 });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run scripts/merge.test.mjs`
预期：FAIL（`merge.mjs` 不存在）。

- [ ] **Step 3: 实现 `scripts/merge.mjs`**

```js
// 纯函数：把各机聚合结果按 machine→tool 分桶合并进 usage 数据。
// 覆盖式写入 => 重跑某台只改它自己的桶，天然幂等。
export function mergeUsage(existing, perMachine, lastSync) {
  const byDay = {};
  for (const [date, machines] of Object.entries(existing.byDay || {})) {
    byDay[date] = {};
    for (const [mid, tools] of Object.entries(machines)) {
      byDay[date][mid] = { claude: tools.claude || 0, codex: tools.codex || 0 };
    }
  }
  for (const [mid, dates] of Object.entries(perMachine)) {
    for (const [date, tools] of Object.entries(dates)) {
      if (!byDay[date]) byDay[date] = {};
      byDay[date][mid] = { claude: tools.claude || 0, codex: tools.codex || 0 };
    }
  }
  const machines = [
    ...new Set([...(existing.meta?.machines || []), ...Object.keys(perMachine)]),
  ].sort();
  return {
    meta: { lastSync, metric: 'io_no_cache', tools: ['claude', 'codex'], machines },
    byDay,
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run scripts/merge.test.mjs`
预期：3 个用例全 PASS。

- [ ] **Step 5: 创建 `scripts/machines.json`**

（远端 host 取自 spec §5：已验证 `user@<your-tailscale-ip>` 免密 SSH + python3 可用。）

```json
{
  "local": { "id": "macbook" },
  "remotes": [
    { "id": "mac-mini", "ssh": "user@<your-tailscale-ip>" }
  ]
}
```

- [ ] **Step 6: 提交**

```bash
git add scripts/merge.mjs scripts/merge.test.mjs scripts/machines.json
git commit -m "feat: 幂等合并逻辑与机器配置（TDD）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: `collect-usage.mjs` 编排器 + 生成真实 usage.json

**Files:**
- Create: `scripts/collect-usage.mjs`
- Modify: `src/data/usage.json`（由脚本生成覆盖）

- [ ] **Step 1: 实现 `scripts/collect-usage.mjs`**

```js
// Node 编排：本地 python3 聚合 + 各远端 ssh 喂脚本聚合 => 合并写 usage.json。
// 远端不可达/无 python3 时打印警告并降级为只采本地，不中断。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeUsage } from './merge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const aggScript = join(__dirname, 'aggregate-usage.py');
const machinesPath = join(__dirname, 'machines.json');
const usagePath = join(repoRoot, 'src', 'data', 'usage.json');
const MAX = 1024 * 1024 * 128;

function runLocal() {
  const out = execFileSync('python3', [aggScript], { encoding: 'utf8', maxBuffer: MAX });
  return JSON.parse(out);
}
function runRemote(host) {
  const script = readFileSync(aggScript, 'utf8');
  const out = execFileSync('ssh', [host, 'python3 -'], { input: script, encoding: 'utf8', maxBuffer: MAX });
  return JSON.parse(out);
}

const machines = JSON.parse(readFileSync(machinesPath, 'utf8'));
const perMachine = {};

try {
  perMachine[machines.local.id] = runLocal();
  console.log(`[ok] local ${machines.local.id}: ${Object.keys(perMachine[machines.local.id]).length} days`);
} catch (e) {
  console.warn(`[warn] 本地聚合失败: ${e.message}`);
}

for (const r of machines.remotes || []) {
  try {
    perMachine[r.id] = runRemote(r.ssh);
    console.log(`[ok] remote ${r.id} via ${r.ssh}: ${Object.keys(perMachine[r.id]).length} days`);
  } catch (e) {
    console.warn(`[warn] 远端 ${r.id} (${r.ssh}) 不可达，降级跳过: ${e.message}`);
  }
}

const existing = existsSync(usagePath)
  ? JSON.parse(readFileSync(usagePath, 'utf8'))
  : { meta: {}, byDay: {} };
const merged = mergeUsage(existing, perMachine, new Date().toISOString());
writeFileSync(usagePath, JSON.stringify(merged, null, 2) + '\n');
console.log(`[done] 写入 ${usagePath}，共 ${Object.keys(merged.byDay).length} 天`);
```

- [ ] **Step 2: 运行采集，生成真实数据**

```bash
npm run collect
```
预期：打印 `[ok] local macbook: N days`；远端 mac-mini 可达则 `[ok] remote ...`，否则 `[warn] ... 降级跳过`（不报错中断）；最后 `[done] 写入 .../usage.json，共 M 天`。`src/data/usage.json` 被真实数据覆盖。

- [ ] **Step 3: 校验生成的 usage.json 结构**

```bash
node -e "const d=require('./src/data/usage.json'); console.log(Object.keys(d.byDay).length,'days; meta=',JSON.stringify(d.meta))"
```
预期：天数 > 0；`meta.metric==='io_no_cache'`、`meta.machines` 含 `macbook`（远端可达则含 `mac-mini`）、`meta.lastSync` 为当前时间。

- [ ] **Step 4: 用真实数据构建并人工核对**

```bash
npm run build && npm run dev
```
预期：热力图与 4 个汇总数字现在反映真实用量；近 6 周（Claude）与更早（Codex 若有）有数据、更早偏空——符合 spec §6「历史保留」预期。版心内无横向滚动。核对后停掉 dev。

- [ ] **Step 5: 提交**

```bash
git add scripts/collect-usage.mjs src/data/usage.json
git commit -m "feat: collect 编排器（本地+ssh 远端降级），接入真实用量数据

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: GitHub Pages 部署工作流

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 向用户确认部署形态**

确认 GitHub 用户名与仓库形态：
- 项目页（仓库名 `wasmir-blog`）→ `astro.config.mjs` 保持 `site: 'https://<user>.github.io'` + `base: '/wasmir-blog'`；
- 用户页（仓库名 `<user>.github.io`）→ 删掉 `base`，`site` 设为 `https://<user>.github.io`。

按确认结果在 Task 1 Step 4 的 `astro.config.mjs` 里把 `<user>` 改成真实用户名（若与推断的 `wasmir` 不符）。

- [ ] **Step 2: 创建 `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: 本地最终校验（CI 等价构建）**

```bash
npm ci
npm test
npm run test:py
npm run build
```
预期：依赖干净安装、TS 测试通过、Python 测试通过、构建成功生成 `dist/`。（CI 读不到 `~/.claude`，故依赖已提交的 `usage.json`——确认它在 git 里。）

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages 构建与部署工作流

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: 推送与启用 Pages（需用户在 GitHub 侧操作）**

在 GitHub 建好 `wasmir-blog` 远端仓库后：

```bash
git branch -M main
git remote add origin git@github.com:<user>/wasmir-blog.git
git push -u origin main
```
然后在仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。预期：Actions 跑 build+deploy，完成后 `https://<user>.github.io/wasmir-blog/` 可访问。

---

## 验收对照（spec §10）

- 单元测试：`npm test`（content.ts、usage.ts、merge.mjs）+ `npm run test:py`（aggregate-usage.py，含 Codex 减 cache、跳过 null info、Python 3.9）全绿。
- 构建：`npm run build` 成功；首页 712px 版心无横向滚动。
- 视觉：dev 下逐块对照 `design/index.html`（Task 3/5/7 的核对步骤）。
- 降级：JS 关闭时内容照常可见（reveal 脚本 `is:inline` 且无 JS 时直接显示）；`prefers-reduced-motion` 下无动效（CSS 已含）。
- 管道降级：远端不可达时 `npm run collect` 警告并只采本地，不中断（Task 10 Step 2）。

---

## 自审记录

- **Spec 覆盖**：§2 范围（首页四区块+管道+Pages）→ Task 2–11；§3 技术栈/目录→ Task 1–2、文件结构表；§4 视觉/删死 CSS→ Task 2 Step 2；§5 数据模型（projects/learning/machines/usage）→ Task 4/9/2;§6 管道双源去 cache→ Task 8（Claude `in+out`、Codex 减 `cached_input`）；§7 派生指标+自适应分级+53×7 网格→ Task 6；§8 部署→ Task 11；§9 组件拆分→ Task 3/5/7；§10 测试→ 各 Task TDD + 验收对照；§11 风险（历史保留/SSH 降级/token_count 用 last_token_usage 增量/隐私）→ 已落到 Task 8/10 实现与注释。
- **类型一致性**：`ProjectStatus`/`LearningStatus` 在 content.ts 定义并被 ProjectProgress 复用；`UsageData`/`ByDay`/`Cell`/`Metrics`/`Thresholds`/`Level` 在 usage.ts 定义，被 TokenHeatmap/Colophon/测试复用；函数名 `dayTotal/dailyTotals/computeThresholds/gradeLevel/computeMetrics/buildGrid/monthLabels/formatM/cellTitle`、`sortProjects/groupLearning/loadProjects/loadLearning`、`mergeUsage`、`aggregate` 全计划内一致。
- **占位符扫描**：无 TBD/TODO 式空步骤；唯一外部依赖项是 GitHub 用户名（Task 11 Step 1 显式确认），不阻塞编码任务。
