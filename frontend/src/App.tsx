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

  const openChat = (chat: Chat) => {
    setSelectedChat(chat);
    setView("chat");
  };

  const backToChats = () => {
    setSelectedChat(null);
    setView("chats");
  };

  return (
    <WebSocketProvider>
      {view === "login" && (
        <LoginScreen
          onLogin={(accessToken, id, refreshToken) => {
            setToken(accessToken);
            setUserId(id);
            localStorage.setItem("access_token", accessToken);
            localStorage.setItem("user_id", String(id));
            if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
            setView("chats");
          }}
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
          onSelectChat={openChat}
          onLogout={() => {
            setToken(null);
            setUserId(null);
            localStorage.clear();
            setView("login");
          }}
          onOpenProfile={() => setView("profile")}
        />
      )}

      {view === "chat" && token && userId !== null && selectedChat && (
        <ChatScreen
          userId={userId}
          chat={selectedChat}
          onBack={backToChats}
        />
      )}

      {view === "profile" && token && userId !== null && (
        <ProfileScreen
          token={token}
          userId={userId}
          onBack={() => setView("chats")}
          onLogout={() => {
            setToken(null);
            setUserId(null);
            localStorage.clear();
            setView("login");
          }}
        />
      )}
    </WebSocketProvider>
  );
}
