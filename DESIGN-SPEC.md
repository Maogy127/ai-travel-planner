# GoNow v2 design spec: "Color is your weather"

Reference for building the v2 look into the site. Source mockups: `/workspace/gonow-style/v2/` (`style.css` holds these tokens as CSS variables on `.s-energized`, `.s-focus`, `.s-calm`, `.s-tired`). Final as of Nov 19, 2026.

## Principles
- Quiet warm surfaces; real food colors are the only vivid accents.
- The whole UI re-tints to today's state (dial: Low → Steady → High). Low days get their own dignified palette: no warnings, no broken streaks.
- Brights (glow, ring colors) are **fills only**, never text. Text is ink, text 2, or a text-safe accent.
- Never pure white `#FFFFFF` or pure black `#000000`.
- Every text pair below passes WCAG AA (4.5:1 or better).

## Energized (`.s-energized`)
High energy. Linen ground, real-food brights.

| Token | CSS var | Hex | Contrast |
|---|---|---|---|
| Ground | `--bg` | `#F6F1E7` | |
| Card / surface | `--card` | `#FFFBF3` | |
| Ink (text) | `--ink` | `#1F2A20` | 13.23:1 on ground · 14.43:1 on card |
| Text 2 | `--sec` | `#5E6559` | 5.36:1 on ground · 5.84:1 on card |
| Accent (buttons) | `--accent` | `#C23B22` | button text `#FFFBF3` on it: 5.16:1 |
| Glow (ambient wash, fill only) | `--glow` | `#F2B820` | fill only |
| Move ring | `--r1` | `#C23B22` tomato | fill only |
| Nourish ring | `--r2` | `#7FA046` avocado | fill only |
| Restore ring | `--r3` | `#F2B820` yolk | fill only |

Deep accent raspberry `#A8173F` (text OK: 7.12:1 on card).

## Focus (`.s-focus`)
Strong. Espresso ground, one task, one ring.

| Token | CSS var | Hex | Contrast |
|---|---|---|---|
| Ground | `--bg` | `#16130F` | |
| Card / surface | `--card` | `#211D18` | |
| Ink (text) | `--ink` | `#F3EDE0` | 15.87:1 on ground · 14.36:1 on card |
| Text 2 | `--sec` | `#A89E8C` | 7.00:1 on ground · 6.33:1 on card |
| Accent (buttons) | `--accent` | `#F0B429` | button text `#16130F` on it: 9.93:1 |
| Glow (ambient wash, fill only) | `--glow` | `#F0B429` | fill only |
| Move ring | `--r1` | `#F0B429` yolk (the single ring) | fill only |
| Nourish ring | `--r2` | `#9BC53D` kiwi (accent 2, text OK: 8.33:1 on surface) | fill only |

Alt ground forest `#12201A`. Dark text base `#F2EBDD`.

## Calm (`.s-calm`)
Steady. Cream, oat milk, a sage sprig (option C2, chosen Nov 19).

| Token | CSS var | Hex | Contrast |
|---|---|---|---|
| Ground | `--bg` | `#F3EADB` | |
| Card / surface | `--card` | `#FBF5EA` | |
| Ink (text) | `--ink` | `#2A2620` | 12.60:1 on ground · 13.86:1 on card |
| Text 2 | `--sec` | `#566150` | 5.46:1 on ground · 6.01:1 on card |
| Accent (buttons) | `--accent` | `#56684A` | button text `#FFFBF3` on it: 5.86:1 |
| Glow (ambient wash, fill only) | `--glow` | `#D9C8A6` | fill only |
| Move ring | `--r1` | `#C9785F` soft tomato | fill only |
| Nourish ring | `--r2` | `#A7B48B` sage | fill only |
| Restore ring | `--r3` | `#A897BC` lavender | fill only |

## Tired (`.s-tired`)
Low. Evening light, hot tea, honey and rose (option T2, chosen Nov 19). Fewer stops, no guilt.

| Token | CSS var | Hex | Contrast |
|---|---|---|---|
| Ground | `--bg` | `#EBD8C3` | |
| Card / surface | `--card` | `#F5E9DA` | |
| Ink (text) | `--ink` | `#2E221C` | 11.12:1 on ground · 12.89:1 on card |
| Text 2 | `--sec` | `#634D3D` | 5.69:1 on ground · 6.60:1 on card |
| Accent (buttons) | `--accent` | `#8C3D49` | button text `#FFFBF3` on it: 7.07:1 |
| Glow (ambient wash, fill only) | `--glow` | `#E7B567` | fill only |
| Move ring | `--r1` | `#C98A6B` clay | fill only |
| Nourish ring | `--r2` | `#B3A67A` tea | fill only |
| Restore ring | `--r3` | `#C78C95` rose | fill only |

Dial track stays slightly desaturated (`saturate(.65)`).

Hairlines: `--line` = ink at 10–11% alpha. Ring tracks: the ring color at 16% opacity.

## Ring mapping
Three rings, outer to inner: **Move**, **Nourish**, **Restore**. Colors come from the state:

| Ring | Energized | Calm | Tired | Focus |
|---|---|---|---|---|
| Move | tomato `#C23B22` | soft tomato `#C9785F` | clay `#C98A6B` | (hidden) |
| Nourish | avocado `#7FA046` | sage `#A7B48B` | tea `#B3A67A` | (hidden) |
| Restore | yolk `#F2B820` | lavender `#A897BC` | rose `#C78C95` | (hidden) |
| Single ring | | | | yolk `#F0B429` for the current task |

Ring numbers: Fraunces big number + small Hanken unit (e.g. **1.2** / 1.6 mi). Closing a ring: soft bloom (ring-colored halo scales 1 → 1.55 while fading, ~1 s) plus a check in the centre.

## State dial
One low-to-high gradient track replaces the emoji feel check-in: `linear-gradient(90deg, #C78C95 0%, #D9C8A6 24%, #A7B48B 46%, #F2B820 74%, #C23B22 100%)`. Thresholds: Low < 0.24 ≤ Steady (Calm) ≤ 0.66 < High (Energized). Focus is a mode (opening a stop), not a dial position.

Re-tint: ~600 ms ease, interpolating every token in **OKLCH** between anchors Tired (0) → Calm (0.45) → Energized (1). When the day turns Tired, the plan crossfades to fewer stops plus a Restore suggestion (600 ms).

## Type
- **Display:** Fraunces (OFL), variable, `SOFT 50–60`, `WONK 0`. Dates, state names (44px phone / 56px desktop, weight 400), ring numerals, italic short labels (Move / Nourish / Restore, 'healthy body').
- **UI / body:** Hanken Grotesk (OFL). 15–17px body, 600 for names and buttons, 11–12px uppercase eyebrows with 1.4px tracking. Times use `font-variant-numeric: tabular-nums`.
- **Chinese:** Noto Serif SC (display) / Noto Sans SC (UI).
- Font files: `v2/fonts/` (Fraunces.ttf, Fraunces-Italic.ttf, Hanken.ttf).

## Shapes, photos, icons
- Cards 24px radius (hero 28px), 1px hairline + very soft shadow; pill buttons 54px tall.
- Photography leads: each stop gets a rounded photo (16–20px radius), warm grade + light grain; only food keeps full saturation. Small serif italic tag on photo (Move / Nourish / Restore). No photo: soft gradient from the state's glow / Restore / accent.
- Icons: 1.5px monochrome line icons only. No emoji, no colored icon tiles.
- Frosted tab bar: ground at 78% + 18px blur.

## In the site (v2 build, Nov 20, 2026)
- **Tokens:** `css/styles.css` `:root` holds the Energized values; `js/v2.js` (`GoNowTheme`) re-tints every token live. Each state holds its exact palette around its dial label (Tired 0–0.10, Calm 0.40–0.55, Energized 0.80–1) and blends in OKLCH between them, so the spec hex values appear exactly at Low / Steady / High.
- **Derived tokens** are computed per position and forced to AA: `--ink-2`, `--accent-text`, `--soft` (glow 20% into card), `--line` (ink 13% into ground), `--boundary` (3:1 control borders), `--card-2`, `--accent-soft`, and `--sleep-text` / `--move-text` / `--rec-text`. `tests/test_v2_theme.js` checks every pair at all 101 dial positions and in Focus.
- **Dial:** "How do you feel?" sits in each day's head (native range input, keyboard and screen-reader friendly). The value is stored per date on this device (`gonow.feel.v1`); if a morning check-in recorded energy, that seeds the dial. The default is High.
- **Rings in the site:** the planner's existing rings are Sleep, Move and Recover. Colours map as Move = `--r1`, Recover = `--r2`, Sleep = `--r3` (the per-state Restore colour). A meal-based Nourish ring needs new meal tracking, so it is not built yet.
- **Focus:** an opened stop (`.db-pair.is-open`) becomes an espresso card with the Focus tokens. The rest of the day keeps the dial's state.
- **Fonts:** `fonts/fraunces/` (SOFT 50, WONK 0 baked in) and `fonts/hanken/`, Latin subsets, woff2. Chinese falls back to Noto Serif/Sans SC or the system CJK face.
- **Icons:** `GoNowIcons.icon(name)`, 24px grid, 1.5px stroke, `currentColor`. No emoji in UI chrome. Data text (place names, user notes) is unchanged.
- Motion: see `MOTION.md`.
