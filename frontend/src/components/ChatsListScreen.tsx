import React, { useEffect, useState } from "react";
import CreateChatScreen from "./CreateChatScreen";
import { fetchWithAuth } from "../api";

export default function ChatsListScreen({
  access_token,
  userId,
  onSelectChat,
  onLogout,
}: {
  access_token: string;
  userId: number;
  onSelectChat: (chat: any) => void;
  onLogout: () => void;
}) {
  const [chats, setChats] = useState<any[]>([]);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchChats = async () => {
    if (!access_token) return;
    setLoading(true);

    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/chats`, {
        method: "GET",
      });

      if (res.ok) {
        const data = await res.json();

        // сортируем по времени последнего сообщения
        const sorted = [...data].sort((a, b) => {
          const t1 = a.last_message
            ? new Date(a.last_message.created_at).getTime()
            : 0;
          const t2 = b.last_message
            ? new Date(b.last_message.created_at).getTime()
            : 0;
          return t2 - t1;
        });

        setChats(sorted);
      } else if (res.status === 401) {
        alert("Сессия истекла. Авторизуйтесь снова.");
        onLogout();
      } else {
        console.error("Ошибка загрузки чатов:", res.status);
      }
    } catch (err) {
      console.error("Ошибка сети при получении чатов:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  // обновляем список при создании нового чата
  const handleChatCreated = () => {
    setShowCreateChat(false);
    fetchChats();
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-100">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Ваши чаты</h1>
        <div className="space-x-3">
          <button
            onClick={() => setShowCreateChat(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Создать чат
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Выйти
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : chats.length === 0 ? (
        <p className="text-gray-500">Нет чатов</p>
      ) : (
        <ul className="space-y-3">
          {chats.map((chat) => {
            const last = chat.last_message;
            return (
              <li
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className="border p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <strong>{chat.title || "Приватный чат"}</strong>
                    <div className="text-sm text-gray-600">
                      {chat.chat_type}
                    </div>
                  </div>
                  {last && (
                    <div className="text-xs text-gray-400">
                      {new Date(last.created_at).toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <div className="text-gray-700 mt-2 line-clamp-1">
                  {last
                    ? `${last.sender_id === userId ? "Вы: " : ""}${last.text}`
                    : "Нет сообщений"}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showCreateChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px] shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Создать чат
            </h2>

            <CreateChatScreen onChatCreated={handleChatCreated} />

            <button
              onClick={() => setShowCreateChat(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
