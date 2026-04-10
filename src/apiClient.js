// ============================================================
// apiClient.js — REST API client for GAFA Express.js backend
// Replaces supabaseClient.js
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TOKEN_KEY = 'gafa_auth_token';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const token = getToken();
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

async function handleResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

// --- HTTP helpers ---

export async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: headers(),
  });
  return handleResponse(response);
}

export async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function apiPut(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function apiPatch(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function apiDelete(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return handleResponse(response);
}

// --- Auth helpers ---

export async function authLogin(email, password) {
  const data = await apiPost('/api/auth/login', { email, password });
  if (data.token) setToken(data.token);
  return data;
}

export async function authSignup(email, password, role = 'student') {
  const data = await apiPost('/api/auth/signup', { email, password, role });
  if (data.token) setToken(data.token);
  return data;
}

export async function authGetMe() {
  return apiGet('/api/auth/me');
}

export function authLogout() {
  clearToken();
}

export function isAuthenticated() {
  return !!getToken();
}
