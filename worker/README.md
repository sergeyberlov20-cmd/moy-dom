# Заявки + мини-админка «Мой Дом» (бесплатно)

Облачный бэкенд на **Cloudflare Workers** (бесплатный тариф): принимает заявки с сайта,
пишет их в базу **D1**, присылает уведомления в **Telegram** и отдаёт данные в
веб-панель `admin/leads.html`. Formspree на сайте остаётся резервным каналом.

Стоимость: **0 ₽/мес** (100 000 запросов в день — с запасом).

---

## 1. Бот в Telegram (2 минуты)

1. Откройте [@BotFather](https://t.me/BotFather) → `/newbot` → имя и username.
2. Скопируйте **токен** вида `123456789:AAH...`.
3. Узнайте свой ID: напишите [@userinfobot](https://t.me/userinfobot) — он пришлёт число.
   Это будет и `ADMIN_IDS`, и `TG_CHAT_ID` (если уведомления хотите себе).

## 2. Cloudflare (5 минут)

1. Регистрация: https://dash.cloudflare.com/sign-up (бесплатно, карта не нужна).
2. В терминале в папке `worker`:
   ```bash
   npx wrangler login
   npx wrangler d1 create moydom
   ```
   Скопируйте `database_id` из вывода в `wrangler.toml`.
   ```bash
   npx wrangler d1 execute moydom --file=./schema.sql --remote
   npx wrangler kv namespace create KV
   ```
   Скопируйте `id` в `wrangler.toml`.

## 3. Секреты и переменные

В `wrangler.toml` замените:
```toml
ADMIN_IDS   = "ваш_telegram_id"
TG_CHAT_ID  = "ваш_telegram_id"
SITE_ORIGIN = "https://dom-mc.ru,https://sergeyberlov20-cmd.github.io"
```

Секреты (не пишутся в файл):
```bash
npx wrangler secret put BOT_TOKEN        # токен от @BotFather
npx wrangler secret put WEBHOOK_SECRET   # придумайте любую строку, напр. 8f3k2m9x
npx wrangler secret put METRIKA_TOKEN    # необязательно (OAuth-токен Метрики)
```

## 4. Деплой и вебхук

```bash
npx wrangler deploy
```
Получите адрес вида `https://moydom-leads.<account>.workers.dev`.

Привяжите вебхук (подставьте свои значения):
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>/api/tg/webhook&secret_token=<WEBHOOK_SECRET>
```
Откройте ссылку в браузере — должно вернуться `{"ok":true,...}`.

## 5. Подключить сайт

1. `js/api.js` — впишите адрес в `const BASE = 'https://…workers.dev';`
2. `admin/leads.html` — впишите тот же адрес в `const API = '';`
3. Запушьте в `main`. Через 1–2 минуты сайт начнёт отправлять заявки в базу и в Telegram.

Проверка: отправьте заявку на `/contacts.html` → сообщение в боте;
затем `/admin/leads.html` → «Получить код» → код в Telegram → войти.

## Команды бота

| Команда | Что делает |
|---|---|
| `/start` | справка |
| `/leads` | 10 последних заявок с кнопками |
| `/leads new` | только новые |
| `/stats` | сводка за 7 дней |
| `/done 12` | закрыть заявку №12 |
| `/id` | ваш Telegram ID |

Кнопки под заявкой: **📞 В работе** / **✅ Готово**.

## Что ещё есть

- **Сайт** отправляет события `pageview`, `tel_click`, `form_submit` → в D1 → видны в панели.
- **Cron** (`0 6 * * *`) присылает сводку в Telegram каждое утро.
- **CSV**: кнопка в панели и `GET /api/admin/export`.
- **Защита**: заявки не чаще 1 раза в 20 секунд с IP; honeypot-поле; вход только по коду из бота;
  сессия 30 дней в KV; всё, кроме `/api/lead` и `/api/event`, требует `Authorization: Bearer <token>`.

## Важно

- **Не коммитьте** `BOT_TOKEN` и `WEBHOOK_SECRET` в репозиторий — только через `wrangler secret`.
- `ADMIN_IDS` обязателен: без него бот не пустит никого (и код входа не отправит).
- Данные лежат в Cloudflare (США). Для «по-белому» по 152-ФЗ со временем — VPS в РФ,
  контракт API при этом менять не нужно.
- Полный откат: `npx wrangler delete` (данные в D1 удаляются вместе с базой).
