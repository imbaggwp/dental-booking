// ====== EmailJS init ======
if (typeof emailjs !== 'undefined' && EMAIL_CONFIG.publicKey) {
  emailjs.init({ publicKey: EMAIL_CONFIG.publicKey });
}

// ====== Данные по умолчанию (переопределяются из Firebase) ======
const DEFAULT_SERVICES = [
  { id: 'consult', name: 'Консультация', desc: 'Осмотр и план лечения', price: '1 500 ₽', icon: '🩺' },
  { id: 'clean',   name: 'Чистка зубов', desc: 'Профессиональная гигиена', price: '4 500 ₽', icon: '✨' },
  { id: 'fill',    name: 'Лечение кариеса', desc: 'Пломбирование', price: '5 000 ₽', icon: '🦷' },
  { id: 'extract', name: 'Удаление зуба', desc: 'Простое / сложное', price: 'от 3 500 ₽', icon: '🔧' },
  { id: 'implant', name: 'Имплантация', desc: 'Установка импланта', price: 'от 35 000 ₽', icon: '💎' },
  { id: 'kids',    name: 'Детский приём', desc: 'Для пациентов до 14 лет', price: '2 500 ₽', icon: '🧸' }
];
const DEFAULT_DOCTORS = [
  { id: 'd1', name: 'Иванов И.И.', spec: 'Терапевт', exp: '12 лет', icon: '👨‍⚕️' },
  { id: 'd2', name: 'Петрова А.С.', spec: 'Хирург-имплантолог', exp: '15 лет', icon: '👩‍⚕️' },
  { id: 'd3', name: 'Сидоров П.В.', spec: 'Ортодонт', exp: '10 лет', icon: '👨‍⚕️' },
  { id: 'd4', name: 'Козлова М.А.', spec: 'Детский стоматолог', exp: '8 лет', icon: '👩‍⚕️' }
];
const TIME_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

// ====== Состояние ======
const state = {
  user: null,
  profile: null,
  services: DEFAULT_SERVICES,
  doctors: DEFAULT_DOCTORS,
  service: null,
  doctor: null,
  date: null,
  time: null,
  calMonth: new Date(),
  currentReviewBookingId: null
};

// ====== Telegram WebApp ======
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  state.user = tg.initDataUnsafe?.user || null;
}

// ====== УТИЛИТЫ ======
function showToast(msg, duration = 2500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function goToStep(stepId) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.step === stepId);
  });
  // Обновляем бейдж шага
  const badge = document.getElementById('step-badge');
  const map = {
    'step-service': 'Шаг 2 из 5 · Услуга',
    'step-doctor': 'Шаг 3 из 5 · Врач',
    'step-date': 'Шаг 4 из 5 · Дата',
    'step-time': 'Шаг 4 из 5 · Время',
    'step-confirm': 'Шаг 5 из 5 · Подтверждение',
    'step-my': 'Мои записи'
  };
  if (badge && map[stepId]) badge.textContent = map[stepId];
}

// ====== СТАРТ ======
async function init() {
  if (!state.user) {
    showToast('Откройте приложение заново из Telegram');
    return;
  }
  // Загружаем настройки из Firebase
  await loadSettings();

  try {
    const snap = await db.ref('users/' + state.user.id).once('value');
    state.profile = snap.val();
  } catch (e) { console.error(e); }

  if (state.profile) {
    showMainUI();
    renderServices();
    goToStep('step-service');
  } else {
    goToStep('step-welcome');
    const tgName = `${state.user.first_name || ''} ${state.user.last_name || ''}`.trim();
    if (tgName) document.getElementById('reg-name').value = tgName;
  }
}

async function loadSettings() {
  try {
    const [sSnap, dSnap] = await Promise.all([
      db.ref('settings/services').once('value'),
      db.ref('settings/doctors').once('value')
    ]);
    const s = sSnap.val();
    const d = dSnap.val();
    if (s) state.services = Object.values(s).filter(x => x.active !== false);
    if (d) state.doctors = Object.values(d).filter(x => x.active !== false);
  } catch (e) { console.error(e); }
}

function showMainUI() {
  document.getElementById('main-header').style.display = 'block';
  document.getElementById('bottom-nav').style.display = 'flex';
  const name = state.profile?.name || state.user.first_name || '';
  document.getElementById('greeting').textContent = `Здравствуйте, ${name.split(' ')[0]}!`;
  document.getElementById('user-avatar').textContent = (name[0] || '?').toUpperCase();
}

// ====== WELCOME → регистрация ======
document.getElementById('btn-start').onclick = () => {
  goToStep('step-register');
  tg?.HapticFeedback?.impactOccurred('light');
};

document.getElementById('btn-share-phone').onclick = () => {
  if (!tg || !tg.requestContact) {
    showToast('Функция доступна только в Telegram');
    return;
  }
  tg.requestContact(() => showToast('✅ Номер получен'));
};

// ====== РЕГИСТРАЦИЯ ======
document.getElementById('btn-register').onclick = async () => {
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const email = document.getElementById('reg-email').value.trim();

  if (!name) { showToast('Укажите имя'); return; }
  if (!phone) { showToast('Укажите телефон'); return; }

  const btn = document.getElementById('btn-register');
  btn.disabled = true;

  const profile = {
    telegramId: state.user.id,
    telegramUsername: state.user.username || '',
    name, phone, email,
    registeredAt: Date.now()
  };

  try {
    await db.ref('users/' + state.user.id).set(profile);
    state.profile = profile;
    tg?.HapticFeedback?.notificationOccurred('success');
    showToast('✅ Регистрация завершена');
    showMainUI();
    renderServices();
    goToStep('step-service');
  } catch (e) {
    console.error(e);
    showToast('Ошибка сохранения');
  } finally {
    btn.disabled = false;
  }
};

// ====== УСЛУГИ ======
function renderServices() {
  const el = document.getElementById('services');
  el.innerHTML = '';
  state.services.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card glass-card';
    card.innerHTML = `
      <div class="card-main">
        <div class="card-icon">${s.icon || '🦷'}</div>
        <div class="info">
          <div class="name">${s.name}</div>
          <div class="desc">${s.desc || ''}</div>
        </div>
      </div>
      <div class="price">${s.price}</div>`;
    card.onclick = () => {
      state.service = s;
      renderDoctors();
      goToStep('step-doctor');
      tg?.HapticFeedback?.selectionChanged();
    };
    el.appendChild(card);
  });
}

// ====== ВРАЧИ ======
function renderDoctors() {
  const el = document.getElementById('doctors');
  el.innerHTML = '';
  state.doctors.forEach(d => {
    const card = document.createElement('div');
    card.className = 'card glass-card';
    card.innerHTML = `
      <div class="card-main">
        <div class="card-icon">${d.icon || '👨‍⚕️'}</div>
        <div class="info">
          <div class="name">${d.name}</div>
          <div class="desc">${d.spec || ''}</div>
          <div class="meta">Опыт: ${d.exp || '—'}</div>
        </div>
      </div>`;
    card.onclick = () => {
      state.doctor = d;
      renderCalendar();
      goToStep('step-date');
      tg?.HapticFeedback?.selectionChanged();
    };
    el.appendChild(card);
  });
}

// ====== НАВИГАЦИЯ ======
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    goToStep(btn.dataset.step);
    if (btn.dataset.step === 'step-my') loadMyBookings();
  });
});

// ====== КАЛЕНДАРЬ ======
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function renderCalendar() {
  const month = state.calMonth.getMonth();
  const year = state.calMonth.getFullYear();
  document.getElementById('cal-month').textContent = `${MONTHS[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;

  const daysEl = document.getElementById('cal-days');
  daysEl.innerHTML = '';
  const today = new Date(); today.setHours(0,0,0,0);

  for (let i = 0; i < startWeekday; i++) daysEl.appendChild(document.createElement('div'));

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const el = document.createElement('div');
    el.className = 'day';
    el.textContent = d;
    const isPast = date < today;
    const isSunday = date.getDay() === 0;
    if (isPast || isSunday) el.classList.add('disabled');
    if (date.getTime() === today.getTime()) el.classList.add('today');
    if (state.date && date.toDateString() === state.date.toDateString()) el.classList.add('selected');

    if (!isPast && !isSunday) {
      el.onclick = () => {
        state.date = date;
        state.time = null;
        renderCalendar();
        renderTimeSlots();
        goToStep('step-time');
        tg?.HapticFeedback?.selectionChanged();
      };
    }
    daysEl.appendChild(el);
  }
}

document.getElementById('prev-month').onclick = () => {
  state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
  renderCalendar();
};
document.getElementById('next-month').onclick = () => {
  state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
  renderCalendar();
};

// ====== ВРЕМЯ ======
async function renderTimeSlots() {
  const label = document.getElementById('selected-date-label');
  label.textContent = state.date.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const slotsEl = document.getElementById('time-slots');
  slotsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--hint);padding:20px">Загрузка...</div>';

  const dateKey = state.date.toISOString().slice(0,10);
  const taken = await fetchTakenSlots(dateKey);

  slotsEl.innerHTML = '';
  TIME_SLOTS.forEach(t => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.textContent = t;
    if (taken.includes(t)) {
      el.classList.add('taken');
    } else {
      el.onclick = () => {
        state.time = t;
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
        renderSummary();
        goToStep('step-confirm');
        tg?.HapticFeedback?.selectionChanged();
      };
    }
    slotsEl.appendChild(el);
  });
}

async function fetchTakenSlots(dateKey) {
  try {
    const snap = await db.ref('bookings').orderByChild('date').equalTo(dateKey).once('value');
    const taken = [];
    snap.forEach(child => {
      const b = child.val();
      if (b.status !== 'cancelled') taken.push(b.time);
    });
    return taken;
  } catch (e) { console.error(e); return []; }
}

// ====== ПОДТВЕРЖДЕНИЕ ======
function renderSummary() {
  const el = document.getElementById('summary');
  el.innerHTML = `
    <div class="row"><span class="label">Услуга</span><span class="value">${state.service.name}</span></div>
    <div class="row"><span class="label">Врач</span><span class="value">${state.doctor.name}</span></div>
    <div class="row"><span class="label">Дата</span><span class="value">${state.date.toLocaleDateString('ru-RU')}</span></div>
    <div class="row"><span class="label">Время</span><span class="value">${state.time}</span></div>
    <div class="row"><span class="label">Стоимость</span><span class="value">${state.service.price}</span></div>
  `;
}

// ====== УВЕДОМЛЕНИЕ АДМИНУ ======
async function notifyAdmin(booking) {
  if (!ADMIN_CONFIG.botToken || !ADMIN_CONFIG.notifyChatId) return;
  const dateStr = new Date(booking.date).toLocaleDateString('ru-RU');
  const text =
`🦷 *Новая запись*

👤 Клиент: ${booking.userName}
📱 Телефон: ${booking.userPhone || '—'}
🆔 Telegram: @${booking.username || booking.userId}

📋 Услуга: ${booking.serviceName}
👨‍⚕️ Врач: ${booking.doctorName}
💰 Стоимость: ${booking.price}
📅 Дата: ${dateStr}
🕐 Время: ${booking.time}`;

  try {
    await fetch(`https://api.telegram.org/bot${ADMIN_CONFIG.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CONFIG.notifyChatId, text, parse_mode: 'Markdown' })
    });
  } catch (e) { console.error(e); }
}

// ====== EMAIL-ПОДТВЕРЖДЕНИЕ ======
async function sendConfirmationEmail(booking) {
  if (!booking.userEmail || !EMAIL_CONFIG.publicKey) return;
  const dateStr = new Date(booking.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
  try {
    await emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templateId, {
      to_name: booking.userName,
      to_email: booking.userEmail,
      service: booking.serviceName,
      doctor: booking.doctorName,
      date: dateStr,
      time: booking.time,
      price: booking.price,
      booking_id: booking.id
    });
  } catch (e) { console.error('Email error:', e); }
}

// ====== СОЗДАНИЕ ЗАПИСИ ======
document.getElementById('btn-book').onclick = async () => {
  if (!state.profile) { showToast('Сначала зарегистрируйтесь'); return; }

  const btn = document.getElementById('btn-book');
  btn.disabled = true;

  const booking = {
    userId: state.user.id,
    userName: state.profile.name,
    userPhone: state.profile.phone,
    userEmail: state.profile.email || '',
    username: state.user.username || '',
    serviceId: state.service.id,
    serviceName: state.service.name,
    doctorId: state.doctor.id,
    doctorName: state.doctor.name,
    price: state.service.price,
    date: state.date.toISOString().slice(0,10),
    time: state.time,
    status: 'confirmed',
    createdAt: Date.now()
  };

  try {
    const ref = db.ref('bookings').push();
    await ref.set(booking);
    booking.id = ref.key;

    tg?.HapticFeedback?.notificationOccurred('success');
    showToast('✅ Вы записаны! Подтверждение отправлено на email');

    await Promise.all([
      notifyAdmin(booking),
      sendConfirmationEmail(booking)
    ]);

    state.service = state.doctor = state.date = state.time = null;
    goToStep('step-my');
    loadMyBookings();
  } catch (e) {
    console.error(e);
    showToast('Ошибка при записи');
  } finally {
    btn.disabled = false;
  }
};

// ====== МОИ ЗАПИСИ ======
async function loadMyBookings() {
  const list = document.getElementById('my-bookings');
  list.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>Загрузка...</div>';
  if (!state.user) return;

  try {
    const snap = await db.ref('bookings').orderByChild('userId').equalTo(state.user.id).once('value');
    const bookings = [];
    snap.forEach(c => bookings.push({ id: c.key, ...c.val() }));
    bookings.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    if (!bookings.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>У вас пока нет записей</div>';
      return;
    }

    const today = new Date().toISOString().slice(0,10);
    list.innerHTML = '';
    bookings.forEach(b => {
      const el = document.createElement('div');
      el.className = 'booking glass-card' + (b.status === 'cancelled' ? ' cancelled' : '');
      const dateStr = new Date(b.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
      const isPast = b.date < today;
      const hasReview = b.review;
      let statusText = 'Подтверждено', statusClass = 'confirmed';
      if (b.status === 'cancelled') { statusText = 'Отменено'; statusClass = 'cancelled'; }
      else if (isPast) { statusText = 'Завершено'; statusClass = 'done'; }

      el.innerHTML = `
        <div class="b-top">
          <span class="b-service">${b.serviceName}</span>
          <span class="b-status ${statusClass}">${statusText}</span>
        </div>
        <div class="b-date">📅 ${dateStr} в ${b.time} · 💰 ${b.price}</div>
        ${b.doctorName ? `<div class="b-doctor">👨‍⚕️ ${b.doctorName}</div>` : ''}
        <div class="b-actions">
          ${b.status !== 'cancelled' && !isPast ? `<button class="cancel" data-id="${b.id}">Отменить</button>` : ''}
          ${isPast && b.status !== 'cancelled' && !hasReview ? `<button class="review" data-id="${b.id}">★ Оставить отзыв</button>` : ''}
          ${hasReview ? `<div style="font-size:12px;color:var(--hint);padding:6px 0">Ваш отзыв: ${'★'.repeat(hasReview.rating)}${'☆'.repeat(5-hasReview.rating)}</div>` : ''}
        </div>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll('.cancel').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Отменить запись?')) return;
        await db.ref('bookings/' + btn.dataset.id).update({ status: 'cancelled' });
        tg?.HapticFeedback?.notificationOccurred('warning');
        showToast('Запись отменена');
        loadMyBookings();
      };
    });

    list.querySelectorAll('.review').forEach(btn => {
      btn.onclick = () => openReviewModal(btn.dataset.id);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div class="empty">Ошибка загрузки</div>';
  }
}

// ====== ОТЗЫВЫ ======
function openReviewModal(bookingId) {
  state.currentReviewBookingId = bookingId;
  document.getElementById('review-modal').style.display = 'flex';
  document.getElementById('review-text').value = '';
  document.querySelectorAll('#rating span').forEach(s => s.classList.remove('active'));
}
function closeReviewModal() {
  document.getElementById('review-modal').style.display = 'none';
  state.currentReviewBookingId = null;
}
let currentRating = 0;
document.querySelectorAll('#rating span').forEach(span => {
  span.onclick = () => {
    currentRating = parseInt(span.dataset.v);
    document.querySelectorAll('#rating span').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.v) <= currentRating);
    });
  };
});

document.getElementById('btn-submit-review').onclick = async () => {
  if (!currentRating) { showToast('Поставьте оценку'); return; }
  const text = document.getElementById('review-text').value.trim();
  const id = state.currentReviewBookingId;
  if (!id) return;

  try {
    const snap = await db.ref('bookings/' + id).once('value');
    const b = snap.val();
    if (!b) return;

    const review = {
      bookingId: id,
      userId: state.user.id,
      userName: b.userName,
      doctorId: b.doctorId,
      doctorName: b.doctorName,
      serviceId: b.serviceId,
      serviceName: b.serviceName,
      rating: currentRating,
      text,
      status: 'pending',
      createdAt: Date.now()
    };
    await Promise.all([
      db.ref('reviews').push().set(review),
      db.ref('bookings/' + id + '/review').set({ rating: currentRating, text })
    ]);
    tg?.HapticFeedback?.notificationOccurred('success');
    showToast('✅ Спасибо за отзыв!');
    closeReviewModal();
    currentRating = 0;
    loadMyBookings();
  } catch (e) {
    console.error(e);
    showToast('Ошибка отправки');
  }
};

// ====== ЗАПУСК ======
init();
