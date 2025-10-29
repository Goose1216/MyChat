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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* --- Заголовок и кнопки --- */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Ваши чаты
          </h1>
          <div className="space-x-3">
            <button
              onClick={() => setShowCreateChat(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow transition-all"
            >
              + Новый чат
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow transition-all"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* --- Список чатов --- */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          {loading ? (
            <p className="text-gray-500 text-center py-6">Загрузка...</p>
          ) : chats.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Нет чатов</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {chats.map((chat) => {
                const last = chat.last_message;
                return (
                  <li
                    key={chat.id}
                    onClick={() => onSelectChat(chat)}
                    className="p-4 hover:bg-blue-50 rounded-lg cursor-pointer transition flex justify-between items-start"
                  >
                    <div>
                      <div className="text-lg font-semibold text-gray-800">
                        {chat.title || "Приватный чат"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {chat.chat_type}
                      </div>
                      {last && (
                        <div className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {last.sender_name
                            ? `${last.sender_name}: `
                            : ""}
                          {last.content || last.text}
                        </div>
                      )}
                    </div>
                    {last && (
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(last.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* --- Модалка создания чата --- */}
      {showCreateChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 text-center">
              Создать новый чат
            </h2>
            <CreateChatScreen onChatCreated={handleChatCreated} />
            <button
              onClick={() => setShowCreateChat(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
