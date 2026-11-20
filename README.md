# VERDE HEAT — Cover Studio

![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)
![rank](https://make.fun/badge/gta6-cover-art-01/xianszc/verde-cover-studio/rank.svg)
![reward](https://make.fun/badge/gta6-cover-art-01/xianszc/verde-cover-studio/reward.svg)

Turn any photo and caption into GTA-style multi-panel poster cover art, in the browser, offline, and export it as a PNG to share. Built for the [make.fun GTA 6 Cover Art bounty](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- **Any photo**: upload your own photos or use the eight built-in samples. Fill several panels with one photo or several, and crop and position each panel by dragging it, scrolling to zoom, or with the sliders.
- **Face-aware auto-crop**: each panel can centre itself on the subject's face (skin-tone detection, computed on your machine).
- **Four layouts**: Hero + 5 panels, Hero + 3 panels, Tilted snapshots, and Full-bleed + strip — with a pop-out hero panel that overlaps its neighbours like layered poster art.
- **Three grades**: Sunset, Neon nights and Noir, plus per-panel warmth tuning. Neon nights is a hard magenta/cyan duotone on a dark indigo ground, unmistakably different from Sunset.
- **Poster lettering**: a huge sunset-gradient title (Anton), a script subtitle (Pacifico), role tags on every panel ("THE QUEEN", "THE FIXER"…), a press quote with five stars, a tagline, a barcode and a big solid-gold "ORIGINAL COVER ART" seal that still reads at thumbnail size.
- **Undo / redo and projects**: 60-step history (buttons, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), save a project as JSON, load it back, and autosave in the browser.
- **One-click export**: PNG in 1080 × 1080, 1080 × 1350 and 1920 × 1080 — individually or all three at once.

## Try it

```sh
node serve.ts   # serves app/ on http://localhost:8080
```

Everything runs offline from static files under `app/` — no network request, no upload, your photos never leave your machine. Fonts (Anton, Bebas Neue, Pacifico) are shipped under the SIL Open Font License; sample photos were made with an image model for this entry. All art, titles and lettering are original — no Rockstar Games logo, artwork or fonts.
