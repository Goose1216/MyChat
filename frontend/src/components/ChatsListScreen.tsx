import React, { useEffect, useState } from "react";
import CreateChatScreen from "./CreateChatScreen";
import TaskStatsPanel from "./TaskStatsPanel";
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
  const [chats, setChats] = useState<any[]>([]);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addHandler, removeHandler } = useWebSocket();

  const [usersMap, setUsersMap] = useState<Record<number, any>>({});
const [typingChats, setTypingChats] = useState<
  Record<number, Record<number, number>>
>({});

const handleTypingEvent = (wsMsg: any) => {
  if (wsMsg.sender) {

  setUsersMap(prev => ({

    ...prev,

    [wsMsg.sender.id]: wsMsg.sender,

  }));

}
  if (wsMsg.type_of_message !== 3) return;
  if (wsMsg.sender_id === userId) return;
  setTypingChats(prev => {
    const chatTyping = prev[wsMsg.chat_id] || {};
    return {
      ...prev,
      [wsMsg.chat_id]: {
        ...chatTyping,
        [wsMsg.sender_id]: Date.now(),
      },
    };
  });
};

  // ── Global stats ───────────────────────────────────────────────────────────
  const [showGlobalStats, setShowGlobalStats] = useState(false);
  const [globalStats, setGlobalStats] = useState<any[]>([]);
  const [loadingGlobalStats, setLoadingGlobalStats] = useState(false);

  const loadGlobalStats = async () => {
    if (globalStats.length) return; // already loaded — refresh manually if needed
    setLoadingGlobalStats(true);
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/tasks/stats/`);
      if (res.ok) {
        const data = await res.json();
        setGlobalStats(data.data ?? []);
      }
    } catch { /* silent */ }
    finally { setLoadingGlobalStats(false); }
  };

  const openGlobalStats = () => {
    setShowGlobalStats(true);
    loadGlobalStats();
  };

  const renderTyping = (chat: any) => {
  const users = typingChats[chat.id];
  if (!users) return null;

  const ids = Object.keys(users).map(Number);

  if (ids.length === 0) return null;

  const names = ids
    .map(id => usersMap[id]?.username || "Кто-то")
    .slice(0, 2);

  if (ids.length === 1) {
    return `${names[0]} печатает...`;
  }

  if (ids.length === 2) {
    return `${names[0]} и ${names[1]} печатают...`;
  }

  return `${names[0]}, ${names[1]} и ещё печатают...`;
};

  const refreshGlobalStats = async () => {
    setGlobalStats([]);
    setLoadingGlobalStats(true);
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/tasks/stats/`);
      if (res.ok) {
        const data = await res.json();
        setGlobalStats(data.data ?? []);
      }
    } catch { /* silent */ }
    finally { setLoadingGlobalStats(false); }
  };

  // ── Chats ──────────────────────────────────────────────────────────────────
  const fetchChats = async () => {
    if (!access_token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/chats`, { method: "GET" });
      if (res.ok) {
        const responseData = await res.json();
        setChats(responseData.data ?? []);
      } else if (res.status === 401) {
        alert("Сессия истекла. Авторизуйтесь снова.");
        onLogout();
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchChats(); }, []);

  useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();

    setTypingChats(prev => {
      const next: typeof prev = {};

      for (const [chatId, users] of Object.entries(prev)) {
        const validUsers: Record<number, number> = {};

        for (const [userId, ts] of Object.entries(users)) {
          if (now - ts < 1500) {
            validUsers[Number(userId)] = ts;
          }
        }

        if (Object.keys(validUsers).length > 0) {
          next[Number(chatId)] = validUsers;
        }
      }

      return next;
    });
  }, 300);

  return () => clearInterval(interval);
}, []);

  useEffect(() => {
  addHandler(handleTypingEvent);

  return () => {
    removeHandler(handleTypingEvent);
  };
}, []);

  const getLastMessagePreview = (chat: any) => {
    const msg = chat.last_message;
    if (!msg) return "Нет сообщений";
    const senderName = msg.sender && msg.sender.id !== userId ? `${msg.sender.username}: ` : "Вы: ";
    if (msg.content) {
      return senderName + (msg.content.length > 28 ? msg.content.slice(0, 28) + "…" : msg.content);
    }
    if (msg.file) return senderName + `📎 ${msg.file.filename.slice(0, 20)}`;
    return "Нет сообщений";
  };

  const updateChatLastMessage = (wsMsg: any) => {
      if (wsMsg.sender) {
        setUsersMap(prev => ({
          ...prev,
          [wsMsg.sender.id]: wsMsg.sender,
        }));
     }
    if (wsMsg.type_of_message !== 0) return;
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === wsMsg.chat_id);
      if (idx === -1) return prev;
      const chat = prev[idx];
      const isForeign = wsMsg.sender_id !== userId;
      const updatedChat = {
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
      return [updatedChat, ...next];
    });
  };

  useEffect(() => {
    addHandler(updateChatLastMessage);
    return () => removeHandler(updateChatLastMessage);
  }, []);

  const handleChatCreated = () => { setShowCreateChat(false); fetchChats(); };

  const getAvClass = (id: number) => AVATAR_CLASSES[id % AVATAR_CLASSES.length];
  const getInitials = (chat: any) => (chat.title || `#${chat.id}`).slice(0, 2).toUpperCase();

  // ── total unread badge for sidebar ─────────────────────────────────────────
  const totalUnread = chats.reduce((n, c) => n + (c.cnt_unread_messages ?? 0), 0);

  return (
    <div style={st.page}>
      {/* ── SIDEBAR ── */}
      <aside style={st.sidebar}>
        <div style={st.sidebarHeader}>
          <span style={st.brandMark}>✦</span>
          <span style={st.brandName}>messenger</span>
        </div>

        <nav style={st.nav}>
          <button className="btn" style={st.navItemActive}>
            <span>💬</span>
            <span>Чаты</span>
            {totalUnread > 0 && (
              <span style={st.sidebarBadge}>{totalUnread > 99 ? "99+" : totalUnread}</span>
            )}
          </button>
          <button className="btn" onClick={onOpenProfile} style={st.navItem}>
            <span>👤</span> Профиль
          </button>
        </nav>

        <div style={st.sidebarFooter}>
          <button className="btn btn-danger" onClick={onLogout} style={{ width: "100%", fontSize: 12 }}>
            Выйти
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={st.main}>
        <div style={st.mainHeader}>
          <div>
            <h1 style={st.heading}>Ваши чаты</h1>
            <p style={st.subheading}>
              {chats.length} {chats.length === 1 ? "чат" : chats.length >= 2 && chats.length <= 4 ? "чата" : "чатов"}
            </p>
          </div>

          {/* ── RIGHT ACTIONS ── */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Global stats button */}
            <button
              className="btn"
              onClick={openGlobalStats}
              style={{ fontSize: 12, gap: 6 }}
              title="Статистика по всем задачам"
            >
              📊 Статистика
            </button>

            <button className="btn btn-primary" onClick={() => setShowCreateChat(true)} style={{ gap: 6 }}>
              <span style={{ fontSize: 16 }}>+</span> Новый чат
            </button>
          </div>
        </div>

        {/* Chats list */}
        <div style={st.chatsList}>
          {loading ? (
            <div style={st.empty}><span className="spinner" /></div>
          ) : chats.length === 0 ? (
            <div style={st.empty}>
              <span style={{ fontSize: 32 }}>💬</span>
              <span style={{ color: "var(--c-ink-muted)", fontSize: 14 }}>Нет чатов. Создайте первый!</span>
            </div>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} onClick={() => onSelectChat(chat)} style={st.chatItem} className="chat-item-row">
                <div className={`avatar avatar-md ${getAvClass(chat.id)}`}>{getInitials(chat)}</div>
                <div style={st.chatInfo}>
                  <div style={st.chatName}>{chat.title || `Чат #${chat.id}`}</div>
                 <div style={st.chatPreview}>
                    {renderTyping(chat) || getLastMessagePreview(chat)}
                  </div>
                </div>
                <div style={st.chatRight}>
                  {chat.cnt_unread_messages > 0 && (
                    <span style={st.badge}>
                      {chat.cnt_unread_messages > 99 ? "99+" : chat.cnt_unread_messages}
                    </span>
                  )}
                  {chat.chat_type && (
                    <span className="pill" style={{ fontSize: 9, background: "var(--c-surface)", color: "var(--c-ink-muted)", border: "1px solid var(--c-line)" }}>
                      {chat.chat_type.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ══ GLOBAL STATS MODAL ═══════════════════════════════════════════════ */}
      {showGlobalStats && (
        <div className="modal-backdrop">
          <div className="modal" style={{
            maxWidth: 720, maxHeight: "92vh",
            overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="modal-title">📊 Статистика задач — все чаты</span>
                <button
                  className="btn"
                  style={{ fontSize: 11, padding: "4px 10px" }}
                  onClick={refreshGlobalStats}
                  disabled={loadingGlobalStats}
                  title="Обновить"
                >
                  {loadingGlobalStats ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : "↺ Обновить"}
                </button>
              </div>
              <button className="modal-close" onClick={() => setShowGlobalStats(false)}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "4px 0 8px" }}>
              <TaskStatsPanel
                stats={globalStats}
                loading={loadingGlobalStats}
                // no getName — user_id labels only (no member list in this context)
              />
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE CHAT MODAL ── */}
      {showCreateChat && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Создать новый чат</span>
              <button className="modal-close" onClick={() => setShowCreateChat(false)}>✕</button>
            </div>
            <CreateChatScreen onChatCreated={handleChatCreated} />
          </div>
        </div>
      )}

      <style>{`
        .chat-item-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; cursor: pointer; border-radius: var(--r-lg);
          transition: background var(--t-fast);
        }
        .chat-item-row:hover { background: var(--c-accent-bg); }
      `}</style>
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  page:          { minHeight: "100vh", display: "flex", background: "var(--c-surface)" },
  sidebar:       { width: 220, background: "var(--c-ink)", display: "flex", flexDirection: "column", padding: "20px 16px", gap: 8, position: "sticky", top: 0, height: "100vh" },
  sidebarHeader: { display: "flex", alignItems: "center", gap: 8, color: "#fff", padding: "4px 0 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  brandMark:     { fontSize: 18, color: "#93c5fd" },
  brandName:     { fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" },
  nav:           { display: "flex", flexDirection: "column", gap: 4, flex: 1, paddingTop: 12 },
  navItemActive: { justifyContent: "flex-start", gap: 8, fontSize: 13, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", width: "100%" },
  navItem:       { justifyContent: "flex-start", gap: 8, fontSize: 13, background: "transparent", color: "rgba(255,255,255,0.6)", border: "1px solid transparent", width: "100%" },
  sidebarBadge:  { marginLeft: "auto", background: "var(--c-accent)", color: "#fff", borderRadius: "var(--r-full)", fontSize: 9, fontWeight: 700, padding: "1px 6px", fontFamily: "var(--font-mono)" },
  sidebarFooter: { paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)" },
  main:          { flex: 1, display: "flex", flexDirection: "column", maxWidth: 680, width: "100%", margin: "0 auto", padding: "28px 24px", gap: 20 },
  mainHeader:    { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  heading:       { fontSize: 22, fontWeight: 600, color: "var(--c-ink)" },
  subheading:    { fontSize: 12, color: "var(--c-ink-muted)", marginTop: 2 },
  chatsList:     { background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: "var(--r-xl)", overflow: "hidden", minHeight: 80 },
  empty:         { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 0" },
  chatInfo:      { flex: 1, minWidth: 0 },
  chatName:      { fontSize: 14, fontWeight: 500, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatPreview:   { fontSize: 12, color: "var(--c-ink-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatRight:     { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 },
  badge:         { background: "var(--c-accent)", color: "#fff", borderRadius: "var(--r-full)", fontSize: 10, fontWeight: 600, padding: "1px 7px", fontFamily: "var(--font-mono)", minWidth: 20, textAlign: "center" },
  chatItem:      {},
};