import React, { useEffect, useState } from "react";
import CreateChatScreen from "./CreateChatScreen";
import TaskStatsPanel from "./TaskStatsPanel";
import BrandLogo from "./BrandLogo";
import { fetchWithAuth } from "../api";
import { useWebSocket } from "../Websocket";
import "../design.css";

const AVATAR_CLASSES = ["av-blue", "av-teal", "av-amber", "av-purple", "av-rose", "av-green"];

export default function ChatsListScreen({
  access_token,
  userId,
  onSelectChat,
  onLogout,
  onOpenProfile,
}: {
  access_token: string;
  userId: number;
  onSelectChat: (chat: any) => void;
  onLogout: () => void;
  onOpenProfile: () => void;
}) {
  const [chats, setChats]               = useState<any[]>([]);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [search, setSearch]             = useState("");
  const { addHandler, removeHandler }   = useWebSocket();

  const [usersMap, setUsersMap]         = useState<Record<number, any>>({});
  const [typingChats, setTypingChats]   = useState<Record<number, Record<number, number>>>({});

  const handleTypingEvent = (wsMsg: any) => {
    if (wsMsg.sender) setUsersMap(prev => ({ ...prev, [wsMsg.sender.id]: wsMsg.sender }));
    if (wsMsg.type_of_message !== 3) return;
    if (wsMsg.sender_id === userId) return;
    setTypingChats(prev => ({
      ...prev,
      [wsMsg.chat_id]: { ...(prev[wsMsg.chat_id] || {}), [wsMsg.sender_id]: Date.now() },
    }));
  };

  const [showGlobalStats, setShowGlobalStats]   = useState(false);
  const [globalStats, setGlobalStats]           = useState<any[]>([]);
  const [loadingGlobalStats, setLoadingGlobalStats] = useState(false);

  const loadGlobalStats = async () => {
    if (globalStats.length) return;
    setLoadingGlobalStats(true);
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/tasks/stats/`);
      if (res.ok) { const data = await res.json(); setGlobalStats(data.data ?? []); }
    } catch { }
    finally { setLoadingGlobalStats(false); }
  };

  const refreshGlobalStats = async () => {
    setGlobalStats([]); setLoadingGlobalStats(true);
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/tasks/stats/`);
      if (res.ok) { const data = await res.json(); setGlobalStats(data.data ?? []); }
    } catch { }
    finally { setLoadingGlobalStats(false); }
  };

  const renderTyping = (chat: any) => {
    const users = typingChats[chat.id];
    if (!users) return null;
    const ids = Object.keys(users).map(Number);
    if (ids.length === 0) return null;
    const names = ids.map(id => usersMap[id]?.username || "Кто-то").slice(0, 2);
    if (ids.length === 1) return `${names[0]} печатает…`;
    if (ids.length === 2) return `${names[0]} и ${names[1]} печатают…`;
    return `${names[0]}, ${names[1]} и ещё…`;
  };

  const fetchChats = async () => {
    if (!access_token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/chats`, { method: "GET" });
      if (res.ok) {
        const d = await res.json();
        // Нормализуем: гарантируем наличие полей которые могут отсутствовать
        // в старых данных (до миграции бэкенда)
        const normalized = (d.data ?? []).map((c: any) => ({
          ...c,
          max_other_read_id:   c.max_other_read_id   ?? 0,
          cnt_unread_messages: c.cnt_unread_messages  ?? 0,
          last_read_message_id: c.last_read_message_id ?? 0,
        }));
        setChats(normalized);
      }
      else if (res.status === 401) { alert("Сессия истекла."); onLogout(); }
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchChats(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingChats(prev => {
        const next: typeof prev = {};
        for (const [chatId, users] of Object.entries(prev)) {
          const valid: Record<number, number> = {};
          for (const [uid, ts] of Object.entries(users)) {
            if (now - ts < 1500) valid[Number(uid)] = ts;
          }
          if (Object.keys(valid).length > 0) next[Number(chatId)] = valid;
        }
        return next;
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { addHandler(handleTypingEvent); return () => removeHandler(handleTypingEvent); }, []);

  const getLastMessagePreview = (chat: any) => {
    const msg = chat.last_message;
    if (!msg) return "Нет сообщений";
    const senderName = msg.sender && msg.sender.id !== userId ? `${msg.sender.username}: ` : "Вы: ";
    if (msg.content) return senderName + (msg.content.length > 30 ? msg.content.slice(0, 30) + "…" : msg.content);
    if (msg.file)    return senderName + `📎 ${msg.file.filename.slice(0, 20)}`;
    return "Нет сообщений";
  };

  const updateChatLastMessage = (wsMsg: any) => {
    if (wsMsg.sender) setUsersMap(prev => ({ ...prev, [wsMsg.sender.id]: wsMsg.sender }));
    if (wsMsg.type_of_message !== 0) return;
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
          created_at: wsMsg.created_at, updated_at: wsMsg.created_at,
          sender: wsMsg.sender, is_deleted: false,
        },
        cnt_unread_messages: isForeign
          ? Math.min((chat.cnt_unread_messages ?? 0) + 1, 99)
          : chat.cnt_unread_messages,
      };
      const next = [...prev];
      next.splice(idx, 1);
      return [updated, ...next];
    });
  };

  useEffect(() => { addHandler(updateChatLastMessage); return () => removeHandler(updateChatLastMessage); }, []);

  const handleChatCreated = () => { setShowCreateChat(false); fetchChats(); };

  const getAvClass   = (id: number) => AVATAR_CLASSES[id % AVATAR_CLASSES.length];
  const getInitials  = (chat: any) => (chat.title || `#${chat.id}`).slice(0, 2).toUpperCase();
  // Количество чатов где есть непрочитанные (а не сумма сообщений)
  const totalUnread  = chats.filter(c => (c.cnt_unread_messages ?? 0) > 0).length;

  const filtered = search.trim()
    ? chats.filter(c => (c.title || `Чат #${c.id}`).toLowerCase().includes(search.toLowerCase()))
    : chats;

  return (
    <div style={s.page}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <BrandLogo size="sm" showText={true} onDark={true} />
        </div>

        <nav style={s.nav}>
          <button className="btn" style={s.navActive}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            Чаты
            {totalUnread > 0 && (
              <span style={s.badge}>{totalUnread > 99 ? "99+" : totalUnread}</span>
            )}
          </button>
          <button className="btn" style={s.navItem} onClick={onOpenProfile}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/></svg>
            Профиль
          </button>
          <button className="btn" style={s.navItem} onClick={() => { setShowGlobalStats(true); loadGlobalStats(); }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            Статистика
          </button>
        </nav>

        <div style={s.sidebarBottom}>
          <button className="btn btn-danger" onClick={onLogout} style={{ width: "100%", fontSize: 12 }}>
            Выйти
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={s.main}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.heading}>Чаты</h1>
            <p style={s.sub}>{chats.length} {chats.length === 1 ? "чат" : chats.length < 5 ? "чата" : "чатов"}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateChat(true)} style={{ gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Новый чат
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по чатам…"
            className="input"
            style={{ paddingLeft: 36 }}
          />
          <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}
            width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>

        {/* List */}
        <div style={s.list}>
          {loading ? (
            <div style={s.empty}><span className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>
              <span style={{ fontSize: 28 }}>💬</span>
              <span style={{ color: "var(--c-ink-muted)", fontSize: 13 }}>
                {search ? "Ничего не найдено" : "Нет чатов. Создайте первый!"}
              </span>
            </div>
          ) : (
            filtered.map(chat => {
              const typing = renderTyping(chat);
              return (
                <div key={chat.id} onClick={() => onSelectChat(chat)} style={s.chatRow} className="chat-row">
                  <div className={`avatar avatar-md ${getAvClass(chat.id)}`}>{getInitials(chat)}</div>
                  <div style={s.chatInfo}>
                    <div style={s.chatName}>{chat.title || `Чат #${chat.id}`}</div>
                    <div style={{ ...s.chatPreview, color: typing ? "var(--c-brand)" : "var(--c-ink-muted)", fontStyle: typing ? "italic" : "normal" }}>
                      {typing || getLastMessagePreview(chat)}
                    </div>
                  </div>
                  <div style={s.chatRight}>
                    {chat.cnt_unread_messages > 0 && (
                      <span style={s.unread}>{chat.cnt_unread_messages > 99 ? "99+" : chat.cnt_unread_messages}</span>
                    )}
                    {chat.chat_type === "channel" && <span title="Канал"   style={s.typeIcon}>📢</span>}
                    {chat.chat_type === "group"   && <span title="Группа"  style={s.typeIcon}>👥</span>}
                    {chat.chat_type === "private" && <span title="Личный"  style={s.typeIcon}>💬</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ── Global stats modal ── */}
      {showGlobalStats && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 720, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="modal-title">📊 Статистика — все чаты</span>
                <button className="btn" style={{ fontSize: 11, padding: "4px 10px" }}
                  onClick={refreshGlobalStats} disabled={loadingGlobalStats}>
                  {loadingGlobalStats ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : "↺"}
                </button>
              </div>
              <button className="modal-close" onClick={() => setShowGlobalStats(false)}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "4px 0 8px" }}>
              <TaskStatsPanel stats={globalStats} loading={loadingGlobalStats} />
            </div>
          </div>
        </div>
      )}

      {/* ── Create chat modal ── */}
      {showCreateChat && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Новый чат</span>
              <button className="modal-close" onClick={() => setShowCreateChat(false)}>✕</button>
            </div>
            <CreateChatScreen onChatCreated={handleChatCreated} />
          </div>
        </div>
      )}

      <style>{`
        .chat-row {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 16px; cursor: pointer;
          border-bottom: 1px solid var(--c-line-soft);
          transition: background var(--t-fast);
        }
        .chat-row:last-child { border-bottom: none; }
        .chat-row:hover { background: var(--c-brand-bg); }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:        { minHeight: "100vh", display: "flex", background: "var(--c-surface)" },
  sidebar:     { width: 210, background: "var(--c-brand)", display: "flex", flexDirection: "column",
                 padding: "16px 12px", gap: 6, position: "sticky", top: 0, height: "100vh", flexShrink: 0 },
  sidebarTop:  { padding: "4px 4px 16px", borderBottom: "1px solid rgba(255,255,255,0.12)", marginBottom: 8 },
  nav:         { display: "flex", flexDirection: "column", gap: 3, flex: 1 },
  navActive:   { justifyContent: "flex-start", gap: 8, fontSize: 13,
                 background: "rgba(255,255,255,0.15)", color: "#fff",
                 border: "1px solid rgba(255,255,255,0.18)", width: "100%" },
  navItem:     { justifyContent: "flex-start", gap: 8, fontSize: 13,
                 background: "transparent", color: "rgba(255,255,255,0.65)",
                 border: "1px solid transparent", width: "100%" },
  badge:       { marginLeft: "auto", background: "var(--c-green)", color: "#fff",
                 borderRadius: "var(--r-full)", fontSize: 9, fontWeight: 700,
                 padding: "1px 6px", fontFamily: "var(--font-mono)" },
  sidebarBottom: { paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.12)" },

  main:        { flex: 1, display: "flex", flexDirection: "column", maxWidth: 680,
                 width: "100%", margin: "0 auto", padding: "24px 20px", gap: 16 },
  header:      { display: "flex", alignItems: "center", justifyContent: "space-between" },
  heading:     { fontSize: 20, fontWeight: 800, color: "var(--c-ink)" },
  sub:         { fontSize: 12, color: "var(--c-ink-muted)", marginTop: 2 },

  list:        { background: "var(--c-paper)", border: "1px solid var(--c-line)",
                 borderRadius: "var(--r-lg)", overflow: "hidden", minHeight: 80 },
  empty:       { display: "flex", flexDirection: "column", alignItems: "center",
                 justifyContent: "center", gap: 12, padding: "48px 0" },

  chatRow:     {},
  chatInfo:    { flex: 1, minWidth: 0 },
  chatName:    { fontSize: 14, fontWeight: 600, color: "var(--c-ink)",
                 whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatPreview: { fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatRight:   { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 },
  unread:      { background: "var(--c-brand)", color: "#fff", borderRadius: "var(--r-full)",
                 fontSize: 10, fontWeight: 700, padding: "1px 7px",
                 fontFamily: "var(--font-mono)", minWidth: 20, textAlign: "center" as const },
  typeIcon:    { fontSize: 13, opacity: 0.6 },
};