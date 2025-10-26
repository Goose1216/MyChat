import React, { useEffect, useState } from "react";
import LoginScreen from "./components/LoginScreen";
import ChatsListScreen from "./components/ChatsListScreen";
import ChatScreen from "./components/ChatScreen";
import type { Chat } from "./types";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("access_token"));
  const [userId, setUserId] = useState<number | null>(() => {
    const u = localStorage.getItem("user_id");
    return u ? parseInt(u) : null;
  });
  const [view, setView] = useState<"login" | "chats" | "chat">(token ? "chats" : "login");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  async function apiMe(token: string) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Ошибка при получении пользователя");
    return res.json();
  }

  useEffect(() => {
    if (token && !userId) {
      (async () => {
        try {
          const data = await apiMe(token);
          if (data && typeof data.id !== "undefined") {
            setUserId(data.id);
            localStorage.setItem("user_id", String(data.id));
            setView("chats");
          } else {
            setView("login");
          }
        } catch {
          setToken(null);
          localStorage.removeItem("access_token");
          setView("login");
        }
      })();
    }
  }, []);

const handleLogin = (accessToken: string, id: number, refreshToken?: string) => {
  setToken(accessToken);
  setUserId(id);
  localStorage.setItem("access_token", accessToken);
  if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
  localStorage.setItem("user_id", String(id));
  setView("chats");
};


  const handleLogout = () => {
    setToken(null);
    setUserId(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    setView("login");
  };

  const openChat = (chat: Chat) => {
    setSelectedChat(chat);
    setView("chat");
  };

  const backToChats = () => {
    setSelectedChat(null);
    setView("chats");
  };

  if (view === "login") return <LoginScreen onLogin={handleLogin} />;

  if (view === "chats" && token && userId !== null)
    return (
      <ChatsListScreen
        access_token={token}
        userId={userId}
        onSelectChat={openChat}
        onLogout={handleLogout}
      />
    );

  if (view === "chat" && token && userId !== null && selectedChat)
    return <ChatScreen token={token} userId={userId} chat={selectedChat} onBack={backToChats} />;

  return null;
}
