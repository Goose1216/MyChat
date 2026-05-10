import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../Websocket";
import { fetchWithAuth, apiBase } from "../api";
import type { Message } from "../types";
import TaskStatsPanel from "./TaskStatsPanel";
import BrandLogo from "./BrandLogo";
import "../design.css";

const AVATAR_CLASSES = ["av-blue", "av-teal", "av-amber", "av-purple", "av-rose", "av-green"];
const avatarColor = (id: number) => AVATAR_CLASSES[id % AVATAR_CLASSES.length];
const safeName    = (u: any) => u?.username || u?.email || "User";
const formatTime  = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });

const STATUS_OPTIONS   = ["NEW", "IN_PROGRESS", "DONE", "CANCELLED"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"];

// ─── Ограничения на файлы (должны совпадать с backend/files.py) ───────────────
const MAX_FILE_MB   = 20;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// Расширения, которые точно запрещены на сервере
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".com",
  ".vbs", ".js", ".ts", ".py", ".php", ".rb", ".pl",
  ".jar", ".dll", ".so", ".dylib", ".app",
]);

// Человекочитаемые категории разрешённых файлов (для подсказки пользователю)
const ALLOWED_HINT = "Изображения, PDF, Word, Excel, PowerPoint, текст, CSV, архивы (ZIP/RAR/7z), аудио MP3/OGG, видео MP4/WebM";

/**
 * Клиентская проверка файла перед отправкой.
 * Возвращает строку с ошибкой или null если всё ок.
 */
function validateFile(file: File): string | null {
  // 1. Проверка расширения
  const dotIdx = file.name.lastIndexOf(".");
  const ext    = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : "";
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `Файлы с расширением «${ext}» запрещены к отправке.`;
  }
  // 2. Проверка размера
  if (file.size > MAX_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `Файл слишком большой: ${sizeMb} МБ. Максимум — ${MAX_FILE_MB} МБ.`;
  }
  return null;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = { NEW: "pill-new", IN_PROGRESS: "pill-prog", DONE: "pill-done", CANCELLED: "pill-cancel" };
  return <span className={`pill ${map[status] || "pill-cancel"}`}>{status}</span>;
}

export default function ChatScreen({ userId, chat, onBack }) {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [members, setMembers]       = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  type TypingMap = Record<number, number>;
  const [typingUsers, setTypingUsers] = useState<TypingMap>({});
  const typingIds = Object.keys(typingUsers).map(Number);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError]       = useState<string | null>(null);
  const messageRefs        = useRef<Record<number, HTMLDivElement | null>>({});
  const initialScrollDoneRef = useRef(false);
  const scrollOnSendRef    = useRef(false);
  const messagesRef        = useRef<HTMLDivElement | null>(null);

  const [editingTaskStatus, setEditingTaskStatus] = useState("");
  const [stats, setStats]           = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showStats, setShowStats]   = useState(false);

  // Нормализуем объект чата ПЕРВЫМ — до всех ref-ов которые его используют
  const safeChat = {
    ...chat,
    max_other_read_id:    chat.max_other_read_id    ?? 0,
    cnt_unread_messages:  chat.cnt_unread_messages   ?? 0,
    last_read_message_id: chat.last_read_message_id  ?? 0,
  };

  const lastTypingRef       = useRef<number>(0);
  const lastSentReadRef     = useRef<number>(0);
  // Оба ref-а инициализируем одним значением — last_read_message_id из чата.
  // Это гарантирует: если пользователь ничего нового не прочитал,
  // условие (currentReadId > batchFromIdRef) будет false и запрос не уйдёт.
  const lastReadMessageIdRef  = useRef<number>(safeChat.last_read_message_id || 0);
  // Батчинг прочтений: храним from_id последнего отправленного батча
  const batchFromIdRef        = useRef<number>(safeChat.last_read_message_id || 0);
  // Интервал отправки батча на сервер (3 минуты)
  const BATCH_INTERVAL_MS     = 3 * 60 * 1000;
  // Ref на функцию отправки батча — чтобы setInterval всегда вызывал актуальную версию
  // (избегаем проблемы замыкания где интервал захватывает undefined из TDZ)
  const sendReadBatchRef      = useRef<(toId: number) => void>(() => {});

  const [someoneReadUpTo, setSomeoneReadUpTo] = useState<number>(safeChat.max_other_read_id);

  // Кнопка "вниз": показывается когда пользователь не в самом низу
  const [isAtBottom, setIsAtBottom]     = useState(true);
  const [unreadCount, setUnreadCount]   = useState<number>(safeChat.cnt_unread_messages);

  const [profileUser, setProfileUser]   = useState<any | null>(null);

  // Контекстное меню (ПКМ на сообщении)
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; messageId: number; isSelf: boolean; senderId: number; isDeleted: boolean;
  } | null>(null);

  // Список читателей сообщения
  const [readersModal, setReadersModal] = useState<{
    messageId: number;
    senderId: number | null;  // автор сообщения — не показываем в списке
    readers: Array<{ user_id: number; username: string | null; email: string | null; read_at: string | null }>;
    loading: boolean;
  } | null>(null);
  const [addUserOpen, setAddUserOpen]   = useState(false);
  const [allUsers, setAllUsers]         = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [addUserError, setAddUserError] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [taskModalOpen, setTaskModalOpen]   = useState(false);
  const [taskMessageId, setTaskMessageId]   = useState<number | null>(null);
  const [taskTitle, setTaskTitle]           = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignees, setTaskAssignees]   = useState<number[]>([]);

  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasks, setTasks]                   = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks]     = useState(false);
  const [editingTaskId, setEditingTaskId]   = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle]       = useState("");
  const [editingTaskDescription, setEditingTaskDescription] = useState("");
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const bottomRef  = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = apiBase();

  useEffect(() => {
    setStats([]);
    setShowStats(false);
    setSomeoneReadUpTo(safeChat.max_other_read_id);
    setUnreadCount(safeChat.cnt_unread_messages);
    setIsAtBottom(true);
  }, [chat.id]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnreadCount(0);
    setIsAtBottom(true);

    // Принудительно отмечаем все видимые сообщения прочитанными —
    // иначе onScroll может не сработать сразу из-за throttle 300ms
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender_id !== userId) {
      const id = lastMsg.id;
      if (id > lastReadMessageIdRef.current) {
        lastReadMessageIdRef.current = id;
        lastSentReadRef.current = Date.now();
        fetchWithAuth(`${API}/messages/read/${id}/`, { method: "POST" }).catch(() => {});
      }
    }
  };

  useEffect(() => {
    (async () => {
      const res  = await fetchWithAuth(`${API}/chats/${chat.id}/messages`);
      const data = await res.json();
      setMessages((data.data || []).map((m: any) => ({
        id: m.id, chat_id: m.chat_id, sender_id: m.sender_id,
        text: m.content, file: m.file ?? null,
        timestamp: m.updated_at || m.created_at, is_deleted: m.is_deleted,
        sender: m.sender, is_self: m.sender_id === userId,
        is_system: m.sender_id === null, edited: m.updated_at !== m.created_at,
      })));
      const mRes  = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
      const mData = await mRes.json();
      setMembers(mData.data || []);
    })();
  }, [chat.id]);

  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.chat_id !== chat.id) return;
      if (msg.type_of_message === 0) {
        setMessages(p => [...p, {
          id: msg.message_id, chat_id: msg.chat_id, sender_id: msg.sender_id,
          text: msg.text ?? null, file: msg.file ?? null, timestamp: msg.created_at,
          is_deleted: msg.is_deleted, sender: msg.sender,
          is_self: msg.sender_id === userId, is_system: msg.sender === null, edited: false,
        }]);
        // Увеличиваем счётчик непрочитанных если пользователь не внизу
        if (msg.sender_id !== userId) {
          setIsAtBottom(prev => {
            if (!prev) setUnreadCount(c => c + 1);
            return prev;
          });
        }
      }
      if (msg.type_of_message === 1) {
        setMessages(p => p.map(m => m.id === msg.message_id
          ? { ...m, text: msg.text, timestamp: msg.updated_at, edited: true, is_system: false, is_deleted: msg.is_deleted } : m));
      }
      if (msg.type_of_message === 2) {
        setMessages(p => p.map(m => m.id === msg.message_id
          ? { ...m, text: msg.text, timestamp: msg.updated_at, edited: true, is_system: false, is_deleted: true } : m));
      }
      if (msg.type_of_message === 3) {
        if (msg.sender_id === userId) return;
        setTypingUsers(prev => ({ ...prev, [msg.sender_id]: Date.now() }));
      }
      if (msg.type_of_message === 4) {
        setSomeoneReadUpTo(prev => Math.max(prev, msg.last_read_message_id));
      }
    };
    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, userId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
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
      const res  = await fetchWithAuth(`${API}/tasks/stats/?chat_id=${chat.id}`);
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
      const res  = await fetchWithAuth(`${API}/users/get_all_users/`, { method: "POST" });
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
      const u = allUsers.find(x => x.id === Number(selectedUserId));
      if (u) setMembers(p => [...p, u]);
      setAddUserOpen(false);
    } catch { setAddUserError("Ошибка соединения с сервером"); }
  };

  const deleteMessage = async (id: number) => {
    if (!window.confirm("Удалить сообщение?")) return;
    await fetchWithAuth(`${API}/messages/${id}/`, { method: "DELETE" });
  };

  useEffect(() => { lastReadMessageIdRef.current = safeChat.last_read_message_id || 0; }, [chat.id]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    const sendRead = (id: number) => {
      if (Date.now() - lastSentReadRef.current < 300) return;
      lastSentReadRef.current = Date.now();
      if (id <= lastReadMessageIdRef.current) return;
      lastReadMessageIdRef.current = id;
      fetchWithAuth(`${API}/messages/read/${id}/`, { method: "POST" }).catch(() => {});
    };

    const onScroll = () => {
      const containerRect = el.getBoundingClientRect();

      // Определяем: пользователь внизу если до конца осталось < 80px
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distFromBottom < 80;
      setIsAtBottom(atBottom);
      // Сбрасываем счётчик когда добрались до низа
      if (atBottom) setUnreadCount(0);

      let maxVisibleId = lastReadMessageIdRef.current;
      for (const m of messages) {
        if (m.sender_id === userId) continue;
        const node = messageRefs.current[m.id];
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        if (rect.bottom > containerRect.top && rect.top < containerRect.bottom && m.id > maxVisibleId) {
          maxVisibleId = m.id;
        }
      }
      if (maxVisibleId > lastReadMessageIdRef.current) sendRead(maxVisibleId);
    };

    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages, userId]);

  const sendFile = async () => {
    if (!selectedFile) return;

    // Клиентская валидация (быстрая проверка до сетевого запроса)
    const clientError = validateFile(selectedFile);
    if (clientError) {
      setFileError(clientError);
      return;
    }

    const form = new FormData();
    form.append("file", selectedFile);
    try {
      const res = await fetchWithAuth(`${API}/messages/${chat.id}/file/`, { method: "POST", body: form });
      if (!res.ok) {
        // Парсим серверную ошибку (400 / 413 / 415)
        const data = await res.json().catch(() => ({}));
        const msg  = data?.detail || data?.description || data?.errors?.[0]?.message || "Не удалось отправить файл";
        setFileError(msg);
        return;
      }
      setSelectedFile(null);
      setFileError(null);
    } catch {
      setFileError("Ошибка соединения. Попробуйте ещё раз.");
    }
  };

  const sendTyping = () => {
    const now = Date.now();
    if (now - lastTypingRef.current < 500) return;
    lastTypingRef.current = now;
    fetchWithAuth(`${API}/chats/${chat.id}/${userId}/typing/`, { method: "POST" }).catch(() => {});
  };

  useEffect(() => {
    if (initialScrollDoneRef.current || !messages.length) return;
    if (safeChat.last_read_message_id) {
      const el = messageRefs.current[chat.last_read_message_id];
      el ? el.scrollIntoView({ block: "center" }) : bottomRef.current?.scrollIntoView();
    } else {
      bottomRef.current?.scrollIntoView();
    }
    initialScrollDoneRef.current = true;
  }, [messages, chat.id]);

  useEffect(() => { setTypingUsers({}); }, [chat.id]);

  // Сбрасываем from_id при смене чата
  useEffect(() => {
    batchFromIdRef.current = safeChat.last_read_message_id || 0;
  }, [chat.id]);

  // Таймер: раз в BATCH_INTERVAL_MS отправляем батч прочтения.
  // При размонтировании (выход из чата) — отправляем финальный батч немедленно,
  // чтобы не потерять прочитанное если пользователь пробыл в чате меньше интервала.
  // Использует ref чтобы всегда иметь актуальную функцию (не захватывает undefined из TDZ).
  useEffect(() => {
    const interval = setInterval(() => {
      const currentReadId = lastReadMessageIdRef.current;
      if (currentReadId > batchFromIdRef.current) {
        sendReadBatchRef.current(currentReadId);
      }
    }, BATCH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      // Финальный батч при выходе из чата
      const currentReadId = lastReadMessageIdRef.current;
      if (currentReadId > batchFromIdRef.current) {
        sendReadBatchRef.current(currentReadId);
      }
    };
  }, [chat.id]);

  const isCreator  = (task: any) => task.creator?.id === userId;
  const isAssignee = (task: any) => task.assignments?.some((a: any) => a.user_id === userId);

  const updateTask = async () => {
    if (!editingTaskId) return;
    try {
      const res  = await fetchWithAuth(`${API}/tasks/${editingTaskId}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTaskTitle, description: editingTaskDescription, status: editingTaskStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.description || "Ошибка обновления"); return; }
      setTasks(prev => prev.map(t => t.id === editingTaskId
        ? { ...t, title: editingTaskTitle, description: editingTaskDescription, status: editingTaskStatus } : t));
      setEditingTaskId(null);
    } catch { alert("Ошибка сети"); }
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const res  = await fetchWithAuth(`${API}/tasks/?chat_id=${chat.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert("Ошибка загрузки задач"); return; }
      setTasks(data.data || []);
    } catch { alert("Ошибка сети"); }
    finally { setLoadingTasks(false); }
  };

  const createTask = async () => {
    if (!taskTitle.trim()) { alert("Введите название задачи"); return; }
    if (!taskMessageId)    { alert("Ошибка: нет message_id"); return; }
    if (creatingTask)      return;
    setCreatingTask(true);
    try {
      const res  = await fetchWithAuth(`${API}/tasks/`, {
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

  const getName = (uid: number) => {
    const u = members.find(m => m.id === uid);
    return u ? safeName(u) : `#${uid}`;
  };

  // Отправляет батч прочтения на сервер
  const sendReadBatch = async (toId: number) => {
    const fromId = batchFromIdRef.current;
    if (toId <= fromId) return; // нечего отправлять

    try {
      await fetchWithAuth(`${API}/chats/messages/read_batch/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, from_id: fromId + 1, to_id: toId }),
      });
      batchFromIdRef.current = toId;
    } catch {
      // тихо — попробуем в следующий тик
    }
  };
  // Синхронизируем ref после каждого рендера — ref всегда указывает на актуальную функцию
  sendReadBatchRef.current = sendReadBatch;

  const loadReaders = async (messageId: number, senderId: number, silent = false) => {
    // silent=true при авто-обновлении — не показываем спиннер
    if (!silent) setReadersModal({ messageId, senderId, readers: [], loading: true });
    try {
      const res  = await fetchWithAuth(`${API}/chats/messages/${messageId}/readers/`);
      const data = await res.json();
      setReadersModal({ messageId, senderId, readers: data.data ?? [], loading: false });
    } catch {
      if (!silent) setReadersModal({ messageId, senderId: null, readers: [], loading: false });
    }
  };

  // Авто-обновление модалки читателей раз в минуту
  const readersRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!readersModal) {
      if (readersRefreshRef.current) clearInterval(readersRefreshRef.current);
      return;
    }
    const { messageId, senderId } = readersModal;
    readersRefreshRef.current = setInterval(() => {
      if (senderId !== null) loadReaders(messageId, senderId, true);
    }, 60_000);
    return () => {
      if (readersRefreshRef.current) clearInterval(readersRefreshRef.current);
    };
  }, [readersModal?.messageId]); // перезапускаем только при смене сообщения

  // Закрываем контекстное меню по клику в любом месте
  const closeCtxMenu = () => setCtxMenu(null);

  const renderMessageContent = (m: Message) => {
    if (m.is_deleted) return <span style={{ fontStyle: "italic", color: "var(--c-ink-ghost)" }}>Сообщение удалено</span>;
    if (m.file) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>📎 {m.file.filename}</span>
        <a href={m.file.url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: m.is_self ? "rgba(255,255,255,0.8)" : "var(--c-brand)", textDecoration: "underline" }}>
          Скачать
        </a>
      </div>
    );
    if (editingId === m.id) return (
      <input style={{
        background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)",
        borderRadius: 6, padding: "3px 8px", color: "#fff", fontSize: 13, outline: "none", minWidth: 160,
      }}
        value={editingText} autoFocus
        onChange={e => setEditingText(e.target.value)}
        onKeyDown={e => {
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
      {/* HEADER */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button className="btn btn-ghost" onClick={onBack} style={{ fontSize: 12, padding: "5px 8px" }}>← Назад</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={s.chatAvatar}>{(chat.title || `#${chat.id}`).slice(0, 2).toUpperCase()}</div>
            <div>
              <div style={s.chatTitle}>{chat.title || `Чат #${chat.id}`}</div>
              <div style={s.chatMeta}>{members.length} участн. · <span style={{ color: connected ? "var(--c-green)" : "var(--c-ink-ghost)" }}>{connected ? "онлайн" : "офлайн"}</span></div>
            </div>
          </div>
        </div>

        <div style={s.headerRight}>
          {/* Member avatars */}
          <div style={{ display: "flex", gap: 2 }}>
            {members.slice(0, 4).map(u => (
              <button key={u.id} onClick={() => setProfileUser(u)}
                className={`avatar avatar-sm ${avatarColor(u.id)}`}
                style={{ cursor: "pointer", border: "2px solid var(--c-paper)" }} title={safeName(u)}>
                {safeName(u)[0].toUpperCase()}
              </button>
            ))}
            {members.length > 4 && (
              <div className="avatar avatar-sm" style={{ background: "var(--c-surface)", color: "var(--c-ink-muted)", border: "2px solid var(--c-paper)", fontSize: 9 }}>
                +{members.length - 4}
              </div>
            )}
          </div>
          <button className="btn" style={{ fontSize: 12 }} onClick={() => { setTasksModalOpen(true); loadTasks(); }}>📋 Задачи</button>
          {chat.chat_type !== "private" && (
            <button className="btn btn-success" style={{ fontSize: 12 }} onClick={openAddUserModal}>+ Добавить</button>
          )}
          <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={leaveChat}>Выйти</button>
        </div>
      </header>

      {/* MESSAGES */}
      <main ref={messagesRef} style={s.messages}>
        {messages.map(m => {
          const isReadBySomeone = m.id <= someoneReadUpTo;
          if (m.is_system) return (
            <div key={m.id} style={s.systemMsg}>{m.text}</div>
          );
          return (
            <div key={m.id} ref={el => (messageRefs.current[m.id] = el)}
              style={{ display: "flex", justifyContent: m.is_self ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>

              {/* Other user avatar — left side */}
              {!m.is_self && (
                <button onClick={() => setProfileUser(m.sender)}
                  className={`avatar avatar-sm ${avatarColor(m.sender_id)}`}
                  style={{ cursor: "pointer", flexShrink: 0, marginBottom: 2 }}
                  title={safeName(m.sender)}>
                  {safeName(m.sender)[0]}
                </button>
              )}

              <div
                style={{ position: "relative", maxWidth: "62%" }}
                className="msg-wrap"
                onContextMenu={e => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, messageId: m.id, isSelf: m.is_self, senderId: m.sender_id, isDeleted: m.is_deleted });
                }}
              >
                {/* Sender name for other users */}
                {!m.is_self && !m.is_deleted && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-brand)", marginBottom: 3, paddingLeft: 2 }}>
                    {safeName(m.sender)}
                  </div>
                )}
                <div style={{
                  padding: "9px 13px",
                  borderRadius: m.is_self ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  fontSize: 13,
                  ...(m.is_deleted
                    ? { background: "var(--c-surface)", color: "var(--c-ink-ghost)", border: "1px solid var(--c-line)", fontStyle: "italic" }
                    : m.is_self
                    ? { background: "var(--c-brand)", color: "#fff" }
                    : { background: "var(--c-paper)", color: "var(--c-ink)", border: "1px solid var(--c-line)" }
                  ),
                }}>
                  {renderMessageContent(m)}
                  <div style={{
                    display: "flex", gap: 4, fontSize: 10, marginTop: 4,
                    justifyContent: "flex-end", alignItems: "center",
                    // удалённое сообщение всегда серый фон — белый цвет не виден
                    color: m.is_deleted ? "var(--c-ink-ghost)" : m.is_self ? "rgba(255,255,255,0.6)" : "var(--c-ink-ghost)",
                  }}>
                    <span>{formatTime(m.timestamp)}</span>
                    {!m.is_deleted && m.edited && <span>· изм.</span>}
                    {m.is_self && <span style={{ marginLeft: 2, fontSize: 11 }}>{isReadBySomeone ? "✔✔" : "✔"}</span>}
                  </div>
                </div>

                {!m.is_deleted && (
                  <div className="msg-actions">
                    {m.is_self && (
                      <button className="msg-action-btn msg-action-delete" onClick={() => deleteMessage(m.id)} title="Удалить">🗑</button>
                    )}
                    <button className="msg-action-btn msg-action-task"
                      onClick={() => { setTaskModalOpen(true); setTaskMessageId(m.id); setTaskTitle(m.text || ""); setTaskDescription(""); setTaskAssignees([]); }}
                      title="Создать задачу">📌</button>
                  </div>
                )}
              </div>

              {/* Self avatar — right side (optional, subtle) */}
              {m.is_self && (
                <div className={`avatar avatar-sm ${avatarColor(userId)}`} style={{ flexShrink: 0, marginBottom: 2, opacity: 0.7 }}>
                  {members.find(x => x.id === userId) ? safeName(members.find(x => x.id === userId))[0] : "Я"}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* ── Кнопка "вниз" — появляется когда пользователь не внизу ── */}
      {!isAtBottom && (
        <div style={s.scrollBtnWrap}>
          <button onClick={scrollToBottom} style={s.scrollBtn} title="Вниз">
            {/* Стрелка вниз */}
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {unreadCount > 0 && (
              <span style={s.scrollBtnBadge}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* FOOTER */}
      <footer style={s.footer}>
        {/* Typing indicator */}
        {typingIds.length > 0 && (
          <div style={s.typing}>
            <span style={s.typingDots}>···</span>
            {typingIds.map(id => { const u = members.find(x => x.id === id); return u ? safeName(u) : "Кто-то"; }).join(", ")} печатает
          </div>
        )}

        {/* Ошибка файла — тост над строкой ввода */}
        {fileError && (
          <div style={s.fileErrorBanner}>
            <span style={{ flex: 1 }}>⚠️ {fileError}</span>
            <button
              style={s.fileErrorClose}
              onClick={() => { setFileError(null); setSelectedFile(null); }}
              title="Закрыть"
            >✕</button>
          </div>
        )}

        {/* Превью выбранного файла */}
        {selectedFile && !fileError && (
          <div style={s.filePreview}>
            <span style={s.filePreviewIcon}>📎</span>
            <div style={s.filePreviewInfo}>
              <span style={s.filePreviewName}>{selectedFile.name}</span>
              <span style={s.filePreviewSize}>{(selectedFile.size / (1024 * 1024)).toFixed(2)} МБ из {MAX_FILE_MB} МБ макс.</span>
            </div>
            <button className="btn btn-danger" style={{ fontSize: 11, padding: "4px 8px", flexShrink: 0 }}
              onClick={() => { setSelectedFile(null); setFileError(null); }}>✕</button>
          </div>
        )}

        <form
          onSubmit={e => { e.preventDefault(); selectedFile ? sendFile() : send(e); }}
          style={s.inputRow}
        >
          <input
            type="file"
            id="file-input"
            style={{ display: "none" }}
            // accept подсказывает браузеру какие файлы показывать в диалоге
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.mp3,.ogg,.mp4,.webm"
            onChange={e => {
              const f = e.target.files?.[0];
              // Сбрасываем input чтобы можно было выбрать тот же файл повторно
              e.target.value = "";
              if (!f) return;
              const err = validateFile(f);
              if (err) {
                setFileError(err);
                setSelectedFile(null);
              } else {
                setFileError(null);
                setSelectedFile(f);
              }
            }}
          />

          {/* Кнопка прикрепления с тултипом об ограничениях */}
          <div style={{ position: "relative" }} className="attach-wrap">
            <label
              htmlFor="file-input"
              style={{
                ...s.attachBtn,
                background: selectedFile ? "var(--c-brand-bg)" : "var(--c-surface)",
                borderColor: selectedFile ? "var(--c-brand-border)" : "var(--c-line)",
              }}
            >
              📎
            </label>
            {/* Тултип — показывается при наведении через CSS */}
            <div style={s.attachTooltip}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Допустимые файлы</div>
              <div style={{ marginBottom: 6, lineHeight: 1.4 }}>{ALLOWED_HINT}</div>
              <div style={{ color: "var(--c-warning)", fontWeight: 700 }}>
                ⚠ Максимальный размер: {MAX_FILE_MB} МБ
              </div>
            </div>
          </div>

          <input
            value={newMessage}
            onChange={e => { setNewMessage(e.target.value); sendTyping(); }}
            placeholder={selectedFile ? `📎 ${selectedFile.name}` : "Написать сообщение…"}
            disabled={!!selectedFile}
            className="input"
            style={{ flex: 1, borderRadius: "var(--r-full)", height: 40, background: "var(--c-surface)" }}
          />

          <button type="submit" className="btn btn-primary"
            style={{ width: 40, height: 40, borderRadius: "var(--r-full)", padding: 0, fontSize: 16, flexShrink: 0 }}>
            ➤
          </button>
        </form>
      </footer>

      {/* ══ TASKS MODAL ══ */}
      {tasksModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{
            maxWidth: showStats ? 700 : 520, maxHeight: "90vh",
            overflow: "hidden", display: "flex", flexDirection: "column",
            transition: "max-width 0.25s ease",
          }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button className={`btn ${!showStats ? "btn-primary" : ""}`} style={{ fontSize: 12 }} onClick={() => setShowStats(false)}>📋 Задачи</button>
                <button className={`btn ${showStats  ? "btn-primary" : ""}`} style={{ fontSize: 12 }} onClick={() => { setShowStats(true); if (!stats.length) loadStats(); }}>📊 Статистика</button>
              </div>
              <button className="modal-close" onClick={() => setTasksModalOpen(false)}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "4px 0 8px" }}>
              {showStats && <TaskStatsPanel stats={stats} loading={loadingStats} getName={getName} />}

              {!showStats && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {loadingTasks && <div style={{ textAlign: "center", padding: 20 }}><span className="spinner" /></div>}
                  {!loadingTasks && tasks.length === 0 && (
                    <div style={{ textAlign: "center", padding: 32, color: "var(--c-ink-muted)", fontSize: 13 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>Нет задач в этом чате
                    </div>
                  )}
                  {!loadingTasks && tasks.map(t => {
                    const assignees   = t.assignments?.map((a: any) => safeName(a.user)) || [];
                    const isMeAssigned = t.assignments?.some((a: any) => a.user_id === userId);
                    return (
                      <div key={t.id} style={{
                        border: `1px solid ${isMeAssigned ? "var(--c-green-border)" : "var(--c-line)"}`,
                        borderRadius: "var(--r-md)", padding: 12,
                        background: isMeAssigned ? "var(--c-green-bg)" : "var(--c-paper)",
                      }}>
                        {editingTaskId === t.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <input value={editingTaskTitle} onChange={e => setEditingTaskTitle(e.target.value)} className="input" />
                            <textarea value={editingTaskDescription} onChange={e => setEditingTaskDescription(e.target.value)} className="input" rows={2} />
                            {(isCreator(t) || isAssignee(t)) && (
                              <select value={editingTaskStatus} onChange={e => setEditingTaskStatus(e.target.value)} className="input" style={{ fontSize: 12 }}>
                                {STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                              </select>
                            )}
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={updateTask}>Сохранить</button>
                              <button className="btn" style={{ fontSize: 11 }} onClick={() => setEditingTaskId(null)}>Отмена</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.title}</div>
                            {t.description && <div style={{ fontSize: 12, color: "var(--c-ink-muted)", marginBottom: 8 }}>{t.description}</div>}
                            <div style={{ fontSize: 11, color: "var(--c-ink-muted)", marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                              <span>👤 Назначил: <strong>{safeName(t.creator)}</strong></span>
                              <span>👥 Исполнители: {assignees.length > 0 ? assignees.join(", ") : "—"}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                              {(isCreator(t) || isAssignee(t)) ? (
                                <select value={t.status} className="input" style={{ fontSize: 11, padding: "2px 24px 2px 8px", height: 26, width: "auto" }}
                                  onChange={async e => {
                                    const ns = e.target.value;
                                    setTasks(p => p.map(tk => tk.id === t.id ? { ...tk, status: ns } : tk));
                                    try { await fetchWithAuth(`${API}/tasks/${t.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: ns }) }); }
                                    catch { setTasks(p => p.map(tk => tk.id === t.id ? { ...tk, status: t.status } : tk)); }
                                  }}>
                                  {STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                              ) : <StatusPill status={t.status} />}
                              <select value={t.priority} className="input" style={{ fontSize: 11, padding: "2px 24px 2px 8px", height: 26, width: "auto" }}
                                onChange={async e => {
                                  const np = e.target.value;
                                  setTasks(p => p.map(tk => tk.id === t.id ? { ...tk, priority: np } : tk));
                                  try { await fetchWithAuth(`${API}/tasks/${t.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: np }) }); }
                                  catch { setTasks(p => p.map(tk => tk.id === t.id ? { ...tk, priority: t.priority } : tk)); }
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE TASK */}
      {taskModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Создать задачу</span>
              <button className="modal-close" onClick={() => setTaskModalOpen(false)}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field"><label>Название</label>
                <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Название задачи" className="input" />
              </div>
              <div className="field"><label>Описание</label>
                <textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Описание" rows={3} className="input" />
              </div>
              <div className="field"><label>Исполнители</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
                  {members.map(u => (
                    <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={taskAssignees.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setTaskAssignees(p => p.includes(u.id) ? p : [...p, u.id]);
                          else setTaskAssignees(p => p.filter(id => id !== u.id));
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

      {/* PROFILE */}
      {profileUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 300 }}>
            <div className="modal-header">
              <span className="modal-title">Профиль</span>
              <button className="modal-close" onClick={() => setProfileUser(null)}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className={`avatar avatar-md ${avatarColor(profileUser.id)}`}>{safeName(profileUser)[0]}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{safeName(profileUser)}</div>
                  <div style={{ fontSize: 12, color: "var(--c-ink-muted)" }}>{profileUser.email || "—"}</div>
                </div>
              </div>
              {profileUser.phone && <div style={{ fontSize: 13, color: "var(--c-ink-soft)" }}>📱 {profileUser.phone}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ADD USER */}
      {addUserOpen && chat.chat_type !== "private" && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <span className="modal-title">Добавить участника</span>
              <button className="modal-close" onClick={() => setAddUserOpen(false)}>✕</button>
            </div>
            {loadingUsers ? (
              <div style={{ display: "flex", gap: 8, padding: "8px 0", alignItems: "center" }}>
                <span className="spinner" /><span style={{ fontSize: 12, color: "var(--c-ink-muted)" }}>Загрузка...</span>
              </div>
            ) : (
              <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="input">
                <option value="">— Выберите пользователя —</option>
                {allUsers.map(u => <option key={u.id} value={u.id}>{safeName(u)}</option>)}
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

      {/* ── CONTEXT MENU (ПКМ) ── */}
      {ctxMenu && (
        <div
          style={{
            position: "fixed",
            // Если меню не влезает справа — сдвигаем влево от курсора
            top:  Math.min(ctxMenu.y, window.innerHeight - 160),
            left: Math.min(ctxMenu.x, window.innerWidth  - 200),
            background: "var(--c-paper)", border: "1px solid var(--c-line)",
            borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)",
            zIndex: 100, minWidth: 180, overflow: "hidden",
            animation: "modalIn 120ms ease",
          }}
          onClick={closeCtxMenu}
        >
          <div style={{ padding: "4px 0" }}>
            <button
              style={ctxStyle.item}
              onClick={() => { loadReaders(ctxMenu.messageId, ctxMenu.senderId); closeCtxMenu(); }}
            >
              <span>👁</span> Кто прочитал
            </button>
            {ctxMenu.isSelf && (
              <button
                style={{ ...ctxStyle.item, color: "var(--c-danger)" }}
                onClick={() => { deleteMessage(ctxMenu.messageId); closeCtxMenu(); }}
              >
                <span>🗑</span> Удалить
              </button>
            )}
            {!ctxMenu.isDeleted && (
              <button
                style={ctxStyle.item}
                onClick={() => {
                  setTaskModalOpen(true);
                  setTaskMessageId(ctxMenu.messageId);
                  closeCtxMenu();
                }}
              >
                <span>📌</span> Создать задачу
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overlay для закрытия контекстного меню */}
      {ctxMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
          onClick={closeCtxMenu}
          onContextMenu={e => { e.preventDefault(); closeCtxMenu(); }}
        />
      )}

      {/* ── READERS MODAL ── */}
      {readersModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <span className="modal-title">👁 Прочитали сообщение</span>
                <button className="modal-close" onClick={() => setReadersModal(null)}>✕</button>
              </div>
              <span style={{ fontSize: 10, color: "var(--c-ink-ghost)", fontFamily: "var(--font-mono)" }}>
                ↻ обновляется автоматически раз в минуту
              </span>
            </div>

            {readersModal.loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <span className="spinner" />
              </div>
            ) : readersModal.readers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--c-ink-muted)", fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>👁</div>
                Никто ещё не прочитал
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {readersModal.readers.map((r, i) => {
                  const isMe   = r.user_id === userId;
                  const name   = isMe ? "Вы" : (r.username || r.email || `#${r.user_id}`);
                  const readTime = r.read_at
                    ? new Date(r.read_at).toLocaleString("ru-RU", {
                        day: "2-digit", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })
                    : "—";
                  return (
                    <div key={r.user_id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 4px",
                      borderBottom: i < readersModal.readers.length - 1 ? "1px solid var(--c-line-soft)" : "none",
                      background: isMe ? "var(--c-brand-bg)" : "transparent",
                      borderRadius: isMe ? "var(--r-md)" : 0,
                    }}>
                      <div className={`avatar avatar-sm ${avatarColor(r.user_id)}`}
                        style={isMe ? { outline: "2px solid var(--c-brand)", outlineOffset: 1 } : {}}>
                        {name[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? "var(--c-brand)" : "var(--c-ink)" }}>
                          {name}
                          {isMe && <span style={{ fontSize: 10, fontWeight: 400, color: "var(--c-ink-muted)", marginLeft: 6 }}>это вы</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--c-ink-muted)", marginTop: 1 }}>
                          прочитано в {readTime}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, color: "var(--c-green)" }}>✔✔</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

            <style>{`
        .msg-wrap { position: relative; }
        .msg-actions {
          display: none; position: absolute; top: -20px; right: 0;
          gap: 4px; background: var(--c-paper);
          border: 1px solid var(--c-line); border-radius: var(--r-md);
          padding: 3px 5px; box-shadow: var(--shadow-sm);
        }
        .msg-wrap:hover .msg-actions { display: flex; }
        .msg-action-btn {
          border: none; border-radius: var(--r-sm); width: 24px; height: 24px;
          font-size: 11px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; background: transparent;
        }
        .msg-action-btn:hover { background: var(--c-surface); }
        .msg-action-delete:hover { background: var(--c-danger-bg) !important; }

        /* Тултип у кнопки прикрепления файла */
        .attach-wrap { position: relative; }
        .attach-wrap:hover > div[style] { display: block !important; }

        /* Кнопка вниз — hover */
        button[title="Вниз"]:hover { background: var(--c-brand-bg) !important; transform: scale(1.08); }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:       { display: "flex", flexDirection: "column", height: "100vh", background: "var(--c-surface)", overflow: "hidden" },
  header:     { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "10px 16px", background: "var(--c-paper)",
                borderBottom: "1px solid var(--c-line)", flexShrink: 0, flexWrap: "wrap" as const },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  chatAvatar: {
    width: 36, height: 36, borderRadius: "50%",
    background: "var(--c-brand)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
  },
  chatTitle:  { fontSize: 14, fontWeight: 700, color: "var(--c-ink)" },
  chatMeta:   { fontSize: 11, color: "var(--c-ink-muted)", marginTop: 1 },
  headerRight:{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const },

  messages:   {
    flex: 1, overflowY: "auto", padding: "16px 20px",
    display: "flex", flexDirection: "column", gap: 10,
    background: "var(--c-surface)",
    backgroundImage: "radial-gradient(circle at 100% 0%, rgba(123,31,162,0.03) 0%, transparent 50%)",
    position: "relative" as const,  // нужен для абсолютного позиционирования кнопки вниз
  },
  systemMsg:  { textAlign: "center", fontSize: 11, color: "var(--c-ink-ghost)", fontStyle: "italic", padding: "4px 0" },

  footer:     { background: "var(--c-paper)", borderTop: "1px solid var(--c-line)", padding: "8px 16px 12px", flexShrink: 0 },
  typing:     { fontSize: 11, color: "var(--c-brand)", fontStyle: "italic", height: 20, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 },
  typingDots: { fontWeight: 700, letterSpacing: 2, fontSize: 16 },
  inputRow:   { display: "flex", gap: 8, alignItems: "center" },
  attachBtn:  {
    width: 40, height: 40, border: "1.5px solid var(--c-line)", borderRadius: "var(--r-full)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, cursor: "pointer", background: "var(--c-surface)", flexShrink: 0,
    transition: "background var(--t-fast)",
  },

  // Кнопка прокрутки вниз
  scrollBtnWrap: {
    position: "absolute" as const,
    bottom: 90,               // над footer
    right: 24,
    zIndex: 20,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    pointerEvents: "none" as const,
  },
  scrollBtn: {
    width: 40, height: 40,
    borderRadius: "var(--r-full)",
    background: "var(--c-paper)",
    border: "1.5px solid var(--c-line)",
    boxShadow: "var(--shadow-md)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    color: "var(--c-brand)",
    pointerEvents: "auto" as const,
    transition: "background var(--t-fast), transform var(--t-fast)",
    position: "relative" as const,
  },
  scrollBtnBadge: {
    position: "absolute" as const,
    top: -6, right: -6,
    background: "var(--c-brand)",
    color: "#fff",
    borderRadius: "var(--r-full)",
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    padding: "1px 5px",
    minWidth: 16,
    textAlign: "center" as const,
    border: "1.5px solid var(--c-paper)",
  },

  // Тост с ошибкой файла
  fileErrorBanner: {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--c-danger-bg)", border: "1px solid #FFCDD2",
    borderRadius: "var(--r-md)", padding: "8px 12px", marginBottom: 8,
    fontSize: 12, fontWeight: 600, color: "var(--c-danger)",
    animation: "fadeInDown 0.2s ease",
  },
  fileErrorClose: {
    background: "transparent", border: "none", cursor: "pointer",
    color: "var(--c-danger)", fontSize: 13, padding: "0 2px", flexShrink: 0,
  },

  // Превью выбранного файла
  filePreview: {
    display: "flex", alignItems: "center", gap: 10,
    background: "var(--c-brand-bg)", border: "1px solid var(--c-brand-border)",
    borderRadius: "var(--r-md)", padding: "7px 12px", marginBottom: 8,
  },
  filePreviewIcon: { fontSize: 18, flexShrink: 0 },
  filePreviewInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 },
  filePreviewName: { fontSize: 12, fontWeight: 700, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  filePreviewSize: { fontSize: 11, color: "var(--c-ink-muted)" },

  // Тултип над кнопкой прикрепления
  attachTooltip: {
    display: "none", // показывается через CSS .attach-wrap:hover
    position: "absolute", bottom: "calc(100% + 8px)", left: 0,
    width: 260, background: "var(--c-ink)", color: "#fff",
    borderRadius: "var(--r-md)", padding: "10px 12px", fontSize: 11,
    boxShadow: "var(--shadow-md)", zIndex: 20, pointerEvents: "none",
    lineHeight: 1.5,
  },
};

const ctxStyle: Record<string, React.CSSProperties> = {
  item: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "9px 16px",
    background: "transparent", border: "none",
    fontSize: 13, fontWeight: 600, color: "var(--c-ink)",
    cursor: "pointer", textAlign: "left" as const,
    transition: "background var(--t-fast)",
  },
};