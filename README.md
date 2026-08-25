# 🦷 Dental Care — Telegram Mini App

Современное приложение для записи пациентов к стоматологу.

## Возможности

### Для клиентов
- 🎨 Современный glassmorphism-дизайн с aurora-фоном
- 📝 Регистрация с сохранением в Firebase
- 🦷 Выбор услуги → 👨‍⚕️ врача → 📅 даты → 🕐 времени
- 📋 Личный кабинет «Мои записи»
- ⭐ Отзывы после приёма
- 📧 Email-подтверждение при записи
- 🔔 Напоминание за день до приёма
- 🌗 Автоматическая подстройка под тему Telegram

### Для администратора
- 🔐 Защищённая паролем админ-панель
- 📊 Статистика: всего / сегодня / за 7 дней / клиентов / отзывов / рейтинг
- 📋 Управление записями (отмена / восстановление)
- 👥 База клиентов
- 🦷 **CRUD услуг** — добавление, редактирование, скрытие, удаление
- 👨‍⚕️ **CRUD врачей** — добавление, редактирование, скрытие, удаление
- ⭐ **Модерация отзывов**
- 📈 **Графики**: записи за 14 дней, популярные услуги, загрузка врачей
- 🔔 Уведомления в Telegram при каждой записи

## Структура Firebase

```
users/<telegram-id>/
  telegramId, telegramUsername, name, phone, email, registeredAt

bookings/<push-id>/
  userId, userName, userPhone, userEmail, username,
  serviceId, serviceName, doctorId, doctorName,
  price, date, time, status, reminderSent, createdAt,
  review: { rating, text }

reviews/<push-id>/
  bookingId, userId, userName, doctorId, doctorName,
  serviceName, rating, text, status, createdAt

settings/
  services/<push-id>/
    name, desc, price, icon, active
  doctors/<push-id>/
    name, spec, exp, icon, active
```

## Развёртывание

### 1. Firebase
1. https://console.firebase.google.com → **Add project**
2. **Build → Realtime Database** → создать в тестовом режиме
3. **Project settings → Your apps → Web** → скопировать `firebaseConfig`
4. Вставить в `firebase-config.js`

**Правила БД:**
```json
{
  "rules": {
    "users": { ".read": true, ".write": true },
    "bookings": { ".read": true, ".write": true, ".indexOn": ["userId", "date"] },
    "reviews": { ".read": true, ".write": true },
    "settings": { ".read": true, ".write": true }
  }
}
```

### 2. EmailJS (для писем клиентам)
1. Регистрация: https://www.emailjs.com
2. Add New Service → Gmail / Outlook
3. Create Email Template с переменными: `{{to_name}}`, `{{to_email}}`, `{{service}}`, `{{doctor}}`, `{{date}}`, `{{time}}`, `{{price}}`
4. Скопировать Service ID, Template ID, Public Key в `firebase-config.js`

### 3. GitHub Pages
1. Создать репозиторий, загрузить файлы
2. Settings → Pages → **Deploy from a branch** → `main` / `root`
3. URL: `https://<user>.github.io/<repo>/`
4. Админка: `https://<user>.github.io/<repo>/admin.html`

### 4. Telegram-бот
1. @BotFather → `/newbot` → `/newapp` → указать URL
2. Готово!

### 5. Cloud Functions (напоминания)
```bash
npm install -g firebase-tools
firebase login
firebase init functions
# выбрать существующий проект
# скопировать functions/index.js и functions/package.json
cd functions && npm install
cd ..
firebase functions:config:set email.user="your@gmail.com" email.pass="app-password"
firebase deploy --only functions
```
> Для Gmail нужен **App Password**: https://myaccount.google.com/apppasswords

### 6. Настройка уведомлений админу
В `firebase-config.js` заполните `ADMIN_CONFIG`:
- `adminTelegramId` — ваш ID (узнать у @userinfobot)
- `botToken` — токен из @BotFather
- `notifyChatId` — ID чата
- `adminPassword` — пароль для админки

## Безопасность

⚠️ Текущая версия — MVP. Для продакшена:
- Замените пароль в админке на Firebase Auth
- Ограничьте правила БД через Firebase Auth
- Храните `botToken` и SMTP-пароли в Cloud Functions config, не в клиенте
