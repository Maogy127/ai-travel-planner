# GoNow v2 motion spec

Motion should feel physical and quiet: springs for touch, short eases for state, nothing that loops.
With `prefers-reduced-motion: reduce`, motion is replaced by an instant state change (the re-tint, burst, count-up, draw-in and press-spring all switch off).

| Motion | Where | Spec | Built in |
|---|---|---|---|
| **Press-spring** | Every button, pill, chip, option and pick card | Press: scale to **0.94** in 90 ms (ease-out), shadow drops. Release: spring back with **stiffness 260, damping 12, mass 1** (ζ ≈ 0.37, about 0.9 s, overshoot to about 1.016). | CSS: `--spring` is a `linear()` curve sampled from that spring. Browsers without `linear()` fall back to `cubic-bezier(.34,1.56,.64,1)`. Drag handles and menu items are excluded. |
| **Re-tint** | Whole app, from the feel dial | About 600 ms ease-in-out; every token interpolates in OKLCH. | `GoNowTheme.set(value)` in `js/v2.js`, rAF-driven. |
| **Vote like-burst** | Group voting on picks | The voted mark scales 1 → **1.3** → 1 (420 ms, slight overshoot). **8 dots** (accent and glow) fly out 18 px and fade (520 ms). The vote count rolls up (**+1**, 260 ms slide-in). Fires on your own tap and when a friend's vote arrives. | `GoNowMotion.burst(el)` and `rollCount(el)`; called from `js/accounts.js`. |
| **Animated checkbox + progress** | Trip prep tasks, packing list | The box fills with the accent and the check **draws left to right in 300 ms** (clip-path wipe). The box pops 1 → 0.86 → 1 on the spring. The packing progress fill grows on the spring. A checked row's label dims with a soft strike. | CSS on `input[type=checkbox]` and `.progress`. |
| **Ring draw + count-up** | Day rings card, wellness rings | When a rings card first appears, the ring strokes draw from 0 to their value (800 ms, ease-out). Numerals count up from 0 (700 ms, cubic ease-out). The real number is in the DOM from the first frame; only the painted copy animates. | `GoNowMotion.countUp()`, run by a MutationObserver. |
| **Date strip** | Day selector | A horizontal, scroll-snapping strip of date tiles (weekday, big date numeral). The selected tile is ink and lifts. A dot marks a day with stops; an empty day shows a hollow dot, and its list says "Nothing planned yet · rest easy". | `js/daybuilder.js` markup plus CSS. |
| **Focus** | Opening a stop | The card crossfades to the espresso Focus palette over 600 ms. | CSS transition on `.db-pair`. |

Not used on purpose: Material ripple. The magnetic button was skipped: it is desktop-only polish, and it fights the press-spring on touch.
