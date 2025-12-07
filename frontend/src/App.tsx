import React, { useEffect, useState } from "react";
import LoginScreen from "./components/LoginScreen";
import RegistrationScreen from "./components/RegistrationScreen";
import ChatsListScreen from "./components/ChatsListScreen";
import ChatScreen from "./components/ChatScreen";
import ProfileScreen from "./components/ProfileScreen";
import type { Chat } from "./types";
import { WebSocketProvider } from "./Websocket.tsx";

export default function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("access_token")
  );

  const [userId, setUserId] = useState<number | null>(() => {
    const u = localStorage.getItem("user_id");
    return u ? parseInt(u) : null;
  });

  const [view, setView] = useState<
    "login" | "register" | "chats" | "chat" | "profile"
  >(token ? "chats" : "login");

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  async function apiMe(token: string) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Ошибка при получении пользователя");
    return res.json();
  }

  // Получаем userId если токен есть
  useEffect(() => {
    if (token && !userId) {
      (async () => {
        try {
          const data = await apiMe(token);

          if (data?.data?.id) {
            setUserId(data.data.id);
            localStorage.setItem("user_id", String(data.data.id));
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

  // Авторизация
  const handleLogin = (
    accessToken: string,
    id: number,
    refreshToken?: string
  ) => {
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
    localStorage.removeItem("refresh_token");
    setView("login");
  };

  const handleRegistered = () => {
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

  const goToProfile = () => {
    setView("profile");
  };

  const backFromProfile = () => {
    setView("chats");
  };

  /* ===========================
      РЕНДЕРИНГ ЭКРАНОВ
  ============================ */

  if (view === "login")
    return (
      <WebSocketProvider>
        <LoginScreen
          onLogin={handleLogin}
          onGoRegister={() => setView("register")}
        />
      </WebSocketProvider>
    );

  if (view === "register")
    return (
      <WebSocketProvider>
        <RegistrationScreen
          onRegistered={handleRegistered}
          onGoLogin={() => setView("login")}
        />
      </WebSocketProvider>
    );

  if (view === "profile" && token && userId !== null)
    return (
      <WebSocketProvider>
        <ProfileScreen
          token={token}
          userId={userId}
          onBack={backFromProfile}
          onLogout={handleLogout}
        />
      </WebSocketProvider>
    );

  if (view === "chats" && token && userId !== null)
    return (
      <WebSocketProvider>
        <ChatsListScreen
          access_token={token}
          userId={userId}
          onSelectChat={openChat}
          onLogout={handleLogout}
          onOpenProfile={goToProfile}
        />
      </WebSocketProvider>
    );

  if (view === "chat" && token && userId !== null && selectedChat)
    return (
      <WebSocketProvider>
        <ChatScreen
          token={token}
          userId={userId}
          chat={selectedChat}
          onBack={backToChats}
        />
      </WebSocketProvider>
    );

  return null;
}
