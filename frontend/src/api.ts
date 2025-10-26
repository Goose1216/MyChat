const BASE = (import.meta.env.VITE_API_URL as string) || "http://backend:8000";

export function apiBase() {
  return BASE.replace(/\/$/, "");
}

// Главная функция для всех запросов с авторизацией и автообновлением токенов
export async function fetchWithAuth(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");
  const headers = new Headers(init?.headers as HeadersInit || {});

  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let res = await fetch(input, { ...init, headers });

  // Если токен протух
  if (res.status === 401 && refreshToken) {
    console.warn("Access token expired, trying to refresh...");

    const refreshed = await refreshTokens(refreshToken);
    if (refreshed) {
      // Обновили токен — пробуем запрос снова
      const newAccessToken = localStorage.getItem("access_token");
      const retryHeaders = new Headers(init?.headers as HeadersInit || {});
      if (newAccessToken) retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);

      res = await fetch(input, { ...init, headers: retryHeaders });
    } else {
      // Refresh токен невалиден
      alert("Сессия истекла. Пожалуйста, войдите снова.");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_id");
      window.location.reload(); // выбрасываем из сессии
    }
  }

  return res;
}

// Обновление токенов
async function refreshTokens(refreshToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/users/refresh_token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${refreshToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("Refresh token invalid or expired");
      return false;
    }

    const data = await res.json();
    if (data?.access_token && data?.refresh_token) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return true;
    }

    return false;
  } catch (err) {
    console.error("Error refreshing token:", err);
    return false;
  }
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

  const data = await res.json();
  // сохраняем оба токена
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  return data;
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
