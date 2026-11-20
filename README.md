# VERDE HEAT Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/xianszc/verde-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/xianszc/verde-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photos and a caption into GTA-style
multi-panel poster cover art, exported as a PNG to share. Built for the
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty
on [make.fun](https://make.fun).

## Try it

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. Everything runs
locally: no account, no upload, no network request while the app runs.
Your photos never leave your machine.

## What it does

- **4 layouts** — Hero + 5 panels, Hero + 3 panels, Tilted snapshots,
  Full-bleed + strip.
- **3 colour grades** — Sunset, Neon nights, Noir — plus a warmth slider
  per panel.
- **Face-aware auto-crop** — a skin-tone finder centres each panel on
  its subject's face; drag any panel to reposition, scroll to zoom, or
  fine-tune with the sliders.
- **Live caption editing** — title, script line, tagline, press quote,
  and each panel's role, place, time and story line.
- **Export** — one click, or all three post sizes at once:
  1080×1080, 1080×1350, 1920×1080.
- **Undo / redo** — 60 steps, buttons plus Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
- **Projects** — save as JSON, load back, autosave in the browser.
- **Poster chrome** — five stars and a press quote, a VOL. badge, a
  striped gradient title with a script subtitle, role tags, a tagline
  strip, a barcode, and a gold "ORIGINAL COVER ART" seal.

The default cover is **VERDE HEAT** — six souls, one coast, golden hour —
with eight built-in sample photos made for this entry with an image model.

## Fonts

Anton, Bebas Neue and Pacifico, all under the
[SIL Open Font License](https://openfontlicense.org/) (files in
`app/fonts/`).

## License

MIT — see [LICENSE](LICENSE).
