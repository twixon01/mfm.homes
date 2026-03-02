import { FastifyPluginAsync } from "fastify";

const devRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dev/test-auth", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MFM Auth Test</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; max-width: 960px; }
    h1 { margin-bottom: 8px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    input, textarea, button { font: inherit; padding: 8px; }
    input, textarea { min-width: 260px; }
    button { cursor: pointer; }
    pre { background: #111; color: #eee; padding: 12px; border-radius: 8px; white-space: pre-wrap; }
    .card { border: 1px solid #ddd; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
    .muted { color: #666; }
  </style>
</head>
<body>
  <h1>Временная тестовая страница auth/profile</h1>
  <p class="muted">Endpoint: <code>/dev/test-auth</code>. После теста удалим.</p>

  <div class="card">
    <h3>1) Регистрация / Логин</h3>
    <div class="row">
      <input id="email" placeholder="Email" />
      <input id="password" type="password" placeholder="Password (min 8)" />
    </div>
    <div class="row">
      <button id="registerBtn">Register</button>
      <button id="loginBtn">Login</button>
      <button id="meBtn">Get /me</button>
    </div>
  </div>

  <div class="card">
    <h3>2) Профиль</h3>
    <div class="row">
      <input id="firstName" placeholder="Имя" />
      <input id="lastName" placeholder="Фамилия" />
      <input id="phone" placeholder="+79990000000" />
    </div>
    <div class="row">
      <button id="saveProfileBtn">PATCH /users/me/profile</button>
      <button id="getProfileBtn">GET /users/me/profile</button>
    </div>
  </div>

  <div class="card">
    <h3>3) Адреса</h3>
    <div class="row">
      <input id="city" placeholder="Город" value="Москва" />
      <input id="street" placeholder="Улица" value="Тверская" />
      <input id="house" placeholder="Дом" value="1" />
      <input id="apartment" placeholder="Кв." value="10" />
    </div>
    <div class="row">
      <button id="createAddressBtn">POST /users/me/addresses</button>
      <button id="listAddressesBtn">GET /users/me/addresses</button>
    </div>
  </div>

  <div class="card">
    <h3>Токен</h3>
    <textarea id="token" rows="3" style="width:100%" placeholder="Bearer token"></textarea>
  </div>

  <h3>Ответ</h3>
  <pre id="out">Готово к тесту...</pre>

  <script>
    const out = document.getElementById("out");
    const tokenEl = document.getElementById("token");

    const emailEl = document.getElementById("email");
    const passwordEl = document.getElementById("password");
    const firstNameEl = document.getElementById("firstName");
    const lastNameEl = document.getElementById("lastName");
    const phoneEl = document.getElementById("phone");
    const cityEl = document.getElementById("city");
    const streetEl = document.getElementById("street");
    const houseEl = document.getElementById("house");
    const apartmentEl = document.getElementById("apartment");

    function pretty(v) { return JSON.stringify(v, null, 2); }
    function setOut(v) { out.textContent = typeof v === "string" ? v : pretty(v); }
    function getAuthHeaders() {
      const t = tokenEl.value.trim();
      return t ? { Authorization: "Bearer " + t } : {};
    }

    async function api(path, options = {}) {
      const res = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      if (!res.ok) throw { status: res.status, body };
      return body;
    }

    document.getElementById("registerBtn").onclick = async () => {
      try {
        const data = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email: emailEl.value.trim(), password: passwordEl.value }),
        });
        tokenEl.value = data.token || "";
        setOut(data);
      } catch (e) { setOut(e); }
    };

    document.getElementById("loginBtn").onclick = async () => {
      try {
        const data = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: emailEl.value.trim(), password: passwordEl.value }),
        });
        tokenEl.value = data.token || "";
        setOut(data);
      } catch (e) { setOut(e); }
    };

    document.getElementById("meBtn").onclick = async () => {
      try {
        const data = await api("/api/auth/me", { headers: getAuthHeaders() });
        setOut(data);
      } catch (e) { setOut(e); }
    };

    document.getElementById("saveProfileBtn").onclick = async () => {
      try {
        const data = await api("/api/users/me/profile", {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            firstName: firstNameEl.value,
            lastName: lastNameEl.value,
            phone: phoneEl.value,
          }),
        });
        setOut(data);
      } catch (e) { setOut(e); }
    };

    document.getElementById("getProfileBtn").onclick = async () => {
      try {
        const data = await api("/api/users/me/profile", { headers: getAuthHeaders() });
        setOut(data);
      } catch (e) { setOut(e); }
    };

    document.getElementById("createAddressBtn").onclick = async () => {
      try {
        const data = await api("/api/users/me/addresses", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            city: cityEl.value,
            street: streetEl.value,
            house: houseEl.value,
            apartment: apartmentEl.value,
            isDefault: true,
          }),
        });
        setOut(data);
      } catch (e) { setOut(e); }
    };

    document.getElementById("listAddressesBtn").onclick = async () => {
      try {
        const data = await api("/api/users/me/addresses", { headers: getAuthHeaders() });
        setOut(data);
      } catch (e) { setOut(e); }
    };
  </script>
</body>
</html>`);
  });
};

export default devRoutes;
