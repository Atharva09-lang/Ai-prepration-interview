import { API_URL } from './utils';

/** Structured error surfaced by the backend: { error: { code, message, details? } }. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (Array.isArray(details)) this.details = details;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(path, opts = {}) {
  const { body, headers, ...rest } = opts;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
  }

  if (res.status === 204) return undefined;

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? 'REQUEST_FAILED',
      err.message ?? `Request failed (${res.status})`,
      err.details,
    );
  }

  return data;
}

// All backend communication goes through this object — no fetch calls in pages.
export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  me: () => request('/api/auth/me'),
  register: (email, password) =>
    request('/api/auth/register', { method: 'POST', body: { email, password } }),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  // ── Kits ──────────────────────────────────────────────────────────────────
  listKits: () => request('/api/kits'),
  getKit: (id) => request(`/api/kits/${id}`),
  createKit: (input) => request('/api/kits', { method: 'POST', body: input }),
  deleteKit: (id) => request(`/api/kits/${id}`, { method: 'DELETE' }),
  patchKit: (id, patch) => request(`/api/kits/${id}`, { method: 'PATCH', body: patch }),
  regenerate: (id, section) =>
    request(`/api/kits/${id}/regenerate`, { method: 'POST', body: { section } }),

  // ── Questions ─────────────────────────────────────────────────────────────
  addQuestion: (id, body) =>
    request(`/api/kits/${id}/questions`, { method: 'POST', body }),
  updateQuestion: (id, qid, body) =>
    request(`/api/kits/${id}/questions/${qid}`, { method: 'PATCH', body }),
  deleteQuestion: (id, qid) =>
    request(`/api/kits/${id}/questions/${qid}`, { method: 'DELETE' }),

  // ── Flashcards ────────────────────────────────────────────────────────────
  addFlashcard: (id, body) =>
    request(`/api/kits/${id}/flashcards`, { method: 'POST', body }),
  updateFlashcard: (id, fid, body) =>
    request(`/api/kits/${id}/flashcards/${fid}`, { method: 'PATCH', body }),
  deleteFlashcard: (id, fid) =>
    request(`/api/kits/${id}/flashcards/${fid}`, { method: 'DELETE' }),

  // ── Practice ──────────────────────────────────────────────────────────────
  getPractice: (id) => request(`/api/kits/${id}/practice`),
  postConfidence: (id, fid, confidence) =>
    request(`/api/kits/${id}/practice/${fid}/confidence`, {
      method: 'POST',
      body: { confidence },
    }),

  // ── Jobs ──────────────────────────────────────────────────────────────────
  getJob: (jobId) => request(`/api/jobs/${jobId}`),

  // ── Misc ──────────────────────────────────────────────────────────────────
  health: () => request('/api/health'),
};
