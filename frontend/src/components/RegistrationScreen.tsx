import React, { useState } from "react";
import BrandLogo from "./BrandLogo";
import "../design.css";

export default function RegistrationScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [loading, setLoading]   = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/register/`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, phone, password }) }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.errors?.[0]?.message || "Ошибка регистрации"); return; }
      setSuccess("Регистрация успешна! Теперь вы можете войти.");
    } catch { setError("Не удалось выполнить регистрацию."); }
    finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.left}>
        <BrandLogo size="lg" showText={true} onDark={true} />
        <p style={s.tagline}>Создайте аккаунт и начните общаться.</p>
      </div>

      <div style={s.right}>
        <form onSubmit={handleRegister} style={s.form} className="card">
          <h2 style={s.title}>Создание аккаунта</h2>
          <p style={s.sub}>Заполните данные для регистрации</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            <div className="field">
              <label>Логин</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                className="input" placeholder="Введите логин" autoComplete="username" />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="name@april.ru" type="email" autoComplete="email" />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="input" placeholder="+7 900 000-00-00" type="tel" autoComplete="tel" />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" autoComplete="new-password" />
            </div>
          </div>

          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {success ? (
              <button type="button" className="btn btn-primary" onClick={onGoLogin} style={{ width: "100%", height: 42 }}>
                Перейти ко входу
              </button>
            ) : (
              <button type="submit" className="btn btn-success" disabled={loading} style={{ width: "100%", height: 42 }}>
                {loading ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Зарегистрироваться"}
              </button>
            )}
            <button type="button" className="btn" onClick={onGoLogin} style={{ width: "100%", height: 42 }}>
              Уже есть аккаунт
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
  right:   { display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" },
  form:    { width: "100%", maxWidth: 380, padding: 32, display: "flex", flexDirection: "column", gap: 10 },
  title:   { fontSize: 20, fontWeight: 800, color: "var(--c-ink)" },
  sub:     { fontSize: 13, color: "var(--c-ink-muted)" },
};