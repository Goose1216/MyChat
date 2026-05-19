import React, { useEffect, useState } from "react";
import LoginScreen from "./components/LoginScreen";
import RegistrationScreen from "./components/RegistrationScreen";
import ChatsListScreen from "./components/ChatsListScreen";
import ChatScreen from "./components/ChatScreen";
import ProfileScreen from "./components/ProfileScreen";
import AdminScreen from "./components/AdminScreen";
import type { Chat } from "./types";
import { WebSocketProvider } from "./Websocket.tsx";
import { setSessionExpiredCallback } from "./api";

type View = "login" | "register" | "chats" | "chat" | "profile" | "admin";

function parseJwt(token: string): any {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("access_token")
  );
  const [userId, setUserId] = useState<number | null>(() => {
    const u = localStorage.getItem("user_id");
    return u ? parseInt(u, 10) : null;
  });
  const [isSuperuser, setIsSuperuser] = useState<boolean>(() => {
    const t = localStorage.getItem("access_token");
    return t ? Boolean(parseJwt(t).is_superuser) : false;
  });

  const [view, setView]                 = useState<View>(token ? "chats" : "login");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  useEffect(() => {
    setSessionExpiredCallback(() => {
      setToken(null);
      setUserId(null);
      setIsSuperuser(false);
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
    setIsSuperuser(Boolean(parseJwt(accessToken).is_superuser));
    setView("chats");
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");
    setToken(null);
    setUserId(null);
    setIsSuperuser(false);
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
          isSuperuser={isSuperuser}
          onSelectChat={(chat: Chat) => { setSelectedChat(chat); setView("chat"); }}
          onLogout={handleLogout}
          onOpenProfile={() => setView("profile")}
          onOpenAdmin={isSuperuser ? () => setView("admin") : undefined}
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

      {view === "admin" && token && isSuperuser && (
        <AdminScreen onBack={() => setView("chats")} />
      )}
    </WebSocketProvider>
  );
}