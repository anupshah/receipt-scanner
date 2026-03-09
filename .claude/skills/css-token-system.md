---
name: css-token-system
description: >
  Design token reference for the receipt-scanner CSS system.
  Use when adding new components or modifying existing styles.
  Lists all custom properties, layer names, and conventions to follow.
  Prevents token name collisions and layer order violations.
compatibility: No external tools required.
---

# CSS Token System

## Layer Order

```css
@layer reset, tokens, base, layout, components, utilities;
```

Defined in `src/css/index.css`. **Never add styles outside a layer.** Later layers win specificity ties; utilities always win over components.

## File Structure

```text
src/css/
  index.css              — layer declaration + imports
  reset.css              — @layer reset
  tokens.css             — @layer tokens (all custom properties)
  base.css               — @layer base (html, body, headings, links, focus)
  layout.css             — @layer layout (.app-shell, .app-main)
  utilities.css          — @layer utilities
  components/
    header.css           — .app-header
    buttons.css          — .btn variants
    dropzone.css         — .dropzone
    status.css           — .ocr-status, .ocr-progress
    form.css             — .receipt-form, .field-*
    results.css          — .results-section, .results-actions, .raw-text-*
    toast.css            — .toast-container, .toast
    footer.css           — .app-footer
    examples.css         — .examples-details, .examples-summary, .example-card
```

## All Custom Properties (from `src/css/tokens.css`)

### Palette (raw colours — prefer semantic tokens below)

```css
--ink-0: #0e0e14 --ink-1: #1c1c2b --ink-2: #2a2a3d --ink-3: #3e3e56
  --mid-1: #6b7280 --mid-2: #9ca3af --pale-1: #d4cfc8 --pale-2: #e8e4df
  --pale-3: #f5f0eb --white: #fdfcfb;
```

### Accent

```css
--accent-h: 162 (teal-green hue, HSL) --accent: hsl(162 60% 38%)
  --accent-hi: hsl(162 65% 30%) --accent-lo: hsl(162 45% 92%)
  --accent-fg: var(--white);
```

### Status

```css
--warn: hsl(38 90% 48%) --error: hsl(4 75% 52%) --success: hsl(162 55% 40%);
```

### Semantic Surface Tokens (use these, not raw palette)

```css
--surface-page: var(--pale-3) page background --surface-card: var(--white)
  card / form background --surface-raised: var(--pale-2) slightly elevated
  surfaces --surface-sunken: var(--pale-1) inset / input backgrounds
  --border: var(--pale-1) --border-focus: var(--accent);
```

### Text Tokens

```css
--text-primary:
  var(--ink-0) body copy --text-secondary: var(--ink-3) labels,
  subtitles --text-muted: var(--mid-1) hints,
  placeholders --text-on-accent: var(--white) text on accent backgrounds;
```

### Shadows

```css
--shadow-sm: 0 1px 3px … --shadow-md: 0 4px 12px … --shadow-lg: 0 12px 32px …;
```

### Typography

```css
--font-body:
  "DM Sans", "Helvetica Neue", sans-serif --font-mono: "JetBrains Mono",
  "Fira Mono", "Courier New",
  monospace --font-display: var(--font-body) --text-xs: 0.75rem
    --text-sm: 0.875rem --text-base: 1rem --text-lg: 1.125rem
    --text-xl: 1.375rem --text-2xl: 1.75rem --leading-tight: 1.2
    --leading-normal: 1.5 --leading-loose: 1.8;
```

### Spacing

```css
--sp-1: 0.25rem --sp-2: 0.5rem --sp-3: 0.75rem --sp-4: 1rem --sp-5: 1.25rem
  --sp-6: 1.5rem --sp-8: 2rem --sp-10: 2.5rem --sp-12: 3rem;
```

### Radii

```css
--radius-sm: 6px --radius-md: 10px --radius-lg: 16px --radius-xl: 24px
  --radius-pill: 999px;
```

### Motion

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1) --dur-fast: 120ms
  --dur-base: 200ms --dur-slow: 350ms;
```

### Layout

```css
--max-content: 680px (max-width of .app-main) --header-h: 60px;
```

## Dark-Mode Override Pattern

Dark-mode overrides live **only** inside `tokens.css`, inside `@layer tokens`:

```css
@layer tokens {
  @media (prefers-color-scheme: dark) {
    :root {
      --accent: hsl(162 65% 52%);
      --surface-page: #0e0e14;
      /* ... */
    }
  }
}
```

Never write dark-mode overrides in component files. Only semantic tokens need dark overrides — raw palette values stay fixed.

## CSS Conventions

- **Native CSS nesting** (`&`) — not SCSS syntax.
- **No `any` values or magic numbers** — always reference a token.
- **`focus-visible`** rings use `--border-focus` at 2px offset 3px, `--radius-sm`.
- **`prefers-reduced-motion`** — wrap all `transition` / `animation` declarations if they are decorative.

## Mobile Font-Size

`base.css` sets `font-size: 106%` on `<html>` for narrow viewports, reverting to `100%` at `min-width: 480px`. All `rem`-based tokens scale with this.
