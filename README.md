# Idle Guild Master

A production-structured browser idle/incremental RPG foundation built with TypeScript, Vite, PixiJS, and Three.js.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages

The included `.github/workflows/deploy.yml` builds and deploys `dist/` on every push to `main`.

In GitHub: open **Settings → Pages**, choose **GitHub Actions** under Build and deployment, then push `main`.

`vite.config.ts` uses `base: './'`, so built asset URLs work under repository subpaths.

## Implemented systems

- Exact XP, JP, stat-budget, and offline-yield formulas from the supplied GDD
- 1-second deterministic combat ticks
- Threat-based tank targeting
- Burn and freeze status handling
- 14 data-driven jobs across T1–T4
- Permanent mastery passive award at Job Lv.10
- Class promotion validation
- Four-hero parties
- Dedicated dual-party eight-hero Ignis raid state machine
- Ignis phase thresholds, Phase 2 adds, tank-swap stacks, and 360s enrage
- Forge, salvage, and socket refinement
- Daily/weekly bounty model
- Guild facilities and Expedition HQ offline cap scaling
- PixiJS combat presentation and floating damage numbers
- Three.js atmospheric background layer
- Responsive mobile-safe layout
- Autosave every 10 seconds plus `beforeunload`
- JSON export/import
- GitHub Pages deployment workflow

## Architecture note

The application entry is `index.html` at repository root, which is Vite's required production layout. `public/` is reserved for static assets.
