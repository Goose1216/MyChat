import React, { useState } from "react";

export default function CreateChatScreen({ onChatCreated }: { onChatCreated: () => void }) {
  const [chatType, setChatType] = useState("private");
  const [user2Id, setUser2Id] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return alert("Вы не авторизованы");

    // Подготовка payload с учётом схем FastAPI
    let payload: any = { chat_type: chatType };

    if (chatType === "private") {
      if (!user2Id) return alert("Введите ID второго пользователя");
      payload.user2_id = Number(user2Id);
    } else {
      if (!title) return alert("Введите название чата");
      payload.title = title;
      if (description) payload.description = description;
    }

    try {
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
      } else {
        const error = await res.json();
        console.error("Ошибка при создании:", error);
        alert(error.detail?.[0]?.msg || "Ошибка при создании чата");
      }
    } catch (e) {
      console.error("Ошибка сети:", e);
      alert("Не удалось создать чат (ошибка соединения)");
    }
  };

  return (
    <div className="p-4 space-y-4 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-lg font-bold text-gray-800">Создать новый чат</h2>


      <div>
        <label className="block font-semibold mb-1">Тип чата:</label>
        <select
          value={chatType}
          onChange={(e) => setChatType(e.target.value)}
          className="border border-gray-300 p-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="private">PRIVATE</option>
          <option value="group">GROUP</option>
          <option value="channel">CHANNEL</option>
        </select>
      </div>

      {/* Поля в зависимости от типа */}
      {chatType === "private" ? (
        <div>
          <label className="block font-semibold mb-1">ID второго пользователя:</label>
          <input
            type="number"
            value={user2Id}
            onChange={(e) => setUser2Id(e.target.value)}
            placeholder="Введите ID пользователя"
            className="border border-gray-300 rounded-lg p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : (
        <>
          <div>
            <label className="block font-semibold mb-1">Название чата:</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название"
              className="border border-gray-300 rounded-lg p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Описание (опционально):</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Введите описание"
              className="border border-gray-300 rounded-lg p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      <button
        onClick={handleCreate}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
      >
        Создать чат
      </button>
    </div>
  );
}
