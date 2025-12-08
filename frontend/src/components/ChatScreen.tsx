// ===========================================================
// ===============   FULL WORKING CHAT SCREEN   ===============
// ===========================================================

import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../Websocket.tsx";
import { fetchWithAuth, apiBase } from "../api";
import type { Chat, Message } from "../types";

export default function ChatScreen({ userId, chat, onBack }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    messageId: number | null;
  }>({ x: 0, y: 0, messageId: null });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingStatus, setEditingStatus] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { sendMessage, addHandler, removeHandler, connected } = useWebSocket();
  const API = apiBase();

  const safeName = (u: any) =>
    u ? u.username || u.email || `user_${u.id ?? "?"}` : "Unknown";

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const res = await fetchWithAuth(`${API}/chats/${chat.id}/messages`);
        const data = await res.json();
        const arr = Array.isArray(data.data) ? data.data : [];

        setMessages(
          arr.map((m) => ({
            id: m.id,
            chat_id: m.chat_id,
            sender_id: m.sender_id,
            text: m.content,
            status: m.status,
            timestamp: m.created_at,
            sender: m.sender,
            is_self: m.sender_id === userId,
          }))
        );
      } catch {
        setMessages([]);
      }
    };

    const loadMembers = async () => {
      try {
        const res = await fetchWithAuth(`${API}/chats/${chat.id}/members`);
        const data = await res.json();
        setMembers(Array.isArray(data.data) ? data.data : []);
      } catch {
        setMembers([]);
      }
    };

    loadMessages();
    loadMembers();
  }, [chat.id]);

  // WebSocket handlers
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.chat_id !== chat.id) return;

      // NEW MESSAGE
      if (msg.type === "new_message") {
        setMessages((prev) => [
          ...prev,
          {
            id: msg.id,
            chat_id: msg.chat_id,
            sender_id: msg.sender_id,
            text: msg.text,
            status: msg.status,
            timestamp: msg.created_at,
            sender: msg.sender,
            is_self: msg.sender_id === userId,
          },
        ]);
      }

      // UPDATE MESSAGE
      else if (msg.type === "update_message") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.message_id
              ? {
                  ...m,
                  text: msg.new_text ?? m.text,
                  status: msg.new_status ?? m.status,
                }
              : m
          )
        );
      }

      // DELETE MESSAGE
      else if (msg.type === "delete_message") {
        setMessages((prev) => prev.filter((m) => m.id !== msg.message_id));
      }
    };

    addHandler(handler);
    return () => removeHandler(handler);
  }, [chat.id, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // SEND NEW MESSAGE
  const [newMessage, setNewMessage] = useState("");
  const send = (e) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !connected) return;

    sendMessage({
      type: "new_message",
      chat_id: chat.id,
      text,
    });

    setNewMessage("");
  };

  // RIGHT CLICK MENU
  const openContext = (e, messageId) => {
    e.preventDefault();
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || !msg.is_self) return;

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageId,
    });
  };

  const closeContext = () => setContextMenu({ x: 0, y: 0, messageId: null });

  // DELETE MESSAGE
  const deleteMessage = (id) => {
    sendMessage({
      type: "delete_message",
      chat_id: chat.id,
      message_id: id,
    });
    closeContext();
  };

  // EDIT TEXT INLINE
  const startEdit = (id) => {
    const msg = messages.find((m) => m.id === id);
    setEditingId(id);
    setEditingText(msg.text);
    setEditingStatus(msg.status);
    closeContext();
  };

  const saveEdit = () => {
    sendMessage({
      type: "update_message",
      chat_id: chat.id,
      message_id: editingId,
      new_text: editingText,
      new_status: editingStatus,
    });
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const statuses = ["send", "delivered", "in_work", "completed"];

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm p-4 border-b flex justify-between">
        <button onClick={onBack}>← Назад</button>
        <h2>{chat.title || `Чат #${chat.id}`}</h2>
        <div className={connected ? "text-green-600" : "text-gray-400"}>
          {connected ? "Онлайн" : "Оффлайн"}
        </div>
      </header>

      {/* MESSAGES */}
      <main className="flex-1 p-4 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-3 flex ${
              m.is_self ? "justify-end" : "justify-start"
            }`}
            onContextMenu={(e) => openContext(e, m.id)}
          >
            <div
              className={`p-3 max-w-[70%] rounded-xl ${
                m.is_self ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
            >
              {editingId === m.id ? (
                <div className="space-y-2">
                  <input
                    className="w-full p-1 rounded text-black"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                  />

                  <select
                    className="w-full p-1 rounded text-black"
                    value={editingStatus}
                    onChange={(e) => setEditingStatus(e.target.value)}
                  >
                    {statuses.map((s) => (
                      <option value={s} key={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2 justify-end">
                    <button
                      className="px-2 py-1 bg-green-600 text-white rounded"
                      onClick={saveEdit}
                    >
                      Сохранить
                    </button>
                    <button
                      className="px-2 py-1 bg-gray-400 text-white rounded"
                      onClick={cancelEdit}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>{m.text}</div>
                  <div className="text-xs opacity-60 mt-1">
                    {m.status} • {formatDateTime(m.timestamp)}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      {/* INPUT */}
      <form onSubmit={send} className="p-4 bg-white border-t flex gap-3">
        <input
          className="flex-1 border rounded-xl px-4 py-2"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Введите сообщение..."
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded-xl">
          ➤
        </button>
      </form>

      {/* CONTEXT MENU */}
      {contextMenu.messageId && (
        <div
          className="fixed z-50 bg-white shadow-md border rounded-md w-40"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100"
            onClick={() => startEdit(contextMenu.messageId)}
          >
            ✏ Редактировать
          </button>

          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100"
            onClick={() => deleteMessage(contextMenu.messageId)}
          >
            🗑 Удалить
          </button>

          <button
            className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
            onClick={closeContext}
          >
            Закрыть
          </button>
        </div>
      )}

      <div
        className="fixed inset-0"
        onClick={closeContext}
        onContextMenu={(e) => {
          e.preventDefault();
          closeContext();
        }}
      />
    </div>
  );
}
