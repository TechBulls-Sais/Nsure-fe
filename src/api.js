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
    throw new ApiError(0, "The API is not reachable. Start the Nsure backend on port 8091.");
  }

  const data = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, data?.message || "Request failed");
  }
  return { status: response.status, data };
}

async function send(session, path, init) {
  try {
    return await fetch(`/api${path}`, {
      ...init,
      headers: { ...(session ? { Authorization: basic(session) } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "The API is not reachable. Start the Nsure backend on port 8091.");
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
  const data = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, data?.message || "Upload failed");
  }
  return { status: response.status, data };
}

/** Fetches a protected file as a Blob, since a plain link cannot send the Authorization header. */
export async function fetchFile(session, path) {
  const response = await send(session, path, { method: "GET", headers: {} });
  if (!response.ok) {
    const data = await readBody(response);
    throw new ApiError(response.status, data?.message || "Could not open the file");
  }
  return response.blob();
}

export function commandMessage(result, saved = "Saved.") {
  if (result.status === 202 || result.data?.status === "AWAITING_APPROVAL") {
    return "Submitted for approval. A different user must approve it in the audit log.";
  }
  return saved;
}
