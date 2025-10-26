import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type WsMessageHandler = (data: any) => void;

interface WebSocketContextType {
  socket: WebSocket | null;
  sendMessage: (msg: any) => void;
  addHandler: (handler: WsMessageHandler) => void;
  removeHandler: (handler: WsMessageHandler) => void;
  connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocket должен использоваться внутри WebSocketProvider");
  return ctx;
};

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<WsMessageHandler>>(new Set());

  const getToken = () => localStorage.getItem("access_token");
  const wsUrl = API.replace(/^http/, "ws") + `/chats/ws?token=${getToken()}`;

  useEffect(() => {
    let stop = false;
    let reconnectTimer: any;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WS подключён");
        setConnected(true);
      };

      ws.onclose = () => {
        console.warn("⚠️ WS закрыт, переподключение...");
        setConnected(false);
        if (!stop) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => console.error("Ошибка WS:", err);

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.forEach((h) => h(data));
        } catch (err) {
          console.error("Ошибка парсинга WS:", err);
        }
      };
    };

    connect();

    // при обновлении токена — переподключаем
    const onStorage = (e: StorageEvent) => {
      if (e.key === "access_token") {
        console.log("♻️ Токен обновился, переподключаем WS...");
        socketRef.current?.close();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      stop = true;
      socketRef.current?.close();
      clearTimeout(reconnectTimer);
      window.removeEventListener("storage", onStorage);
    };
  }, [wsUrl]);

  const sendMessage = (msg: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("❌ WS не подключён, сообщение не отправлено");
    }
  };

  const addHandler = (handler: WsMessageHandler) => {
    handlersRef.current.add(handler);
  };

  const removeHandler = (handler: WsMessageHandler) => {
    handlersRef.current.delete(handler);
  };

  return (
    <WebSocketContext.Provider
      value={{
        socket: socketRef.current,
        sendMessage,
        addHandler,
        removeHandler,
        connected,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
