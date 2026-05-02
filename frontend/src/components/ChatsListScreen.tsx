import React, { useEffect, useState } from "react";
import CreateChatScreen from "./CreateChatScreen";
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

  const handleReadEvent = (wsMsg: any) => {

  if (wsMsg.type_of_message !== 4) return;

  setChats(prev =>

    prev.map(c =>

      c.id === wsMsg.chat_id

        ? {

            ...c,

            cnt_unread_messages: 0,

          }

        : c

    )

  );

};

  useEffect(() => {

  addHandler(updateChatLastMessage);

  addHandler(handleReadEvent);

  return () => {

    removeHandler(updateChatLastMessage);

    removeHandler(handleReadEvent);

  };

}, []);

const handleSelectChat = async (chat: any) => {
  try {
    await fetchWithAuth(
      `${import.meta.env.VITE_API_URL}/chats/${chat.id}/read`,
      { method: "POST" }
    );

    await fetchChats();
  } catch (e) {
    console.error(e);
  }

  onSelectChat(chat);
};

  useEffect(() => { fetchChats(); }, []);

  const getLastMessagePreview = (chat: any) => {
    const msg = chat.last_message;
    if (!msg) return "Нет сообщений";
    const senderName = msg.sender && msg.sender.id !== userId ? `${msg.sender.username}: ` : "Вы: ";
    if (msg.content) {
      const text = msg.content.length > 28 ? msg.content.slice(0, 28) + "…" : msg.content;
      return senderName + text;
    }
    if (msg.file) return senderName + `📎 ${msg.file.filename.slice(0, 20)}`;
    return "Нет сообщений";
  };

const updateChatLastMessage = (wsMsg: any) => {
  if (wsMsg.type_of_message !== 0) return;

  setChats(prev => {
    const idx = prev.findIndex(c => c.id === wsMsg.chat_id);
    if (idx === -1) return prev;

    const chat = prev[idx];

    const isForeign = wsMsg.sender_id !== userId;

    const updatedChat = {
      ...chat,
      last_message: {
        chat_id: wsMsg.chat_id,
        sender_id: wsMsg.sender_id,
        content: wsMsg.text ?? null,
        file: wsMsg.file ?? null,
        created_at: wsMsg.created_at,
        updated_at: wsMsg.created_at,
        sender: wsMsg.sender,
        is_deleted: false,
      },
      cnt_unread_messages: isForeign
        ? Math.min((chat.cnt_unread_messages ?? 0) + 1, 99)
        : chat.cnt_unread_messages,
    };

    const newList = [...prev];
    newList.splice(idx, 1);

    return [updatedChat, ...newList];
  });
};


  useEffect(() => {
  addHandler(updateChatLastMessage);

  return () => {
    removeHandler(updateChatLastMessage);
  };
}, []);


  const handleChatCreated = () => { setShowCreateChat(false); fetchChats(); };

  const getAvClass = (id: number) => AVATAR_CLASSES[id % AVATAR_CLASSES.length];
  const getInitials = (chat: any) => {
    const t = chat.title || `#${chat.id}`;
    return t.slice(0, 2).toUpperCase();
  };

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.brandMark}>✦</span>
          <span style={styles.brandName}>messenger</span>
        </div>

        <nav style={styles.nav}>
          <button className="btn" style={styles.navItemActive}>
            <span>💬</span> Чаты
          </button>
          <button className="btn" onClick={onOpenProfile} style={styles.navItem}>
            <span>👤</span> Профиль
          </button>
        </nav>

        <div style={styles.sidebarFooter}>
          <button className="btn btn-danger" onClick={onLogout} style={{ width: "100%", fontSize: 12 }}>
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.mainHeader}>
          <div>
            <h1 style={styles.heading}>Ваши чаты</h1>
            <p style={styles.subheading}>{chats.length} {chats.length === 1 ? "чат" : chats.length >= 2 && chats.length <= 4 ? "чата" : "чатов"}</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateChat(true)}
            style={{ gap: 6 }}
          >
            <span style={{ fontSize: 16 }}>+</span> Новый чат
          </button>
        </div>

        <div style={styles.chatsList}>
          {loading ? (
            <div style={styles.empty}>
              <span className="spinner" />
            </div>
          ) : chats.length === 0 ? (
            <div style={styles.empty}>
              <span style={{ fontSize: 32 }}>💬</span>
              <span style={{ color: "var(--c-ink-muted)", fontSize: 14 }}>Нет чатов. Создайте первый!</span>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                style={styles.chatItem}
                className="chat-item-row"
              >
                <div className={`avatar avatar-md ${getAvClass(chat.id)}`}>
                  {getInitials(chat)}
                </div>
                <div style={styles.chatInfo}>
                  <div style={styles.chatName}>{chat.title || `Чат #${chat.id}`}</div>
                  <div style={styles.chatPreview}>{getLastMessagePreview(chat)}</div>
                </div>
                <div style={styles.chatRight}>
                  {chat.cnt_unread_messages > 0 && (
                    <span style={styles.badge}>
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

      {/* Create chat modal */}
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

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", background: "var(--c-surface)" },
  sidebar: {
    width: 220, background: "var(--c-ink)", display: "flex",
    flexDirection: "column", padding: "20px 16px", gap: 8,
    position: "sticky", top: 0, height: "100vh",
  },
  sidebarHeader: { display: "flex", alignItems: "center", gap: 8, color: "#fff", padding: "4px 0 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  brandMark: { fontSize: 18, color: "#93c5fd" },
  brandName: { fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" },
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1, paddingTop: 12 },
  navItemActive: { justifyContent: "flex-start", gap: 8, fontSize: 13, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", width: "100%" },
  navItem: { justifyContent: "flex-start", gap: 8, fontSize: 13, background: "transparent", color: "rgba(255,255,255,0.6)", border: "1px solid transparent", width: "100%" },
  sidebarFooter: { paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)" },
  main: { flex: 1, display: "flex", flexDirection: "column", maxWidth: 680, width: "100%", margin: "0 auto", padding: "28px 24px", gap: 20 },
  mainHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  heading: { fontSize: 22, fontWeight: 600, color: "var(--c-ink)" },
  subheading: { fontSize: 12, color: "var(--c-ink-muted)", marginTop: 2 },
  chatsList: { background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: "var(--r-xl)", overflow: "hidden", minHeight: 80 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 0" },
  chatInfo: { flex: 1, minWidth: 0 },
  chatName: { fontSize: 14, fontWeight: 500, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatPreview: { fontSize: 12, color: "var(--c-ink-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 },
  badge: { background: "var(--c-accent)", color: "#fff", borderRadius: "var(--r-full)", fontSize: 10, fontWeight: 600, padding: "1px 7px", fontFamily: "var(--font-mono)", minWidth: 20, textAlign: "center" },
};