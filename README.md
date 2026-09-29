# Nsure Life — frontend showcase

A React + Vite insurance workspace with fictional data, dummy sign-in, and connected demonstration journeys. No backend, credentials, AI provider, or external business service is required.

## Run locally

Requires Node.js 22.12+ (Node.js 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Dummy credentials are prefilled; any valid email and password of at least four characters enters the same demo identity. These are not real authentication controls.

```sh
npm run build
npm run preview
```

## Team walkthrough

1. Enter the workspace and explore the overview, collection chart period selector, product mix, and recent activity.
2. Customers → Add customer. Use fictional details.
3. Applications → New application. Choose the customer and product, review, then submit (or save a draft).
4. Open the application → Simulate underwriting acceptance → Simulate policy issue. See the new record in Policies.
5. Claims → Register claim. Open Documents and simulate evidence received; return to Overview to simulate approval and settlement.
6. Group schemes → Explore scheme or Demo census import. Load four sample rows and download validation results.
7. Products → select a product arrow to begin its application journey.
8. Collections → open an unpaid invoice and record a demo receipt.
9. AI assistant → try case summaries, communication drafting, and document extraction. All outputs are scripted.
10. Settings → change table density, notification indicator, or reset sample data.

Tables support search/status filters and CSV export where shown. Details include overview, sample documents, and an illustrative activity timeline. The navigation is responsive and supports browser history via hash routes.

## Demo boundaries

- All people, records, premiums, cover amounts, metrics, and activity are fictional or illustrative. They are not approved tariffs or contractual promises.
- Portfolio dashboard totals are fixed showcase figures; workbench record counts reflect the smaller interactive sample dataset.
- Business record changes are held in React memory and reset on refresh. Only the dummy login flag is held in sessionStorage. Signing out does not clear the in-memory dataset; Settings → Reset demo data does.
- Document actions simulate receipt of evidence; no document bytes are uploaded or stored. The census uses a sample file preview and does not mutate scheme membership.
- AI replies are scripted, not produced by a model. No messages are sent to customers.
- All approvals, issuance, and settlements are simulations. There is no server-side authentication, authorization, financial processing, or secure data storage.

## Structure and later Spring Boot integration

- `src/data.js`: seed fixtures, display helpers, and illustrative product catalogue.
- `src/App.jsx`: page views, reusable UI elements, dialogs, session state, and local actions.
- `src/styles.css`: responsive design system and page styles.
- `src/main.jsx`: React entry point.

Replace seed state and local mutation handlers with a typed API client when the backend is introduced. Define OpenAPI contracts, split pages into feature modules, and add real identity/object authorization before using real customer data. The backend must own product/rate versions, calculations, validation, approval guards, audit evidence, idempotency, state transitions, and financial effects. UI guards are demonstration behavior only.

Scope follows the supplied Nsure Life specification: Individual Life application/policy journeys, customer records, claims, Group scheme previews, products, collections, and governed AI previews. Commissions, reinsurance, subledger posting, provider integrations, and a full product rule engine are outside this frontend milestone.

## Browser smoke check

With the dev server running and Google Chrome installed:

```sh
npm run test:smoke
```

The check exercises dummy login, search, customer creation, application submission and policy issuance, claim evidence/approval/settlement, census validation, scripted AI, product defaults, CSV download, and mobile navigation. It fails on browser runtime errors or page-wide mobile overflow. Screenshots are written to the operating system temporary directory.

Optional environment variables: `NSURE_BASE_URL`, `NSURE_SCREENSHOT_DIR` (existing directory), and `PLAYWRIGHT_CHANNEL` (defaults to `chrome`).

## Product Studio

Open **Product studio** in the sidebar, or **Products → Configure products**.

The configuration showcase includes a searchable list with Draft, In review, and Demo active states; create/edit/duplicate actions; and a four-step wizard:

1. Essentials: product name/code, Individual or Group business line, currency, effective date, wording package, and description.
2. Benefits and eligibility: sample benefit choices, entry ages, benefit limit, and waiting period.
3. Pricing and operations: fixed sample premium, payment frequency, grace period, underwriting approach, and distribution channels.
4. Review: configuration summary, simulated review submission, or demo activation.

A live product preview updates while editing. Save draft retains a configuration in the current session; editing and saving increments its displayed version. Validation checks required/unique product identity, age ranges, selected benefits/channels, and positive amounts. Drafts may contain incomplete operational settings. Demo activation changes only the configuration status: it does not add a saleable product to the existing catalogue or change application premiums. Refresh resets configurations to the seeded examples.

Run the focused configuration browser check with `npm run test:products` while the dev server is running. It covers creation, validation, live edits, review/activation, versioning, duplication, drafts, search, navigation, and mobile layout.

## Animated intelligence experience

The UI now uses adapted open-source components from **Kokonut UI** and **Magic UI**, with **Motion** and **Anime.js** installed as runtime dependencies. Component origins and retained MIT licenses are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); public license files are included in the production build.

- Dashboard: Anime.js scoped/staggered page entrance, animated metric counters, shimmer headings, an orbital illustration, and contextual shortcuts.
- Product catalogue: Kokonut-style spring-based spotlight hover cards.
- Product Studio: **Design with AI** opens an animated prompt composer. A brief mentioning family/funeral, hospital/cash, or group/employer chooses a fixed sample template and fills the editable configuration. Other briefs use a generic life template. This is deterministic keyword matching, not a real model.
- AI assistant: animated prompt cards, expanding composer, finite thinking states, example response cards, copy response, and cancellation through Clear conversation.
- Workspace command palette: **Cmd/Ctrl+K** opens search with arrow-key navigation, Enter selection, and Escape dismissal. It opens pages or starts applications/claims.
- Motion: the header toggle pauses decorative animation. System reduced-motion preferences are respected, including changes while the app is open. Page timelines clean up on navigation; decorative effects have bounded repeats. Thinking animation exists only during a finite simulated response.

Run all browser checks with `npm test` while the dev server is running, or run only the new interactions with `npm run test:intelligence`. No backend, live AI calls, web searches, or credentials were added. Briefs and records remain in frontend memory.

Dropdown fields share a themed Radix Select menu with selected checkmarks, keyboard navigation, and mobile-aware positioning. Run `npm run test:select` for selection, premium updates, focus/Escape, mobile bounds, and claim submission checks.
