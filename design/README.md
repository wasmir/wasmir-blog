# Handoff: Wasmir 个人主页（单页 homepage）

## Overview
A single-page personal homepage for **Wasmir**, an independent developer who works alongside AI. The page is a centered, blog-style column (not wide) with four stacked sections:

1. **Intro** — name + a small one-line tagline.
2. **Token activity heatmap** — a GitHub-contributions-style year grid of daily AI token usage, plus four summary numbers.
3. **Project progress** — a status list of "things I've built with AI" (TODO / DOING / FINISH / DROPPED), with a progress bar on in-progress items.
4. **Learning progress** — AI topics grouped into "已完成 / 学习中" as compact progress bars.

The page is designed for a planned **Astro static site**. There is **no heavy client framework** — everything renders from static HTML + CSS, with one tiny vanilla-JS scroll-reveal enhancement that degrades gracefully.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look, layout, and behavior. They are **not** meant to be shipped verbatim.

The task is to **recreate this design in the target codebase (Astro)** using its idioms: split the markup into `.astro` components, generate the heatmap cells and the project/learning lists from data (see **Data Structures** below) instead of hand-writing each node, and keep the design tokens in a shared stylesheet. If a different framework is ultimately chosen, the same structure applies (a component per section, data-driven lists).

Because the source is already plain HTML/CSS, porting is mostly: (a) move `styles/tokens.css` in as a global stylesheet, (b) turn each `<section>` into a component, (c) replace the static list/grid items with `.map()` over real data.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, and interactions are all specified and pulled from the Wasmir design system. Recreate pixel-for-pixel. All values below are exact.

---

## Design System & Tokens
All visual values come from the **Wasmir design system**. The single source of truth is **`styles/tokens.css`** (included in this bundle) — import it globally and use the CSS custom properties; **do not hardcode hexes** in components. Key tokens:

### Fonts (Google Fonts, loaded via `@import` at the top of `tokens.css`)
- **Display** — `Bricolage Grotesque` (700/800) → `var(--font-display)`. Name, project/blurb titles.
- **Text** — `Hanken Grotesk` (300–800) → `var(--font-text)`. Body, blurbs, UI.
- **Mono** — `Space Mono` → `var(--font-mono)`. Micro-labels, status badges, numbers, month/weekday labels.

### Colors
| Token | Hex | Use |
|---|---|---|
| `--cream` | `#FBFAF6` | page background |
| `--white` | `#FFFFFF` | card / heatmap surface |
| `--ink-900` | `#1A1916` | headings, name |
| `--ink-800` | `#242220` | body text, "done" progress fill |
| `--ink-600` | `#5C574E` | secondary text (`--text-muted`) |
| `--ink-500` | `#7D776C` | dropped item name |
| `--ink-400` | `#ABA59A` | subtle text (`--text-subtle`) |
| `--ink-300` | `#D8D3C8` | strong hairline (`--border-strong`) |
| `--ink-200` | `#ECE8DF` | default border (`--border`) |
| `--ink-100` | `#F3F0E9` | subtle fill, progress track |
| `--pop` | `#C6F24D` | lime accent — heatmap peak, in-progress bars, highlight |
| `--pop-soft` | `#EEF9C9` | lime tint — DOING badge bg |
| `--pop-ink` | `#1F2A00` | text on lime |
| `--danger` | `#BC4A30` | DROPPED badge text/dot |
| `--danger-soft` | `#F6E1DA` | DROPPED badge bg |

**Lime discipline:** lime is the only accent and is used sparingly (heatmap high-activity cells, in-progress bars, the one tagline highlight). Never as a large flat fill.

### Spacing (4px base) — `--space-1`=4 … `--space-6`=24, `--space-8`=32, `--space-12`=48, `--space-16`=64, `--space-20`=80
### Radii — `--radius-sm`=10, `--radius-md`=14, `--radius-lg`=18, `--radius-xl`=24, `--radius-pill`=999
### Shadows — `--shadow-xs`, `--shadow-sm`, `--shadow-md` (soft, warm-tinted, low-opacity)
### Motion — `--ease-out`, `--ease-spring`, `--dur-fast`=120ms, `--dur-base`=200ms

### Voice / copy rules
- Sentence case everywhere. No emoji. First person singular.
- The only uppercase is the mono micro-label (section labels, status badges).
- Chinese body copy + English mono micro-labels.

---

## Data Structures
The two list sections must be **data-driven**. Suggested shapes:

```ts
// Project progress
type Project = {
  name: string;            // 项目名, e.g. "AboutMeinAI"
  blurb: string;           // 一句话简介
  status: 'todo' | 'doing' | 'finish' | 'dropped';
  progress?: number;       // 0–100, only meaningful when status === 'doing'
};

// Learning progress
type Learning = {
  topic: string;           // 主题, e.g. "RAG"
  status: 'learning' | 'done';
  progress?: number;       // 0–100, only meaningful when status === 'learning'
};

// Token heatmap — one entry per day
type TokenDay = {
  date: string;            // 'YYYY-MM-DD'
  tokens: number;          // millions of tokens that day, e.g. 2.3
};
```

**Current prototype data (placeholders — replace with real data):**

Projects (rendered in this order — DOING first, DROPPED last):
1. `AboutMeinAI` · doing · 70 — "你正在看的这个站。把我和 AI 协作的轨迹摊开来给人看。"
2. `滴答清单会话沉淀` · doing · 40 — "把对话自动归档成结构化笔记，沉到滴答清单里随时翻。"
3. `本地笔记 RAG 问答` · todo — "把这些年的笔记接进本地检索，问它就行 —— 还没动手。" *(example, replaceable)*
4. `Coze 工作流批量生图` · finish — "用 API 批量生成封面图，一次跑完一整批，不用手点。"
5. `英语沉浸式陪练` · finish — "i+1 渐进式英文对话，难度跟着我的水平一点点往上走。"
6. `自动追更脚本` · dropped — "想自动抓更新，做一半发现没必要，先搁置了。" *(example, replaceable)*

Learning — 已完成 (done, 100): `Prompt Engineering`, `RAG`, `Agent / 工具调用`, `MCP`, `Claude Code`.
Learning — 学习中 (learning): `多 Agent 编排` 55, `Fine-tuning` 35, `Evals 评测` 45, `上下文工程` 60.

Summary numbers (heatmap header, hardcoded display values): 累计 token **180M** · 最长连续 streak **23 天** · 单日峰值 **4.2M** · 本月 **26M**.

---

## Layout — global
- Centered column: `.page { max-width: 712px; margin: 0 auto; padding: 0 24px 120px; }`
- Each section: `.module { padding-top: 72px; }`
- Section header: a single mono micro-label with a 7×7px lime square marker (`::before`), uppercase, `letter-spacing: var(--tracking-caps)`, color `--text-muted`. No big Chinese headings — kept intentionally minimal.

---

## Sections (recreate exactly)

### 1. Intro
- A small wordmark row: **`Wasmir.`** in `--font-display` 800, 23px, `-0.02em`; the trailing `.` is `--pop` colored.
- Below, a small one-line tagline in `--font-text` 13px, `--text-subtle`: `fuck that, we are going to get it done` — where **`get it done`** is wrapped in a lime highlight: bg `--pop-soft`, color `--pop-ink`, `padding: 0 5px`, `border-radius: 5px`, `white-space: nowrap` (so the highlighted phrase never splits across lines).
- The tagline sits inline after the name (`.intro-id { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }`).
- Intentionally tiny — this is not a hero. No logo (the user hasn't decided on a logo yet — leave a slot).

### 2. Token activity heatmap
- Mono section label: `TOKEN ACTIVITY`.
- **Card:** `--white` bg, `1px var(--border)`, `border-radius: var(--radius-xl)` (24px), `--shadow-sm`, `padding: 24px`.
- **Summary row:** 4-column grid. Each item: number in `--font-display` 800, `clamp(22px,5vw,30px)`, `-0.025em`; the unit (M/天) is `0.55em`, weight 700, `--text-muted`; label below in 12px `--text-subtle`. The "单日峰值" item is prefixed by a 9×9px lime square.
- **Heatmap grid (GitHub-style):**
  - 53 columns × 7 rows (Sun→Sat top to bottom), ~1 year ending "today".
  - Layout: `.heat-board { display:inline-flex; gap:6px; align-items:flex-start; }` → a weekday-label column + a main column.
  - Weekday labels (`一 三 五` only) in a `grid-template-rows: repeat(7, 9px); gap:2px;` column, `margin-top:20px` to clear the months row, mono 9px.
  - Main column = month labels row (mono 10px, `grid-auto-columns:11px`, label only at month boundaries with ≥3-column spacing to avoid collisions) above the cells grid.
  - Cells: `grid-template-rows: repeat(7, 9px); grid-auto-flow: column; grid-auto-columns: 9px; gap: 2px;`. Each cell `9×9px`, `border-radius: 2px`, `inset 0 0 0 1px rgba(36,34,32,0.04)`.
  - **At 9px cells the full year fits the 712px column with no horizontal scroll** — keep it that way; the card wraps in an `overflow-x:auto` so it scrolls only if a viewport is narrower.
  - Hover: `transform: scale(1.45)`. Native `title` tooltip per cell: `"2026-03-14 · 2.3M tokens"` (or `"… · 安静的一天"` for empty days).
- **Heatmap intensity ramp (5 levels)** — map each day's token count to a level, low→high:
  | Level | Color | Threshold (M tokens) |
  |---|---|---|
  | l0 | `#ECE8DF` | `< 0.12` (quiet) |
  | l1 | `#DEE6C4` | `< 1.0` |
  | l2 | `#CAE889` | `< 2.0` |
  | l3 | `#C6F24D` (`--pop`) | `< 3.0` |
  | l4 | `#A6CE34` | `>= 3.0` |
  Distribution intent: weekdays mid-high, weekends light, the most recent ~month visibly denser/heavier. (Prototype uses a seeded generator; in production drive it from real `TokenDay[]`.)
- **Legend:** bottom-right — `少` + five swatch cells (l0→l4) + `多`, mono 11px.
- Future cells (after today, within the last column) render as `.cell.empty` (transparent, no border).

### 3. Project progress
- Mono section label: `PROJECT PROGRESS`.
- A single ruled list (`.pj-list` border-top; each `.pj-item` border-bottom; `padding: 18px 2px; gap: 9px;`), ordered **DOING first → … → DROPPED last**.
- Each item:
  - **Head row** (`display:flex; align-items:center; gap:12px;`): status **badge**, then **name** (`--font-display` 700, 17px, flex:1), then **percent** (mono 12px `--text-subtle`) — percent only shown for `doing`.
  - **Blurb** (`--font-text` 14px, `--text-muted`, `max-width:62ch`).
  - **Progress track** (only for `doing`): `height:6px; background:--ink-100; radius:pill; overflow:hidden;` with a lime fill (`background:--pop`, width = `progress%`). Fill element must be `display:block`.
- **Status badges** (mono, 10px, `letter-spacing:0.1em`, uppercase, pill, with a 6px leading dot):
  | status | label | bg | text | dot |
  |---|---|---|---|---|
  | doing | `DOING` | `--pop-soft` | `--pop-ink` | `--pop` (with `0 0 0 3px rgba(198,242,77,.35)` ring) |
  | todo | `TODO` | transparent, `1px --border-strong` | `--ink-500` | hollow (inset ring `--ink-400`) |
  | finish | `DONE` | `--ink-100` | `--ink-600` | `--ink-400` |
  | dropped | `DROPPED` | `--danger-soft` | `--danger` | `--danger` |
- **Dropped item:** whole row `opacity: 0.55`; name gets `line-through` (`text-decoration-color: --ink-400`, color `--ink-500`). No bar, no percent.
- **Finish/Todo:** no bar, no percent.

### 4. Learning progress
- Mono section label: `LEARNING PROGRESS`.
- Two groups (`.prog-board { display:flex; flex-direction:column; gap:26px; }`): **已完成** then **学习中**. Each group has a `.pc-head` (mono uppercase label with a colored 8px dot — `--ink-800` for done, `--pop` w/ soft ring for learning).
- Each row (`.prog-item`, `display:flex; align-items:center; gap:14px; padding:11px 0; border-top:1px solid --border;`):
  - **name** (fixed `width:168px`, weight 600, 15px, `--ink-900`),
  - **track** (`flex:1; height:7px; --ink-100; radius:pill; overflow:hidden;`),
  - **fill** (`display:block; height:100%;` — `--ink-800` for done, `--pop` for learning; width = `progress%`; done = 100%),
  - **percent** (mono 11px `--text-subtle`, `width:34px; text-align:right`).

### Colophon
- A thin top-bordered row, mono 12px `--text-subtle`, space-between: `© 2026 Wasmir` · `最后同步 · 2026-05-29`.

---

## Interactions & Behavior
- **Scroll reveal:** sections with `.reveal` start at `opacity:0; translateY(14px)` and animate to visible (`opacity .6s, transform .6s var(--ease-out)`) when scrolled into view, via a tiny `IntersectionObserver`. If JS is off / unsupported, content shows immediately (graceful). Respect `prefers-reduced-motion: reduce` (disables all reveal + hover transforms — already in the CSS).
- **Heatmap cell hover:** scale 1.45, native `title` tooltip.
- **Project item:** static (no hover lift in the current list version).
- No routing, no client state — fully static.

## Responsive behavior
- `max-width: 560px`: heatmap summary becomes 2 columns; learning `name` width shrinks to 120px; tagline/intro reflow naturally. The centered column simply narrows with its 24px side padding.

## Assets
- `assets/logo-mark.svg` — the Wasmir lime "W" badge from the design system. **Currently NOT used on the page** (user is undecided on a logo). Included for reference / future use.
- Fonts load from Google Fonts CDN via `tokens.css` `@import`. For an offline/perf-optimized Astro build, consider self-hosting the three families (`@fontsource` or local `.woff2`) and removing the `@import`.
- Icons: the design system standard is **Lucide** (stroke icons). None are used on this page currently.

## Files in this bundle
- `index.html` — the full hifi prototype (all four sections + inline `<style>` + the reveal script).
- `styles/tokens.css` — the Wasmir design-system tokens + base element/component classes. **Source of truth for all values.**
- `assets/logo-mark.svg` — logo mark (unused, for reference).

## Implementation notes / cleanup
- **Dead CSS:** the prototype went through earlier explorations (a CSS-only segmented toggle with card/list/pill variants). Those variants' markup was removed, but some now-unused rules remain in `index.html`'s `<style>` (`.vswitch`, `.seg`, `.variant*`, `.proj-card*`, `.proj-row*`, `.pill*`, `.learn-group*`, `.variant--prog`, plus the `#pv-*`/`#lv-*` toggle wiring). Safe to delete during the port. Keep: `.badge*`, `.prog-board`, `.prog-col`, `.prog-item`, `.pi-*`, `.pc-head`, `.lg-dot`, `.pj-*`, `.heat-*`, `.cell*`, `.intro*`, `.module*`, `.kicker`, `.colophon`.
- Generate the 53×7 heatmap from `TokenDay[]` (don't hand-write 371 cells). The level thresholds are above.
- The four summary numbers and the tagline are static copy — wire them to data/config if they should update.
