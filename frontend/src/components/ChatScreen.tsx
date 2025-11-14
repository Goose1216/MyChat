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
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addError, setAddError] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = apiBase();

  const safeName = (u: any) =>
    u ? u.username || u.email || `user_${u.id ?? "?"}` : "Unknown";

  // ========== ЗАГРУЗКА УЧАСТНИКОВ ==========
  const loadMembers = async () => {
    try {
      const res = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
      const resData = await res.json().catch(() => ({}));
      const membersList = Array.isArray(resData?.data) ? resData.data : [];
      setMembers(membersList);
    } catch (err) {
      console.error("Ошибка загрузки участников:", err);
      setMembers([]);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [chat.id]);

  // ========== ЗАГРУЗКА ИСТОРИИ СООБЩЕНИЙ ==========
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

  useEffect(() => {
    loadMessages();
  }, [chat.id, userId]);

  // ========== WebSocket ==========
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
          is_self: msg.sender_id === userId,
        },
      ]);
    };

    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, userId, addHandler, removeHandler]);

  // ========== Автоскролл ==========
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ========== Отправка сообщения ==========
  const send = (e?: React.FormEvent) => {
    e?.preventDefault();

    const text = newMessage.trim();
    if (!text || !connected) return;

    sendMessage({ chat_id: chat.id, text });
    setNewMessage("");
  };

  // ========== Открытие модалки добавления ==========
  const openAddModal = async () => {
    setShowAddModal(true);
    setAddError("");
    setLoadingUsers(true);

    try {
      const res = await fetchWithAuth(`${API}/users/get_all_users/`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      const usersList = Array.isArray(data?.data) ? data.data : [];
      setUsers(usersList);
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
      setAddError("Не удалось загрузить список пользователей");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // ========== ДОБАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ==========
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
        body: JSON.stringify({
          chat_id: chat.id,
          user_id: Number(selectedUserId),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const resMembers = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
        const resMembersJson = await resMembers.json().catch(() => ({}));
        const updated = Array.isArray(resMembersJson?.data)
          ? resMembersJson.data
          : [];

        setMembers(updated);
        setShowAddModal(false);
        setSelectedUserId("");
        return;
      }


      const msg =
        data?.description ||
        data?.message ||
        data?.errors?.[0]?.message ||
        "Ошибка при добавлении пользователя";

      setAddError(msg);
    } catch (err) {
      console.error("Ошибка при добавлении пользователя:", err);
      setAddError("Ошибка соединения");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm p-4 border-b flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-blue-600 hover:text-blue-800 transition"
            >
              ← Назад
            </button>
            <h2 className="font-semibold text-lg text-gray-800">
              {chat.title || `Чат #${chat.id}`}
            </h2>
          </div>
          <div
            className={`text-sm font-medium ${
              connected ? "text-green-600" : "text-gray-400"
            }`}
          >
            {connected ? "Онлайн" : "Оффлайн"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-1 items-center">
          {members.length === 0 ? (
            <div className="text-sm text-gray-400 italic">
              Загрузка участников...
            </div>
          ) : (
            members.map((u) => (
              <div
                key={`member_${u.id}`}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition rounded-full px-3 py-1 text-sm text-gray-800"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                  {safeName(u).charAt(0).toUpperCase()}
                </div>
                <span>
                  {safeName(u)}
                  {u?.id === userId && " (Вы)"}
                </span>
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
        </div>
      </header>

      {/* МОДАЛКА */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 text-center">
              Добавить пользователя
            </h3>

            {loadingUsers ? (
              <div className="text-gray-500 text-center py-4">
                Загрузка списка пользователей...
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Выберите пользователя --</option>
                {users.map((u) => (
                  <option key={`usr_${u.id}`} value={u?.id ?? ""}>
                    {safeName(u)}
                  </option>
                ))}
              </select>
            )}

            {addError && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-2">
                {addError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* СООБЩЕНИЯ */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
          {loading ? (
            <div className="text-gray-500 text-center py-10">
              Загрузка сообщений...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-gray-500 text-center py-10">
              Нет сообщений
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.is_self ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 rounded-2xl max-w-[70%] text-sm ${
                    m.is_self
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-gray-100 text-gray-900 rounded-bl-none"
                  } shadow`}
                >
                  <div>{m.text}</div>
                  <div className="text-xs mt-1 opacity-70 text-right">
                    {new Date(m.timestamp).toLocaleDateString([], {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}{" "}
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
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
            className={`px-4 py-2 rounded-2xl shadow text-white font-semibold transition ${
              connected
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
