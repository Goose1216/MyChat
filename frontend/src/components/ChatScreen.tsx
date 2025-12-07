import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../Websocket.tsx";
import { fetchWithAuth, apiBase } from "../api";
import type { Chat, Message } from "../types";

export default function ChatScreen({
  userId,
  chat,
  onBack,
}: {
  userId: number;
  chat: Chat;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addError, setAddError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = apiBase();

  const safeName = (u: any) =>
    u ? u.username || u.email || `user_${u.id ?? "?"}` : "Unknown";

  const avatarColor = (id: number) => {
    const colors = ["bg-blue-500", "bg-green-500", "bg-red-500", "bg-purple-500", "bg-yellow-500"];
    return colors[id % colors.length];
  };

  // ====== Загрузка сообщений ======
  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API}/chats/${chat.id}/messages`);
      const resData = await res.json().catch(() => ({}));
      const messagesList = Array.isArray(resData?.data) ? resData.data : [];

      setMessages(
        messagesList.map((m: any) => ({
          id: m.id,
          chat_id: m.chat_id,
          sender_id: m.sender_id,
          text: m.content,
          timestamp: m.created_at,
          sender: m.sender,
          is_self: m.sender_id === userId,
        }))
      );
    } catch (err) {
      console.error("Ошибка загрузки истории:", err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // ====== Загрузка участников ======
  const loadMembers = async () => {
    try {
      const res = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
      const data = await res.json().catch(() => ({}));
      setMembers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error("Ошибка загрузки участников:", err);
      setMembers([]);
    }
  };

  useEffect(() => {
    loadMessages();
    loadMembers();
  }, [chat.id, userId]);

  // ====== WebSocket ======
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.chat_id !== chat.id || !msg.text) return;

      setMessages((prev) => [
        ...prev,
        {
          id: msg.id ?? Date.now() + Math.random(),
          chat_id: msg.chat_id,
          sender_id: msg.sender_id,
          text: msg.text,
          timestamp: msg.created_at,
          sender: msg.sender,
          is_self: msg.sender_id === userId,
        },
      ]);
    };

    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, userId, addHandler, removeHandler]);

  // ====== Автоскролл ======
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ====== Отправка сообщения ======
  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !connected) return;

    sendMessage({ chat_id: chat.id, text });
    setNewMessage("");
  };

  // ====== Добавление участников ======
  const openAddModal = async () => {
    setShowAddModal(true);
    setAddError("");
    setLoadingUsers(true);
    try {
      const res = await fetchWithAuth(`${API}/users/get_all_users/`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setUsers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setAddError("Не удалось загрузить пользователей");
    } finally {
      setLoadingUsers(false);
    }
  };

  const leaveChat = async () => {
  try {
    const res = await fetchWithAuth(`${API}/chats/${chat.id}/me/delete/`, {
      method: "POST",
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      onBack();
      return;
    }

    let msg = "Ошибка выхода";

    if (data?.description) msg = data.description;
    else if (Array.isArray(data?.errors) && data.errors.length > 0)
      msg = data.errors[0]?.message || msg;
    else if (data?.message) msg = data.message;

    alert(msg);
  } catch (e) {
    console.error(e);
    alert("Ошибка соединения");
  }
};


  const handleAddUser = async () => {
  if (!selectedUserId) {
    setAddError("Выберите пользователя");
    return;
  }

  setAddError("");

  try {
    const res = await fetchWithAuth(`${API}/chats/add_user/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat.id, user_id: Number(selectedUserId) }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      await loadMembers();
      setShowAddModal(false);
      setSelectedUserId("");
      return;
    }

    let errorMessage = "Ошибка добавления";
    if (data?.description) {
      errorMessage = data.description;
    } else if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      errorMessage = data.errors[0]?.message || errorMessage;
    } else if (data?.message) {
      errorMessage = data.message;
    }

    setAddError(errorMessage);
  } catch (err) {
    console.error(err);
    setAddError("Ошибка соединения");
  }
};


  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm p-4 border-b flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← Назад</button>
            <h2 className="font-semibold text-lg text-gray-800">{chat.title || `Чат #${chat.id}`}</h2>
          </div>
          <div className={`text-sm font-medium ${connected ? "text-green-600" : "text-gray-400"}`}>
            {connected ? "Онлайн" : "Оффлайн"}
          </div>
        </div>

        {/* Участники */}
        <div className="flex flex-wrap gap-2 mt-1 items-center">
          {members.length === 0 ? (
            <div className="text-sm text-gray-400 italic">Загрузка участников...</div>
          ) : (
            members.map((u) => (
              <div key={u.id} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition rounded-full px-3 py-1 text-sm text-gray-800">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarColor(u.id)}`}>
                  {safeName(u).charAt(0).toUpperCase()}
                </div>
                <span>{safeName(u)}{u?.id === userId && " (Вы)"}</span>
              </div>
            ))
          )}

          {chat.chat_type !== "private" && (
            <button
              onClick={openAddModal}
              className="ml-2 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 transition"
            >
              + Добавить
            </button>

          )}
          <button
            onClick={leaveChat}
            className="ml-2 text-sm bg-red-600 text-white px-3 py-1.5 rounded-full hover:bg-red-700 transition"
          >
            Выйти
        </button>

        </div>
      </header>

      {/* MODAL: Добавление пользователя */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 text-center">Добавить пользователя</h3>

            {loadingUsers ? (
              <div className="text-gray-500 text-center py-4">Загрузка списка пользователей...</div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Выберите пользователя --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{safeName(u)}</option>
                ))}
              </select>
            )}

            {addError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-2">{addError}</div>}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition">Отмена</button>
              <button onClick={handleAddUser} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition">Добавить</button>
            </div>
          </div>
        </div>
      )}

      {/* СООБЩЕНИЯ */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full overflow-y-auto">
        <div className="flex flex-col space-y-3">
          {loading ? (
            <div className="text-gray-500 text-center py-10">Загрузка сообщений...</div>
          ) : messages.length === 0 ? (
            <div className="text-gray-500 text-center py-10">Нет сообщений</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-2 ${m.is_self ? "justify-end" : "justify-start"}`}>
                {!m.is_self && m.sender && (
                  <div className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-bold shrink-0 ${avatarColor(m.sender.id)}`}>
                    {safeName(m.sender).charAt(0).toUpperCase()}
                  </div>
                )}

                <div className={`p-3 rounded-2xl max-w-[70%] text-sm shadow ${m.is_self ? "bg-blue-600 text-white rounded-br-none" : "bg-gray-100 text-gray-900 rounded-bl-none"}`}>
                  {!m.is_self && m.sender && (
                    <div className="text-xs font-semibold text-gray-700 mb-1">{safeName(m.sender)}</div>
                  )}
                  <div>{m.text}</div>
                  <div className="text-xs mt-1 opacity-50 text-right">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                {m.is_self && (
                  <div className="w-10 h-10 flex items-center justify-center rounded-full text-white font-bold shrink-0 bg-blue-500">
                    {safeName({ username: "Вы" }).charAt(0)}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* INPUT */}
      <form onSubmit={send} className="p-4 border-t bg-white">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            className="flex-1 border rounded-2xl px-4 py-2 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Введите сообщение..."
          />
          <button
            type="submit"
            className={`px-4 py-2 rounded-2xl shadow text-white font-semibold transition ${connected ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
