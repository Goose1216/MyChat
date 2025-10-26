import React, { useState } from "react";
import { login } from "../api";

export default function LoginScreen({ onLogin }: { onLogin: (token: string, userId: number) => void }) {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const tokens = await login(loginValue, password);
      // ожидаем, что backend вернёт токены в формате { access_token: "...", refresh_token: "...", ... }
      const accessToken = tokens.access_token;
      const refresh_token = tokens.refresh_token;
      if (!accessToken) {
        throw new Error("No access token in response");
      }
      // После получения токена нужно вызвать /users/me чтобы получить user_id
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refresh_token);
      // попытка получить user_id немедленно (чисто для UX)
      const meRes = await fetch(`${(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) throw new Error("Login succeeded but cannot get /users/me");
      const me = await meRes.json();
      const userId = me.id ?? me.user_id ?? me.userId;
      if (!userId) throw new Error("No user id in /users/me response");
      onLogin(accessToken, Number(userId));
    } catch (err: any) {
      setError(err.message || "Ошибка при входе");
      localStorage.removeItem("chat_token");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-xl font-semibold mb-4">Войти</h2>

        <label className="block text-sm mb-1">Email или логин</label>
        <input value={loginValue} onChange={(e) => setLoginValue(e.target.value)} className="w-full border p-2 rounded mb-3" />

        <label className="block text-sm mb-1">Пароль</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border p-2 rounded mb-4" />

        {error && <div className="text-red-600 mb-3">{error}</div>}

        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">Войти</button>
      </form>
    </div>
  );
}
