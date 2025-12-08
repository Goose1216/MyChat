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
  const [viewedUserId, setViewedUserId] = useState<number | null>(null);
  const [viewedUser, setViewedUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addError, setAddError] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = apiBase();

  const safeName = (u: any) =>
    u ? u.username || u.email || `user_${u.id ?? "?"}` : "Unknown";

  const avatarColor = (id: number) => {
    const colors = ["bg-blue-500", "bg-green-500", "bg-red-500", "bg-purple-500", "bg-yellow-500"];
    return colors[id % colors.length];
  };

  // ====== Загрузка сообщений и участников ======
  useEffect(() => {
    const loadMessages = async () => {
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
            is_system: m.sender_id === null,
          }))
        );
      } catch (err) {
        console.error(err);
        setMessages([]);
      }
    };

    const loadMembers = async () => {
      try {
        const res = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
        const data = await res.json().catch(() => ({}));
        setMembers(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        console.error(err);
        setMembers([]);
      }
    };

    loadMessages();
    loadMembers();
  }, [chat.id]);

  // ====== WebSocket для новых сообщений ======
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
          is_system: msg.sender_id === null,
        },
      ]);
    };
    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, userId]);

  // ====== Автоскролл ======
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ====== Отправка сообщений ======
  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !connected) return;
    sendMessage({ chat_id: chat.id, text });
    setNewMessage("");
  };

  // ====== Модалка чужого пользователя ======
  const openUserModal = async (id: number) => {
    setViewedUserId(id);
    setLoadingUser(true);
    try {
      const res = await fetchWithAuth(`${API}/users/${id}/${chat.id}`);
      const data = await res.json().catch(() => null);
      if (data?.data) {
        setViewedUser({
          ...data.data,
          count_message: data.data.count_message || 0,
          count_message_in_this_chat: data.data.count_message_in_this_chat || 0,
        });
      } else {
        setViewedUser(null);
      }
    } catch (err) {
      console.error(err);
      setViewedUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString([], { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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

  const loadMembers = async () => {
    try {
      const res = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
      const data = await res.json().catch(() => ({}));
      setMembers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setMembers([]);
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
        await loadMembers(); // <-- Обновляем список участников
        setShowAddModal(false);
        setSelectedUserId("");
        return;
      }

      let errorMessage = data?.description || data?.errors?.[0]?.message || data?.message || "Ошибка добавления";
      setAddError(errorMessage);
    } catch (err) {
      console.error(err);
      setAddError("Ошибка соединения");
    }
  };

  const leaveChat = async () => {
    try {
      const res = await fetchWithAuth(`${API}/chats/${chat.id}/me/delete/`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onBack();
        return;
      }
      let msg = data?.description || data?.errors?.[0]?.message || data?.message || "Ошибка выхода";
      alert(msg);
    } catch (err) {
      console.error(err);
      alert("Ошибка соединения");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm p-4 border-b flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← Назад</button>
          <h2 className="font-semibold text-lg text-gray-800">{chat.title || `Чат #${chat.id}`}</h2>
          <div className={`text-sm font-medium ${connected ? "text-green-600" : "text-gray-400"}`}>
            {connected ? "Онлайн" : "Оффлайн"}
          </div>
        </div>

        {/* Участники + кнопки */}
        <div className="flex flex-wrap gap-2 mt-1 items-center">
          {members.map((u) => (
            <div key={u.id} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition rounded-full px-3 py-1 text-sm text-gray-800 cursor-pointer"
                 onClick={() => u.id !== userId && openUserModal(u.id)}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarColor(u.id)}`}>
                {safeName(u).charAt(0).toUpperCase()}
              </div>
              <span>{safeName(u)}{u.id === userId && " (Вы)"}</span>
            </div>
          ))}

          {chat.chat_type !== "private" && (
            <>
              <button
                onClick={openAddModal}
                className="ml-2 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 transition"
              >
                + Добавить
              </button>
              <button
                onClick={leaveChat}
                className="ml-2 text-sm bg-red-600 text-white px-3 py-1.5 rounded-full hover:bg-red-700 transition"
              >
                Выйти
              </button>
            </>
          )}
        </div>
      </header>

      {/* СООБЩЕНИЯ */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full overflow-y-auto">
        {messages.map((m) =>
          m.is_system ? (
            <div key={m.id} className="w-full text-center my-3">
              <div className="text-gray-500 text-xs italic">{m.text}</div>
              <div className="text-gray-400 text-[10px] mt-1">{formatDateTime(m.timestamp)}</div>
            </div>
          ) : (
            <div key={m.id} className={`flex items-start gap-2 mb-3 ${m.is_self ? "justify-end" : "justify-start"}`}>
              {!m.is_self && m.sender && (
                <div className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-bold shrink-0 ${avatarColor(m.sender.id)}`}>
                  {safeName(m.sender).charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`p-3 rounded-2xl max-w-[70%] text-sm shadow ${m.is_self ? "bg-blue-600 text-white rounded-br-none" : "bg-gray-100 text-gray-900 rounded-bl-none"}`}>
                {!m.is_self && m.sender && (
                  <div className="text-xs font-semibold text-gray-700 mb-1 cursor-pointer"
                       onClick={() => openUserModal(m.sender.id)}>
                    {safeName(m.sender)}
                  </div>
                )}
                <div>{m.text}</div>
                <div className="text-xs mt-1 opacity-50 text-right">{formatDateTime(m.timestamp)}</div>
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
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
          <button type="submit" className={`px-4 py-2 rounded-2xl shadow text-white font-semibold transition ${connected ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}>
            ➤
          </button>
        </div>
      </form>

      {/* MODAL ПРОФИЛЯ */}
      {viewedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 text-center">Профиль пользователя</h2>
            {loadingUser ? (
              <div className="text-gray-500 text-center py-4">Загрузка...</div>
            ) : viewedUser ? (
              <div className="space-y-2 text-gray-800">
                <div><b>Логин:</b> {viewedUser.username}</div>
                <div><b>Email:</b> {viewedUser.email}</div>
                <div><b>Телефон:</b> {viewedUser.phone}</div>
                <div><b>Всего сообщений:</b> {viewedUser.count_message}</div>
                <div><b>Сообщений в этом чате:</b> {viewedUser.count_message_in_this_chat}</div>
              </div>
            ) : (
              <div className="text-red-600 text-center">Не удалось загрузить данные</div>
            )}
            <button
              onClick={() => setViewedUserId(null)}
              className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* MODAL ДОБАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
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
    </div>
  );
}
