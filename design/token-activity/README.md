# Handoff: Token activity (热力图 + data-loss 蒙版)

A focused handoff for the **Token activity** section of the Wasmir homepage — the GitHub-style
contribution heatmap, its four summary numbers, and the new **data-loss mask** that covers the
period before token logging began.

> This is a component-level handoff. The full-page handoff lives in
> `design_handoff_wasmir_homepage/`. Anything not covered here (global layout, fonts, the other two
> sections) is defined there.

## Files in this bundle
- `index.html` — isolated hifi prototype of just the Token activity card (centered for review). Contains the heatmap CSS, the markup, and the data-loss JS.
- `styles/tokens.css` — Wasmir design-system tokens. **Source of truth for all values; never hardcode hexes.**
- `assets/logo-mark.svg` — for reference (unused on this card).

## Fidelity
**High-fidelity.** Recreate exactly. Two things changed since the last homepage handoff, both
captured below:
1. The heatmap ramp moved from the lime scale to the **classic GitHub green scale**.
2. A **data-loss mask** was added over all days before the data-start cutoff.

---

## 1 · The card (unchanged structurally)

- Mono section label `TOKEN ACTIVITY` (7×7px lime square marker via `.kicker::before`).
- **Card:** `--white` bg, `1px var(--border)`, `border-radius: var(--radius-xl)` (24px), `--shadow-sm`, `padding: 24px`.
- **Summary row:** 4-column grid. Number in `--font-display` 800, `clamp(22px,5vw,30px)`, `-0.025em`; unit (M/天) `0.55em`/700/`--text-muted`; label 12px `--text-subtle`. The "单日峰值" item is prefixed by a 9×9px lime square. These four numbers are static display copy — wire to data if they should update.
- **Grid geometry:** `.heat-cells { grid-template-rows: repeat(7, 9px); grid-auto-flow: column; grid-auto-columns: 9px; gap: 2px; }`. Each cell `9×9px`, `radius 2px`. Weekday labels `一 三 五`; month labels only at month boundaries. Card wraps in `overflow-x:auto`. Rolling ~1-year window (53 columns) ending "today".
- **Legend:** bottom-right `少 [l0…l4] 多`, mono 11px.
- Hover: `transform: scale(1.45)`, native `title` tooltip per cell (`"2026-04-16 · 1.1M tokens"`, or `"… · 安静的一天"`).

### Intensity ramp — NOW CLASSIC GITHUB GREEN
Map each day's token count to a level, low→high. **These hexes are deliberately raw GitHub greens, not design-system tokens** — they're the one intentional exception to "tokens only," because the brand brief asked for the recognizable GitHub heatmap. Keep them as literals (or add them to `tokens.css` as `--heat-l1…l4` if you prefer).

| Level | Hex | Threshold (M tokens) |
|---|---|---|
| `l0` | `#EBEDF0` | `< 0.12` (quiet / empty) |
| `l1` | `#9BE9A8` | `< 1.0` |
| `l2` | `#40C463` | `< 2.0` |
| `l3` | `#30A14E` | `< 3.0` |
| `l4` | `#216E39` | `>= 3.0` |

---

## 2 · Data-loss mask  ← read this carefully

**The problem it solves:** token logging only started on **2026-04-16**. Everything before that is
genuinely gone — not "zero activity," just missing. The card must say so honestly instead of
drawing fake empty cells that read as "quiet days."

**The treatment:** the leading span of the grid (every day strictly before the cutoff) is
neutralized to flat gray, a faint diagonal-hatch scrim is laid over it, a **dashed vertical
boundary** marks the cutoff column, and a small mono pill floats in the band:
`▢ DATA LOSS · 4.16 之前数据缺失`.

### ⚠️ This must be DATA-DRIVEN and DYNAMIC — not a fixed gray block
The single most important thing about this feature: **the mask is computed from the data every
render. It is NOT a hardcoded width and NOT a hardcoded list of "lost" cells.** It is driven by one
input — the cutoff date — and it must re-flow on its own as the dataset grows. Concretely:

1. **One input: `dataStartDate` = `2026-04-16`.** Any day with `date < dataStartDate` is `lost`. The
   first day `>= dataStartDate` is the boundary.
2. **The band spans from the grid's left edge to the cutoff column** — measured, not guessed. In the
   prototype: `overlay.style.width = firstAliveCell.offsetLeft - 1`.
3. **As real post-cutoff data accumulates, the green region grows to the right and the band stays
   pinned to the cutoff** — so the band's *share* of the card shrinks on its own. No code change per
   new day of data.
4. **Because the heatmap is a rolling ~1-year window ending today, the cutoff column drifts left
   over time.** Roughly one year after the cutoff (≈ 2027-04-16) the cutoff scrolls off the left
   edge: the band shrinks toward zero and then **disappears entirely** — at which point there are no
   `.lost` cells left and the overlay must not render at all. The guard
   `if (!cells.querySelector('.cell.lost')) return;` already does this; preserve it.

In short: **today the band covers most of the card; in a month it covers less; eventually it's
gone.** That lifecycle is the feature — don't freeze it into a static asset.

### Edge cases the implementation must handle
| Situation | Expected behavior | Prototype status |
|---|---|---|
| Some pre-cutoff + some post-cutoff days visible (today) | Band over the pre-cutoff span, green to the right | ✅ handled |
| Cutoff older than the visible window (≈1yr+ later) | No `.lost` cells → **no band** | ✅ handled (guard returns early) |
| Cutoff falls mid-week (partial column) | Boundary snaps to that column's **left edge**; the 1–6 pre-cutoff cells in that column still render gray `.lost`, sitting just right of the band edge. Acceptable. | ✅ acceptable; document |
| **No surviving data yet** (everything is pre-cutoff) | Product decision — most likely band over the **whole** grid. Prototype currently returns early (no band) because there's no `firstAlive` to anchor to. **Decide & implement.** | ⚠️ flagged — not yet defined |

### Production note (SSR / Astro)
The prototype measures `offsetLeft` after paint, which is fine client-side but unavailable during
SSR. For a static Astro build, compute the boundary **from column-index math** instead of DOM
measurement so it renders correct on first paint:

```
pitch        = cellSize + gap            // 9px + 2px = 11px
lostColumns  = number of week-columns entirely before the cutoff column
bandWidth    = lostColumns * pitch       // (the partial cutoff column stays green-side)
```

Even cleaner: render the band as a **grid item that spans those columns** rather than an absolutely
positioned overlay — it then re-flows for free with the grid. Either way, derive everything from
`dataStartDate`; keep the post-paint `place()` + `resize` listener only as a hydration fallback.

---

## 3 · CSS added for the mask

```css
/* grid becomes the positioning context for the overlay */
.heat-cells { position: relative; }

/* lost cells are neutralized — never show a fake activity color */
.cell.lost {
  background: #EBEDF0 !important;
  box-shadow: inset 0 0 0 1px rgba(36,34,32,0.05);
}

/* the band: hatch scrim + dashed boundary on its right edge */
.heat-loss {
  position: absolute; top: 0; left: 0; height: 100%;
  pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  border-right: 1.5px dashed var(--ink-300);
  border-radius: 3px 0 0 3px;
  overflow: hidden;
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(36,34,32,0.045) 0, rgba(36,34,32,0.045) 1px,
    transparent 1px, transparent 6px);
}

/* the floating pill label */
.loss-tag {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 13px;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
}
.loss-tag svg { width: 14px; height: 14px; stroke: var(--ink-500); flex: none; }
.loss-tag .lt-main {
  font-family: var(--font-mono); font-weight: 700; font-size: 10px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-800);
}
.loss-tag .lt-sub {
  font-size: 11px; color: var(--text-subtle);
  padding-left: 8px; border-left: 1px solid var(--border);
}
```

The icon is an inline Lucide-style "database with slash" SVG (stroke only, `--ink-500`). If you wire
up the Lucide CDN, swap it for `<i data-lucide="database"></i>` + a slash, or `database-zap` /
`circle-slash`.

---

## 4 · Data structures

```ts
// One entry per day (heatmap). Days with no entry before dataStartDate are rendered as "lost".
type TokenDay = {
  date: string;    // 'YYYY-MM-DD'
  tokens: number;  // millions of tokens that day
};

type HeatmapConfig = {
  days: TokenDay[];
  dataStartDate: string;   // 'YYYY-MM-DD' — first day real data exists. Drives the data-loss mask.
                           // Currently '2026-04-16'. Change this ONE value, never the markup.
  today: string;           // window end ('YYYY-MM-DD')
};
```

Render rule per day:
- `date < dataStartDate` → `class="cell lost"`, **no level color**, tooltip e.g. `"2026-03-02 · 数据缺失"`.
- `date >= dataStartDate` → `class="cell l{0..4}"` by the ramp above.
- future days (after `today`, trailing the last column) → `class="cell empty"` (transparent).

**Current display numbers** (summary row, static): 累计 **180M** · streak **23 天** · 峰值 **4.2M** · 本月 **26M**. Replace with real aggregates.

---

## 5 · Build checklist
- [ ] Heatmap generated from `TokenDay[]` — never hand-write cells.
- [ ] Ramp uses the GitHub green hexes above; empty/quiet = `#EBEDF0`.
- [ ] Mask driven solely by `dataStartDate`; pre-cutoff days get `.lost` (no color).
- [ ] Band width derived from column math at render (SSR-safe); `resize`/hydration fallback optional.
- [ ] Early-return when there are no `.lost` cells (band fully aged out).
- [ ] Decide the "no surviving data yet" behavior (band over whole grid?) and implement it.
- [ ] Respect `prefers-reduced-motion` (hover scale already gated in CSS).
- [ ] Keep lime discipline elsewhere on the card (peak-marker square, section dot) — the green ramp does not change the rest of the brand.
