# Open-source UI attribution

The Nsure Life showcase adapts the components below to plain React JSX and the existing CSS design system. Source reviewed on 29 September 2026. Original license texts are retained in `public/licenses/` and copied into production builds by Vite. No paid Kokonut Pro templates are used.

## Kokonut UI

Copyright (c) 2025 kokonutUI. MIT License — [full license](public/licenses/kokonut-ui.txt).

Repository: https://github.com/kokonut-labs/kokonutui

Adapted source components:

- `components/kokonutui/shimmer-text.tsx` — `ShimmerText` in `src/ui/animated.jsx`; background-position animation with bounded repeats and reduced-motion handling.
- `components/kokonutui/spotlight-cards.tsx` — `SpotlightCard`; spring-driven pointer tilt and glow, reduced tilt range, no sibling dimming, no touch tilt.
- `components/kokonutui/ai-input-search.tsx` — `AIComposer`; resizing textarea, focused container, contextual controls, keyboard submission, and motion feedback. File/web-search actions replaced by an explicit sample-case action; no uploads or network search.
- `components/kokonutui/action-search-bar.tsx` — `ActionSearch`; filtered action list and arrow/enter keyboard selection, used inside the existing dialog with an implemented Cmd/Ctrl+K shortcut.
- `components/kokonutui/ai-loading.tsx` — sequence-based loading presentation informed `ThinkingSteps`; finite demo processing sequences replace the original continuously advancing examples. No web searches or model processing are claimed.

Original authors include @kokonutui and @dorianbaffier. TypeScript/Tailwind/shadcn dependencies were replaced by app-local JSX/CSS and accessible native controls.

## Magic UI

Copyright (c) Magic UI. MIT License — [full license](public/licenses/magic-ui.txt).

Repository: https://github.com/magicuidesign/magicui

- `apps/www/registry/magicui/number-ticker.tsx` — `NumberTicker` / `AnimatedMetric`; in-view motion value, spring subscription, and locale formatting. Accessible final values, existing prefixes/suffixes, and reduced-motion support added.
- `apps/www/registry/magicui/border-beam.tsx` — `BorderBeam`; masked border layer with animated offset-distance. Uses Nsure colors, a bounded repeat count, and reduced-motion handling.

## Animation dependencies

- Anime.js: https://github.com/juliangarnier/anime — MIT. Used directly for scoped page-entry timelines, shared child defaults, and staggered transitions. Timeline cleanup uses `scope.revert()` on navigation/unmount.
- Motion: https://github.com/motiondivision/motion — MIT. Used directly for springs, reveal transitions, input feedback, and accessible motion preferences.

Full license files for Anime.js, Motion, Framer Motion, Motion DOM, and Motion Utils are also retained in `public/licenses/` and distributed with the build. The app also uses React, Vite, and Lucide under their respective licenses. The optional React Bits repository was reviewed but none of its components were copied or incorporated.

## Radix UI Select

The shared styled dropdown uses `@radix-ui/react-select` for keyboard navigation, focus management, and viewport-aware popover positioning. MIT License — [full license](public/licenses/radix-select.txt). Source: https://github.com/radix-ui/primitives
