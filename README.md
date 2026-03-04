# FATE GRID

A mobile-first web app where you place character cards on a grid and an algorithm automatically generates relationships (links) and emotions, visualised via an SVG relationship map.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Tech Stack

- **React + TypeScript + Vite**
- **TailwindCSS** – styling
- **Zustand** – lightweight state management
- **SVG** – all relationship visualisation (no Canvas)
- **html-to-image** – PNG export

## Features

- Place up to **27 character cards** on a grid
- **Automatic relationship generation** (outgoing + incoming links)
- **Emotion system**: Love / Friendly / Hostile / Awkward, each with Korean sub-categories
- **Preview lines** (up to 6) shown while hovering over placement targets
- **Reroll** – regenerate relationships while keeping character positions
- **Export** – PNG image + SVG download + Korean text report with copy button
- **Session persistence** via LocalStorage (auto-save, auto-restore, reset)
- **Zoom / Pan** – mouse wheel or pinch-to-zoom; drag to pan

## Project Structure

```
src/
├── types.ts                     # All shared types & enums
├── main.tsx / App.tsx           # Entry point & root component
├── engine/
│   ├── rng.ts                   # Seeded PRNG (mulberry32)
│   ├── distance.ts              # Manhattan distance helpers
│   ├── characterGenerator.ts   # Stats calculation & card generation
│   ├── emotionGenerator.ts     # Emotion + sub-category generation
│   ├── relationshipEngine.ts   # Core link generation algorithm
│   ├── previewEngine.ts        # Preview line computation (max 6)
│   └── __tests__/              # Unit tests (Vitest)
├── storage/
│   └── sessionManager.ts       # LocalStorage save / restore / clear
├── store/
│   └── useStore.ts             # Zustand store
└── components/
    ├── TopBar.tsx
    ├── GridBoard.tsx            # SVG board with pan/zoom/preview
    ├── BottomDrawer.tsx
    ├── SetupModal.tsx
    └── ExportModal.tsx
```

## Running Tests

```bash
npm test
```

32 unit tests covering: distance calculation, character stat generation, personality modifiers, relationship engine (first-card rule, no duplicates, slot management), and preview engine.
