import { can } from "./ui/workspace";

// The one access map of the staff workspace (spec 04 A-9: a page and its endpoint gate on the same capability).
// The sidebar, the router, the ⌘K palette and the landing page all read it, and each code is the one the page's own
// GET endpoint checks (nsure-be ApiAccessRules), so a page shows exactly when its data can load and a typed URL never
// renders a page the user cannot use. Holding any one listed code opens the page; an empty list means any staff user.
// The order is the sidebar's, and the landing page is the first one the user may open.
export const PAGE_ACCESS = {
  overview: ["READ_DASHBOARD"],
  customers: ["READ_CUSTOMER"],
  applications: ["READ_APPLICATION"],
  underwriting: ["READ_UNDERWRITING"],
  policies: ["READ_POLICY"],
  servicing: ["READ_SERVICING"],
  "credit-life": ["READ_CREDIT"],
  claims: ["READ_CLAIM"],
  "care-cash": ["READ_CLAIM"],
  collections: ["READ_PAYMENT"],
  "service-desk": ["READ_SERVICE_CASE"],
  communications: ["READ_COMMUNICATION"],
  // Group administration needs READ_SCHEME; READ_POLICY alone still opens the older scheme overview.
  schemes: ["READ_SCHEME", "READ_POLICY"],
  products: [],
  "product-config": ["READ_PRODUCT"],
  "rate-tables": ["READ_RATE_TABLE"],
  configuration: ["READ_CONFIG"],
  finance: ["READ_FINANCE"],
  distribution: ["READ_DISTRIBUTION"],
  reinsurance: ["READ_REINSURANCE"],
  reports: ["READ_REPORT"],
  integration: ["READ_INTEGRATION"],
  access: [
    "READ_ROLE",
    "READ_USER",
    "READ_PERMISSION",
    "READ_AUDIT",
    "GRANT_EMERGENCY_ACCESS",
    "REVIEW_EMERGENCY_ACCESS",
  ],
  controls: ["READ_CONTROL"],
  settings: [],
};

// Write actions offered outside their own page (overview shortcuts, the palette, record dialogs). Every code listed
// is needed, because the action calls each of those endpoints.
export const ACTION_ACCESS = {
  newApplication: ["CREATE_APPLICATION"],
  newClaim: ["CREATE_CLAIM"],
  newCustomer: ["CREATE_CUSTOMER"],
  newPolicy: ["CREATE_POLICY"],
  // POST /portfolio/policies, then PUT /portfolio/applications/{id} to mark it Issued.
  issuePolicy: ["CREATE_POLICY", "UPDATE_APPLICATION"],
  // A receipt is never edited (NS-SH04-005): premiums are recorded on the policy, returns through Collections.
};

/** A workspace user: anyone signed in who is not a portal customer (the API's staff rule). */
export const isStaff = (profile) => Boolean(profile) && !profile.customerPortal;

export const canAny = (profile, codes) => codes.some((code) => can(profile, code));

export const isWorkspacePage = (page) => Object.prototype.hasOwnProperty.call(PAGE_ACCESS, page);

/** Whether the user may open a workspace page; false for a page the map does not know. */
export function canOpen(profile, page) {
  if (!isStaff(profile) || !isWorkspacePage(page)) return false;
  const codes = PAGE_ACCESS[page];
  return codes.length === 0 || canAny(profile, codes);
}

/** Whether the user may run a write action from ACTION_ACCESS. */
export function canDo(profile, action) {
  const codes = ACTION_ACCESS[action];
  return Boolean(codes) && codes.every((code) => can(profile, code));
}

/** Where the user lands: the overview when they may read the dashboard, otherwise the first page they can open. */
export function landingPage(profile) {
  return Object.keys(PAGE_ACCESS).find((page) => canOpen(profile, page)) || "settings";
}
