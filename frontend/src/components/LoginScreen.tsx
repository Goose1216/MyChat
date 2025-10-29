import React, { useState } from "react";
import { login } from "../api";

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (token: string, userId: number) => void;
}) {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username_or_email: loginValue,
          password: password,
        }),
      }
    );

    if (!res.ok) {
      if (res.status === 401) {
        setError("Неверный логин или пароль");
      } else if (res.status === 500) {
        setError("Ошибка на стороне сервера. Попробуйте позже");
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.detail || `Ошибка: ${res.status}`);
      }
      return;
    }

    const tokens = await res.json();
    const accessToken = tokens.access_token;
    const refresh_token = tokens.refresh_token;
    if (!accessToken) throw new Error("No access token in response");

    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refresh_token);

    const meRes = await fetch(
      `${(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")}/users/me`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!meRes.ok) throw new Error("Login succeeded but cannot get /users/me");

    const me = await meRes.json();
    const userId = me.id ?? me.user_id ?? me.userId;
    if (!userId) throw new Error("No user id in /users/me response");

    onLogin(accessToken, Number(userId));
  } catch (err) {
    console.error("Login error:", err);
    setError("Не удалось выполнить вход. Проверьте подключение к серверу.");
  }
};


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-lg w-full max-w-sm border border-gray-200"
      >
        <h2 className="text-2xl font-semibold mb-6 text-gray-800 text-center">
          Вход в систему
        </h2>

        <label className="block text-sm mb-1 text-gray-700">
          Email или логин
        </label>
        <input
          value={loginValue}
          onChange={(e) => setLoginValue(e.target.value)}
          className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300 transition rounded-lg p-2 mb-4 text-gray-900 placeholder-gray-400 outline-none"
          placeholder="Введите email или логин"
        />

        <label className="block text-sm mb-1 text-gray-700">Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300 transition rounded-lg p-2 mb-4 text-gray-900 placeholder-gray-400 outline-none"
          placeholder="Введите пароль"
        />

        {error && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white p-2.5 rounded-lg font-semibold shadow transition-all"
        >
          Войти
        </button>

        <p className="text-gray-500 text-sm text-center mt-4">
          Добро пожаловать 👋
        </p>
      </form>
    </div>
  );
}
