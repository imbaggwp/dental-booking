// ====== EmailJS init ======
if (typeof emailjs !== 'undefined' && EMAIL_CONFIG.publicKey) {
  emailjs.init({ publicKey: EMAIL_CONFIG.publicKey });
}

// ====== Данные по умолчанию ======
const DEFAULT_SERVICES = [
  { id: 'consult', name: {ru:'Консультация', en:'Consultation'}, desc: {ru:'Осмотр и план лечения', en:'Examination and treatment plan'}, price: '1 500 ₽', icon: '🩺' },
  { id: 'clean',   name: {ru:'Чистка зубов', en:'Teeth cleaning'}, desc: {ru:'Профессиональная гигиена', en:'Professional hygiene'}, price: '4 500 ₽', icon: '✨' },
  { id: 'fill',    name: {ru:'Лечение кариеса', en:'Cavity treatment'}, desc: {ru:'Пломбирование', en:'Filling'}, price: '5 000 ₽', icon: '🦷' },
  { id: 'extract', name: {ru:'Удаление зуба', en:'Tooth extraction'}, desc: {ru:'Простое / сложное', en:'Simple / complex'}, price: 'от 3 500 ₽', icon: '🔧' },
  { id: 'implant', name: {ru:'Имплантация', en:'Implantation'}, desc: {ru:'Установка импланта', en:'Implant placement'}, price: 'от 35 000 ₽', icon: '💎' },
  { id: 'kids',    name: {ru:'Детский приём', en:'Pediatric visit'}, desc: {ru:'Для пациентов до 14 лет', en:'For patients under 14'}, price: '2 500 ₽', icon: '🧸' }
];

const DEFAULT_DOCTORS = [
  { id: 'd1', name: 'Иванов И.И.', spec: {ru:'Терапевт', en:'Therapist'}, exp: '12', icon: '👨⚕️' },
  { id: 'd2', name: 'Петрова А.С.', spec: {ru:'Хирург-имплантолог', en:'Implant surgeon'}, exp: '15', icon: '👩⚕️' },
  { id: 'd3', name: 'Сидоров П.В.', spec: {ru:'Ортодонт', en:'Orthodontist'}, exp: '10', icon: '👨‍⚕️' },
  { id: 'd4', name: 'Козлова М.А.', spec: {ru:'Детский стоматолог', en:'Pediatric dentist'}, exp: '8', icon: '‍⚕️' }
];

const TIME_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

// ====== Состояние ======
const state = {
  user: null,
  profile: null,
  services: DEFAULT_SERVICES,
  doctors: DEFAULT_DOCTORS,
  promotions: [],
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
  
  const badge = document.getElementById('step-badge');
  const map = {
    'step-service': `${t('stepService')} · 2/5`,
    'step-doctor': `${t('stepDoctor')} · 3/5`,
    'step-date': `${t('stepDate')} · 4/5`,
    'step-time': `${t('stepTime')} · 4/5`,
    'step-confirm': `${t('stepConfirm')} · 5/5`,
    'step-my': t('myBookings')
  };
  if (badge && map[stepId]) badge.textContent = map[stepId];
}

// Локализованное название
function loc(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[currentLang] || obj.ru || Object.values(obj)[0] || '';
}

// ====== СТАРТ ======
async function init() {
  // Определяем язык
  const savedLang = localStorage.getItem('dental_lang');
  if (savedLang && translations[savedLang]) {
    currentLang = savedLang;
  } else {
    detectLanguage();
  }
  applyTranslations();

  if (!state.user) {
    showToast('Откройте приложение заново из Telegram');
    return;
  }

  await loadSettings();
  await loadPromotions();

  try {
    const snap = await db.ref('users/' + state.user.id).once('value');
    state.profile = snap.val();
  } catch (e) { 
    console.error(e); 
  }

  if (state.profile) {
    showMainUI();
    renderServices();
    goToStep('step-service');
  } else {
    goToStep('step-welcome');
    const tgName = `${state.user.first_name || ''} ${state.user.last_name || ''}`.trim();
    if (tgName) {
      document.getElementById('reg-name').value = tgName;
    }
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
  } catch (e) { 
    console.error(e); 
  }
}

async function loadPromotions() {
  try {
    const snap = await db.ref('promotions').once('value');
    const today = new Date().toISOString().slice(0,10);
    const promos = [];
    snap.forEach(c => {
      const p = c.val();
      if (p.active && (!p.validUntil || p.validUntil >= today)) {
        promos.push({ id: c.key, ...p });
      }
    });
    state.promotions = promos;
    renderPromoBanner();
  } catch (e) { 
    console.error(e); 
  }
}

function renderPromoBanner() {
  const banner = document.getElementById('promo-banner');
  if (!state.promotions.length) { 
    banner.style.display = 'none'; 
    return; 
  }
  const p = state.promotions[0];
  document.getElementById('promo-title').textContent = loc(p.title);
  document.getElementById('promo-desc').textContent = loc(p.desc);
  banner.style.display = 'flex';
}

function showMainUI() {
  document.getElementById('main-header').style.display = 'block';
  document.getElementById('bottom-nav').style.display = 'flex';
  const name = state.profile?.name || state.user.first_name || '';
  document.getElementById('greeting').textContent = `${t('hello')}, ${name.split(' ')[0]}!`;
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
  tg.requestContact(() => showToast('✅'));
};

// ====== РЕГИСТРАЦИЯ ======
document.getElementById('btn-register').onclick = async () => {
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const email = document.getElementById('reg-email').value.trim();

  if (!name) { showToast(t('fillName')); return; }
  if (!phone) { showToast(t('fillPhone')); return; }

  const btn = document.getElementById('btn-register');
  btn.disabled = true;

  const profile = {
    telegramId: state.user.id,
    telegramUsername: state.user.username || '',
    language: currentLang,
    name, phone, email,
    registeredAt: Date.now()
  };

  try {
    await db.ref('users/' + state.user.id).set(profile);
    state.profile = profile;
    tg?.HapticFeedback?.notificationOccurred('success');
    showToast(t('registered'));
    showMainUI();
    renderServices();
    goToStep('step-service');
  } catch (e) {
    console.error(e);
    showToast(t('error'));
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
          <div class="name">${loc(s.name)}</div>
          <div class="desc">${loc(s.desc) || ''}</div>
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
          <div class="desc">${loc(d.spec) || ''}</div>
          <div class="meta">${t('exp')}: ${d.exp || '—'} ${t('years')}</div>
          <button class="portfolio-btn" data-doctor="${d.id}"> ${t('portfolio')}</button>
        </div>
      </div>`;
    
    card.querySelector('.card-main').onclick = (e) => {
      if (e.target.classList.contains('portfolio-btn')) return;
      state.doctor = d;
      renderCalendar();
      goToStep('step-date');
      tg?.HapticFeedback?.selectionChanged();
    };
    
    const portfolioBtn = card.querySelector('.portfolio-btn');
    portfolioBtn.onclick = (e) => {
      e.stopPropagation();
      openGalleryModal(d);
    };
    
    el.appendChild(card);
  });
}

// ====== НАВИГАЦИЯ ======
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    goToStep(btn.dataset.step);
    if (btn.dataset.step === 'step-my') {
      loadMyBookings();
      loadMyHistory();
      renderPromos();
    }
  });
});

// Sub-tabs
document.querySelectorAll('.sub-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));
    document.getElementById('sub-' + tab.dataset.sub).classList.add('active');
  };
});

function showPromotions() {
  goToStep('step-my');
  document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.sub-tab[data-sub="promos"]').classList.add('active');
  document.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));
  document.getElementById('sub-promos').classList.add('active');
  loadMyBookings();
  loadMyHistory();
  renderPromos();
}

// ====== КАЛЕНДАРЬ ======
function renderCalendar() {
  const month = state.calMonth.getMonth();
  const year = state.calMonth.getFullYear();
  document.getElementById('cal-month').textContent = `${t('months')[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;

  const daysEl = document.getElementById('cal-days');
  daysEl.innerHTML = '';
  const today = new Date(); 
  today.setHours(0,0,0,0);

  for (let i = 0; i < startWeekday; i++) {
    daysEl.appendChild(document.createElement('div'));
  }

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
  label.textContent = state.date.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const slotsEl = document.getElementById('time-slots');
  slotsEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--hint);padding:20px">${t('loading')}...</div>`;

  const dateKey = state.date.toISOString().slice(0,10);
  const taken = await fetchTakenSlots(dateKey);

  slotsEl.innerHTML = '';
  TIME_SLOTS.forEach(time => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.textContent = time;
    if (taken.includes(time)) {
      el.classList.add('taken');
    } else {
      el.onclick = () => {
        state.time = time;
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
  } catch (e) { 
    return []; 
  }
}

// ====== ПОДТВЕРЖДЕНИЕ ======
function renderSummary() {
  const el = document.getElementById('summary');
  el.innerHTML = `
    <div class="row"><span class="label">${t('service')}</span><span class="value">${loc(state.service.name)}</span></div>
    <div class="row"><span class="label">${t('doctor')}</span><span class="value">${state.doctor.name}</span></div>
    <div class="row"><span class="label">${t('date')}</span><span class="value">${state.date.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US')}</span></div>
    <div class="row"><span class="label">${t('time')}</span><span class="value">${state.time}</span></div>
    <div class="row"><span class="label">${t('price')}</span><span class="value">${state.service.price}</span></div>
  `;
}

// ====== УВЕДОМЛЕНИЕ АДМИНУ ======
async function notifyAdmin(booking) {
  if (!ADMIN_CONFIG.botToken || !ADMIN_CONFIG.notifyChatId) return;
  const dateStr = new Date(booking.date).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US');
  const text =
`🦷 *New booking*

👤 Client: ${booking.userName}
📱 Phone: ${booking.userPhone || '—'}
🆔 Telegram: @${booking.username || booking.userId}

 Service: ${loc(booking.serviceName)}
👨‍⚕️ Doctor: ${booking.doctorName}
💰 Price: ${booking.price}
📅 Date: ${dateStr}
🕐 Time: ${booking.time}`;

  try {
    await fetch(`https://api.telegram.org/bot${ADMIN_CONFIG.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CONFIG.notifyChatId, text, parse_mode: 'Markdown' })
    });
  } catch (e) { 
    console.error(e); 
  }
}

// ====== EMAIL ======
async function sendConfirmationEmail(booking) {
  if (!booking.userEmail || !EMAIL_CONFIG.publicKey) return;
  const dateStr = new Date(booking.date).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { 
    day:'numeric', month:'long', year:'numeric' 
  });
  try {
    await emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templateId, {
      to_name: booking.userName,
      to_email: booking.userEmail,
      service: loc(booking.serviceName),
      doctor: booking.doctorName,
      date: dateStr,
      time: booking.time,
      price: booking.price
    });
  } catch (e) { 
    console.error(e); 
  }
}

// ====== СОЗДАНИЕ ЗАПИСИ ======
document.getElementById('btn-book').onclick = async () => {
  if (!state.profile) { showToast(t('fillName')); return; }

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
    showToast(t('booked'));

    await Promise.all([
      notifyAdmin(booking),
      sendConfirmationEmail(booking)
    ]);

    state.service = state.doctor = state.date = state.time = null;
    goToStep('step-my');
    loadMyBookings();
    loadMyHistory();
    renderPromos();
  } catch (e) {
    console.error(e);
    showToast(t('error'));
  } finally {
    btn.disabled = false;
  }
};

// ====== МОИ ЗАПИСИ (будущие) ======
async function loadMyBookings() {
  const list = document.getElementById('my-bookings');
  list.innerHTML = `<div class="empty"><div class="empty-icon">📋</div>${t('loading')}...</div>`;
  if (!state.user) return;

  try {
    const snap = await db.ref('bookings').orderByChild('userId').equalTo(state.user.id).once('value');
    const bookings = [];
    snap.forEach(c => bookings.push({ id: c.key, ...c.val() }));
    const today = new Date().toISOString().slice(0,10);
    const upcoming = bookings.filter(b => b.date >= today && b.status !== 'cancelled');
    upcoming.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    if (!upcoming.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">📋</div>${t('noBookings')}</div>`;
      return;
    }

    list.innerHTML = '';
    upcoming.forEach(b => {
      const el = document.createElement('div');
      el.className = 'booking glass-card';
      const dateStr = new Date(b.date).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { 
        day:'numeric', month:'long' 
      });
      el.innerHTML = `
        <div class="b-top">
          <span class="b-service">${loc(b.serviceName)}</span>
          <span class="b-status confirmed">${t('confirmed')}</span>
        </div>
        <div class="b-date">📅 ${dateStr} · 🕐 ${b.time} · 💰 ${b.price}</div>
        ${b.doctorName ? `<div class="b-doctor">👨‍⚕️ ${b.doctorName}</div>` : ''}
        <div class="b-actions">
          <button class="cancel" data-id="${b.id}">${t('cancel')}</button>
        </div>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll('.cancel').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm(t('cancel') + '?')) return;
        await db.ref('bookings/' + btn.dataset.id).update({ status: 'cancelled' });
        tg?.HapticFeedback?.notificationOccurred('warning');
        showToast(t('cancelledMsg'));
        loadMyBookings();
      };
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = `<div class="empty">${t('error')}</div>`;
  }
}

// ====== ИСТОРИЯ ======
async function loadMyHistory() {
  const list = document.getElementById('my-history');
  list.innerHTML = `<div class="empty"><div class="empty-icon">📜</div>${t('loading')}...</div>`;
  if (!state.user) return;

  try {
    const snap = await db.ref('bookings').orderByChild('userId').equalTo(state.user.id).once('value');
    const bookings = [];
    snap.forEach(c => bookings.push({ id: c.key, ...c.val() }));
    const today = new Date().toISOString().slice(0,10);
    const past = bookings.filter(b => b.date < today || b.status === 'cancelled');
    past.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    if (!past.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">📜</div>${t('noHistory')}</div>`;
      return;
    }

    list.innerHTML = '';
    past.forEach(b => {
      const el = document.createElement('div');
      el.className = 'history-item glass-card';
      const dateStr = new Date(b.date).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { 
        day:'numeric', month:'long', year:'numeric' 
      });
      const status = b.status === 'cancelled' ? t('cancelled') : t('done');
      el.innerHTML = `
        <div class="h-head">
          <span class="h-service">${loc(b.serviceName)}</span>
          <span class="b-status ${b.status === 'cancelled' ? 'cancelled' : 'done'}">${status}</span>
        </div>
        <div class="h-date">📅 ${dateStr} · 🕐 ${b.time}</div>
        ${b.doctorName ? `<div class="h-doctor">👨‍️ ${b.doctorName}</div>` : ''}
        ${b.review ? `<div class="h-review">${'★'.repeat(b.review.rating)}${'☆'.repeat(5-b.review.rating)} — ${b.review.text || ''}</div>` : ''}
        <div class="h-actions">
          ${b.status !== 'cancelled' ? `<button class="btn-again" data-id="${b.id}"> ${t('bookAgain')}</button>` : ''}
          ${b.status !== 'cancelled' && !b.review ? `<button class="btn-review" data-id="${b.id}">${t('leaveReview')}</button>` : ''}
        </div>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll('.btn-again').forEach(btn => {
      btn.onclick = () => bookAgain(btn.dataset.id);
    });
    list.querySelectorAll('.btn-review').forEach(btn => {
      btn.onclick = () => openReviewModal(btn.dataset.id);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = `<div class="empty">${t('error')}</div>`;
  }
}

// ====== ЗАПИСАТЬСЯ СНОВА ======
async function bookAgain(bookingId) {
  try {
    const snap = await db.ref('bookings/' + bookingId).once('value');
    const b = snap.val();
    if (!b) return;

    state.service = state.services.find(s => s.id === b.serviceId) || {
      id: b.serviceId, name: b.serviceName, price: b.price
    };
    state.doctor = state.doctors.find(d => d.id === b.doctorId) || {
      id: b.doctorId, name: b.doctorName
    };
    renderCalendar();
    goToStep('step-date');
    showToast('');
  } catch (e) { 
    console.error(e); 
  }
}

// ====== АКЦИИ ======
async function renderPromos() {
  const list = document.getElementById('promos-list');
  if (!state.promotions.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon"></div>${t('noPromos')}</div>`;
    return;
  }
  list.innerHTML = '';
  state.promotions.forEach(p => {
    const el = document.createElement('div');
    el.className = 'promo-card glass-card';
    const until = p.validUntil ? new Date(p.validUntil).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US') : '';
    el.innerHTML = `
      <div class="p-head">
        <div class="p-title">${loc(p.title)}</div>
        ${p.discount ? `<div class="p-discount">-${p.discount}%</div>` : ''}
      </div>
      <div class="p-desc">${loc(p.desc)}</div>
      <div class="p-meta">${t('validUntil')} ${until}</div>
      <button class="p-btn" data-promo="${p.id}">${t('bookPromo')}</button>
    `;
    list.appendChild(el);
  });

  list.querySelectorAll('.p-btn').forEach(btn => {
    btn.onclick = async () => {
      const p = state.promotions.find(x => x.id === btn.dataset.promo);
      if (p?.serviceId) {
        state.service = state.services.find(s => s.id === p.serviceId);
        if (state.service) {
          renderDoctors();
          goToStep('step-doctor');
        }
      } else {
        goToStep('step-service');
      }
    };
  });
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
  if (!currentRating) { showToast(t('fillRating')); return; }
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
    showToast(t('reviewSent'));
    closeReviewModal();
    currentRating = 0;
    loadMyHistory();
  } catch (e) {
    console.error(e);
    showToast(t('error'));
  }
};

// ====== ГАЛЕРЕЯ ВРАЧА ======
async function openGalleryModal(doctor) {
  document.getElementById('gallery-modal').style.display = 'flex';
  document.getElementById('gallery-title').textContent = `${t('portfolio')}: ${doctor.name}`;
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--hint);padding:20px">${t('loading')}...</div>`;

  try {
    const snap = await db.ref('portfolio/' + doctor.id).once('value');
    const photos = [];
    snap.forEach(c => {
      const p = c.val();
      if (p.status === 'approved' || p.status === undefined) {
        photos.push({ id: c.key, ...p });
      }
    });

    if (!photos.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--hint);padding:20px">${t('noPortfolio')}</div>`;
      return;
    }

    grid.innerHTML = '';
    photos.forEach(p => {
      const el = document.createElement('div');
      el.className = 'gallery-item';
      el.innerHTML = `<img src="${p.url}" alt="" loading="lazy">`;
      grid.appendChild(el);
    });
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--hint)">${t('error')}</div>`;
  }
}

function closeGalleryModal() {
  document.getElementById('gallery-modal').style.display = 'none';
}

// ====== ЗАПУСК ======
init();
