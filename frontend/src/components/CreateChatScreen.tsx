import React, { useEffect, useState } from "react";

export default function CreateChatScreen({
  onChatCreated,
}: {
  onChatCreated: () => void;
}) {
  const [chatType, setChatType] = useState("private");
  const [user2Id, setUser2Id] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      setLoadingUsers(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/users/get_all_users/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          setUsers(data.data ?? []);
        } else {
          setErrorMessage("Не удалось загрузить список пользователей");
          console.error("Ошибка получения списка пользователей:", res.status);
        }
      } catch (err) {
        setErrorMessage("Ошибка сети при получении пользователей");
        console.error("Ошибка сети:", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const handleCreate = async () => {
    setErrorMessage("");
    const token = localStorage.getItem("access_token");
    if (!token) {
      setErrorMessage("Вы не авторизованы");
      return;
    }

    let payload: any = { chat_type: chatType };

    if (chatType === "private") {
      if (!user2Id) return setErrorMessage("Выберите пользователя");
      payload.user2_id = Number(user2Id);
    } else {
      if (!title.trim()) return setErrorMessage("Введите название чата");
      payload.title = title.trim();
      if (description.trim()) payload.description = description.trim();
    }

    try {
      setCreating(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onChatCreated();
        setErrorMessage("");
      } else {
        const error = await res.json();
        console.error("Ошибка при создании:", error);

        const detailMsg =
          error.description ||
          error.message ||
          error.errors?.[0]?.message ||
          "Ошибка при создании чата";

        setErrorMessage(detailMsg);
      }
    } catch (e) {
      console.error("Ошибка сети:", e);
      setErrorMessage("Не удалось создать чат (ошибка соединения)");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5 bg-white rounded-2xl shadow-md border border-gray-200 p-6 transition-all">
      <h2 className="text-2xl font-bold text-center text-gray-800 tracking-tight">
        Создать новый чат
      </h2>

      {/* Выбор типа чата */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Тип чата
        </label>
        <select
          value={chatType}
          onChange={(e) => setChatType(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        >
          <option value="private">PRIVATE</option>
          <option value="group">GROUP</option>
          <option value="channel">CHANNEL</option>
        </select>
      </div>

      {/* Поля для разных типов */}
      {chatType === "private" ? (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Выберите пользователя
          </label>

          {loadingUsers ? (
            <p className="text-gray-500 text-sm italic py-2">
              Загрузка пользователей...
            </p>
          ) : users.length === 0 ? (
            <p className="text-gray-500 text-sm italic py-2">
              Нет доступных пользователей
            </p>
          ) : (
            <select
              value={user2Id}
              onChange={(e) => setUser2Id(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="">-- Выберите пользователя --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username || u.email || `user_${u.id}`}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Название чата
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название"
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Описание (опционально)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Введите описание"
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </>
      )}

      {/* Ошибки */}
      {errorMessage && (
        <div className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-lg p-3">
          {errorMessage}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={creating}
        className={`w-full py-2.5 rounded-lg font-semibold text-white shadow transition ${
          creating
            ? "bg-blue-400 cursor-wait"
            : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
        }`}
      >
        {creating ? "Создание..." : "Создать чат"}
      </button>
    </div>
  );
}
