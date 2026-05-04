import React, { useState } from "react";
import BrandLogo from "./BrandLogo";
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
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username_or_email: loginValue, password }) }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.errors?.[0]?.message || "Ошибка авторизации"); return; }
      const accessToken = json.data.access_token;
      const refreshToken = json.data.refresh_token;
      if (!accessToken) { setError("Ответ не содержит access_token"); return; }
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      const meRes = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/me/`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meJson = await meRes.json().catch(() => null);
      if (!meRes.ok) { setError(meJson?.errors?.[0]?.message || "Ошибка загрузки профиля"); return; }
      const userId = meJson.data.id;
      if (!userId) { setError("В ответе от /users/me/ нет user_id"); return; }
      onLogin(accessToken, Number(userId), refreshToken);
    } catch { setError("Не удалось выполнить вход. Проверьте подключение."); }
    finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      {/* Left brand panel */}
      <div style={s.left}>
        <BrandLogo size="lg" showText={true} onDark={true} />
        <p style={s.tagline}>Корпоративный мессенджер<br />сети аптек</p>
        <div style={s.pills}>
          {["Чаты и группы", "Задачи", "Файлы"].map(f => (
            <span key={f} style={s.chip}>{f}</span>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={s.right}>
        <form onSubmit={handleSubmit} style={s.form} className="card">
          <h2 style={s.title}>Вход в систему</h2>
          <p style={s.sub}>Введите корпоративный логин или email</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            <div className="field">
              <label>Email или логин</label>
              <input value={loginValue} onChange={e => setLoginValue(e.target.value)}
                className="input" placeholder="name@april.ru" autoComplete="username" />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" autoComplete="current-password" />
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginTop: 4 }}>{error}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn btn-primary"
              disabled={loading} style={{ width: "100%", height: 42 }}>
              {loading ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Войти"}
            </button>
            <button type="button" className="btn" onClick={onGoRegister} style={{ width: "100%", height: 42 }}>
              Создать аккаунт
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--c-surface)" },
  left:    { display: "flex", flexDirection: "column", justifyContent: "center", gap: 28,
             padding: "60px 52px", background: "var(--c-brand)",
             backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 60%)" },
  tagline: { fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.35 },
  pills:   { display: "flex", flexWrap: "wrap" as const, gap: 8 },
  chip:    { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)",
             background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)",
             borderRadius: "var(--r-full)", padding: "5px 12px" },
  right:   { display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" },
  form:    { width: "100%", maxWidth: 380, padding: 32, display: "flex", flexDirection: "column", gap: 10 },
  title:   { fontSize: 20, fontWeight: 800, color: "var(--c-ink)" },
  sub:     { fontSize: 13, color: "var(--c-ink-muted)" },
};