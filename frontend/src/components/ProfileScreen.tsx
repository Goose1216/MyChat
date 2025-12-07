import React, { useEffect, useState } from "react";
import { fetchWithAuth, apiBase } from "../api";

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const API = apiBase();

  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = async () => {
    setLoading(true);

    try {
      const res = await fetchWithAuth(`${API}/users/me/`);
      const data = await res.json();

      if (res.ok && data?.data) {
        setForm({
          username: data.data.username,
          email: data.data.email,
          phone: data.data.phone,
        });
      }
    } catch (e) {
      console.error(e);
      setError("Ошибка загрузки профиля");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateProfile = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetchWithAuth(`${API}/users/me/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Данные успешно обновлены");
        return;
      }

      if (data?.description) setError(data.description);
      else if (data?.errors?.length) setError(data.errors[0].message);
      else setError("Ошибка обновления");

    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const change = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow">

        <button onClick={onBack} className="text-blue-600 mb-4">
          ← Назад
        </button>

        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Профиль
        </h2>

        {loading ? (
          <div className="text-gray-600 py-6 text-center">Загрузка...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm  mb-1 text-gray-900 placeholder-gray-400">Логин</label>
              <input
                name="username"
                value={form.username}
                onChange={change}
                className="w-full p-2 rounded-lg border bg-gray-50 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-900 placeholder-gray-400 mb-1">Email</label>
              <input
                name="email"
                value={form.email}
                onChange={change}
                className="w-full p-2 rounded-lg border bg-gray-50 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-900 placeholder-gray-400 mb-1">Телефон</label>
              <input
                name="phone"
                value={form.phone}
                onChange={change}
                className="w-full p-2 rounded-lg border bg-gray-50 text-gray-900"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-2 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="text-green-600 text-sm bg-green-50 border border-green-200 p-2 rounded-lg">
                {success}
              </div>
            )}

            <button
              onClick={updateProfile}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
