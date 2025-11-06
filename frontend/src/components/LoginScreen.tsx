import React, { useState } from "react";

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (token: string, userId: number, refreshToken: string) => void;
}) {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/login/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username_or_email: loginValue,
            password: password,
          }),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.errors?.[0]?.message || "Ошибка авторизации");
        return;
      }

      const accessToken = json.data.access_token;
      const refreshToken = json.data.refresh_token;

      if (!accessToken) {
        setError("Ответ не содержит access_token");
        return;
      }

      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);

      const meRes = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/me/`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const meJson = await meRes.json().catch(() => null);

      if (!meRes.ok) {
        setError(meJson?.errors?.[0]?.message || "Ошибка загрузки профиля");
        return;
      }

      const userId = meJson.data.id;

      if (!userId) {
        setError("В ответе от /users/me/ нет user_id");
        return;
      }

      onLogin(accessToken, Number(userId), refreshToken);
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
      </form>
    </div>
  );
}
