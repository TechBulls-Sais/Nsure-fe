# Nsure — frontend

A React + Vite insurance workspace. Sign-in and portfolio records use the Nsure backend.

## Run locally

Start `Nsure-be` on port 8091, then from this folder (Node.js 22.12+):

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5180. Dev login is username `admin` and password `password`. Staff sign-in then asks for a one-time code, which the backend checks before it issues the session (`POST /auth/session` answers staff and partners with a challenge, `POST /auth/session/verify` turns the right code into a session). No SMS or email gateway is connected, so a dev or demo backend accepts the fixed code `123456` and returns it with the challenge; the sign-in and sign-up screens show it. A production backend never accepts it. Partner logins `agent`, `employer` and `lender` (same password and code) open the partner portal only.

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
6. Group schemes → with the scheme permission, the group administration (members, census imports, billing); without it, an overview of the scheme records and their totals.
7. Products → select a product arrow to begin its application journey.
8. Collections → open an unpaid invoice and record a demo receipt.
9. Settings → change table density or the notification indicator, or reload the records from the server.

Tables support search/status filters and CSV export where shown. Details include overview, sample documents, and an illustrative activity timeline. The navigation is responsive and supports browser history via hash routes.

### Individual Life screens (demo defaults)

- **Applications**: tabs for the workbench, the **Missing evidence** queue and **Compare quotes** (price plans side by
  side, save a quote, start a draft application). New cover always starts as an application (the former "Add policy"
  buttons open one); the form takes occupation, proposer/payer, beneficiaries and the policy term.
- **Underwriting**: screening panel (compliance answers a match), decision validity, authority by total cover /
  loading / decision type, rule changes approved by a second person, **Run daily review**.
- **Policy servicing**: rules for continuity, removal approval, lapse, cooling-off and terms; **Plans** maintenance;
  insured-life consent; cover end and **End cover at term**.
- **Credit life**: claim payee verification and payment, settlement files, benefit rules.
- **Customer portal**: questions and declaration at checkout, **Your applications** with offer acceptance.

## Access and permissions

What a staff user sees follows the permission codes in `GET /me` (`permissions`; a super admin holds every code), never their role names. `src/access.js` is the one access map: each workspace page and the read code its API checks (for example Claims → `READ_CLAIM`, Controls → `READ_CONTROL`, Access → any of `READ_ROLE`, `READ_USER`, `READ_PERMISSION`). The sidebar, the router, the ⌘K palette and the landing page all read it, so a typed address the user cannot open shows "You don't have access to this page" instead of the page, and a user without `READ_DASHBOARD` lands on the first page they can open. Buttons that write (new application, register a claim, add customer or policy, record receipt, rate grid save, product create/edit/activate, claim assess/approve/reject/pay) show only with the code their endpoint needs. A 401 on any call after sign-in signs the user out.

- **Administration → Access**: opens for anyone holding `READ_ROLE`, `READ_USER` or `READ_PERMISSION`; each tab and action needs its own code. Roles have a desk-access switch (makes holders staff); protected roles such as Policyholder / End User can never get permissions or desk access and cannot be renamed or deleted. Permission codes are fixed in the application: only their label, group and maker-checker flag can be edited. **Approval limits** sets the largest claim payout each role may approve (none = unlimited). A write that needs maker-checker approval shows "Submitted for approval by a second person".
- **Administration → Controls** (`READ_CONTROL`): operational controls with their state, value, fail mode and change history, the straight-through-processing monitor (rate overall and over 7 days, ineligibility reasons, four-eyes-not-applied register) and per-product STP policies. Changing anything needs `UPDATE_CONTROL`, which no role holds by default, and a written reason.
- The header bell lists the alerts from `GET /me/alerts` (for example a control switched off).
- Claims: an assessor cannot approve a claim they assessed (four-eyes) unless they hold `OVERRIDE_CLAIM_FOUR_EYES` and give a break-glass reason, which is recorded on the claim. A payout above the approver's limit is refused with the server's message.

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

Scope follows the supplied Nsure specification: Individual Life application/policy journeys, customer records, claims, Group scheme previews, products, collections, and governed AI previews. Commissions, reinsurance, subledger posting, provider integrations, and a full product rule engine are outside this frontend milestone.

## Browser smoke checks

The checks drive the real app. Start the backend with demo data (port 8091) and `npm run dev` (port 5180), with
Google Chrome installed, then:

```sh
npm test               # workspace: staff sign-in with the one-time code, navigation, work queue, access, service desk, mobile
npm run test:landing   # public landing page, sign-in routes, product cards, FAQ, reduced motion, mobile menu
npm run test:intelligence  # command palette, theme switch, reduced motion
npm run test:select    # themed dropdowns in the New application form (cancelled, nothing saved)
npm run test:products  # Product studio list and wizard validation (discarded, nothing saved)
npm run test:all       # all of the above
```

Staff sign-in is the real two-step flow: the scripts read the demo code a dev/demo backend shows on screen. They only
read (the workspace check also confirms that a read-only role has no work to take). They fail on browser runtime
errors or sideways scrolling at phone width. Screenshots go to the operating system temporary directory. Shared set-up
is in `scripts/smoke-support.cjs`.

Optional environment variables: `NSURE_BASE_URL` (default `http://127.0.0.1:5180`), `NSURE_SCREENSHOT_DIR` (existing
directory), `PLAYWRIGHT_CHANNEL` (defaults to `chrome`), `NSURE_PASSWORD` (default `password`) and
`NSURE_ONE_TIME_CODE` (only for a backend that does not show the demo code).

## Product Studio

Open **Product studio** in the sidebar, or **Products → Configure products**.

The configuration showcase includes a searchable list with Draft, In review, and Demo active states; create/edit/duplicate actions; and a four-step wizard:

1. Essentials: product name/code, Individual or Group business line, currency, effective date, wording package, and description.
2. Benefits and eligibility: sample benefit choices, entry ages, benefit limit, and waiting period.
3. Pricing and operations: fixed sample premium, payment frequency, grace period, underwriting approach, and distribution channels.
4. Review: configuration summary, simulated review submission, or demo activation.

A live product preview updates while editing. Configurations are saved on the server (`/portfolio/product-configs`); every save keeps a numbered version. Validation checks required/unique product identity, age ranges, selected benefits/channels, and positive amounts. Drafts may contain incomplete operational settings. A configuration goes Draft → In review → Active: Activate is offered only on a saved configuration that is in review, and only to a user holding `ACTIVATE_PRODUCT` who did not make its current content (the server refuses the rest). An active configuration can be withdrawn from sale. Activation changes only the configuration status: it does not add a saleable product to the existing catalogue or change application premiums.

Run the focused configuration browser check with `npm run test:products` while the dev server and backend are running. It covers the list, filters, search, wizard validation, leaving without saving, and the mobile layout.

## Animated intelligence experience

The UI now uses adapted open-source components from **Kokonut UI** and **Magic UI**, with **Motion** and **Anime.js** installed as runtime dependencies. Component origins and retained MIT licenses are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); public license files are included in the production build.

- Dashboard: Anime.js scoped/staggered page entrance, animated metric counters, shimmer headings, an orbital illustration, and contextual shortcuts.
- Workspace command palette: **Cmd/Ctrl+K** opens search with arrow-key navigation, Enter selection, and Escape dismissal. It opens pages or starts applications/claims.
- Motion: the header toggle pauses decorative animation. System reduced-motion preferences are respected, including changes while the app is open. Page timelines clean up on navigation; decorative effects have bounded repeats.

Run all browser checks with `npm run test:all` while the dev server and backend are running, or run only these interactions with `npm run test:intelligence`. Portfolio records are stored by the backend.

Dropdown fields share a themed Radix Select menu with selected checkmarks, keyboard navigation, and mobile-aware positioning. Run `npm run test:select` for selection, premium updates, focus/Escape, mobile bounds, and claim submission checks.

## Public landing page

The root URL now opens a responsive Nsure landing page. It includes product cards with explicit flip controls, a short getting-started guide, expandable FAQs, and **Admin login** and **Customer login** links in the header. Product copy is introductory and illustrative; current products and eligibility remain in the authenticated portal.

- `#/home`: landing page; `#/cover`, `#/how-it-works`, and `#/questions`: landing sections.
- `#/login/customer`: existing customer sign-in form.
- `#/login/admin`: existing staff/admin sign-in form.
- Signing out returns to the landing page. Successful sign-in retains the existing backend-based customer/staff routing.
- `src/LandingPage.jsx` and `src/landing.css`: isolated landing UI, responsive styles, accessible interactions, and scoped Anime.js entrance animation.

Use `npm run test:landing` with the dev server and backend running for the landing-page checks (the product cards come from the backend). These verify public navigation, both login entry points, flip controls, FAQs, mobile bounds, and reduced motion.
