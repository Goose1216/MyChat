import React, { useEffect, useState } from "react";
import LoginScreen from "./components/LoginScreen";
import RegistrationScreen from "./components/RegistrationScreen";
import ChatsListScreen from "./components/ChatsListScreen";
import ChatScreen from "./components/ChatScreen";
import ProfileScreen from "./components/ProfileScreen";
import type { Chat } from "./types";
import { WebSocketProvider } from "./Websocket.tsx";
import { setSessionExpiredCallback } from "./api";

type View = "login" | "register" | "chats" | "chat" | "profile";

export default function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("access_token")
  );
  const [userId, setUserId] = useState<number | null>(() => {
    const u = localStorage.getItem("user_id");
    return u ? parseInt(u, 10) : null;
  });

  const [view, setView]                 = useState<View>(token ? "chats" : "login");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  // Регистрируем коллбэк один раз при монтировании.
  // api.ts вызовет его когда refresh-токен протухнет.
  // Никакого window.location.reload() — просто переключаем состояние.
  useEffect(() => {
    setSessionExpiredCallback(() => {
      setToken(null);
      setUserId(null);
      setSelectedChat(null);
      setView("login");
    });
  }, []);

  const handleLogin = (accessToken: string, id: number, refreshToken: string) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("user_id", String(id));
    setToken(accessToken);
    setUserId(id);
    setView("chats");
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");
    setToken(null);
    setUserId(null);
    setSelectedChat(null);
    setView("login");
  };

  return (
    <WebSocketProvider>
      {view === "login" && (
        <LoginScreen
          onLogin={handleLogin}
          onGoRegister={() => setView("register")}
        />
      )}

      {view === "register" && (
        <RegistrationScreen
          onRegistered={() => setView("login")}
          onGoLogin={() => setView("login")}
        />
      )}

      {view === "chats" && token && userId !== null && (
        <ChatsListScreen
          access_token={token}
          userId={userId}
          onSelectChat={(chat: Chat) => { setSelectedChat(chat); setView("chat"); }}
          onLogout={handleLogout}
          onOpenProfile={() => setView("profile")}
        />
      )}

      {view === "chat" && token && userId !== null && selectedChat && (
        <ChatScreen
          userId={userId}
          chat={selectedChat}
          onBack={() => { setSelectedChat(null); setView("chats"); }}
        />
      )}

      {view === "profile" && token && userId !== null && (
        <ProfileScreen
          token={token}
          userId={userId}
          onBack={() => setView("chats")}
          onLogout={handleLogout}
        />
      )}
    </WebSocketProvider>
  );
}