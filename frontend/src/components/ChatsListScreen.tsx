import React, { useEffect, useState } from "react";
import CreateChatScreen from "./CreateChatScreen";
import { fetchWithAuth } from "../api";

export default function ChatsListScreen({
  access_token,
  userId,
  onSelectChat,
  onLogout,
  onOpenProfile,
}: {
  access_token: string;
  userId: number;
  onSelectChat: (chat: any) => void;
  onLogout: () => void;
  onOpenProfile: () => void;
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
        const responseData = await res.json();
        setChats(responseData.data ?? []);
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

  const handleChatCreated = () => {
    setShowCreateChat(false);
    fetchChats();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Заголовок */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Ваши чаты
          </h1>
          <div className="space-x-3">

            {/* Кнопка профиля */}
            <button
              onClick={onOpenProfile}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow transition-all"
            >
              Профиль
            </button>

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

        {/* Список */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          {loading ? (
            <p className="text-gray-500 text-center py-6">Загрузка...</p>
          ) : chats.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Нет чатов</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {chats.map((chat) => (
                <li
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className="p-4 hover:bg-blue-50 rounded-lg cursor-pointer transition flex justify-between items-center"
                >
                  <div>
                    <div className="text-lg font-semibold text-gray-800">
                      {chat.title || `Чат #${chat.id}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      Тип: {chat.chat_type}
                    </div>
                    {chat.description && (
                      <div className="text-sm text-gray-600 mt-1">
                        {chat.description}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
