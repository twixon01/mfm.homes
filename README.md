# Moscow Flea Market

Веб-сервис для покупки одежды и выкупа товаров с внешних площадок.

В проекте есть:
- `frontend` — клиентская часть на React + TypeScript + Vite
- `backend` — серверная часть на Fastify + TypeScript + Prisma
- `PostgreSQL` — база данных

## Что умеет проект

- просмотр каталога товаров
- поиск и фильтрация
- карточка товара
- внешние товары с eBay
- корзина
- wishlist
- регистрация и вход
- личный кабинет
- адреса доставки
- оформление заказа
- повторная оплата заказа
- административный интерфейс для товаров и заказов

## Технологии

### Frontend
- React
- TypeScript
- Vite
- React Router

### Backend
- Node.js
- Fastify
- TypeScript
- Prisma
- PostgreSQL
- JWT
- httpOnly cookies
- bcrypt

### Внешние интеграции
- YooKassa — для оплаты
- eBay API — для внешнего поиска товаров
- API ЦБ РФ — для курса валют

## Как запустить проект локально

Ниже самый простой вариант запуска.

### 1. Установить зависимости

В корне проекта:

```bash
cd frontend
npm install

cd ../backend
npm install
```

### 2. Поднять PostgreSQL

В папке `backend` есть `docker-compose.yml`, поэтому базу можно запустить так:

```bash
cd backend
docker compose up -d
```

После этого PostgreSQL будет доступен на `127.0.0.1:5432`.

### 3. Создать файл `.env` для backend

В папке `backend` нужно создать файл `.env`.

Минимальный вариант:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mfm?schema=public
JWT_SECRET=supersecretkey12345
APP_BASE_URL=http://127.0.0.1:5173
```

Для использования оплаты и внешнего поиска (eBay) еще нужны:

```env
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
YOOKASSA_RETURN_URL=
EBAY_APP_ID=
EBAY_CLIENT_SECRET=
EBAY_MARKETPLACE=EBAY_US
UPLOADS_DIR=
UPLOADS_PUBLIC_PREFIX=/uploads
```

## 4. Подготовить Prisma

После создания `.env`:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

Таблицы должны создаться в базе.

### 5. Запустить backend

```bash
cd backend
npm run dev
```

По умолчанию backend работает на:

```text
http://127.0.0.1:4000
```

Проверка, что сервер жив:

```text
http://127.0.0.1:4000/health
```

Должен вернуться ответ:

```json
{ "ok": true }
```

### 6. Запустить frontend

В отдельном терминале:

```bash
cd frontend
npm run dev
```

Обычно frontend поднимается на:

```text
http://127.0.0.1:5173
```

Важно: в `vite.config.ts` уже настроен прокси с frontend на backend для `/api` и `/dev`, поэтому дополнительно ничего прописывать не нужно.

## Полезные команды

### Frontend

```bash
npm run dev
npm run build
npm run preview
npm run lint
npx playwright install
npm run test:e2e
npm run test:e2e:headed
```

### Backend

```bash
npm run dev
npm run dev:watch
npm run build
npm run start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

## Как устроен проект

### Frontend

Точка входа — `frontend/src/main.tsx`, приложение обернуто в `ErrorBoundary`.  
`frontend/src/App.tsx` выполняет роль orchestration-слоя (роутинг + композиция хуков),  
основная логика вынесена в:
- `frontend/src/pages` — страницы
- `frontend/src/hooks` — сессионная логика, корзина, wishlist, кэш товаров
- `frontend/src/lib` — http/storage/ui/routes утилиты
- `frontend/e2e` — smoke e2e сценарии (логин, checkout, admin filters)

### Backend

Точка входа — `backend/src/server.ts`.  
Сборка приложения — `backend/src/app.ts`.  
Основные серверные модули лежат в `backend/src/modules`.

## Что важно понимать

- часть функций опциональна без внешних ключей API, но базовый проект запускается и без них
- аутентификация работает через `httpOnly` cookie (токен не хранится в `localStorage`)
- если не заданы ключи YooKassa, оплата работать не будет
- если не заданы ключи eBay, внешний поиск будет недоступен
- smoke e2e тесты запускаются через Playwright и требуют установленный браузер (`npx playwright install`)

