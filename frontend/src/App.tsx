import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

function safeParseJSON(data) {
  try {
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

function normalizeWsBaseUrl(input) {
  // Разрешаем ws://, wss:// и даже http(s):// (автозамена на ws(s)://)
  const trimmed = (input || "").trim();
  if (!trimmed) return "ws://127.0.0.1:8000";
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) return trimmed;
  if (trimmed.startsWith("https://")) return trimmed.replace(/^https:\/\//i, "wss://");
  if (trimmed.startsWith("http://")) return trimmed.replace(/^http:\/\//i, "ws://");
  // Если без протокола — добавим ws://
  return `ws://${trimmed}`;
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState("ws://127.0.0.1:8000");
  const [chatId, setChatId] = useState("1");
  const [userId, setUserId] = useState("1");
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | connected | error
  const [messages, setMessages] = useState([]); // { id, text, it_self, ts }
  const [outgoing, setOutgoing] = useState("");

  const wsRef = useRef(null);
  const listEndRef = useRef(null);
  const msgIdRef = useRef(0);

  const wsUrl = useMemo(() => {
    const safeBase = normalizeWsBaseUrl(baseUrl);
    return `${safeBase}/chats/${encodeURIComponent(chatId)}/${encodeURIComponent(userId)}`;
  }, [baseUrl, chatId, userId]);

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => {
      const next = [...prev, { id: ++msgIdRef.current, ts: Date.now(), ...msg }];
      return next.slice(-5000); // простая защита от разрастания
    });
  }, []);

  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const connect = useCallback(() => {
    if (wsRef.current && (status === "connecting" || status === "connected")) return;

    const url = wsUrl;
    try {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        appendMessage({ text: `✔ Подключено к ${url}`, it_self: true });
      };

      ws.onmessage = (event) => {
        const asJson = typeof event.data === "string" ? safeParseJSON(event.data) : null;
        if (asJson && typeof asJson.text === "string") {
          appendMessage({ text: asJson.text, it_self: !!asJson.it_self });
        } else if (typeof event.data === "string") {
          appendMessage({ text: event.data, it_self: false });
        } else {
          appendMessage({ text: "[Получены бинарные данные]", it_self: false });
        }
      };

      ws.onerror = () => {
        setStatus("error");
        appendMessage({ text: "⚠ Ошибка WebSocket", it_self: true });
      };

      ws.onclose = (evt) => {
        setStatus("disconnected");
        appendMessage({ text: `✖ Соединение закрыто (code ${evt.code})`, it_self: true });
        wsRef.current = null;
      };
    } catch (e) {
      setStatus("error");
      appendMessage({ text: `⚠ Не удалось открыть сокет: ${String(e)}`, it_self: true });
    }
  }, [wsUrl, status, appendMessage]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "client closing");
      } catch (_) {}
      wsRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    // cleanup on unmount
    if (wsRef.current) {
      try { wsRef.current.close(1000, "unmount"); } catch (_) {}
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(() => {
    const text = outgoing.trim();
    if (!text) return;
    if (!wsRef.current || status !== "connected") {
      appendMessage({ text: "Соединение не установлено", it_self: true });
      return;
    }
    try {
      wsRef.current.send(text); // сервер ожидает text frame
      setOutgoing("");
    } catch (e) {
      appendMessage({ text: `Ошибка отправки: ${String(e)}`, it_self: true });
    }
  }, [outgoing, status, appendMessage]);

  const statusBadge = useMemo(() => {
    const map = {
      disconnected: "bg-gray-200 text-gray-700",
      connecting: "bg-yellow-200 text-yellow-900",
      connected: "bg-green-200 text-green-900",
      error: "bg-red-200 text-red-900",
    };
    return map[status] || map.disconnected;
  }, [status]);

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl shadow-lg bg-white overflow-hidden">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className={`px-2 py-1 rounded-md text-sm font-medium ${statusBadge}`}>{status}</div>
          <h1 className="text-xl font-semibold">FastAPI WebSocket Chat</h1>
        </header>

        <div className="p-6 grid grid-cols-1 gap-4">
          <form
            className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              connect();
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">Base URL (ws/wss)</span>
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring focus:ring-slate-200"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="ws://127.0.0.1:8000"
                inputMode="url"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">chatId</span>
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring focus:ring-slate-200"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="1"
                inputMode="numeric"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">userId</span>
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring focus:ring-slate-200"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="1"
                inputMode="numeric"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
                disabled={status === "connecting" || status === "connected"}
                title="Подключиться"
              >
                Подключиться
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-900 border border-slate-300 hover:bg-slate-200 transition"
                disabled={status !== "connected" && status !== "error"}
                title="Отключиться"
              >
                Отключиться
              </button>
            </div>
          </form>

          <div className="h-96 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
            <ul className="flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id} className={`flex ${m.it_self ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${m.it_self ? "bg-slate-900 text-white rounded-tr" : "bg-white border border-slate-200 rounded-tl"}`}>
                    <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                    <div className="mt-1 text-[10px] opacity-60 text-right">{new Date(m.ts).toLocaleTimeString()}</div>
                  </div>
                </li>
              ))}
              <div ref={listEndRef} />
            </ul>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring focus:ring-slate-200"
              value={outgoing}
              onChange={(e) => setOutgoing(e.target.value)}
              placeholder="Введите сообщение и нажмите Enter"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
              disabled={status !== "connected"}
            >
              Отправить
            </button>
          </form>

          <div className="text-xs text-slate-500">
            Текущий URL сокета: <code className="px-1 py-0.5 bg-slate-100 rounded">{wsUrl}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
