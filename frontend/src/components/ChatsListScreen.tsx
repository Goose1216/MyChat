import React, { useEffect, useState, useCallback } from "react";
import CreateChatScreen from "./CreateChatScreen";
import TaskStatsPanel from "./Taskstatspanel";
import BrandLogo from "./BrandLogo";
import { fetchWithAuth } from "../api";
import { useWebSocket } from "../Websocket";
import "../design.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const AVATAR_CLASSES = ["av-blue", "av-teal", "av-amber", "av-purple", "av-rose", "av-green"];
const avClass   = (id: number) => AVATAR_CLASSES[id % AVATAR_CLASSES.length];
const initials  = (chat: any) => (chat.title || `#${chat.id}`).slice(0, 2).toUpperCase();
const pluralChat = (n: number) => n === 1 ? "чат" : n < 5 ? "чата" : "чатов";

const CHAT_TYPE_ICON: Record<string, string> = {
  private: "💬",
  group:   "👥",
  channel: "📢",
};

// ── NavButton ─────────────────────────────────────────────────────────────────

function NavBtn({
  active, onClick, icon, label, badge, highlight,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "10px 12px", width: "100%", borderRadius: "var(--r-md)",
        border: active
          ? "1px solid rgba(255,255,255,0.22)"
          : highlight
          ? "1px solid rgba(255,255,255,0.22)"
          : "1px solid transparent",
        background: active
          ? "rgba(255,255,255,0.18)"
          : highlight
          ? "rgba(255,255,255,0.10)"
          : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.68)",
        fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: onClick ? "pointer" : "default",
        transition: "all var(--t-fast)",
        fontFamily: "var(--font-sans)",
        textAlign: "left",
      }}
      className="nav-btn"
    >
      <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && (
        <span style={{
          background: "var(--c-green)", color: "#fff",
          borderRadius: "var(--r-full)", fontSize: 9, fontWeight: 700,
          padding: "1px 6px", fontFamily: "var(--font-mono)", minWidth: 20, textAlign: "center",
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════

export default function ChatsListScreen({
  access_token,
  userId,
  isSuperuser,
  onSelectChat,
  onLogout,
  onOpenProfile,
  onOpenAdmin,
}: {
  access_token: string;
  userId: number;
  isSuperuser?: boolean;
  onSelectChat: (chat: any) => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenAdmin?: () => void;
}) {
  const [chats, setChats]                   = useState<any[]>([]);
  const [loading, setLoading]               = useState(false);
  const [search, setSearch]                 = useState("");
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [showStats, setShowStats]           = useState(false);
  const [globalStats, setGlobalStats]       = useState<any[]>([]);
  const [loadingStats, setLoadingStats]     = useState(false);
  const [usersMap, setUsersMap]             = useState<Record<number, any>>({});
  const [typingChats, setTypingChats]       = useState<Record<number, Record<number, number>>>({});

  const { addHandler, removeHandler } = useWebSocket();

  // ── Fetch chats ─────────────────────────────────────────────────────────────

  const fetchChats = useCallback(async () => {
    if (!access_token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API}/chats`);
      if (res.ok) { const d = await res.json(); setChats(d.data ?? []); }
      else if (res.status === 401) { onLogout(); }
    } catch {}
    finally { setLoading(false); }
  }, [access_token]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const loadStats = async (force = false) => {
    if (!force && globalStats.length) return;
    setLoadingStats(true);
    try {
      const res = await fetchWithAuth(`${API}/tasks/stats/`);
      if (res.ok) { const d = await res.json(); setGlobalStats(d.data ?? []); }
    } catch {}
    finally { setLoadingStats(false); }
  };

  // ── Typing indicator ─────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setTypingChats(prev => {
        const next: typeof prev = {};
        for (const [cid, users] of Object.entries(prev)) {
          const valid: Record<number, number> = {};
          for (const [uid, ts] of Object.entries(users)) {
            if (now - ts < 1500) valid[Number(uid)] = ts;
          }
          if (Object.keys(valid).length > 0) next[Number(cid)] = valid;
        }
        return next;
      });
    }, 300);
    return () => clearInterval(t);
  }, []);

  // ── WS handlers ──────────────────────────────────────────────────────────────

  const handleWS = useCallback((wsMsg: any) => {
    if (wsMsg.sender) setUsersMap(prev => ({ ...prev, [wsMsg.sender.id]: wsMsg.sender }));

    // Typing
    if (wsMsg.type_of_message === 3 && wsMsg.sender_id !== userId) {
      setTypingChats(prev => ({
        ...prev,
        [wsMsg.chat_id]: { ...(prev[wsMsg.chat_id] || {}), [wsMsg.sender_id]: Date.now() },
      }));
    }

    // New message → update last_message and move chat to top
    if (wsMsg.type_of_message === 0) {
      setChats(prev => {
        const idx = prev.findIndex(c => c.id === wsMsg.chat_id);
        if (idx === -1) return prev;
        const chat = prev[idx];
        const isForeign = wsMsg.sender_id !== userId;
        const updated = {
          ...chat,
          last_message: {
            chat_id: wsMsg.chat_id, sender_id: wsMsg.sender_id,
            content: wsMsg.text ?? null, file: wsMsg.file ?? null,
            created_at: wsMsg.created_at, sender: wsMsg.sender, is_deleted: false,
          },
          cnt_unread_messages: isForeign
            ? Math.min((chat.cnt_unread_messages ?? 0) + 1, 99)
            : chat.cnt_unread_messages,
        };
        const next = [...prev];
        next.splice(idx, 1);
        return [updated, ...next];
      });
    }

    // Added to new chat (type 5)
    if (wsMsg.type_of_message === 5 && wsMsg.chat) {
      const newChat = wsMsg.chat;
      setChats(prev => {
        if (prev.some(c => c.id === newChat.id)) return prev;
        return [{ ...newChat, cnt_unread_messages: 0, max_other_read_id: 0, last_read_message_id: 0 }, ...prev];
      });
    }
  }, [userId]);

  useEffect(() => {
    addHandler(handleWS);
    return () => removeHandler(handleWS);
  }, [handleWS]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getPreview = (chat: any) => {
    const msg = chat.last_message;
    if (!msg) return "Нет сообщений";
    const isMine = !msg.sender || msg.sender.id === userId;
    const who = isMine ? "Вы: " : `${msg.sender?.username ?? "??"}: `;
    if (msg.content) return who + (msg.content.length > 36 ? msg.content.slice(0, 36) + "…" : msg.content);
    if (msg.file)    return who + `📎 ${msg.file.filename?.slice(0, 22) ?? "файл"}`;
    return "Нет сообщений";
  };

  const getTyping = (chat: any) => {
    const users = typingChats[chat.id];
    if (!users) return null;
    const ids = Object.keys(users).map(Number);
    if (!ids.length) return null;
    const names = ids.map(id => usersMap[id]?.username ?? "Кто-то").slice(0, 2);
    if (ids.length === 1) return `${names[0]} печатает…`;
    if (ids.length === 2) return `${names[0]} и ${names[1]} печатают…`;
    return `${names[0]}, ${names[1]} и ещё…`;
  };

  const totalUnread = chats.reduce((n, c) => n + (c.cnt_unread_messages ?? 0), 0);

  const filtered = search.trim()
    ? chats.filter(c => (c.title ?? `Чат #${c.id}`).toLowerCase().includes(search.toLowerCase()))
    : chats;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--c-surface)" }}>
      <style>{`
        .nav-btn:hover { background: rgba(255,255,255,0.12) !important; color: #fff !important; }
        .chat-row { display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; border-bottom:1px solid var(--c-line-soft); transition:background var(--t-fast); }
        .chat-row:last-child { border-bottom:none; }
        .chat-row:hover { background:var(--c-brand-bg); }
      `}</style>

      {/* ══ SIDEBAR ══ */}
      <aside style={{
        width: 216, background: "var(--c-brand)", display: "flex", flexDirection: "column",
        padding: "16px 10px", gap: 4, position: "sticky", top: 0, height: "100vh", flexShrink: 0,
        boxShadow: "2px 0 10px rgba(123,31,162,0.13)",
      }}>
        {/* Logo */}
        <div style={{ padding: "2px 4px 14px", borderBottom: "1px solid rgba(255,255,255,0.12)", marginBottom: 6 }}>
          <BrandLogo size="sm" showText={true} onDark={true} />
        </div>

        {/* Navigation */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {/* Чаты — active item */}
          <NavBtn
            active
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>}
            label="Чаты"
            badge={totalUnread > 0 ? (totalUnread > 99 ? "99+" : totalUnread) : undefined}
          />

          {/* Профиль */}
          <NavBtn
            onClick={onOpenProfile}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/></svg>}
            label="Профиль"
          />

          {/* Статистика */}
          <NavBtn
            onClick={() => { setShowStats(true); loadStats(); }}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>}
            label="Статистика"
          />

          {/* Администратор — только для суперпользователя */}
          {isSuperuser && onOpenAdmin && (
            <NavBtn
              onClick={onOpenAdmin}
              highlight
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5zm-1 3v4h2V8h-2zm0 6v2h2v-2h-2z"/></svg>}
              label="Администратор"
            />
          )}
        </nav>

        {/* Logout */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 10 }}>
          <button
            onClick={onLogout}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: "var(--r-md)",
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "var(--font-sans)", transition: "all var(--t-fast)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
            className="nav-btn"
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Выйти
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        maxWidth: 700, width: "100%", margin: "0 auto",
        padding: "28px 24px", gap: 18,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--c-ink)", lineHeight: 1.1 }}>Чаты</h1>
            <p style={{ fontSize: 12, color: "var(--c-ink-muted)", marginTop: 3 }}>
              {chats.length} {pluralChat(chats.length)}
              {totalUnread > 0 && (
                <span style={{ marginLeft: 8, color: "var(--c-brand)", fontWeight: 700 }}>
                  · {totalUnread} непрочитанных
                </span>
              )}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateChat(true)}
            style={{ gap: 6, fontSize: 13 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Новый чат
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", opacity: 0.38, pointerEvents: "none" }}
            width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по чатам…"
            style={{ paddingLeft: 36 }}
          />
        </div>

        {/* Chat list */}
        <div style={{
          background: "var(--c-paper)", border: "1px solid var(--c-line)",
          borderRadius: "var(--r-lg)", overflow: "hidden", minHeight: 80,
          boxShadow: "var(--shadow-sm)",
        }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <span className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "52px 0" }}>
              <span style={{ fontSize: 30, opacity: 0.35 }}>💬</span>
              <span style={{ color: "var(--c-ink-muted)", fontSize: 13 }}>
                {search ? "Ничего не найдено" : "Нет чатов — создайте первый!"}
              </span>
            </div>
          ) : (
            filtered.map(chat => {
              const typing   = getTyping(chat);
              const preview  = getPreview(chat);
              const unread   = chat.cnt_unread_messages ?? 0;
              const typeIcon = CHAT_TYPE_ICON[chat.chat_type] ?? "";

              return (
                <div key={chat.id} className="chat-row" onClick={() => onSelectChat(chat)}>
                  {/* Avatar */}
                  <div className={`avatar avatar-md ${avClass(chat.id)}`} style={{ flexShrink: 0 }}>
                    {typeIcon || initials(chat)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {chat.title || `Чат #${chat.id}`}
                      </span>
                      {chat.chat_type && (
                        <span style={{ fontSize: 9, color: "var(--c-ink-ghost)", fontFamily: "var(--font-mono)", fontWeight: 600, flexShrink: 0 }}>
                          {chat.chat_type.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12, marginTop: 2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      color: typing ? "var(--c-brand)" : "var(--c-ink-muted)",
                      fontStyle: typing ? "italic" : "normal",
                    }}>
                      {typing ?? preview}
                    </div>
                  </div>

                  {/* Unread badge */}
                  {unread > 0 && (
                    <span style={{
                      background: "var(--c-brand)", color: "#fff",
                      borderRadius: "var(--r-full)", fontSize: 10, fontWeight: 700,
                      padding: "2px 7px", fontFamily: "var(--font-mono)",
                      minWidth: 22, textAlign: "center", flexShrink: 0,
                    }}>
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ══ STATS MODAL ══ */}
      {showStats && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 740, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="modal-title">📊 Статистика — все чаты</span>
                <button className="btn" style={{ fontSize: 11, padding: "4px 10px" }}
                  onClick={() => loadStats(true)} disabled={loadingStats}>
                  {loadingStats
                    ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    : "↺ Обновить"}
                </button>
              </div>
              <button className="modal-close" onClick={() => setShowStats(false)}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "4px 0 8px" }}>
              <TaskStatsPanel stats={globalStats} loading={loadingStats} />
            </div>
          </div>
        </div>
      )}

      {/* ══ CREATE CHAT MODAL ══ */}
      {showCreateChat && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">Новый чат</span>
              <button className="modal-close" onClick={() => setShowCreateChat(false)}>✕</button>
            </div>
            <CreateChatScreen onChatCreated={() => { setShowCreateChat(false); fetchChats(); }} />
          </div>
        </div>
      )}
    </div>
  );
}