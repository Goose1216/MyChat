import React, { useEffect, useState } from "react";
import "../design.css";

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
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setUsers(data.data ?? []);
        } else {
          setErrorMessage("Не удалось загрузить список пользователей");
        }
      } catch {
        setErrorMessage("Ошибка сети при получении пользователей");
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const handleCreate = async () => {
    setErrorMessage("");
    const token = localStorage.getItem("access_token");
    if (!token) { setErrorMessage("Вы не авторизованы"); return; }

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onChatCreated();
      } else {
        const error = await res.json();
        setErrorMessage(
          error.description || error.message || error.errors?.[0]?.message || "Ошибка при создании чата"
        );
      }
    } catch {
      setErrorMessage("Не удалось создать чат (ошибка соединения)");
    } finally {
      setCreating(false);
    }
  };

  const typeLabels: Record<string, string> = { private: "PRIVATE", group: "GROUP", channel: "CHANNEL" };

  return (
    <div style={styles.wrap}>
      <div className="field">
        <label>Тип чата</label>
        <div style={styles.typeTabs}>
          {["private", "group", "channel"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setChatType(t)}
              className="btn mono"
              style={{
                flex: 1,
                fontSize: 11,
                padding: "6px 8px",
                background: chatType === t ? "var(--c-ink)" : "var(--c-surface)",
                color: chatType === t ? "#fff" : "var(--c-ink-muted)",
                borderColor: chatType === t ? "var(--c-ink)" : "var(--c-line)",
              }}
            >
              {typeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {chatType === "private" ? (
        <div className="field">
          <label>Выберите пользователя</label>
          {loadingUsers ? (
            <div style={styles.loading}><span className="spinner" /> <span>Загрузка...</span></div>
          ) : users.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--c-ink-muted)" }}>Нет доступных пользователей</p>
          ) : (
            <select value={user2Id} onChange={(e) => setUser2Id(e.target.value)} className="input">
              <option value="">— Выберите пользователя —</option>
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
          <div className="field">
            <label>Название чата</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название"
              className="input"
            />
          </div>
          <div className="field">
            <label>Описание <span style={{ color: "var(--c-ink-ghost)", fontWeight: 400 }}>(опционально)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Введите описание"
              rows={3}
              className="input"
            />
          </div>
        </>
      )}

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      <button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        className="btn btn-primary"
        style={{ width: "100%", height: "40px", fontSize: "14px" }}
      >
        {creating ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Создать чат"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: 16 },
  typeTabs: { display: "flex", gap: 6 },
  loading: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--c-ink-muted)", padding: "8px 0" },
};