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
  const WS_BASE = API.replace(/^http/, "ws");

  const [connected, setConnected]         = useState(false);
  const socketRef                         = useRef<WebSocket | null>(null);
  const handlersRef                       = useRef<Set<WsMessageHandler>>(new Set());
  const stopRef                           = useRef(false);
  const reconnectTimerRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Каждый раз берём токен из localStorage — не кэшируем в переменной
  const getWsUrl = () => {
    const token = localStorage.getItem("access_token") ?? "";
    return `${WS_BASE}/chats/ws?token=${token}`;
  };

  const connect = () => {
    if (stopRef.current) return;

    // Закрываем старое соединение если есть
    if (socketRef.current) {
      socketRef.current.onclose = null; // отключаем авто-реконнект для старого
      socketRef.current.close();
    }

    const ws = new WebSocket(getWsUrl());
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("[ws] подключён");
      setConnected(true);
    };

    ws.onclose = (e) => {
      console.warn("[ws] соединение закрыто", e.code, e.reason);
      setConnected(false);

      // Код 1008 = Policy Violation = токен невалиден.
      // Не переподключаемся автоматически — будем ждать tokenRefreshed.
      if (e.code === 1008) {
        console.warn("[ws] токен отклонён сервером, жду обновления токена...");
        return;
      }

      if (!stopRef.current) {
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => console.error("[ws] ошибка:", err);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.forEach((h) => h(data));
      } catch (err) {
        console.error("[ws] ошибка парсинга:", err);
      }
    };
  };

  useEffect(() => {
    stopRef.current = false;
    connect();

    // Событие от api.ts: токен успешно обновлён — переподключаемся с новым
    const onTokenRefreshed = () => {
      console.log("[ws] токен обновлён, переподключаюсь...");
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      connect();
    };
    window.addEventListener("tokenRefreshed", onTokenRefreshed);

    // StorageEvent — для переподключения при смене токена в другой вкладке
    const onStorage = (e: StorageEvent) => {
      if (e.key === "access_token" && e.newValue) {
        console.log("[ws] токен обновлён в другой вкладке, переподключаюсь...");
        connect();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      stopRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      window.removeEventListener("tokenRefreshed", onTokenRefreshed);
      window.removeEventListener("storage", onStorage);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Пустой массив зависимостей — правильно: connect() читает токен через getWsUrl()
  // который обращается к localStorage в момент вызова, а не при монтировании.

  const sendMessage = (msg: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("[ws] не подключён, сообщение не отправлено");
    }
  };

  const addHandler    = (h: WsMessageHandler) => handlersRef.current.add(h);
  const removeHandler = (h: WsMessageHandler) => handlersRef.current.delete(h);

  return (
    <WebSocketContext.Provider
      value={{ socket: socketRef.current, sendMessage, addHandler, removeHandler, connected }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};