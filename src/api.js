export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function basic(session) {
  const token = btoa(`${session.username}:${session.password}`);
  return `Basic ${token}`;
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
  if (session) headers.Authorization = basic(session);
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "The API is not reachable. Start the backend on port 8080.");
  }

  const data = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, data?.message || "Request failed");
  }
  return { status: response.status, data };
}

export function commandMessage(result, saved = "Saved.") {
  if (result.status === 202 || result.data?.status === "AWAITING_APPROVAL") {
    return "Submitted for approval. A different user must approve it in the audit log.";
  }
  return saved;
}
