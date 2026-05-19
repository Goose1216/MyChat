import React, { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "../api";
import "../design.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "stats" | "users" | "chats";

interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  is_superuser: boolean;
  is_deleted: boolean;
  is_verified: boolean;
  created_at?: string;
}

interface ChatParticipant {
  user_id: number;
  username?: string;
  email?: string;
  role: string;
}

interface AdminChat {
  id: number;
  title?: string;
  description?: string;
  chat_type: "private" | "group" | "channel";
  is_deleted: boolean;
  created_at?: string;
  participants: ChatParticipant[];
  message_count: number;
}

interface AdminMessage {
  id: number;
  chat_id: number;
  sender_id?: number;
  content?: string;
  is_deleted: boolean;
  created_at: string;
}

interface Stats {
  users: { total: number; active: number; deleted: number; superusers: number };
  chats: { total: number; by_type: Record<string, number> };
  messages: { total: number; active: number; deleted: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["av-blue", "av-teal", "av-amber", "av-purple", "av-rose", "av-green"];
const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];
const initials = (u: { username?: string; email?: string }) =>
  (u?.username || u?.email || "?")[0].toUpperCase();

const CHAT_TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  private: { label: "Приват",  icon: "💬", color: "#7A6888",           bg: "var(--c-surface)"      },
  group:   { label: "Группа", icon: "👥", color: "var(--c-success)",   bg: "var(--c-success-bg)"   },
  channel: { label: "Канал",  icon: "📢", color: "var(--c-warning)",   bg: "var(--c-warning-bg)"   },
};

const ROLE_META: Record<string, { label: string; icon: string }> = {
  owner:  { label: "Владелец",  icon: "👑" },
  admin:  { label: "Редактор",  icon: "✏️" },
  member: { label: "Читатель",  icon: "👁" },
};

function fmt(dt?: string) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("ru", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 56 }}>
      <div className="spinner" style={{ width: 22, height: 22 }} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 32px", color: "var(--c-ink-ghost)", fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.35 }}>◎</div>
      {text}
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px",
      borderRadius: "var(--r-full)", fontSize: 10, fontWeight: 700,
      letterSpacing: "0.04em", color, background: bg,
      fontFamily: "var(--font-mono)",
    }}>
      {label}
    </span>
  );
}

function Confirm({ text, onOk, onCancel }: { text: string; onOk: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop" style={{ zIndex: 200 }}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title">⚠️ Подтверждение</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--c-ink-soft)", marginBottom: 20, lineHeight: 1.65 }}>{text}</p>
        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>Отмена</button>
          <button className="btn btn-danger" onClick={onOk}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: "11px 16px", textAlign: "left",
      fontSize: 10, fontWeight: 700, color: "var(--c-ink-muted)",
      letterSpacing: "0.07em", textTransform: "uppercase" as const,
      borderBottom: "1px solid var(--c-line)",
      background: "var(--c-surface)", position: "sticky" as const, top: 0, zIndex: 1,
    }}>
      {children}
    </th>
  );
}

function TD({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td style={{
      padding: "10px 16px",
      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
      fontSize: mono ? 11 : 13,
      color: "var(--c-ink-soft)",
      borderBottom: "1px solid var(--c-line-soft)",
    }}>
      {children}
    </td>
  );
}

function ABtn({ title, onClick, danger = false, children }: {
  title: string; onClick: () => void; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button className={`btn${danger ? " btn-danger" : ""}`} title={title} onClick={onClick}
      style={{ fontSize: 12, padding: "4px 9px", minWidth: 0 }}>
      {children}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  STATS TAB
// ══════════════════════════════════════════════════════════════════════════════

function StatsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth(`${API}/admin/stats/`)
      .then(r => r.json())
      .then(d => setStats(d.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!stats)  return <Empty text="Не удалось загрузить статистику" />;

  const cards = [
    {
      title: "Пользователи", value: stats.users.total,    icon: "👤", color: "var(--c-brand)",   bg: "var(--c-brand-bg)",
      rows: [
        { label: "Активных",           val: stats.users.active,      color: "var(--c-success)" },
        { label: "Удалённых",          val: stats.users.deleted,     color: "var(--c-danger)"  },
        { label: "Суперпользователей", val: stats.users.superusers,  color: "var(--c-brand)"   },
      ],
    },
    {
      title: "Чаты", value: stats.chats.total, icon: "💬", color: "var(--c-green)", bg: "var(--c-green-bg)",
      rows: Object.entries(stats.chats.by_type ?? {}).map(([k, v]) => ({
        label: CHAT_TYPE_META[k]?.label ?? k,
        val: v as number,
        color: CHAT_TYPE_META[k]?.color ?? "var(--c-ink-muted)",
      })),
    },
    {
      title: "Сообщения", value: stats.messages.total, icon: "📨", color: "var(--c-warning)", bg: "var(--c-warning-bg)",
      rows: [
        { label: "Активных",  val: stats.messages.active,  color: "var(--c-success)" },
        { label: "Удалённых", val: stats.messages.deleted, color: "var(--c-danger)"  },
      ],
    },
  ];

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {cards.map(card => (
          <div key={card.title} className="card" style={{ padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-ink-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{card.title}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: card.color, lineHeight: 1.1 }}>{card.value.toLocaleString("ru")}</div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--c-line-soft)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
              {card.rows.map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--c-ink-muted)" }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: row.color, fontFamily: "var(--font-mono)" }}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "22px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-ink)", marginBottom: 18 }}>Распределение чатов по типу</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Object.entries(stats.chats.by_type ?? {}).map(([type, count]) => {
            const meta = CHAT_TYPE_META[type];
            const pct  = stats.chats.total > 0 ? Math.round((count as number) / stats.chats.total * 100) : 0;
            return (
              <div key={type}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "var(--c-ink-soft)" }}>{meta?.icon} {meta?.label ?? type}</span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--c-ink-muted)" }}>{count as number} · {pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: "var(--r-full)", background: "var(--c-line)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: "var(--r-full)", background: meta?.color ?? "var(--c-brand)", transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  USER EDIT MODAL
// ══════════════════════════════════════════════════════════════════════════════

function UserEditModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    username:     user.username,
    email:        user.email,
    phone:        user.phone ?? "",
    is_superuser: user.is_superuser,
    is_deleted:   user.is_deleted,
    is_verified:  user.is_verified ?? false,
  });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setError("");
    try {
      const r = await fetchWithAuth(`${API}/admin/users/${user.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json()).detail ?? "Ошибка сохранения");
      if (newPassword.trim()) {
        const r2 = await fetchWithAuth(`${API}/admin/users/${user.id}/set_password/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_password: newPassword }),
        });
        if (!r2.ok) throw new Error((await r2.json()).detail ?? "Ошибка смены пароля");
      }
      onSaved(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggles = [
    { key: "is_superuser", label: "👑 Супер",        activeColor: "var(--c-brand)"   },
    { key: "is_verified",  label: "✓ Верифицирован", activeColor: "var(--c-success)" },
    { key: "is_deleted",   label: "🗑 Удалён",        activeColor: "var(--c-danger)"  },
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={`avatar avatar-sm ${avatarColor(user.id)}`}>{initials(user)}</div>
            <span className="modal-title">
              {user.username}
              <span style={{ fontSize: 11, color: "var(--c-ink-ghost)", fontWeight: 400, marginLeft: 6 }}>#{user.id}</span>
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {[
            ["Имя пользователя", "username", "text"],
            ["Email",            "email",    "email"],
            ["Телефон",          "phone",    "tel"],
          ].map(([label, key, type]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input className="input" type={type} value={(form as any)[key]}
                onChange={e => set(key, e.target.value)} style={{ height: 38 }} />
            </div>
          ))}

          <div className="field">
            <label>
              Новый пароль
              <span style={{ fontWeight: 400, textTransform: "none" as const, letterSpacing: 0, color: "var(--c-ink-ghost)", marginLeft: 4 }}>
                (пусто — не менять)
              </span>
            </label>
            <input className="input" type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" style={{ height: 38 }} />
          </div>

          {/* Toggle group */}
          <div style={{ display: "flex", borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--c-line)" }}>
            {toggles.map(({ key, label, activeColor }, i) => {
              const on = (form as any)[key];
              return (
                <button key={key} onClick={() => set(key, !on)} style={{
                  flex: 1, padding: "9px 6px", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700,
                  background: on ? activeColor : "var(--c-surface)",
                  color: on ? "#fff" : "var(--c-ink-muted)",
                  borderLeft: i > 0 ? "1px solid var(--c-line)" : "none",
                  transition: "all var(--t-fast)",
                }}>
                  {label}
                </button>
              );
            })}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="modal-footer" style={{ marginTop: 4 }}>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  USERS TAB
// ══════════════════════════════════════════════════════════════════════════════

function UsersTab() {
  const [users, setUsers]           = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [inclDel, setInclDel]       = useState(false);
  const [editUser, setEditUser]     = useState<User | null>(null);
  const [confirm, setConfirm]       = useState<{ id: number; hard: boolean; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "300", include_deleted: String(inclDel) });
    if (search) p.set("search", search);
    const r = await fetchWithAuth(`${API}/admin/users/?${p}`);
    const d = await r.json();
    setUsers(d.data ?? []);
    setLoading(false);
  }, [search, inclDel]);

  useEffect(() => { load(); }, [load]);

  const softDelete    = async (id: number) => { await fetchWithAuth(`${API}/admin/users/${id}/`,             { method: "DELETE" }); load(); };
  const hardDelete    = async (id: number) => { await fetchWithAuth(`${API}/admin/users/${id}/hard_delete/`, { method: "DELETE" }); load(); };
  const makeSuperuser = async (id: number) => { await fetchWithAuth(`${API}/admin/users/${id}/make_superuser/`,   { method: "POST" }); load(); };
  const revokeSuper   = async (id: number) => { await fetchWithAuth(`${API}/admin/users/${id}/revoke_superuser/`, { method: "POST" }); load(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--c-line)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0, background: "var(--c-paper)" }}>
        <input className="input" placeholder="Поиск по имени / email…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ height: 34, flex: 1, maxWidth: 300 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "var(--c-ink-muted)", whiteSpace: "nowrap" as const }}>
          <input type="checkbox" checked={inclDel} onChange={e => setInclDel(e.target.checked)} />
          С удалёнными
        </label>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--c-ink-ghost)", fontFamily: "var(--font-mono)" }}>
          {users.length} записей
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? <Spinner /> : users.length === 0 ? <Empty text="Пользователи не найдены" /> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["ID", "Пользователь", "Email", "Телефон", "Дата регистрации", "Статус", "Действия"].map(h => <TH key={h}>{h}</TH>)}</tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.is_deleted ? 0.5 : 1 }} className="admin-row">
                  <TD mono>#{u.id}</TD>
                  <TD>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className={`avatar avatar-sm ${avatarColor(u.id)}`}>{initials(u)}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--c-ink)", fontSize: 13 }}>{u.username}</div>
                        {u.is_superuser && <div style={{ fontSize: 10, color: "var(--c-brand)", fontWeight: 700 }}>👑 Суперпользователь</div>}
                      </div>
                    </div>
                  </TD>
                  <TD>{u.email}</TD>
                  <TD mono>{u.phone || "—"}</TD>
                  <TD mono>{fmt(u.created_at)}</TD>
                  <TD>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                      {u.is_deleted   && <Badge label="Удалён"       color="var(--c-danger)"      bg="var(--c-danger-bg)"  />}
                      {u.is_verified  && <Badge label="Верифицирован" color="var(--c-success)"     bg="var(--c-success-bg)" />}
                      {!u.is_deleted && !u.is_verified && <Badge label="Активен" color="var(--c-ink-muted)" bg="var(--c-surface)" />}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ display: "flex", gap: 3 }}>
                      <ABtn title="Редактировать" onClick={() => setEditUser(u)}>✏️</ABtn>
                      {u.is_superuser
                        ? <ABtn title="Снять права"                onClick={() => revokeSuper(u.id)}>👑</ABtn>
                        : <ABtn title="Сделать суперпользователем" onClick={() => makeSuperuser(u.id)}>⬆️</ABtn>
                      }
                      {!u.is_deleted && <ABtn title="Мягкое удаление" danger onClick={() => setConfirm({ id: u.id, hard: false, name: u.username })}>🗑️</ABtn>}
                      <ABtn title="Полное удаление из БД" danger onClick={() => setConfirm({ id: u.id, hard: true, name: u.username })}>💥</ABtn>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editUser && <UserEditModal user={editUser} onClose={() => setEditUser(null)} onSaved={load} />}
      {confirm && (
        <Confirm
          text={confirm.hard
            ? `Полностью удалить «${confirm.name}» из БД? Все сообщения и данные будут уничтожены. Необратимо.`
            : `Мягко удалить «${confirm.name}»? Аккаунт деактивируется, данные сохранятся.`}
          onOk={() => { confirm.hard ? hardDelete(confirm.id) : softDelete(confirm.id); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHAT DETAIL MODAL
// ══════════════════════════════════════════════════════════════════════════════

function ChatDetailModal({ chat: initial, onClose, onSaved }: { chat: AdminChat; onClose: () => void; onSaved: () => void }) {
  const [subTab, setSubTab]           = useState<"participants" | "messages" | "edit">("participants");
  const [participants, setParticipants] = useState<ChatParticipant[]>(initial.participants ?? []);
  const [messages, setMessages]       = useState<AdminMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [addUserId, setAddUserId]     = useState("");
  const [addRole, setAddRole]         = useState("member");
  const [editForm, setEditForm]       = useState({ title: initial.title ?? "", description: initial.description ?? "" });
  const [saving, setSaving]           = useState(false);
  const [confirmMsg, setConfirmMsg]   = useState<{ id: number; hard: boolean } | null>(null);

  const loadMessages = useCallback(async () => {
    setLoadingMsgs(true);
    const r = await fetchWithAuth(`${API}/admin/chats/${initial.id}/messages/?limit=200&include_deleted=true`);
    const d = await r.json();
    setMessages(d.data ?? []);
    setLoadingMsgs(false);
  }, [initial.id]);

  useEffect(() => { if (subTab === "messages") loadMessages(); }, [subTab, loadMessages]);

  const reloadPart = async () => {
    const r = await fetchWithAuth(`${API}/admin/chats/${initial.id}/participants/`);
    setParticipants((await r.json()).data ?? []);
  };

  const addPart = async () => {
    const uid = parseInt(addUserId); if (!uid) return;
    await fetchWithAuth(`${API}/admin/chats/${initial.id}/participants/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, role: addRole }),
    });
    setAddUserId(""); await reloadPart();
  };

  const removePart  = async (uid: number) => {
    await fetchWithAuth(`${API}/admin/chats/${initial.id}/participants/${uid}/`, { method: "DELETE" });
    setParticipants(p => p.filter(x => x.user_id !== uid));
  };

  const changeRole = async (uid: number, role: string) => {
    await fetchWithAuth(`${API}/admin/chats/${initial.id}/participants/${uid}/role/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setParticipants(p => p.map(x => x.user_id === uid ? { ...x, role } : x));
  };

  const saveChat = async () => {
    setSaving(true);
    await fetchWithAuth(`${API}/admin/chats/${initial.id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false); onSaved();
  };

  const deleteMsg = async (msgId: number, hard: boolean) => {
    const url = `${API}/admin/chats/${initial.id}/messages/${msgId}/${hard ? "hard_delete/" : ""}`;
    await fetchWithAuth(url, { method: "DELETE" });
    setMessages(prev =>
      hard ? prev.filter(m => m.id !== msgId)
           : prev.map(m => m.id === msgId ? { ...m, is_deleted: true } : m)
    );
    setConfirmMsg(null);
  };

  const meta = CHAT_TYPE_META[initial.chat_type] ?? CHAT_TYPE_META.private;
  const subTabs = [
    { id: "participants", label: `👥 Участники (${participants.length})` },
    { id: "messages",     label: `💬 Сообщения (${initial.message_count})` },
    { id: "edit",         label: "✏️ Редактировать" },
  ] as const;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 660, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "18px 22px 0", borderBottom: "1px solid var(--c-line)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{meta.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-ink)" }}>{initial.title || `Чат #${initial.id}`}</span>
                <Badge label={meta.label} color={meta.color} bg={meta.bg} />
              </div>
              <div style={{ fontSize: 11, color: "var(--c-ink-ghost)", fontFamily: "var(--font-mono)" }}>
                ID #{initial.id} · {participants.length} участников · {initial.message_count} сообщений
              </div>
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div style={{ display: "flex" }}>
            {subTabs.map(t => {
              const active = subTab === t.id;
              return (
                <button key={t.id} onClick={() => setSubTab(t.id)} style={{
                  padding: "9px 16px", fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? "var(--c-brand)" : "var(--c-ink-muted)",
                  background: "none", border: "none",
                  borderBottom: active ? "2px solid var(--c-brand)" : "2px solid transparent",
                  cursor: "pointer",
                }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Participants */}
          {subTab === "participants" && (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-line-soft)", display: "flex", gap: 8 }}>
                <input className="input" placeholder="ID пользователя" value={addUserId}
                  onChange={e => setAddUserId(e.target.value)} style={{ height: 32, width: 140, fontSize: 12 }} />
                <select className="input" value={addRole} onChange={e => setAddRole(e.target.value)}
                  style={{ height: 32, fontSize: 12, width: 130 }}>
                  <option value="member">👁 Читатель</option>
                  <option value="admin">✏️ Редактор</option>
                  <option value="owner">👑 Владелец</option>
                </select>
                <button className="btn btn-primary" onClick={addPart} style={{ height: 32, fontSize: 12, padding: "0 14px" }}>+ Добавить</button>
              </div>
              {participants.length === 0 ? <Empty text="Нет участников" /> : participants.map(p => {
                const rm = ROLE_META[p.role] ?? { label: p.role, icon: "?" };
                return (
                  <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid var(--c-line-soft)" }}>
                    <div className={`avatar avatar-sm ${avatarColor(p.user_id)}`}>
                      {(p.username || p.email || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--c-ink)" }}>{p.username || p.email || `#${p.user_id}`}</div>
                      <div style={{ fontSize: 10, color: "var(--c-ink-ghost)" }}>{rm.icon} {rm.label}</div>
                    </div>
                    <select className="input" value={p.role} onChange={e => changeRole(p.user_id, e.target.value)}
                      style={{ height: 30, fontSize: 11, width: 130 }}>
                      <option value="member">👁 Читатель</option>
                      <option value="admin">✏️ Редактор</option>
                      <option value="owner">👑 Владелец</option>
                    </select>
                    <button className="btn btn-danger" onClick={() => removePart(p.user_id)}
                      style={{ height: 30, fontSize: 12, padding: "0 10px" }}>✕</button>
                  </div>
                );
              })}
            </>
          )}

          {/* Messages */}
          {subTab === "messages" && (
            loadingMsgs ? <Spinner /> :
            messages.length === 0 ? <Empty text="Нет сообщений" /> :
            messages.map(m => (
              <div key={m.id} style={{ padding: "9px 16px", borderBottom: "1px solid var(--c-line-soft)", display: "flex", gap: 10, alignItems: "flex-start", opacity: m.is_deleted ? 0.45 : 1 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-ink-ghost)", paddingTop: 2, minWidth: 30 }}>#{m.id}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "var(--c-ink-ghost)", marginBottom: 2 }}>user#{m.sender_id} · {fmt(m.created_at)}</div>
                  <div style={{ fontSize: 13, color: m.is_deleted ? "var(--c-ink-ghost)" : "var(--c-ink)", wordBreak: "break-word" as const }}>
                    {m.is_deleted ? "⚠️ Удалено" : (m.content || "—")}
                  </div>
                </div>
                {!m.is_deleted && (
                  <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    <ABtn title="Мягкое удаление" danger onClick={() => deleteMsg(m.id, false)}>🗑️</ABtn>
                    <ABtn title="Удалить полностью" danger onClick={() => setConfirmMsg({ id: m.id, hard: true })}>💥</ABtn>
                  </div>
                )}
                {confirmMsg?.id === m.id && (
                  <Confirm
                    text={`Полностью удалить сообщение #${m.id}? Необратимо.`}
                    onOk={() => deleteMsg(m.id, true)}
                    onCancel={() => setConfirmMsg(null)}
                  />
                )}
              </div>
            ))
          )}

          {/* Edit */}
          {subTab === "edit" && (
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Название</label>
                <input className="input" value={editForm.title}
                  onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} style={{ height: 38 }} />
              </div>
              <div className="field">
                <label>Описание</label>
                <textarea className="input" value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={saveChat} disabled={saving}>
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHATS TAB
// ══════════════════════════════════════════════════════════════════════════════

function ChatsTab() {
  const [chats, setChats]           = useState<AdminChat[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterType, setFilterType] = useState("");
  const [inclDel, setInclDel]       = useState(false);
  const [detailChat, setDetailChat] = useState<AdminChat | null>(null);
  const [confirm, setConfirm]       = useState<{ id: number; hard: boolean; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "300", include_deleted: String(inclDel) });
    if (search)     p.set("search", search);
    if (filterType) p.set("chat_type", filterType);
    const r = await fetchWithAuth(`${API}/admin/chats/?${p}`);
    const d = await r.json();
    setChats(d.data ?? []);
    setLoading(false);
  }, [search, filterType, inclDel]);

  useEffect(() => { load(); }, [load]);

  const softDelete = async (id: number) => { await fetchWithAuth(`${API}/admin/chats/${id}/`,             { method: "DELETE" }); load(); };
  const hardDelete = async (id: number) => { await fetchWithAuth(`${API}/admin/chats/${id}/hard_delete/`, { method: "DELETE" }); load(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--c-line)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0, background: "var(--c-paper)", flexWrap: "wrap" as const }}>
        <input className="input" placeholder="Поиск по названию…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ height: 34, flex: 1, minWidth: 160, maxWidth: 280 }} />
        <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ height: 34, fontSize: 12, width: 150 }}>
          <option value="">Все типы</option>
          <option value="private">💬 Приватный</option>
          <option value="group">👥 Группа</option>
          <option value="channel">📢 Канал</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "var(--c-ink-muted)", whiteSpace: "nowrap" as const }}>
          <input type="checkbox" checked={inclDel} onChange={e => setInclDel(e.target.checked)} />
          С удалёнными
        </label>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--c-ink-ghost)", fontFamily: "var(--font-mono)" }}>
          {chats.length} записей
        </span>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? <Spinner /> : chats.length === 0 ? <Empty text="Чаты не найдены" /> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["ID", "Название", "Тип", "Участников", "Сообщений", "Статус", "Действия"].map(h => <TH key={h}>{h}</TH>)}</tr>
            </thead>
            <tbody>
              {chats.map(c => {
                const meta = CHAT_TYPE_META[c.chat_type] ?? CHAT_TYPE_META.private;
                return (
                  <tr key={c.id} style={{ opacity: c.is_deleted ? 0.5 : 1 }} className="admin-row">
                    <TD mono>#{c.id}</TD>
                    <TD>
                      <span style={{ fontWeight: 600, color: "var(--c-ink)" }}>
                        {c.title || <span style={{ color: "var(--c-ink-ghost)", fontStyle: "italic" }}>без названия</span>}
                      </span>
                    </TD>
                    <TD><Badge label={`${meta.icon} ${meta.label}`} color={meta.color} bg={meta.bg} /></TD>
                    <TD mono>{c.participants?.length ?? 0}</TD>
                    <TD mono>{c.message_count ?? 0}</TD>
                    <TD>
                      {c.is_deleted
                        ? <Badge label="Удалён"  color="var(--c-danger)"  bg="var(--c-danger-bg)"  />
                        : <Badge label="Активен" color="var(--c-success)" bg="var(--c-success-bg)" />
                      }
                    </TD>
                    <TD>
                      <div style={{ display: "flex", gap: 3 }}>
                        <ABtn title="Детали: участники, сообщения, редактирование" onClick={() => setDetailChat(c)}>👁 Детали</ABtn>
                        {!c.is_deleted && <ABtn title="Мягкое удаление" danger onClick={() => setConfirm({ id: c.id, hard: false, name: c.title || `#${c.id}` })}>🗑️</ABtn>}
                        <ABtn title="Полное удаление (необратимо)" danger onClick={() => setConfirm({ id: c.id, hard: true, name: c.title || `#${c.id}` })}>💥</ABtn>
                      </div>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {detailChat && <ChatDetailModal chat={detailChat} onClose={() => setDetailChat(null)} onSaved={load} />}
      {confirm && (
        <Confirm
          text={confirm.hard
            ? `Полностью удалить чат «${confirm.name}» из БД? Все сообщения и участники уничтожатся. Необратимо.`
            : `Мягко удалить чат «${confirm.name}»?`}
          onOk={() => { confirm.hard ? hardDelete(confirm.id) : softDelete(confirm.id); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════════════════════════

const NAV: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: "stats", label: "Обзор",        icon: "📊", desc: "Статистика системы" },
  { id: "users", label: "Пользователи", icon: "👤", desc: "CRUD пользователей" },
  { id: "chats", label: "Чаты",         icon: "💬", desc: "Управление чатами"  },
];

export default function AdminScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("stats");

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--c-surface)", fontFamily: "var(--font-sans)", overflow: "hidden" }}>
      <style>{`
        .admin-row:hover  { background: var(--c-brand-bg) !important; }
        .admin-nav-btn:hover { background: rgba(255,255,255,0.12) !important; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width: 220, background: "var(--c-brand)", display: "flex", flexDirection: "column", flexShrink: 0, boxShadow: "2px 0 12px rgba(123,31,162,0.18)" }}>
        {/* Brand */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--r-md)", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              🛡️
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>Панель</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>управления</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 8, fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>ADMINISTRATOR</div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: "10px 8px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} className="admin-nav-btn" onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%",
                borderRadius: "var(--r-md)", border: active ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
                cursor: "pointer", textAlign: "left" as const,
                background: active ? "rgba(255,255,255,0.2)" : "transparent",
                transition: "all var(--t-fast)",
              }}>
                <span style={{ fontSize: 17, flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "#fff" : "rgba(255,255,255,0.7)", lineHeight: 1.2 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1.2 }}>{t.desc}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Back */}
        <div style={{ padding: "10px 8px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={onBack} className="admin-nav-btn" style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%",
            borderRadius: "var(--r-md)", border: "none", cursor: "pointer", textAlign: "left" as const,
            background: "transparent", transition: "background var(--t-fast)",
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="rgba(255,255,255,0.55)">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>Назад к чатам</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ height: 54, padding: "0 28px", background: "var(--c-paper)", borderBottom: "1px solid var(--c-line)", display: "flex", alignItems: "center", flexShrink: 0, boxShadow: "var(--shadow-sm)" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-ink)" }}>
            {NAV.find(t => t.id === tab)?.icon}{" "}{NAV.find(t => t.id === tab)?.label}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "var(--r-full)", background: "var(--c-brand-bg)", border: "1px solid var(--c-brand-border)" }}>
            <span style={{ fontSize: 11 }}>👑</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-brand)" }}>Суперпользователь</span>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {tab === "stats" && <StatsTab />}
          {tab === "users" && <UsersTab />}
          {tab === "chats" && <ChatsTab />}
        </div>
      </div>
    </div>
  );
}