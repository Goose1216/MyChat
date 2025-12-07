import React, { useState } from "react";

export default function RegistrationScreen({
  onGoLogin,
}: {
  onGoLogin: () => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/users/register/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            email,
            phone,
            password,
          }),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.errors?.[0]?.message || "Ошибка регистрации");
        return;
      }

      setSuccess("Регистрация успешна! Теперь вы можете войти.");
    } catch (err) {
      console.error(err);
      setError("Не удалось выполнить регистрацию.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
      <form
        onSubmit={handleRegister}
        className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-lg w-full max-w-sm border border-gray-200"
      >
        <h2 className="text-2xl font-semibold mb-6 text-gray-800 text-center">
          Создание аккаунта
        </h2>

        <label className="block text-sm mb-1 text-gray-700">Логин</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 mb-4 text-gray-900"
          placeholder="Введите логин"
        />

        <label className="block text-sm mb-1 text-gray-700">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 mb-4 text-gray-900 placeholder-gray-400 "
          placeholder="Введите email"
        />

        <label className="block text-sm mb-1 text-gray-700">Телефон</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 mb-4 text-gray-900 placeholder-gray-400 "
          placeholder="В международном формате, пример: +79000000000"
        />

        <label className="block text-sm mb-1 text-gray-700">Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 mb-4 text-gray-900 placeholder-gray-400 "
          placeholder="Введите пароль"
        />

        {error && (
          <div className="text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg mb-4 text-center text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="text-green-700 bg-green-50 border border-green-200 p-2 rounded-lg mb-4 text-center text-sm">
            {success}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-lg font-semibold shadow mb-3"
        >
          Зарегистрироваться
        </button>

        <button
          type="button"
          onClick={onGoLogin}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 p-2.5 rounded-lg font-semibold"
        >
          Уже есть аккаунт
        </button>
      </form>
    </div>
  );
}
