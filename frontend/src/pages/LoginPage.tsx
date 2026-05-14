import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import homeBackground from "../assets/HOME.png";
import { apiRequest } from "../lib/http";
import type { User } from "../types/domain";

type LoginPageProps = {
  onAuth: (user: User) => void;
};

export function LoginPage({ onAuth }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(mode: "login" | "register", e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const data = await apiRequest<{ user: User }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onAuth(data.user);
      navigate("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ошибка");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page" style={{ backgroundImage: `url(${homeBackground})` }}>
      <section className="login-card">
        <div className="login-panel">
          <h1>Войдите для покупок на mfm.homes</h1>
          <p className="subtitle">Поиск и заказ вещей в одном месте.</p>
          <form className="login-form" onSubmit={(e) => submit("login", e)}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <div className="login-actions">
              <button type="submit" disabled={isLoading}>
                {isLoading ? "Входим..." : "Войти"}
              </button>
              <button type="button" className="secondary" disabled={isLoading} onClick={(e) => submit("register", e)}>
                Зарегистрироваться
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
