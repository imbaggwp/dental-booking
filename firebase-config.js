// ====== FIREBASE ======
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  databaseURL: "https://your-app-default-rtdb.firebaseio.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// ====== АДМИН И УВЕДОМЛЕНИЯ ======
const ADMIN_CONFIG = {
  adminTelegramId: 123456789,
  botToken: "123456:ABC-DEF...",
  notifyChatId: 123456789,
  adminPassword: "your-secret-password"
};

// ====== EMAIL (EmailJS) ======
// Регистрация: https://www.emailjs.com (бесплатно 200 писем/мес)
const EMAIL_CONFIG = {
  serviceId: "service_xxxxx",    // ваш Email Service ID
  templateId: "template_xxxxx",  // ваш Template ID
  publicKey: "xxxxxxxxxxxxxxx"   // ваш Public Key
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
