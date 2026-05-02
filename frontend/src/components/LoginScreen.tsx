import React, { useState } from "react";
import "../design.css";

export default function LoginScreen({
  onLogin,
  onGoRegister,
}: {
  onLogin: (token: string, userId: number, refreshToken: string) => void;
  onGoRegister: () => void;
}) {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/login/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username_or_email: loginValue,
            password: password,
          }),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.errors?.[0]?.message || "Ошибка авторизации");
        return;
      }

      const accessToken = json.data.access_token;
      const refreshToken = json.data.refresh_token;

      if (!accessToken) {
        setError("Ответ не содержит access_token");
        return;
      }

      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);

      const meRes = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/me/`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const meJson = await meRes.json().catch(() => null);

      if (!meRes.ok) {
        setError(meJson?.errors?.[0]?.message || "Ошибка загрузки профиля");
        return;
      }

      const userId = meJson.data.id;
      if (!userId) {
        setError("В ответе от /users/me/ нет user_id");
        return;
      }

      onLogin(accessToken, Number(userId), refreshToken);
    } catch (err) {
      setError("Не удалось выполнить вход. Проверьте подключение к серверу.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>✦</span>
          <span style={styles.brandName}>messenger</span>
        </div>
        <p style={styles.tagline}>Чаты. Задачи.<br />Всё в одном месте.</p>
      </div>

      <div style={styles.right}>
        <form onSubmit={handleSubmit} style={styles.card} className="card">
          <div style={styles.cardHeader}>
            <h2 style={styles.title}>Вход в систему</h2>
            <p style={styles.subtitle}>Введите ваши данные для входа</p>
          </div>

          <div style={styles.fields}>
            <div className="field">
              <label>Email или логин</label>
              <input
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                className="input"
                placeholder="Введите email или логин"
                autoComplete="username"
              />
            </div>

            <div className="field">
              <label>Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Введите пароль"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div style={styles.actions}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", height: "40px", fontSize: "14px" }}
            >
              {loading ? <span className="spinner" /> : "Войти"}
            </button>

            <button
              type="button"
              className="btn"
              onClick={onGoRegister}
              style={{ width: "100%", height: "40px", fontSize: "14px" }}
            >
              Создать аккаунт
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "var(--c-surface)",
  },
  left: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "64px 56px",
    background: "var(--c-ink)",
    gap: 24,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#fff",
  },
  brandMark: {
    fontSize: 22,
    color: "#93c5fd",
  },
  brandName: {
    fontSize: 18,
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.04em",
  },
  tagline: {
    fontSize: 36,
    fontWeight: 600,
    color: "#fff",
    lineHeight: 1.25,
    letterSpacing: "-0.02em",
  },
  right: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    padding: 32,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  cardHeader: { display: "flex", flexDirection: "column", gap: 4 },
  title: { fontSize: 20, fontWeight: 600, color: "var(--c-ink)" },
  subtitle: { fontSize: 13, color: "var(--c-ink-muted)" },
  fields: { display: "flex", flexDirection: "column", gap: 14 },
  actions: { display: "flex", flexDirection: "column", gap: 8 },
};