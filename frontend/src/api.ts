const BASE = (import.meta.env.VITE_API_URL as string) || "http://backend:8000";

export function apiBase() {
  return BASE.replace(/\/$/, "");
}

export async function fetchWithAuth(input: RequestInfo, init?: RequestInit) {
  const token = localStorage.getItem("chat_token");
  const headers = new Headers(init?.headers as HeadersInit || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  return res;
}

export async function login(usernameOrEmail: string, password: string) {
  const res = await fetch(`${apiBase()}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `Login failed: ${res.status}`);
  }
  return res.json(); // expect { access_token, refresh_token, ... } or similar
}

export async function me() {
  const res = await fetchWithAuth(`${apiBase()}/users/me`);
  if (!res.ok) throw new Error("Failed to fetch current user");
  return res.json();
}

export async function getChats() {
  const res = await fetchWithAuth(`${apiBase()}/chats`);
  if (!res.ok) throw new Error("Failed to load chats");
  return res.json();
}

export async function createChat(user2_id: number) {
  const res = await fetchWithAuth(`${apiBase()}/chats/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user2_id }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || "Failed to create chat");
  }
  return res.json();
}
