const TOKEN_KEY = 'guestToken';
const ADMIN_TOKEN_KEY = 'adminToken';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function readBody(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.code = data.error || 'SERVER_ERROR';
    err.status = res.status;
    throw err;
  }
  return data;
}

export function verifyName(fullName, signal) {
  return fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName }),
    signal,
  }).then(readBody);
}

export function getMe(token) {
  return fetch('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(readBody);
}

export function getInvitation(token) {
  return fetch('/api/invitation', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(readBody);
}

export function submitRsvp(token, { status, companions = [] }) {
  return fetch('/api/rsvp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status, companions }),
  }).then(readBody);
}
