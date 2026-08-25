const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Email через nodemailer + Gmail (или любой SMTP)
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email.user,     // ваш gmail
    pass: functions.config().email.pass      // app password
  }
});

// Запуск каждый день в 10:00
exports.sendReminders = functions.pubsub.schedule('0 10 * * *')
  .timeZone('Europe/Moscow')
  .onRun(async (context) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10);
    console.log('Checking bookings for', tomorrow);

    const snap = await admin.database().ref('bookings')
      .orderByChild('date').equalTo(tomorrow).once('value');

    let sent = 0;
    for (const child of Object.values(snap.val() || {})) {
      const b = child;
      if (b.status !== 'confirmed' || b.reminderSent) continue;
      if (!b.userEmail) continue;

      try {
        await transporter.sendMail({
          from: '"Dental Care" <' + functions.config().email.user + '>',
          to: b.userEmail,
          subject: '🦷 Напоминание о приёме завтра',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
              <h2 style="color:#5b6ef5">Здравствуйте, ${b.userName}!</h2>
              <p>Напоминаем о вашем приёме <b>завтра</b>:</p>
              <div style="background:#f5f7fb;padding:16px;border-radius:12px;margin:16px 0">
                <p><b>📋 Услуга:</b> ${b.serviceName}</p>
                <p><b>👨‍⚕️ Врач:</b> ${b.doctorName}</p>
                <p><b>📅 Дата:</b> ${new Date(b.date).toLocaleDateString('ru-RU')}</p>
                <p><b>🕐 Время:</b> ${b.time}</p>
              </div>
              <p>Ждём вас! Если нужно отменить — сделайте это в приложении.</p>
              <p style="color:#8893a7;font-size:12px">Dental Care</p>
            </div>
          `
        });
        await admin.database().ref('bookings/' + child['.key'] || Object.keys(snap.val())[sent]).update({ reminderSent: true });
        sent++;
      } catch (e) {
        console.error('Email failed for', b.userEmail, e);
      }
    }
    console.log(`Sent ${sent} reminders`);
    return null;
  });
