export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The session layer registers this while someone is signed in. A 401 on any call made with their credentials means
// the sign-in no longer holds (password changed, user disabled or deleted), so the app signs them out in one place
// instead of every page showing its own "Unauthorized".
let unauthorizedHandler = null;

/** Registers the sign-out to run on a 401; returns the function that unregisters it. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

function signedOut(session, response) {
  if (response.status === 401 && session && unauthorizedHandler) unauthorizedHandler(response);
}

// A signed-in browser holds only a session token (NS-SH11-001); the password is sent once, to openSession.
function authorization(session) {
  if (session.token) return `Bearer ${session.token}`;
  return `Basic ${btoa(`${session.username}:${session.password}`)}`;
}

/**
 * Signs in: exchanges the username and password for a session token. The result is the session to keep; it holds
 * no password. The token ends after idle time, at its expiry, on sign-out, or when the password changes.
 */
export async function openSession(username, password) {
  const { data } = await request({ username, password }, "/auth/session", { method: "POST" });
  return { username: data.username, token: data.token, expiresAt: data.expiresAt };
}

/** Signs out on the server so the token stops working at once; the browser forgets it either way. */
export async function closeSession(session) {
  if (!session?.token) return;
  try {
    await fetch("/api/auth/session", { method: "DELETE", headers: { Authorization: authorization(session) } });
  } catch {
    // The server is unreachable; the token still expires on its own.
  }
}

// The backend is down or restarting: no response at all, a gateway error (502/503/504 from a proxy), or the
// dev server's own empty 500 (Vite answers that way when nothing listens on the API port). A real backend error
// always carries a JSON body with its own message, so it never lands here.
const UNREACHABLE =
  "The Nsure server is not responding. Please try again in a moment." +
  (import.meta.env.DEV ? " (Start the Nsure backend on port 8091.)" : "");

function unreachable(response, data) {
  return [502, 503, 504].includes(response.status) || (response.status >= 500 && data == null);
}

/** The error to throw for a failed response: the server's own message, or why the server could not answer. */
function failure(response, data, fallback) {
  if (unreachable(response, data)) return new ApiError(response.status, UNREACHABLE);
  // A server fault carries a reference support can find in the logs (NS-API-001).
  const reference = response.status >= 500 && data?.correlationId ? ` (reference ${data.correlationId})` : "";
  const error = new ApiError(response.status, (data?.message || fallback) + reference);
  error.code = data?.code;
  return error;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function request(session, path, options = {}) {
  const headers = { Accept: "application/json" };
  if (session) headers.Authorization = authorization(session);
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  // The version the screen showed (NS-TXN-001): a record changed meanwhile is refused with 409 STALE_VERSION.
  if (options.version !== undefined && options.version !== null) headers["If-Match"] = String(options.version);

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, UNREACHABLE);
  }

  signedOut(session, response);
  const data = await readBody(response);
  if (!response.ok) {
    throw failure(response, data, "Request failed");
  }
  return { status: response.status, data };
}

async function send(session, path, init) {
  try {
    return await fetch(`/api${path}`, {
      ...init,
      headers: { ...(session ? { Authorization: authorization(session) } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, UNREACHABLE);
  }
}

/** Uploads one file as multipart/form-data (the browser sets the boundary); extra fields go alongside it. */
export async function uploadFile(session, path, file, fields = {}) {
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([key, value]) => value && form.append(key, value));
  const response = await send(session, path, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: form,
  });
  signedOut(session, response);
  const data = await readBody(response);
  if (!response.ok) {
    throw failure(response, data, "Upload failed");
  }
  return { status: response.status, data };
}

/** Fetches a protected file as a Blob, since a plain link cannot send the Authorization header. */
export async function fetchFile(session, path) {
  const response = await send(session, path, { method: "GET", headers: {} });
  signedOut(session, response);
  if (!response.ok) {
    const data = await readBody(response);
    throw failure(response, data, "Could not open the file");
  }
  return response.blob();
}

/** A maker-checker write (202, status AWAITING_APPROVAL): accepted, but it only takes effect once a second person approves it. */
export function awaitingApproval(result) {
  return Boolean(result && (result.status === 202 || result.data?.status === "AWAITING_APPROVAL"));
}

export const AWAITING_APPROVAL_MESSAGE = "Submitted for approval by a second person.";

export function commandMessage(result, saved = "Saved.") {
  return awaitingApproval(result) ? AWAITING_APPROVAL_MESSAGE : saved;
}
