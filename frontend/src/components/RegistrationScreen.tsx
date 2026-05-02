import React, { useState } from "react";
import "../design.css";

export default function RegistrationScreen({
  onGoLogin,
}: {
  onGoLogin: () => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/register/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, phone, password }),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.errors?.[0]?.message || "Ошибка регистрации");
        return;
      }

      setSuccess("Регистрация успешна! Теперь вы можете войти.");
    } catch (err) {
      setError("Не удалось выполнить регистрацию.");
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
        <p style={styles.tagline}>Создайте аккаунт и начните общаться.</p>
      </div>

      <div style={styles.right}>
        <form onSubmit={handleRegister} style={styles.card} className="card">
          <div style={styles.cardHeader}>
            <h2 style={styles.title}>Создание аккаунта</h2>
            <p style={styles.subtitle}>Заполните все поля для регистрации</p>
          </div>

          <div style={styles.fields}>
            <div className="field">
              <label>Логин</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Введите логин"
                autoComplete="username"
              />
            </div>

            <div className="field">
              <label>Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="Введите email"
                type="email"
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label>Телефон</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="+79000000000"
                type="tel"
                autoComplete="tel"
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
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div style={styles.actions}>
            {success ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onGoLogin}
                style={{ width: "100%", height: "40px", fontSize: "14px" }}
              >
                Перейти ко входу
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: "100%", height: "40px", fontSize: "14px", background: "var(--c-success)", borderColor: "var(--c-success)" }}
              >
                {loading ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Зарегистрироваться"}
              </button>
            )}

            <button
              type="button"
              className="btn"
              onClick={onGoLogin}
              style={{ width: "100%", height: "40px", fontSize: "14px" }}
            >
              Уже есть аккаунт
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
  brand: { display: "flex", alignItems: "center", gap: 10, color: "#fff" },
  brandMark: { fontSize: 22, color: "#93c5fd" },
  brandName: { fontSize: 18, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" },
  tagline: { fontSize: 32, fontWeight: 600, color: "#fff", lineHeight: 1.3, letterSpacing: "-0.02em" },
  right: { display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" },
  card: { width: "100%", maxWidth: 380, padding: 32, display: "flex", flexDirection: "column", gap: 20 },
  cardHeader: { display: "flex", flexDirection: "column", gap: 4 },
  title: { fontSize: 20, fontWeight: 600, color: "var(--c-ink)" },
  subtitle: { fontSize: 13, color: "var(--c-ink-muted)" },
  fields: { display: "flex", flexDirection: "column", gap: 14 },
  actions: { display: "flex", flexDirection: "column", gap: 8 },
};