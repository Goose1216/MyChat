import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../Websocket";
import { fetchWithAuth, apiBase } from "../api";
import type { Message } from "../types";

export default function ChatScreen({ userId, chat, onBack }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // === added from old version ===
  const [profileUser, setProfileUser] = useState<any | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [addUserError, setAddUserError] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(false);

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
          timestamp: m.updated_at || m.created_at,
          sender: m.sender,
          is_self: m.sender_id !== null && m.sender_id === userId,
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
            text: msg.text,
            timestamp: msg.created_at,
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
                }
              : m
          )
        );
      }
    };

    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ================= SEND =================
  const send = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessage({ chat_id: chat.id, text: newMessage });
    setNewMessage("");
  };

  // ================= EDIT MESSAGE =================
  const startEdit = (m: any) => {
    if (!m.is_self) return;
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
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4">
          {messages.map((m) => {
            if (m.is_system) {
              return (
                <div key={m.id} className="text-center my-4">
                  <span className="text-xs text-gray-500 italic">
                    {m.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={m.id}
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
                  className={`max-w-[70%] p-3 rounded-2xl text-sm ${
                    m.is_self
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {editingId === m.id ? (
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border rounded px-2 py-1 text-white"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <button
                        onClick={saveEdit}
                        className="bg-green-600 text-white px-2 rounded"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <div onDoubleClick={() => startEdit(m)}>
                      {m.text}
                    </div>
                  )}

                  <div className="text-xs opacity-70 mt-1 text-right">
                    {formatDateTime(m.timestamp)}
                    {m.edited && " · изменено"}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* INPUT */}
      <form onSubmit={send} className="border-t bg-white p-4">
        <div className="max-w-4xl mx-auto flex gap-2 ">
          <input
            className="flex-1 border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 text-black"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Введите сообщение..."
          />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl">
            ➤
          </button>
        </div>
      </form>

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
