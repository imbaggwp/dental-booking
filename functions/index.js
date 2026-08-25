const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Инициализация Firebase Admin
admin.initializeApp();

// ====== КОНФИГУРАЦИЯ ======
// Устанавливается через: firebase functions:config:set
// telegram.token="BOT_TOKEN" telegram.admin="ADMIN_CHAT_ID"
// email.user="your@gmail.com" email.pass="APP_PASSWORD"
const config = functions.config();

const BOT_TOKEN = config.telegram?.token || '';
const ADMIN_CHAT_ID = config.telegram?.admin || '';
const EMAIL_USER = config.email?.user || '';
const EMAIL_PASS = config.email?.pass || '';

// ====== НАСТРОЙКА EMAIL-ТРАНСПОРТА ======
let transporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
  console.log('✅ Email transporter initialized for', EMAIL_USER);
}

// ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======

/**
 * Отправка сообщения в Telegram
 */
async function sendTelegram(chatId, text, parseMode = 'Markdown') {
  if (!BOT_TOKEN) {
    console.warn('⚠️ BOT_TOKEN не установлен');
    return;
  }
  if (!chatId) {
    console.warn('⚠️ chatId не указан');
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('❌ Telegram API error:', data.description);
    } else {
      console.log(`✅ Telegram sent to ${chatId}`);
    }
    return data;
  } catch (e) {
    console.error('❌ Telegram send error:', e);
  }
}

/**
 * Отправка email
 */
async function sendEmail(to, subject, html) {
  if (!transporter) {
    console.warn('⚠️ Email transporter не инициализирован');
    return;
  }
  if (!to) {
    console.warn('⚠️ Email не указан');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Dental Care" <${EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`✅ Email sent to ${to}:`, info.messageId);
    return info;
  } catch (e) {
    console.error('❌ Email send error:', e);
  }
}

/**
 * Форматирование даты на русском
 */
function formatDateRu(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

// ====== 1. НАПОМИНАНИЕ ЗА ДЕНЬ ДО ПРИЁМА ======
// Запускается каждый день в 10:00 МСК
exports.sendReminders = functions.pubsub
  .schedule('0 10 * * *')
  .timeZone('Europe/Moscow')
  .onRun(async (context) => {
    console.log('🔔 Запуск напоминаний');

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    console.log('📅 Проверяем записи на', tomorrow);

    try {
      const snap = await admin.database()
        .ref('bookings')
        .orderByChild('date')
        .equalTo(tomorrow)
        .once('value');

      const data = snap.val();
      if (!data) {
        console.log('ℹ️ Записей на завтра нет');
        return null;
      }

      let sentCount = 0;
      const entries = Object.entries(data);

      for (const [key, booking] of entries) {
        // Пропускаем отменённые и уже напомненные
        if (booking.status !== 'confirmed') {
          console.log(`⏭ Пропускаем ${key}: статус ${booking.status}`);
          continue;
        }
        if (booking.reminderSent) {
          console.log(`⏭ Пропускаем ${key}: напомнение уже отправлено`);
          continue;
        }

        const dateRu = formatDateRu(booking.date);
        const serviceName = booking.serviceName?.ru || booking.serviceName || '—';

        // === Telegram клиенту ===
        if (booking.userId) {
          const tgText =
`🦷 *Напоминание о приёме*

Здравствуйте, ${booking.userName}!

Напоминаем о вашем визите *завтра*:

📅 *Дата:* ${dateRu}
🕐 *Время:* ${booking.time}
📋 *Услуга:* ${serviceName}
👨‍⚕️ *Врач:* ${booking.doctorName || '—'}
💰 *Стоимость:* ${booking.price}

Если нужно отменить или перенести — сделайте это в приложении.
Ждём вас! 🦷`;

          await sendTelegram(booking.userId, tgText);
        }

        // === Email клиенту ===
        if (booking.userEmail) {
          const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#f5f7fb;padding:20px">
  <div style="background:#fff;border-radius:20px;padding:30px;box-shadow:0 8px 24px rgba(91,110,245,.08)">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:48px">🦷</div>
      <h1 style="color:#5b6ef5;margin:10px 0 0;font-size:24px">Dental Care</h1>
    </div>
    <h2 style="color:#0f1729;margin:0 0 10px">Здравствуйте, ${booking.userName}!</h2>
    <p style="color:#555;line-height:1.6">Напоминаем о вашем визите <b>завтра</b>:</p>
    <div style="background:linear-gradient(135deg,rgba(91,110,245,.08),rgba(34,211,238,.08));padding:20px;border-radius:14px;margin:20px 0">
      <p style="margin:6px 0"><b>📅 Дата:</b> ${dateRu}</p>
      <p style="margin:6px 0"><b>🕐 Время:</b> ${booking.time}</p>
      <p style="margin:6px 0"><b>📋 Услуга:</b> ${serviceName}</p>
      <p style="margin:6px 0"><b>👨‍⚕️ Врач:</b> ${booking.doctorName || '—'}</p>
      <p style="margin:6px 0"><b>💰 Стоимость:</b> ${booking.price}</p>
    </div>
    <p style="color:#555;line-height:1.6">Если нужно отменить или перенести — сделайте это в приложении.</p>
    <p style="color:#555;line-height:1.6;margin-top:20px">Ждём вас! 🦷</p>
    <p style="color:#8893a7;font-size:12px;margin-top:30px;text-align:center">Dental Care — современная стоматология</p>
  </div>
</div>`;
          await sendEmail(
            booking.userEmail,
            `🦷 Напоминание: приём завтра в ${booking.time}`,
            emailHtml
          );
        }

        // === Помечаем как отправленное ===
        await admin.database().ref('bookings/' + key).update({ reminderSent: true });
        sentCount++;
      }

      console.log(`✅ Отправлено напоминаний: ${sentCount}`);
    } catch (e) {
      console.error('❌ Ошибка в sendReminders:', e);
    }

    return null;
  });

// ====== 2. УВЕДОМЛЕНИЕ ПРИ ИЗМЕНЕНИИ СТАТУСА ЗАПИСИ ======
exports.onBookingStatusChange = functions.database
  .ref('bookings/{bookingId}/status')
  .onUpdate(async (change, context) => {
    const before = change.before.val();
    const after = change.after.val();

    if (before === after) return null;

    const bookingId = context.params.bookingId;
    console.log(`🔄 Статус записи ${bookingId}: ${before} → ${after}`);

    try {
      const snap = await admin.database().ref('bookings/' + bookingId).once('value');
      const booking = snap.val();
      if (!booking) return null;

      const dateRu = formatDateRu(booking.date);
      const serviceName = booking.serviceName?.ru || booking.serviceName || '—';

      let tgText = '';
      let emailSubject = '';
      let emailHtml = '';

      // === ОТМЕНА ===
      if (after === 'cancelled') {
        tgText =
`❌ *Запись отменена*

Здравствуйте, ${booking.userName}!

Ваша запись была отменена:

📅 ${dateRu} в ${booking.time}
📋 ${serviceName}
👨‍⚕️ ${booking.doctorName || '—'}

Вы можете записаться снова в приложении.
Если у вас есть вопросы — свяжитесь с нами.`;

        emailSubject = '❌ Ваша запись отменена';
        emailHtml = buildStatusEmail(booking, 'отменена', '❌', '#ef4444');
      }

      // === ВОССТАНОВЛЕНИЕ ===
      else if (after === 'confirmed' && before === 'cancelled') {
        tgText =
`✅ *Запись восстановлена*

Здравствуйте, ${booking.userName}!

Ваша запись снова активна:

📅 ${dateRu} в ${booking.time}
📋 ${serviceName}
👨‍⚕️ ${booking.doctorName || '—'}

Ждём вас! 🦷`;

        emailSubject = '✅ Ваша запись восстановлена';
        emailHtml = buildStatusEmail(booking, 'восстановлена', '✅', '#10b981');
      }

      // === ЗАВЕРШЕНИЕ ВИЗИТА ===
      else if (after === 'completed') {
        tgText =
`✨ *Визит завершён*

Здравствуйте, ${booking.userName}!

Спасибо, что выбрали Dental Care!

📅 ${dateRu}
📋 ${serviceName}
👨‍⚕️ ${booking.doctorName || '—'}

Будем рады оставить отзыв в приложении — это поможет нам стать лучше! 🦷`;

        emailSubject = '✨ Спасибо за визит! Оставьте отзыв';
        emailHtml = buildStatusEmail(booking, 'завершён', '✨', '#5b6ef5', true);
      }

      if (!tgText) return null;

      // Отправляем клиенту
      if (booking.userId) {
        await sendTelegram(booking.userId, tgText);
      }
      if (booking.userEmail && emailHtml) {
        await sendEmail(booking.userEmail, emailSubject, emailHtml);
      }

      // Уведомляем админа о смене статуса
      if (ADMIN_CHAT_ID) {
        const adminText =
`🔄 *Статус записи изменён*

👤 ${booking.userName}
📋 ${serviceName}
📅 ${dateRu} в ${booking.time}

Статус: ${before} → *${after}*`;
        await sendTelegram(ADMIN_CHAT_ID, adminText);
      }
    } catch (e) {
      console.error('❌ Ошибка в onBookingStatusChange:', e);
    }

    return null;
  });

// ====== 3. УВЕДОМЛЕНИЕ АДМИНУ О НОВОЙ ЗАПИСИ ======
exports.onNewBooking = functions.database
  .ref('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const booking = snap.val();
    if (!booking) return null;

    console.log('🆕 Новая запись:', context.params.bookingId);

    if (!ADMIN_CHAT_ID) {
      console.warn('⚠️ ADMIN_CHAT_ID не установлен');
      return null;
    }

    try {
      const dateRu = formatDateRu(booking.date);
      const serviceName = booking.serviceName?.ru || booking.serviceName || '—';

      const text =
`🦷 *Новая запись!*

👤 *Клиент:* ${booking.userName}
📱 Телефон: ${booking.userPhone || '—'}
✉️ Email: ${booking.userEmail || '—'}
🆔 Telegram: @${booking.username || booking.userId}

📋 *Услуга:* ${serviceName}
👨‍⚕️ *Врач:* ${booking.doctorName || '—'}
💰 *Стоимость:* ${booking.price}
📅 *Дата:* ${dateRu}
🕐 *Время:* ${booking.time}`;

      await sendTelegram(ADMIN_CHAT_ID, text);
    } catch (e) {
      console.error('❌ Ошибка уведомления админа:', e);
    }

    return null;
  });

// ====== ВСПОМОГАТЕЛЬНАЯ: генерация HTML для email ======
function buildStatusEmail(booking, action, emoji, color, withReview = false) {
  const dateRu = formatDateRu(booking.date);
  const serviceName = booking.serviceName?.ru || booking.serviceName || '—';

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#f5f7fb;padding:20px">
  <div style="background:#fff;border-radius:20px;padding:30px;box-shadow:0 8px 24px rgba(91,110,245,.08)">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:64px">${emoji}</div>
      <h1 style="color:${color};margin:10px 0 0;font-size:24px">Dental Care</h1>
    </div>
    <h2 style="color:#0f1729;margin:0 0 10px">Здравствуйте, ${booking.userName}!</h2>
    <p style="color:#555;line-height:1.6">Ваша запись ${action}:</p>
    <div style="background:linear-gradient(135deg,rgba(91,110,245,.08),rgba(34,211,238,.08));padding:20px;border-radius:14px;margin:20px 0">
      <p style="margin:6px 0"><b>📅 Дата:</b> ${dateRu}</p>
      <p style="margin:6px 0"><b>🕐 Время:</b> ${booking.time}</p>
      <p style="margin:6px 0"><b>📋 Услуга:</b> ${serviceName}</p>
      <p style="margin:6px 0"><b>👨‍⚕️ Врач:</b> ${booking.doctorName || '—'}</p>
      <p style="margin:6px 0"><b>💰 Стоимость:</b> ${booking.price}</p>
    </div>
    ${withReview ? `
      <p style="color:#555;line-height:1.6">Будем рады, если вы оставите отзыв в приложении — это поможет нам стать лучше! 🦷</p>
    ` : `
      <p style="color:#555;line-height:1.6">Вы можете записаться снова в приложении.</p>
      <p style="color:#555;line-height:1.6">Если у вас есть вопросы — свяжитесь с нами.</p>
    `}
    <p style="color:#8893a7;font-size:12px;margin-top:30px;text-align:center">Dental Care — современная стоматология</p>
  </div>
</div>`;
}
