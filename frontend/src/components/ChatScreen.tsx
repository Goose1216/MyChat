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

  // Загрузка участников чата
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
        if (!res.ok) throw new Error(`Ошибка ${res.status}`);
        const data = await res.json();
        setMembers(data);
      } catch (err) {
        console.error("Ошибка загрузки участников:", err);
      }
    };

    loadMembers();
  }, [chat.id]);

  // Загрузка истории сообщений
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`${API}/chats/${chat.id}/messages`);
        if (!res.ok) throw new Error(`Ошибка ${res.status}`);
        const data = await res.json();
        setMessages(
          data.map((m: any) => ({
            id: m.id,
            text: m.content,
            sender_id: m.sender_id,
            chat_id: m.chat_id,
            is_self: m.sender_id === userId,
            timestamp: m.created_at ,
          }))
        );
      } catch (err) {
        console.error("Ошибка загрузки истории:", err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [chat.id, userId]);

  // WebSocket обработчик сообщений
  useEffect(() => {
    const handler = (data: any) => {
      if (data.chat_id === chat.id && data.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.id ?? Date.now() + Math.random(),
            text: data.text,
            sender_id: data.sender_id,
            chat_id: data.chat_id,
            is_self: data.sender_id === userId,
            timestamp: data.created_at,
          },
        ]);
      }
    };

    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, addHandler, removeHandler, userId]);

  // автопрокрутка вниз
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Отправка сообщения
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !connected) return;

    sendMessage({ chat_id: chat.id, text });
    setNewMessage("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Шапка */}
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
              Чат #{chat.id}
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

        {/* Список участников */}
        <div className="flex flex-wrap gap-2 mt-1">
          {members.length > 0 ? (
            members.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition rounded-full px-3 py-1 text-sm text-gray-800"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                  {(u.username || u.email || `U${u.id}`)
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <span>
                  {u.username || u.email || `user_${u.id}`}
                  {u.id === userId && " (Вы)"}
                </span>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-400 italic">
              Загрузка участников...
            </div>
          )}
        </div>
      </header>

<main className="flex-1 p-4 max-w-4xl mx-auto w-full overflow-y-auto">
  <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
    {loading ? (
      <div className="text-gray-500 text-center py-10">Загрузка сообщений...</div>
    ) : messages.length === 0 ? (
      <div className="text-gray-500 text-center py-10">Нет сообщений</div>
    ) : (
      messages.map((m) => (
        <div key={m.id} className={`flex ${m.is_self ? "justify-end" : "justify-start"}`}>
          <div
            className={`p-3 rounded-2xl max-w-[70%] text-sm ${
              m.is_self
                ? "bg-blue-600 text-white rounded-br-none"
                : "bg-gray-100 text-gray-900 rounded-bl-none"
            } shadow`}
          >
            <div>{m.text}</div>
            <div className="text-xs mt-1 opacity-70 text-right">
              {new Date(m.timestamp).toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })}{" "}
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))
    )}
    <div ref={bottomRef} />
  </div>
</main>

{/* Поле ввода */}
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
