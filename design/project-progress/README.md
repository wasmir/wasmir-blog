# Handoff: Project progress — finished/dropped row layout

## Overview
A focused redesign of the **Project progress** module on the Wasmir personal site.
The fix removes the empty right ~¼ of every finished/dropped row by adding a
**right-anchored meta rail** (platform micro-label + an optional "open" action).
This is a surgical CSS + markup change to one existing module — not a new feature.

## About the design files
The files in `reference/` are **design references created in HTML** — a prototype
showing the intended look and behavior, not production code to ship verbatim.
The task is to apply this change inside the existing site codebase (the homepage is
plain HTML/CSS, Astro-friendly) using its established `.pj-*` classes and design tokens.

Open `reference/project-progress-v2.html` in a browser to see the target result. It is
self-contained (loads the brand `tokens.css` next to it).

## Fidelity
**High-fidelity.** Final colors, typography, spacing and interaction are specified
below to the pixel/token. Recreate exactly, pulling all values from the existing
`tokens.css` (the `var(--*)` names below already exist in the project).

---

## The change (what's different from current code)

Current row: `.pj-name` is `flex:1`, so short names leave a large empty stretch; only
DOING rows carry right-side content (% + progress bar). DONE/DROPPED rows have nothing
on the right → the whole right quarter reads empty and unbalanced.

Fix: drop `flex:1` from `.pj-name` and add a `.pj-meta` cluster pushed to the right edge
with `margin-left:auto`. Now content is anchored at **both ends** of the head row, so the
gap in the middle becomes intentional whitespace instead of a void.

### CSS — replace `.pj-name`, add `.pj-meta` / `.pj-plat` / `.pj-open`, tweak `.pj-pct` & `.pj-blurb`

```css
/* CHANGED: remove flex:1 */
.pj-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.01em;
  color: var(--ink-900);
  min-width: 0;
}

/* NEW: right-anchored meta rail */
.pj-meta {
  margin-left: auto;        /* claims the right edge of the head row */
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 20px;         /* equal row height with or without an action */
}

/* NEW: platform / type micro-label (mono — the brand's signature accent) */
.pj-plat {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--text-subtle);
  white-space: nowrap;
}

/* NEW: "open" action — replaces the inline external-link icon after the name */
.pj-open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-text);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-600);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out);
}
.pj-open svg {
  width: 14px; height: 14px;
  stroke: currentColor;
  transition: transform var(--dur-fast) var(--ease-out);
}
.pj-open:hover { color: var(--ink-900); }
.pj-open:hover svg { color: var(--pop-ink); transform: translate(1px, -1px); } /* lime, one touch */

/* CHANGED: doing % moves into the same right slot, slightly bolder */
.pj-pct { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--ink-800); flex: none; }

/* CHANGED: tighten reading measure a touch */
.pj-blurb { font-size: 14px; line-height: 1.55; color: var(--text-muted); margin: 0; max-width: 58ch; }
```

`.pj-head`, `.pj-item`, `.pj-track`, `.pj-fill`, `.pj-item.dropped`, and all `.badge*`
rules stay exactly as they are today.

### Markup — add `.pj-meta` inside each `.pj-head`

The icon is Lucide `arrow-up-right` (the project's icon set). Inline SVG shown here; if the
site already loads Lucide, use `<i data-lucide="arrow-up-right"></i>` instead.

```html
<!-- DOING — % goes in the rail; progress bar stays full-width below -->
<div class="pj-head">
  <span class="badge doing">DOING</span>
  <span class="pj-name">AboutMeinAI</span>
  <div class="pj-meta"><span class="pj-pct">70%</span></div>
</div>

<!-- DONE + link — platform label + open action -->
<div class="pj-head">
  <span class="badge done">DONE</span>
  <span class="pj-name">Boofa</span>
  <div class="pj-meta">
    <span class="pj-plat">macOS</span>
    <a class="pj-open" href="<APP_STORE_URL>" target="_blank" rel="noopener">打开<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg></a>
  </div>
</div>

<!-- DONE, no link — platform label only, no dead action -->
<div class="pj-head">
  <span class="badge done">DONE</span>
  <span class="pj-name">PPTAutoGen</span>
  <div class="pj-meta"><span class="pj-plat">工作流</span></div>
</div>

<!-- DROPPED — keep the platform label (it dims with the row); no open action -->
<div class="pj-head">
  <span class="badge dropped">DROPPED</span>
  <span class="pj-name">Picasso AI</span>
  <div class="pj-meta"><span class="pj-plat">网页</span></div>
</div>
```

### Per-item rail content (rules of thumb)
| State | `.pj-meta` content |
|---|---|
| DOING | `<span class="pj-pct">NN%</span>` (progress bar stays below the blurb) |
| TODO | planned platform `<span class="pj-plat">…</span>` |
| DONE + link | `<span class="pj-plat">…</span>` + `<a class="pj-open">打开 ↗</a>` |
| DONE, no link | `<span class="pj-plat">…</span>` only |
| DROPPED | `<span class="pj-plat">…</span>` only (no action — semantically shelved) |

Platform values for current data: `macOS` (Boofa) · `iOS` (Yeliner) · `工作流` (PPTAutoGen) · `网页` (Picasso AI).

---

## Interactions & behavior
- `.pj-open` hover: text `--ink-600 → --ink-900`; arrow tints to `--pop-ink` and nudges
  `translate(1px,-1px)`; transition `var(--dur-fast) var(--ease-out)`. This is the only
  lime moment in the module — keep it restrained.
- `.pj-open` opens the link in a new tab (`target="_blank" rel="noopener"`).
- DROPPED rows keep the existing `opacity:0.55` + name strikethrough; the platform label
  inherits the dim. No hover affordance.
- No layout/JS state changes; the module stays static HTML.

## Design tokens used (all already defined in `tokens.css`)
- Color: `--ink-900 #1A1916`, `--ink-800 #242220`, `--ink-600 #5C574E`, `--text-subtle`, `--text-muted`, `--pop-ink #1F2A00`, `--pop #C6F24D`
- Type: `--font-display` (Bricolage Grotesque), `--font-text` (Hanken Grotesk), `--font-mono` (Space Mono)
- Motion: `--dur-fast`, `--ease-out`
- Sizes (literal, by design): name 17px / blurb 14px / plat 12px / open 13px / icon 14px; gaps 12px (head) & 14px (meta); blurb measure `58ch`

## Assets
- Icon: Lucide `arrow-up-right` (the site's icon set). No new image assets.

## Files
- `reference/project-progress-v2.html` — the target result (open in a browser)
- `reference/tokens.css` — brand tokens the reference depends on (already in the codebase)
- In the live codebase the module lives in the homepage under
  `<section class="module" id="projects">` → `.pj-list` → `.pj-item`.
