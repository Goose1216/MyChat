import React, { useEffect, useState } from "react";
import { fetchWithAuth, apiBase } from "../api";
import BrandLogo from "./BrandLogo";
import "../design.css";

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const API = apiBase();
  const [form, setForm] = useState({ username: "", email: "", phone: "" });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res  = await fetchWithAuth(`${API}/users/me/`);
      const data = await res.json();
      if (res.ok && data?.data) setForm({ username: data.data.username, email: data.data.email, phone: data.data.phone });
    } catch { setError("Ошибка загрузки профиля"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { loadProfile(); }, []);

  const updateProfile = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res  = await fetchWithAuth(`${API}/users/me/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { setSuccess("Данные успешно обновлены"); return; }
      if (data?.description) setError(data.description);
      else if (data?.errors?.length) setError(data.errors[0].message);
      else setError("Ошибка обновления");
    } catch { setError("Ошибка соединения"); }
    finally  { setSaving(false); }
  };

  const change  = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });
  const initials = form.username ? form.username.slice(0, 2).toUpperCase() : "??";

  return (
    <div style={s.page}>
      {/* Topbar */}
      <header style={s.topbar}>
        <button className="btn btn-ghost" onClick={onBack} style={{ fontSize: 13, padding: "6px 10px" }}>
          ← Назад
        </button>
        <BrandLogo size="sm" showText={true} onDark={false} />
        <div style={{ width: 80 }} />
      </header>

      <div style={s.body}>
        <div style={s.card} className="card">
          {loading ? (
            <div style={s.loadingWrap}><span className="spinner" /><span style={{ color: "var(--c-ink-muted)", fontSize: 13 }}>Загрузка...</span></div>
          ) : (
            <>
              {/* Avatar row */}
              <div style={s.avatarRow}>
                <div className="avatar avatar-lg av-purple" style={{ width: 56, height: 56, fontSize: 18 }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--c-ink)" }}>{form.username || "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--c-ink-muted)", marginTop: 2 }}>{form.email || "—"}</div>
                </div>
              </div>

              <div className="divider" />

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="field">
                  <label>Логин</label>
                  <input name="username" value={form.username} onChange={change} className="input" />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input name="email" value={form.email} onChange={change} className="input" type="email" />
                </div>
                <div className="field">
                  <label>Телефон</label>
                  <input name="phone" value={form.phone} onChange={change} className="input" type="tel" />
                </div>
              </div>

              {error   && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <button onClick={updateProfile} disabled={saving} className="btn btn-primary" style={{ width: "100%", height: 42 }}>
                {saving ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Сохранить изменения"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:       { minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--c-surface)" },
  topbar:     { display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 20px", background: "var(--c-paper)",
                borderBottom: "1px solid var(--c-line)", position: "sticky", top: 0, zIndex: 10 },
  body:       { flex: 1, display: "flex", justifyContent: "center", padding: "32px 16px" },
  card:       { width: "100%", maxWidth: 440, padding: 28, display: "flex", flexDirection: "column", gap: 18 },
  loadingWrap:{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "32px 0" },
  avatarRow:  { display: "flex", alignItems: "center", gap: 14 },
};