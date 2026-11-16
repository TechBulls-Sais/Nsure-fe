# Open-source UI attribution

The Nsure showcase adapts the components below to plain React JSX and the existing CSS design system. Source reviewed on 29 September 2026. Original license texts are retained in `public/licenses/` and copied into production builds by Vite. No paid Kokonut Pro templates are used.

## Kokonut UI

Copyright (c) 2025 kokonutUI. MIT License — [full license](public/licenses/kokonut-ui.txt).

Repository: https://github.com/kokonut-labs/kokonutui

Adapted source components:

- `components/kokonutui/shimmer-text.tsx` — `ShimmerText` in `src/ui/animated.jsx`; background-position animation with bounded repeats and reduced-motion handling.
- `components/kokonutui/action-search-bar.tsx` — `ActionSearch`; filtered action list and arrow/enter keyboard selection, used inside the existing dialog with an implemented Cmd/Ctrl+K shortcut.

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

## Landing page design references

The landing page uses original React/CSS implementations inspired by the user-supplied references:

- Kokonut UI Card Flip: https://kokonutui.com/docs/cards/card-flip — 3D front/back product cards, adapted here as explicit keyboard- and touch-operable buttons rather than hover-only reveals.
- Uiverse loader by lukepadiachy: https://uiverse.io/lukepadiachy/funny-moose-89 — inspiration for the small geometric cube motif. No source code was copied; Nsure uses original clipped CSS faces and a bounded floating animation.
- Anime.js timeline defaults: https://animejs.com/documentation/timeline/timeline-playback-settings/defaults — shared timing/easing defaults for the scoped hero entrance. Uses the existing Anime.js dependency and retained license.

Landing-page motion follows the existing system/user reduced-motion preference. The product photography is reused from this project's existing public assets.
