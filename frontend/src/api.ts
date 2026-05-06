const BASE = (import.meta.env.VITE_API_URL as string) || "http://backend:8000";

export function apiBase(): string {
  return BASE.replace(/\/$/, "");
}

// ─── Коллбэк на истечение сессии ─────────────────────────────────────────────
// Устанавливается из App.tsx один раз при монтировании.
// Вызывается когда refresh-токен тоже протух — нужно показать экран логина.
let _onSessionExpired: (() => void) | null = null;

export function setSessionExpiredCallback(cb: () => void): void {
  _onSessionExpired = cb;
}

// ─── Mutex для refresh ────────────────────────────────────────────────────────
// Если несколько запросов одновременно получат 401, только ОДИН выполнит
// refresh. Остальные дождутся его результата и повторят свои запросы.
let _refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${apiBase()}/users/refresh_token/`, {
      method: "POST",
      headers: {
        // Сервер ожидает refresh-токен в заголовке Authorization
        Authorization: `Bearer ${refreshToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.warn("[auth] refresh_token отклонён, статус:", res.status);
      return false;
    }

    // Сервер возвращает { data: { access_token, refresh_token } }
    const json = await res.json();
    const tokens = json?.data;

    if (tokens?.access_token && tokens?.refresh_token) {
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);

      // Диспатчим кастомное событие — WebSocket-провайдер слушает его
      // и переподключается с новым токеном
      window.dispatchEvent(new Event("tokenRefreshed"));
      return true;
    }

    console.warn("[auth] refresh: токены отсутствуют в ответе:", json);
    return false;
  } catch (err) {
    console.error("[auth] ошибка при обновлении токена:", err);
    return false;
  }
}

function refreshTokens(): Promise<boolean> {
  // Если refresh уже запущен — возвращаем тот же промис
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

function clearSession(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_id");
  _onSessionExpired?.();
}

// ─── fetchWithAuth ────────────────────────────────────────────────────────────
/**
 * Замена fetch() для всех запросов к API.
 * Автоматически:
 *  - подставляет актуальный access-токен в каждый запрос
 *  - при 401 обновляет пару токенов через refresh и повторяет запрос
 *  - при невалидном refresh-токене сбрасывает сессию и показывает логин
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const buildHeaders = (): Headers => {
    const h = new Headers((init?.headers as HeadersInit) || {});
    const token = localStorage.getItem("access_token");
    if (token) h.set("Authorization", `Bearer ${token}`);
    return h;
  };

  // Первая попытка запроса
  let res = await fetch(input, { ...init, headers: buildHeaders() });

  // Не 401 — всё хорошо, возвращаем как есть
  if (res.status !== 401) return res;

  // Получили 401 — пробуем обновить токен (mutex защищает от дублей)
  const refreshed = await refreshTokens();

  if (!refreshed) {
    // Refresh тоже не прошёл — сессия истекла, выбрасываем на логин
    clearSession();
    return res; // возвращаем 401 вызывающему коду
  }

  // Токен успешно обновлён — повторяем оригинальный запрос с новым токеном
  return fetch(input, { ...init, headers: buildHeaders() });
}