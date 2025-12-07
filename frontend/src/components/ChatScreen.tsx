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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = apiBase();

  const safeName = (u: any) =>
    u ? u.username || u.email || `user_${u.id ?? "?"}` : "Unknown";

  const avatarColor = (id: number) => {
    const colors = ["bg-blue-500", "bg-green-500", "bg-red-500", "bg-purple-500", "bg-yellow-500"];
    return colors[id % colors.length];
  };

  // Загрузка истории сообщений
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

  useEffect(() => {
    loadMessages();
  }, [chat.id, userId]);

  // WebSocket
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

  // Автоскролл
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !connected) return;

    sendMessage({ chat_id: chat.id, text });
    setNewMessage("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm p-4 border-b flex items-center justify-between">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800">
          ← Назад
        </button>
        <h2 className="font-semibold text-lg text-gray-800">{chat.title || `Чат #${chat.id}`}</h2>
        <div className={`text-sm font-medium ${connected ? "text-green-600" : "text-gray-400"}`}>
          {connected ? "Онлайн" : "Оффлайн"}
        </div>
      </header>

      {/* СООБЩЕНИЯ */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full overflow-y-auto">
        <div className="flex flex-col space-y-3">
          {loading ? (
            <div className="text-gray-500 text-center py-10">Загрузка сообщений...</div>
          ) : messages.length === 0 ? (
            <div className="text-gray-500 text-center py-10">Нет сообщений</div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-2 ${m.is_self ? "justify-end" : "justify-start"}`}
              >
                {!m.is_self && m.sender && (
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-bold shrink-0 ${avatarColor(
                      m.sender.id
                    )}`}
                  >
                    {safeName(m.sender).charAt(0).toUpperCase()}
                  </div>
                )}

                <div
                  className={`p-3 rounded-2xl max-w-[70%] text-sm shadow ${
                    m.is_self
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-gray-100 text-gray-900 rounded-bl-none"
                  }`}
                >
                  {!m.is_self && m.sender && (
                    <div className="text-xs font-semibold text-gray-700 mb-1">
                      {safeName(m.sender)}
                    </div>
                  )}
                  <div>{m.text}</div>
                  <div className="text-xs mt-1 opacity-50 text-right">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {m.is_self && (
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-bold shrink-0 bg-blue-500`}
                  >
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
            className={`px-4 py-2 rounded-2xl shadow text-white font-semibold transition ${
              connected ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
