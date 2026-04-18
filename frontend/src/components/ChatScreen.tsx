import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../Websocket";
import { fetchWithAuth, apiBase } from "../api";
import type { Message } from "../types";

export default function ChatScreen({ userId, chat, onBack }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  type TypingMap = Record<number, number>; // user_id -> last_seen_ts
  const [typingUsers, setTypingUsers] = useState<TypingMap>({});
  const typingIds = Object.keys(typingUsers).map(Number);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const initialScrollDoneRef = useRef(false);
  const scrollOnSendRef = useRef(false);

  const [editingTaskStatus, setEditingTaskStatus] = useState("");
const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const lastTypingRef = useRef<number>(0);
  const lastSentReadRef = useRef<number>(0);
  const lastReadMessageIdRef = useRef<number>(0);

  const [someoneReadUpTo, setSomeoneReadUpTo] = useState<number>(0);

  // === added from old version ===
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
  // === edit message ===
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = apiBase();

  const safeName = (u: any) => u?.username || u?.email || "User";

  const avatarColor = (id: number) => {
    const colors = ["bg-red-500", "bg-blue-500", "bg-green-500"];
    return colors[id % colors.length];
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString();

  // ================= LOAD =================
  useEffect(() => {
    (async () => {
      const res = await fetchWithAuth(`${API}/chats/${chat.id}/messages`);
      const data = await res.json();

    setMessages(
      (data.data || []).map((m: any) => ({
        id: m.id,
        chat_id: m.chat_id,
        sender_id: m.sender_id,
        text: m.content,
        file: m.file ?? null,
        timestamp: m.updated_at || m.created_at,
        is_deleted: m.is_deleted,
        sender: m.sender,
        is_self: m.sender_id === userId,
        is_system: m.sender_id === null,
        edited: m.updated_at !== m.created_at,
      }))
    );

      const mRes = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
      const mData = await mRes.json();
      setMembers(mData.data || []);
    })();
  }, [chat.id]);

  // ================= WS =================
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.chat_id !== chat.id) return;

      if (msg.type_of_message === 0) {
        setMessages((p) => [
          ...p,
          {
            id: msg.message_id,
            chat_id: msg.chat_id,
            sender_id: msg.sender_id,
            text: msg.text ?? null,
            file: msg.file ?? null,
            timestamp: msg.created_at,
            is_deleted: msg.is_deleted,
            sender: msg.sender,
            is_self: msg.sender_id === userId,
            is_system:  msg.sender === null,
            edited: false,
          },
        ]);
      }

      if (msg.type_of_message === 1) {
        setMessages((p) =>
          p.map((m) =>
            m.id === msg.message_id
              ? {
                  ...m,
                  text: msg.text,
                  timestamp: msg.updated_at,
                  edited: true,
                  is_system: false,
                  is_deleted: msg.is_deleted,
                }
              : m
          )
        );
      }
      if (msg.type_of_message === 2) {
        setMessages((p) =>
          p.map((m) =>
            m.id === msg.message_id
              ? {
                  ...m,
                  text: msg.text,
                  timestamp: msg.updated_at,
                  edited: true,
                  is_system: false,
                  is_deleted: true
                }
              : m
          )
        );
      }

      if (msg.type_of_message === 3) {
        if (msg.sender_id === userId) return;

        const now = Date.now();

        setTypingUsers((prev) => ({
          ...prev,
          [msg.sender_id]: now,
        }));
      }

      if (msg.type_of_message === 4) {
        setSomeoneReadUpTo((prev) =>
          Math.max(prev, msg.last_read_message_id)
        );
      }
}
    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, userId]);

  useEffect(() => {
  const TYPING_TTL = 700; // 0.7 секунды

  const interval = setInterval(() => {
    const now = Date.now();

    setTypingUsers((prev) => {
      const next: TypingMap = {};

      for (const [userId, ts] of Object.entries(prev)) {
        if (now - ts < TYPING_TTL) {
          next[Number(userId)] = ts;
        }
      }

      return next;
    });
  }, 200); // проверяем 5 раз в секунду

  return () => clearInterval(interval);
}, []);


  // ================= SEND =================
  const send = (e) => {
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

  // ================= EDIT MESSAGE =================
  const startEdit = (m: any) => {
    if (!m.is_self) return;
    if (m.file) return;
    setEditingId(m.id);
    setEditingText(m.text);
  };

  const saveEdit = async () => {
    if (!editingText.trim() || editingId === null) return;

    await fetchWithAuth(`${API}/messages/${editingId}/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: editingText,
      }),
    });

    // обновление придёт через WS
    setEditingId(null);
  };

  // ================= LEAVE CHAT =================
  const leaveChat = async () => {
    await fetchWithAuth(`${API}/chats/${chat.id}/me/delete/`, {
      method: "DELETE",
    });
    onBack();
  };

  // ================= ADD USER =================

  const openAddUserModal = async () => {
  setAddUserOpen(true);
  setAddUserError("");
  setSelectedUserId("");
  setLoadingUsers(true);

  try {
    const res = await fetchWithAuth(`${API}/users/get_all_users/`, {
      method: "POST",
    });
    const data = await res.json();
    setAllUsers(Array.isArray(data.data) ? data.data : []);
  } catch (e) {
    setAddUserError("Не удалось загрузить список пользователей");
  } finally {
    setLoadingUsers(false);
  }
};


  const addSelectedUser = async () => {
  if (!selectedUserId) {
    setAddUserError("Выберите пользователя");
    return;
  }

  setAddUserError("");

  try {
    const res = await fetchWithAuth(`${API}/chats/add_user/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(selectedUserId), chat_id: chat.id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));

      const errorText =
        data?.description ||
        data?.errors?.[0]?.message ||
        data?.message ||
        "Ошибка добавления пользователя";

      setAddUserError(errorText);
      return;
    }


    const u = allUsers.find((x) => x.id === Number(selectedUserId));
    if (u) setMembers((p) => [...p, u]);

    setAddUserOpen(false);
  } catch {
    setAddUserError("Ошибка соединения с сервером");
  }
};

  const deleteMessage = async (id: number) => {
    if (!window.confirm("Удалить сообщение?")) return;

    await fetchWithAuth(`${API}/messages/${id}/`, {
      method: "DELETE",
    });
    // обновление придёт через WS
  };


const renderMessageContent = (m: Message) => {
  if (m.is_deleted) {
    return (
      <span className="italic text-gray-700 select-none">
        Сообщение удалено
      </span>
    );
  }

  if (m.file) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">
          📎 {m.file.filename}
        </div>
        <a
          href={m.file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline text-xs"
        >
          Скачать
        </a>
      </div>
    );
  }

if (editingId === m.id) {
  return (
    <input
      className="flex-1 border rounded px-2 py-1 "
      value={editingText}
      autoFocus
      onChange={(e) => setEditingText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveEdit();
        }

        if (e.key === "Escape") {
          setEditingId(null);
          setEditingText("");
        }
      }}
      onBlur={() => {
        setEditingId(null);
        setEditingText("");
      }}
    />
  );
}

  return <div onDoubleClick={() => startEdit(m)}>{m.text}</div>;
};

const renderSystemMessage = (m: Message) => {
  return (
    <div className="flex justify-center my-4">
      <span className="text-xs text-gray-400 italic text-center max-w-[70%]">
        {m.text}
      </span>
    </div>
  );
};

useEffect(() => {
  const onScroll = () => {
    const now = Date.now();
    if (now - lastSentReadRef.current < 1000) return;

    const lastVisible = getLastVisibleForeignMessageId();
    if (!lastVisible) return;

    if (lastVisible <= lastReadMessageIdRef.current) return;

    lastReadMessageIdRef.current = lastVisible;
    lastSentReadRef.current = now;

    fetchWithAuth(`${API}/messages/read/${lastVisible}/`, {
      method: "POST",
    }).catch(() => {});
  };

  window.addEventListener("scroll", onScroll);
  return () => window.removeEventListener("scroll", onScroll);
}, [messages, userId]);

const sendFile = async () => {
  if (!selectedFile) return;

  const form = new FormData();
  form.append("file", selectedFile);
  try {


    await fetchWithAuth(
        `${API}/messages/${chat.id}/file/`,
        {
          method: "POST",
          body: form,
        }
    );

    setSelectedFile(null);
  } catch {
  alert("Не удалось отправить файл");
}
};

const sendTyping = () => {
  const now = Date.now();
  if (now - lastTypingRef.current < 500) return;

  lastTypingRef.current = now;

  fetchWithAuth(
    `${API}/chats/${chat.id}/${userId}/typing/`,
    { method: "POST" }
  ).catch(() => {});
};

const getLastVisibleForeignMessageId = () => {
  let lastVisibleId: number | null = null;

  for (const m of messages) {
    if (m.sender_id === userId) continue;

    const el = messageRefs.current[m.id];
    if (!el) continue;

    const rect = el.getBoundingClientRect();
    if (rect.bottom <= window.innerHeight) {
      lastVisibleId = m.id;
    }
  }

  return lastVisibleId;
};

const [creatingTask, setCreatingTask] = useState(false);

const isCreator = (task: any) => {

  return task.creator?.id === userId;

};

const isAssignee = (task: any) => {

  return task.assignments?.some((a: any) => a.user_id === userId);

};

const updateTask = async () => {
  if (!editingTaskId) return;

  try {
    const res = await fetchWithAuth(`${API}/tasks/${editingTaskId}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: editingTaskTitle,
        description: editingTaskDescription,
        status: editingTaskStatus,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.description || "Ошибка обновления");
      return;
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === editingTaskId
          ? {
              ...t,
              title: editingTaskTitle,
              description: editingTaskDescription,
              status: editingTaskStatus, // ← ДОБАВЬ
            }
          : t
      )
    );

    setEditingTaskId(null);
  } catch {
    alert("Ошибка сети");
  }
};

const loadTasks = async () => {
  setLoadingTasks(true);

  try {
    const res = await fetchWithAuth(
      `${API}/tasks/?chat_id=${chat.id}`
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert("Ошибка загрузки задач");
      return;
    }

    setTasks(data.data || []);
  } catch {
    alert("Ошибка сети");
  } finally {
    setLoadingTasks(false);
  }
};

const createTask = async () => {
  if (!taskTitle.trim()) {
    alert("Введите название задачи");
    return;
  }

  if (!taskMessageId) {
    alert("Ошибка: нет message_id");
    return;
  }

  if (creatingTask) return;

  setCreatingTask(true);

  try {
    const res = await fetchWithAuth(`${API}/tasks/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: taskTitle,
        description: taskDescription,
        chat_id: chat.id,
        message_id: taskMessageId,
        assignee_ids: taskAssignees,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error =
        data?.description ||
        data?.errors?.[0]?.message ||
        "Ошибка создания задачи";

      alert(error);
      return;
    }

    // reset state
    setTaskModalOpen(false);
    setTaskTitle("");
    setTaskDescription("");
    setTaskAssignees([]);
    setTaskMessageId(null);

    alert("Задача создана");
  } catch {
    alert("Ошибка сети");
  } finally {
    setCreatingTask(false);
  }
};

useEffect(() => {
  if (initialScrollDoneRef.current) return;
  if (!messages.length) return;

  if (chat.last_read_message_id) {
    const el = messageRefs.current[chat.last_read_message_id];
    if (el) {
      el.scrollIntoView({ block: "center" });
    } else {
      bottomRef.current?.scrollIntoView();
    }
  } else {
    bottomRef.current?.scrollIntoView();
  }

  initialScrollDoneRef.current = true;
}, [messages, chat.id]);

useEffect(() => {
  setTypingUsers({});
}, [chat.id]);


  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* HEADER */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Назад
          </button>

          <span className="text-gray-900 font-semibold text-lg">
            Чат #{chat.id}
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setTasksModalOpen(true);
                loadTasks();
              }}
              className="text-sm text-purple-600"
            >
              📋 Задачи
            </button>

            {chat.chat_type !== "private"  && (
              <button
                onClick={openAddUserModal}
                className="text-sm text-blue-600"
              >
                + Добавить
              </button>
            )}

            <button
              onClick={leaveChat}
              className="text-sm text-red-600"
            >
              Выйти
            </button>

            <span className={connected ? "text-green-600" : "text-gray-400"}>
              Онлайн
            </span>
          </div>
        </div>

        {/* MEMBERS */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 flex-wrap">
          {members.map((u) => (
            <div
              key={u.id}
              onClick={() => setProfileUser(u)}
              className={`px-3 py-1 rounded-full cursor-pointer text-white text-sm ${avatarColor(
                u.id
              )}`}
            >
              {safeName(u)}
            </div>
          ))}
        </div>
      </header>

      {/* MESSAGES */}
       {/* MESSAGES */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4">
          {messages.map((m) => {
            const isReadBySomeone = m.id <= someoneReadUpTo;
  // ===== SYSTEM MESSAGE =====
  if (m.is_system) {
    return (
      <div key={m.id}>
        {renderSystemMessage(m)}
      </div>
    );
  }



  // ===== USER MESSAGE =====
  return (
    <div
      key={m.id}
      ref={(el) => (messageRefs.current[m.id] = el)}
      className={`flex mb-3 ${
        m.is_self ? "justify-end" : "justify-start"
      }`}
    >

      {!m.is_self && (
        <div
          className={`w-11 h-11 mr-3 rounded-full flex items-center justify-center text-white font-bold ${avatarColor(
            m.sender_id
          )}`}
        >
          {safeName(m.sender)[0]}
        </div>
      )}

      <div
        className={`relative max-w-[70%] p-3 rounded-2xl text-sm group ${
          m.is_deleted
            ? "bg-gray-200 text-gray-700"
            : m.is_self
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-900"
        }`}
      >
        {renderMessageContent(m)}

      {!m.is_deleted && (
  <>
    {/* DELETE */}
    {m.is_self && (
      <button
        onClick={() => deleteMessage(m.id)}
        className="absolute -top-2 -right-2 hidden group-hover:block text-xs bg-red-600 text-white rounded-full px-1.5"
      >
        🗑
      </button>
    )}

    {/* CREATE TASK */}
    <button
      onClick={() => {
        setTaskModalOpen(true);
        setTaskMessageId(m.id);
        setTaskTitle(m.text || "");
        setTaskDescription("");
        setTaskAssignees([]);
      }}
      className="absolute -top-2 -left-2 hidden group-hover:block text-xs bg-green-600 text-white rounded-full px-1.5"
      title="Создать задачу"
    >
      📌
    </button>
  </>
)}


        <div className="text-xs opacity-70 mt-1 text-right flex gap-1 justify-end items-center">
        <span>{formatDateTime(m.timestamp)}</span>

        {!m.is_deleted && m.edited && <span>· изменено</span>}

        {m.is_self && (
          <span className="ml-1">
            {isReadBySomeone ? "✔✔" : "✔"}
          </span>
        )}
      </div>
      </div>
    </div>
  );
})}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* FOOTER */}
      <div className="border-t bg-white">
  {/* typing placeholder */}
  <div className="h-8 mx-4 mt-2">
    {typingIds.length > 0 && (
      <div className="px-3 py-1 rounded-md bg-gray-100 text-sm text-gray-600 italic">
        {typingIds
          .map((id) => {
            const u = members.find((x) => x.id === id);
            return u ? safeName(u) : "Кто-то";
          })
          .join(", ")}{" "}
        печатает…
      </div>
    )}
  </div>

  {/* input */}
<form
  onSubmit={(e) => {
    e.preventDefault();
    if (selectedFile) {
      sendFile();
    } else {
      send(e);
    }
  }}
  className="p-4"
>
  <div className="max-w-4xl mx-auto flex gap-2 items-center">

    {/* FILE INPUT (скрытый) */}
    <input
      type="file"
      id="file-input"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) setSelectedFile(f);
      }}
    />

    {/* FILE BUTTON */}
    <label
      htmlFor="file-input"
      className="cursor-pointer text-xl px-2 select-none"
      title="Прикрепить файл"
    >
      📎
    </label>

    {/* TEXT INPUT */}
    <input
      value={newMessage}
      onChange={(e) => {
        setNewMessage(e.target.value);
        sendTyping();
      }}
      placeholder={
        selectedFile
          ? `Файл: ${selectedFile.name}`
          : "Введите сообщение..."
      }
      disabled={!!selectedFile}
      className="flex-1 border rounded-xl px-4 py-2 text-gray-900
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />

    {/* SEND */}
    <button
      type="submit"
      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl"
    >
      ➤
    </button>
  </div>
</form>
</div>
  {tasksModalOpen && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white p-4 rounded w-[500px] max-h-[80vh] overflow-y-auto text-gray-900">

      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-lg">
          Задачи чата #{chat.id}
        </h3>

        <button
          onClick={() => setTasksModalOpen(false)}
          className="text-sm text-gray-500"
        >
          ✕
        </button>
      </div>

      {loadingTasks && (
        <div className="text-sm text-gray-500">
          Загрузка...
        </div>
      )}

      {!loadingTasks && tasks.length === 0 && (
        <div className="text-sm text-gray-500">
          Нет задач
        </div>
      )}

{!loadingTasks && tasks.map((t) => {

  const assignees =
    t.assignments?.map((a: any) => safeName(a.user)) || [];

  const creatorName = safeName(t.creator);
  const isMeAssigned = t.assignments?.some(
    (a: any) => a.user_id === userId
  );

  return (
    <div
      key={t.id}
      className={`border rounded p-3 mb-2 ${
        isMeAssigned ? "border-green-500 bg-green-50" : ""
      }`}
    >
      {/* ===== EDIT MODE ===== */}
      {editingTaskId === t.id ? (
        <>
          <input
            value={editingTaskTitle}
            onChange={(e) => setEditingTaskTitle(e.target.value)}
            className="w-full border rounded p-1 mb-1"
          />

          <textarea
            value={editingTaskDescription}
            onChange={(e) => setEditingTaskDescription(e.target.value)}
            className="w-full border rounded p-1 mb-1"
          />

          <div className="flex gap-2">
            <button
              onClick={updateTask}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
            >
              Сохранить
            </button>

            <button
              onClick={() => setEditingTaskId(null)}
              className="text-xs bg-gray-300 px-2 py-1 rounded"
            >
              Отмена
            </button>
          </div>

          {(isCreator(t) || isAssignee(t)) && (
              <select
                value={editingTaskStatus}
                onChange={(e) => setEditingTaskStatus(e.target.value)}
                className="text-xs border rounded px-1 py-0.5 mt-1"
              >
              <option value="NEW">NEW</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          )}
        </>
      ) : (
        <>
          {/* TITLE */}
          <div className="font-medium text-base">
            {t.title}
          </div>

          {/* DESCRIPTION */}
          {t.description && (
            <div className="text-sm text-gray-600 mt-1">
              {t.description}
            </div>
          )}

          {/* META */}
          <div className="text-xs text-gray-500 mt-2 flex flex-col gap-1">

            <div>
              👤 Назначил:{" "}
              <span className="font-medium">
                {creatorName}
              </span>
            </div>

            <div>
              👥 Исполнители:{" "}
              {assignees.length > 0
                ? assignees.join(", ")
                : "—"}
            </div>

<div className="flex items-center gap-2">
  <span>Статус:</span>

  {(isCreator(t) || isAssignee(t)) ? (
    <select
      value={t.status}
      onChange={async (e) => {
      const newStatus = e.target.value;

      setTasks((prev) =>
        prev.map((task) =>
          task.id === t.id
            ? { ...task, status: newStatus }
            : task
        )
      );

      try {
        await fetchWithAuth(`${API}/tasks/${t.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch {
        // rollback (иначе рассинхрон)
        setTasks((prev) =>
          prev.map((task) =>
            task.id === t.id
              ? { ...task, status: t.status }
              : task
          )
        );
      }
    }}
      className="text-xs border rounded px-1 py-0.5"
    >
      <option value="NEW">NEW</option>
      <option value="IN_PROGRESS">IN_PROGRESS</option>
      <option value="DONE">DONE</option>
      <option value="CANCELLED">CANCELLED</option>
    </select>
  ) : (
    <span>{t.status}</span>
  )}

  <select
  value={t.priority}
  onChange={async (e) => {
    const newPriority = e.target.value;

    setTasks((prev) =>
      prev.map((task) =>
        task.id === t.id
          ? { ...task, priority: newPriority }
          : task
      )
    );

    try {
      await fetchWithAuth(`${API}/tasks/${t.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
    } catch {
      // rollback
      setTasks((prev) =>
        prev.map((task) =>
          task.id === t.id
            ? { ...task, priority: t.priority }
            : task
        )
      );
    }
  }}
  className="text-xs border rounded px-1 py-0.5"
>
  <option value="LOW">LOW</option>
  <option value="MEDIUM">MEDIUM</option>
  <option value="HIGH">HIGH</option>
</select>
</div>
          </div>

          {/* ACTION */}
          {isCreator(t) && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => {
                  setEditingTaskId(t.id);
                  setEditingTaskTitle(t.title || "");
                  setEditingTaskDescription(t.description || "");
                  setEditingTaskStatus(t.status);
                }}
                className="text-xs text-blue-600"
              >
                ✏️ Редактировать
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
})}

    </div>
  </div>
  )}
      {taskModalOpen && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white p-4 rounded w-96 text-gray-900">
      <h3 className="font-semibold text-lg mb-3">
        Создать задачу
      </h3>

      <input
        value={taskTitle}
        onChange={(e) => setTaskTitle(e.target.value)}
        placeholder="Название"
        className="w-full border rounded p-2 mb-2"
      />

      <textarea
        value={taskDescription}
        onChange={(e) => setTaskDescription(e.target.value)}
        placeholder="Описание"
        className="w-full border rounded p-2 mb-2"
      />

      <div className="mb-2">
        <div className="text-sm mb-1">Исполнители:</div>

        {members.map((u) => (
          <label key={u.id} className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={taskAssignees.includes(u.id)}
              onChange={(e) => {
                if (e.target.checked) {
                setTaskAssignees((p) =>
                                p.includes(u.id) ? p : [...p, u.id]
                              );
                } else {
                  setTaskAssignees((p) =>
                    p.filter((id) => id !== u.id)
                  );
                }
              }}
            />
            {safeName(u)}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={() => setTaskModalOpen(false)}
          className="px-3 py-1 bg-gray-200 rounded"
        >
          Отмена
        </button>

        <button
        onClick={createTask}
        disabled={!taskTitle.trim() || creatingTask}
        className={`px-3 py-1 rounded text-white ${
          creatingTask || !taskTitle.trim()
            ? "bg-gray-400"
            : "bg-blue-600"
        }`}
      >
        {creatingTask ? "Создание..." : "Создать"}
      </button>
      </div>
    </div>
  </div>
)}

      {/* PROFILE MODAL */}
      {profileUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded w-80">
            <h3 className="font-semibold text-lg mb-2 text-blue-700">
              {safeName(profileUser)}
            </h3>
            <div className="text-s text-blue-700">
              Email: {profileUser.email || "—"}
            </div>
            <div className="text-s text-blue-700">
              Phone: {profileUser.phone || "—"}
            </div>
            <button
              className="mt-4 text-sm text-blue-600"
              onClick={() => setProfileUser(null)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {addUserOpen && chat.chat_type !== "private" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded w-96 text-gray-900">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">
              Добавить пользователя
            </h3>

            {loadingUsers ? (
              <div className="text-sm text-gray-600">
                Загрузка списка пользователей...
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border rounded p-2 text-gray-900 bg-white"
              >
                <option value="">— Выберите пользователя —</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {safeName(u)}
                  </option>
                ))}
              </select>
            )}

            {addUserError && (
              <div className="mt-2 text-sm text-red-600">
                {addUserError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setAddUserOpen(false)}
                className="px-3 py-1.5 rounded text-gray-700 bg-gray-200"
              >
                Отмена
              </button>
              <button
                onClick={addSelectedUser}
                className="px-3 py-1.5 rounded bg-blue-600 text-white"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
