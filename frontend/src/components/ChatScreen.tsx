import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../Websocket.tsx";
import { fetchWithAuth } from "../api";
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
  const [newMessage, setNewMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetchWithAuth(`${API}/chats/${chat.id}/messages`);
        const data = await res.json();
        setMessages(
          data.map((m: any) => ({
            id: m.id,
            text: m.content,
            sender_id: m.sender_id,
            chat_id: m.chat_id,
            is_self: m.sender_id === userId,
            timestamp: m.created_at || new Date().toISOString(),
          }))
        );
      } catch (err) {
        console.error("Ошибка загрузки истории:", err);
      }
    };

    loadHistory();
  }, [chat.id]);

  useEffect(() => {
    const handler = (data: any) => {
      if (data.chat_id === chat.id && data.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            text: data.text,
            sender_id: data.sender_id,
            chat_id: data.chat_id,
            is_self: data.sender_id === userId,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };

    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, addHandler, removeHandler]);

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
    <div className="min-h-screen flex flex-col">
      <header className="bg-white p-4 border-b flex items-center gap-3">
        <button onClick={onBack} className="text-blue-600">
          ← Назад
        </button>
        <h2 className="font-semibold">Чат #{chat.id}</h2>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full overflow-y-auto">
        <div className="bg-white rounded shadow p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-gray-500 text-center py-10">Нет сообщений</div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.is_self ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`p-3 rounded-2xl max-w-[70%] ${
                  m.is_self
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <div>{m.text}</div>
                <div className="text-xs mt-1 opacity-70">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      <form onSubmit={send} className="p-4 border-t bg-white">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            className="flex-1 border rounded px-3 py-2"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Введите сообщение..."
          />
          <button
            type="submit"
            className={`px-4 py-2 rounded text-white ${
              connected ? "bg-blue-600" : "bg-gray-400"
            }`}
          >
            {">"}
          </button>
        </div>
      </form>
    </div>
  );
}
