import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../Websocket";
import { fetchWithAuth, apiBase } from "../api";
import type { Message } from "../types";
import "../design.css";

const AVATAR_CLASSES = ["av-blue", "av-teal", "av-amber", "av-purple", "av-rose", "av-green"];
const avatarColor = (id: number) => AVATAR_CLASSES[id % AVATAR_CLASSES.length];
const safeName = (u: any) => u?.username || u?.email || "User";
const formatDateTime = (iso: string) => new Date(iso).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });

const STATUS_OPTIONS = ["NEW", "IN_PROGRESS", "DONE", "CANCELLED"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = { NEW: "pill-new", IN_PROGRESS: "pill-prog", DONE: "pill-done", CANCELLED: "pill-cancel" };
  return <span className={`pill ${map[status] || "pill-cancel"}`}>{status}</span>;
}
function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, string> = { LOW: "pill-low", MEDIUM: "pill-med", HIGH: "pill-high" };
  return <span className={`pill ${map[priority] || "pill-low"}`}>{priority}</span>;
}

export default function ChatScreen({ userId, chat, onBack }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  type TypingMap = Record<number, number>;
  const [typingUsers, setTypingUsers] = useState<TypingMap>({});
  const typingIds = Object.keys(typingUsers).map(Number);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const initialScrollDoneRef = useRef(false);
  const scrollOnSendRef = useRef(false);

  const [editingTaskStatus, setEditingTaskStatus] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [stats, setStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const messagesRef = useRef<HTMLDivElement | null>(null);

  const lastTypingRef = useRef<number>(0);
  const lastSentReadRef = useRef<number>(0);
  const lastReadMessageIdRef = useRef<number>(0);
  const [someoneReadUpTo, setSomeoneReadUpTo] = useState<number>(0);

  const [profileUser, setProfileUser] = useState<any | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [addUserError, setAddUserError] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskMessageId, setTaskMessageId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignees, setTaskAssignees] = useState<number[]>([]);

  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskDescription, setEditingTaskDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = apiBase();

  useEffect(() => { setStats([]); setShowStats(false); }, [chat.id]);

  // Load messages & members
  useEffect(() => {
    (async () => {
      const res = await fetchWithAuth(`${API}/chats/${chat.id}/messages`);
      const data = await res.json();
      setMessages((data.data || []).map((m: any) => ({
        id: m.id, chat_id: m.chat_id, sender_id: m.sender_id,
        text: m.content, file: m.file ?? null,
        timestamp: m.updated_at || m.created_at, is_deleted: m.is_deleted,
        sender: m.sender, is_self: m.sender_id === userId,
        is_system: m.sender_id === null, edited: m.updated_at !== m.created_at,
      })));
      const mRes = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
      const mData = await mRes.json();
      setMembers(mData.data || []);
    })();
  }, [chat.id]);


  // WebSocket handler
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.chat_id !== chat.id) return;
      if (msg.type_of_message === 0) {
        setMessages((p) => [...p, {
          id: msg.message_id, chat_id: msg.chat_id, sender_id: msg.sender_id,
          text: msg.text ?? null, file: msg.file ?? null, timestamp: msg.created_at,
          is_deleted: msg.is_deleted, sender: msg.sender,
          is_self: msg.sender_id === userId, is_system: msg.sender === null, edited: false,
        }]);
      }
      if (msg.type_of_message === 1) {
        setMessages((p) => p.map((m) => m.id === msg.message_id
          ? { ...m, text: msg.text, timestamp: msg.updated_at, edited: true, is_system: false, is_deleted: msg.is_deleted }
          : m));
      }
      if (msg.type_of_message === 2) {
        setMessages((p) => p.map((m) => m.id === msg.message_id
          ? { ...m, text: msg.text, timestamp: msg.updated_at, edited: true, is_system: false, is_deleted: true }
          : m));
      }
      if (msg.type_of_message === 3) {
        if (msg.sender_id === userId) return;
        setTypingUsers((prev) => ({ ...prev, [msg.sender_id]: Date.now() }));
      }
      if (msg.type_of_message === 4) {
        setSomeoneReadUpTo((prev) => Math.max(prev, msg.last_read_message_id));
      }
    };
    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, userId]);

  // Typing TTL
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next: TypingMap = {};
        for (const [uid, ts] of Object.entries(prev)) {
          if (now - ts < 700) next[Number(uid)] = ts;
        }
        return next;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetchWithAuth(`${API}/tasks/stats/?chat_id=${chat.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert("Ошибка загрузки статистики"); return; }
      setStats(data.data || []);
    } catch { alert("Ошибка сети"); }
    finally { setLoadingStats(false); }
  };

  const send = (e: any) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    scrollOnSendRef.current = true;
    sendMessage({ chat_id: chat.id, text: newMessage });
    setNewMessage("");
  };

  useEffect(() => {
    if (!scrollOnSendRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    scrollOnSendRef.current = false;
  }, [messages]);

  const startEdit = (m: any) => {
    if (!m.is_self || m.file) return;
    setEditingId(m.id); setEditingText(m.text);
  };

  const saveEdit = async () => {
    if (!editingText.trim() || editingId === null) return;
    await fetchWithAuth(`${API}/messages/${editingId}/`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editingText }),
    });
    setEditingId(null);
  };

  const leaveChat = async () => {
    await fetchWithAuth(`${API}/chats/${chat.id}/me/delete/`, { method: "DELETE" });
    onBack();
  };

  const openAddUserModal = async () => {
    setAddUserOpen(true); setAddUserError(""); setSelectedUserId(""); setLoadingUsers(true);
    try {
      const res = await fetchWithAuth(`${API}/users/get_all_users/`, { method: "POST" });
      const data = await res.json();
      setAllUsers(Array.isArray(data.data) ? data.data : []);
    } catch { setAddUserError("Не удалось загрузить список пользователей"); }
    finally { setLoadingUsers(false); }
  };

  const addSelectedUser = async () => {
    if (!selectedUserId) { setAddUserError("Выберите пользователя"); return; }
    setAddUserError("");
    try {
      const res = await fetchWithAuth(`${API}/chats/add_user/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(selectedUserId), chat_id: chat.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddUserError(data?.description || data?.errors?.[0]?.message || "Ошибка добавления");
        return;
      }
      const u = allUsers.find((x) => x.id === Number(selectedUserId));
      if (u) setMembers((p) => [...p, u]);
      setAddUserOpen(false);
    } catch { setAddUserError("Ошибка соединения с сервером"); }
  };

  const deleteMessage = async (id: number) => {
    if (!window.confirm("Удалить сообщение?")) return;
    await fetchWithAuth(`${API}/messages/${id}/`, { method: "DELETE" });
  };

  useEffect(() => {

  lastReadMessageIdRef.current = chat.last_read_message_id || 0;

}, [chat.id]);

  const sendFile = async () => {
    if (!selectedFile) return;
    const form = new FormData();
    form.append("file", selectedFile);
    try {
      await fetchWithAuth(`${API}/messages/${chat.id}/file/`, { method: "POST", body: form });
      setSelectedFile(null);
    } catch { alert("Не удалось отправить файл"); }
  };

  const sendTyping = () => {
    const now = Date.now();
    if (now - lastTypingRef.current < 500) return;
    lastTypingRef.current = now;
    fetchWithAuth(`${API}/chats/${chat.id}/${userId}/typing/`, { method: "POST" }).catch(() => {});
  };

  useEffect(() => {
  const el = messagesRef.current;
  if (!el) return;

  const sendRead = (id: number) => {
    if (Date.now() - lastSentReadRef.current < 300) return;
    lastSentReadRef.current = Date.now();

    if (id <= lastReadMessageIdRef.current) return;

    lastReadMessageIdRef.current = id;

    fetchWithAuth(`${API}/messages/read/${id}/`, {
      method: "POST",
    }).catch(() => {});
  };

  const onScroll = () => {
    const containerRect = el.getBoundingClientRect();
    let maxVisibleId = lastReadMessageIdRef.current;

    for (const m of messages) {
      if (m.sender_id === userId) continue;

      const node = messageRefs.current[m.id];
      if (!node) continue;

      const rect = node.getBoundingClientRect();

      const isVisible =
        rect.bottom > containerRect.top &&
        rect.top < containerRect.bottom;

      if (isVisible && m.id > maxVisibleId) {
        maxVisibleId = m.id;
      }
    }

    if (maxVisibleId > lastReadMessageIdRef.current) {
      sendRead(maxVisibleId);
    }
  };

  el.addEventListener("scroll", onScroll);
  onScroll();

  return () => el.removeEventListener("scroll", onScroll);
}, [messages, userId]);

  useEffect(() => {
    if (initialScrollDoneRef.current || !messages.length) return;
    if (chat.last_read_message_id) {
      const el = messageRefs.current[chat.last_read_message_id];
      el ? el.scrollIntoView({ block: "center" }) : bottomRef.current?.scrollIntoView();
    } else {
      bottomRef.current?.scrollIntoView();
    }
    initialScrollDoneRef.current = true;
  }, [messages, chat.id]);


  useEffect(() => { setTypingUsers({}); }, [chat.id]);

  const isCreator = (task: any) => task.creator?.id === userId;
  const isAssignee = (task: any) => task.assignments?.some((a: any) => a.user_id === userId);

  const updateTask = async () => {
    if (!editingTaskId) return;
    try {
      const res = await fetchWithAuth(`${API}/tasks/${editingTaskId}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTaskTitle, description: editingTaskDescription, status: editingTaskStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.description || "Ошибка обновления"); return; }
      setTasks((prev) => prev.map((t) => t.id === editingTaskId
        ? { ...t, title: editingTaskTitle, description: editingTaskDescription, status: editingTaskStatus }
        : t));
      setEditingTaskId(null);
    } catch { alert("Ошибка сети"); }
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetchWithAuth(`${API}/tasks/?chat_id=${chat.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert("Ошибка загрузки задач"); return; }
      setTasks(data.data || []);
    } catch { alert("Ошибка сети"); }
    finally { setLoadingTasks(false); }
  };

  const createTask = async () => {
    if (!taskTitle.trim()) { alert("Введите название задачи"); return; }
    if (!taskMessageId) { alert("Ошибка: нет message_id"); return; }
    if (creatingTask) return;
    setCreatingTask(true);
    try {
      const res = await fetchWithAuth(`${API}/tasks/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, description: taskDescription, chat_id: chat.id, message_id: taskMessageId, assignee_ids: taskAssignees }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.description || data?.errors?.[0]?.message || "Ошибка создания задачи"); return; }
      setTaskModalOpen(false); setTaskTitle(""); setTaskDescription(""); setTaskAssignees([]); setTaskMessageId(null);
      alert("Задача создана");
    } catch { alert("Ошибка сети"); }
    finally { setCreatingTask(false); }
  };

  // ===== RENDER =====
  const renderMessageContent = (m: Message) => {
    if (m.is_deleted) return <span style={s.deletedText}>Сообщение удалено</span>;
    if (m.file) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>📎 {m.file.filename}</span>
        <a href={m.file.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: m.is_self ? "rgba(255,255,255,0.8)" : "var(--c-accent)", textDecoration: "underline" }}>Скачать</a>
      </div>
    );
    if (editingId === m.id) return (
      <input
        style={s.inlineEdit}
        value={editingText}
        autoFocus
        onChange={(e) => setEditingText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
          if (e.key === "Escape") { setEditingId(null); setEditingText(""); }
        }}
        onBlur={() => { setEditingId(null); setEditingText(""); }}
      />
    );
    return <div onDoubleClick={() => startEdit(m)} style={{ lineHeight: 1.5 }}>{m.text}</div>;
  };

  return (
    <div style={s.page}>
      {/* ======= HEADER ======= */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button className="btn btn-ghost" onClick={onBack} style={{ fontSize: 13, padding: "6px 10px" }}>← Назад</button>
          <div style={s.chatTitle}>Чат #{chat.id}</div>
        </div>

        <div style={s.memberPills}>
          {members.map((u) => (
            <button key={u.id} onClick={() => setProfileUser(u)} style={s.memberPill} className={`avatar avatar-sm ${avatarColor(u.id)}`} title={safeName(u)}>
              {safeName(u)[0].toUpperCase()}
            </button>
          ))}
        </div>

        <div style={s.headerRight}>
          <button className="btn" style={{ fontSize: 12, gap: 4 }} onClick={() => { setTasksModalOpen(true); loadTasks(); }}>
            📋 Задачи
          </button>
          {chat.chat_type !== "private" && (
            <button className="btn btn-success" style={{ fontSize: 12 }} onClick={openAddUserModal}>+ Добавить</button>
          )}
          <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={leaveChat}>Выйти</button>
          <span style={{ ...s.onlineDot, color: connected ? "var(--c-success)" : "var(--c-ink-ghost)" }}>
            {connected ? "● онлайн" : "○ офлайн"}
          </span>
        </div>
      </header>

      {/* ======= MESSAGES ======= */}
     <main ref={messagesRef} style={s.messagesArea}>
        {messages.map((m) => {
          const isReadBySomeone = m.id <= someoneReadUpTo;
          if (m.is_system) return (
            <div key={m.id} style={s.systemMsg}>{m.text}</div>
          );
          return (
            <div key={m.id} ref={(el) => (messageRefs.current[m.id] = el)}
              style={{ ...s.msgRow, justifyContent: m.is_self ? "flex-end" : "flex-start" }}>
              {!m.is_self && (
                <div className={`avatar avatar-sm ${avatarColor(m.sender_id)}`} style={{ flexShrink: 0 }}>
                  {safeName(m.sender)[0]}
                </div>
              )}
              <div style={{ position: "relative" }} className="msg-wrap">
                <div style={{
                  ...s.bubble,
                  ...(m.is_deleted ? s.bubbleDeleted : m.is_self ? s.bubbleSelf : s.bubbleOther)
                }}>
                  {renderMessageContent(m)}
                  <div style={{ ...s.msgMeta, color: m.is_self ? "rgba(255,255,255,0.65)" : "var(--c-ink-ghost)" }}>
                    <span>{formatDateTime(m.timestamp)}</span>
                    {!m.is_deleted && m.edited && <span>· изм.</span>}
                    {m.is_self && <span style={{ marginLeft: 2 }}>{isReadBySomeone ? "✔✔" : "✔"}</span>}
                  </div>
                </div>

                {!m.is_deleted && (
                  <div className="msg-actions">
                    {m.is_self && (
                      <button className="msg-action-btn msg-action-delete" onClick={() => deleteMessage(m.id)} title="Удалить">🗑</button>
                    )}
                    <button className="msg-action-btn msg-action-task" onClick={() => { setTaskModalOpen(true); setTaskMessageId(m.id); setTaskTitle(m.text || ""); setTaskDescription(""); setTaskAssignees([]); }} title="Создать задачу">📌</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* ======= FOOTER ======= */}
      <footer style={s.footer}>
        <div style={s.typingRow}>
          {typingIds.length > 0 && (
            <span style={s.typingIndicator}>
              {typingIds.map((id) => { const u = members.find((x) => x.id === id); return u ? safeName(u) : "Кто-то"; }).join(", ")} печатает…
            </span>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); selectedFile ? sendFile() : send(e); }} style={s.inputRow}>
          <input type="file" id="file-input" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
          <label htmlFor="file-input" style={s.attachBtn} title="Прикрепить файл">📎</label>
          <input
            value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); sendTyping(); }}
            placeholder={selectedFile ? `Файл: ${selectedFile.name}` : "Введите сообщение..."}
            disabled={!!selectedFile}
            className="input"
            style={{ flex: 1, borderRadius: "var(--r-full)", height: 40 }}
          />
          {selectedFile && (
            <button type="button" className="btn btn-danger" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => setSelectedFile(null)}>✕</button>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: 40, height: 40, borderRadius: "var(--r-full)", padding: 0, fontSize: 16 }}>➤</button>
        </form>
      </footer>

      {/* ======= TASKS MODAL ======= */}
      {tasksModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="modal-header">
              <div style={{ display: "flex", gap: 8 }}>
                <button className={`btn ${!showStats ? "btn-primary" : ""}`} style={{ fontSize: 12 }} onClick={() => setShowStats(false)}>Задачи</button>
                <button className={`btn ${showStats ? "btn-primary" : ""}`} style={{ fontSize: 12 }} onClick={() => { setShowStats(true); if (!stats.length) loadStats(); }}>📊 Статистика</button>
              </div>
              <button className="modal-close" onClick={() => setTasksModalOpen(false)}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {loadingTasks && <div style={{ textAlign: "center", padding: 20 }}><span className="spinner" /></div>}

              {showStats ? (
                <>
                  {loadingStats && <div style={{ textAlign: "center", padding: 20 }}><span className="spinner" /></div>}
                  {!loadingStats && stats.map((s) => {
                    const user = members.find((u) => u.id === s.user_id);
                    return (
                      <div key={s.user_id} style={{ border: "1px solid var(--c-line)", borderRadius: "var(--r-md)", padding: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{user ? safeName(user) : `#${s.user_id}`}</div>
                        <div style={{ fontSize: 12, color: "var(--c-ink-muted)" }}>Всего задач: {s.total_tasks}</div>
                        <div style={{ fontSize: 11, marginTop: 8 }}>
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>Статусы:</div>
                          {s.by_status.map((st: any) => <div key={st.status}>{st.status}: {st.count}</div>)}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 8 }}>
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>Приоритеты:</div>
                          {s.by_priority.map((pr: any) => <div key={pr.priority}>{pr.priority}: {pr.count}</div>)}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  {!loadingTasks && tasks.length === 0 && <p style={{ color: "var(--c-ink-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>Нет задач</p>}
                  {!loadingTasks && tasks.map((t) => {
                    const assignees = t.assignments?.map((a: any) => safeName(a.user)) || [];
                    const isMeAssigned = t.assignments?.some((a: any) => a.user_id === userId);
                    return (
                      <div key={t.id} style={{ border: `1px solid ${isMeAssigned ? "var(--c-success)" : "var(--c-line)"}`, borderRadius: "var(--r-md)", padding: 12, background: isMeAssigned ? "var(--c-success-bg)" : "var(--c-paper)" }}>
                        {editingTaskId === t.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <input value={editingTaskTitle} onChange={(e) => setEditingTaskTitle(e.target.value)} className="input" />
                            <textarea value={editingTaskDescription} onChange={(e) => setEditingTaskDescription(e.target.value)} className="input" rows={2} />
                            {(isCreator(t) || isAssignee(t)) && (
                              <select value={editingTaskStatus} onChange={(e) => setEditingTaskStatus(e.target.value)} className="input" style={{ fontSize: 12 }}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            )}
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={updateTask}>Сохранить</button>
                              <button className="btn" style={{ fontSize: 11 }} onClick={() => setEditingTaskId(null)}>Отмена</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.title}</div>
                            {t.description && <div style={{ fontSize: 12, color: "var(--c-ink-muted)", marginBottom: 8 }}>{t.description}</div>}
                            <div style={{ fontSize: 11, color: "var(--c-ink-muted)", marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                              <span>👤 Назначил: <strong>{safeName(t.creator)}</strong></span>
                              <span>👥 Исполнители: {assignees.length > 0 ? assignees.join(", ") : "—"}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              {(isCreator(t) || isAssignee(t)) ? (
                                <select value={t.status} className="input" style={{ fontSize: 11, padding: "2px 24px 2px 8px", height: 26, width: "auto" }}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    setTasks((prev) => prev.map((task) => task.id === t.id ? { ...task, status: newStatus } : task));
                                    try { await fetchWithAuth(`${API}/tasks/${t.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) }); }
                                    catch { setTasks((prev) => prev.map((task) => task.id === t.id ? { ...task, status: t.status } : task)); }
                                  }}>
                                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : <StatusPill status={t.status} />}
                              <select value={t.priority} className="input" style={{ fontSize: 11, padding: "2px 24px 2px 8px", height: 26, width: "auto" }}
                                onChange={async (e) => {
                                  const newPriority = e.target.value;
                                  setTasks((prev) => prev.map((task) => task.id === t.id ? { ...task, priority: newPriority } : task));
                                  try { await fetchWithAuth(`${API}/tasks/${t.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: newPriority }) }); }
                                  catch { setTasks((prev) => prev.map((task) => task.id === t.id ? { ...task, priority: t.priority } : task)); }
                                }}>
                                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                              {isCreator(t) && (
                                <button className="btn btn-ghost" style={{ fontSize: 11 }}
                                  onClick={() => { setEditingTaskId(t.id); setEditingTaskTitle(t.title || ""); setEditingTaskDescription(t.description || ""); setEditingTaskStatus(t.status); }}>
                                  ✏️ Редактировать
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======= CREATE TASK MODAL ======= */}
      {taskModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Создать задачу</span>
              <button className="modal-close" onClick={() => setTaskModalOpen(false)}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Название</label>
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Название задачи" className="input" />
              </div>
              <div className="field">
                <label>Описание</label>
                <textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Описание" rows={3} className="input" />
              </div>
              <div className="field">
                <label>Исполнители</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
                  {members.map((u) => (
                    <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={taskAssignees.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setTaskAssignees((p) => p.includes(u.id) ? p : [...p, u.id]);
                          else setTaskAssignees((p) => p.filter((id) => id !== u.id));
                        }} />
                      <div className={`avatar avatar-sm ${avatarColor(u.id)}`}>{safeName(u)[0]}</div>
                      {safeName(u)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setTaskModalOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={createTask} disabled={!taskTitle.trim() || creatingTask}>
                {creatingTask ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======= PROFILE MODAL ======= */}
      {profileUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 320 }}>
            <div className="modal-header">
              <span className="modal-title">Профиль пользователя</span>
              <button className="modal-close" onClick={() => setProfileUser(null)}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className={`avatar avatar-md ${avatarColor(profileUser.id)}`}>{safeName(profileUser)[0]}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{safeName(profileUser)}</div>
                  <div style={{ fontSize: 12, color: "var(--c-ink-muted)" }}>{profileUser.email || "—"}</div>
                </div>
              </div>
              {profileUser.phone && <div style={{ fontSize: 13, color: "var(--c-ink-soft)" }}>📱 {profileUser.phone}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ======= ADD USER MODAL ======= */}
      {addUserOpen && chat.chat_type !== "private" && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">Добавить пользователя</span>
              <button className="modal-close" onClick={() => setAddUserOpen(false)}>✕</button>
            </div>
            {loadingUsers ? (
              <div style={{ display: "flex", gap: 8, padding: "8px 0", alignItems: "center" }}><span className="spinner" /><span style={{ fontSize: 12, color: "var(--c-ink-muted)" }}>Загрузка...</span></div>
            ) : (
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="input">
                <option value="">— Выберите пользователя —</option>
                {allUsers.map((u) => <option key={u.id} value={u.id}>{safeName(u)}</option>)}
              </select>
            )}
            {addUserError && <div className="alert alert-error" style={{ marginTop: 8 }}>{addUserError}</div>}
            <div className="modal-footer">
              <button className="btn" onClick={() => setAddUserOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={addSelectedUser}>Добавить</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .msg-wrap { position: relative; }
        .msg-actions { display: none; position: absolute; top: -14px; left: 0; right: 0; gap: 4px; justify-content: flex-end; }
        .msg-wrap:hover .msg-actions { display: flex; }
        .msg-action-btn { border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .msg-action-delete { background: #fee2e2; }
        .msg-action-task { background: #dcfce7; }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", height: "100vh", background: "var(--c-surface)", overflow: "hidden" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "10px 16px", background: "var(--c-paper)",
    borderBottom: "1px solid var(--c-line)", flexShrink: 0, flexWrap: "wrap",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  chatTitle: { fontSize: 15, fontWeight: 600, color: "var(--c-ink)" },
  memberPills: { display: "flex", gap: 4, flexWrap: "wrap" },
  memberPill: { cursor: "pointer", border: "2px solid var(--c-paper)", transition: "transform var(--t-fast)" },
  headerRight: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  onlineDot: { fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 500 },
  messagesArea: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 8 },
  systemMsg: { textAlign: "center", fontSize: 11, color: "var(--c-ink-ghost)", fontStyle: "italic", padding: "4px 0", margin: "4px 0" },
  bubble: { maxWidth: 480, padding: "9px 13px", borderRadius: 16, fontSize: 13, lineHeight: 1.5 },
  bubbleSelf: { background: "var(--c-accent)", color: "#fff", borderBottomRightRadius: 4 },
  bubbleOther: { background: "var(--c-paper)", color: "var(--c-ink)", border: "1px solid var(--c-line)", borderBottomLeftRadius: 4 },
  bubbleDeleted: { background: "var(--c-surface)", color: "var(--c-ink-ghost)", border: "1px solid var(--c-line)", fontStyle: "italic" },
  deletedText: { fontStyle: "italic", color: "var(--c-ink-ghost)" },
  msgMeta: { display: "flex", gap: 4, fontSize: 10, marginTop: 4, justifyContent: "flex-end", alignItems: "center" },
  inlineEdit: { background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 6, padding: "3px 8px", color: "#fff", fontSize: 13, outline: "none", minWidth: 160 },
  footer: { background: "var(--c-paper)", borderTop: "1px solid var(--c-line)", padding: "8px 16px 12px", flexShrink: 0 },
  typingRow: { height: 22, marginBottom: 6 },
  typingIndicator: { fontSize: 11, color: "var(--c-ink-muted)", fontStyle: "italic", background: "var(--c-surface)", padding: "2px 10px", borderRadius: "var(--r-full)" },
  inputRow: { display: "flex", gap: 8, alignItems: "center" },
  attachBtn: { width: 40, height: 40, border: "1px solid var(--c-line)", borderRadius: "var(--r-full)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", background: "var(--c-surface)", flexShrink: 0 },
};