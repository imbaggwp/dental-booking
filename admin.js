// ====== AUTH ======
function tryLogin() {
  const pwd = document.getElementById('admin-password').value;
  if (pwd === ADMIN_CONFIG.adminPassword) {
    sessionStorage.setItem('adminAuth', '1');
    showPanel();
  } else alert('Неверный пароль');
}
function showPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-panel').classList.add('active');
  loadStats();
  loadBookings();
  loadUsers();
  loadServices();
  loadDoctors();
  loadReviews();
  loadAnalytics();
}
function logout() { sessionStorage.removeItem('adminAuth'); location.reload(); }
if (sessionStorage.getItem('adminAuth') === '1') showPanel();

// ====== TABS ======
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  };
});

// ====== STATS ======
async function loadStats() {
  try {
    const [bookSnap, usersSnap, reviewsSnap] = await Promise.all([
      db.ref('bookings').once('value'),
      db.ref('users').once('value'),
      db.ref('reviews').once('value')
    ]);
    const today = new Date().toISOString().slice(0,10);
    const weekAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
    let total = 0, todayCount = 0, weekCount = 0;
    bookSnap.forEach(c => {
      const b = c.val();
      if (b.status !== 'cancelled') {
        total++;
        if (b.date === today) todayCount++;
        if (b.date >= weekAgo) weekCount++;
      }
    });
    let ratingSum = 0, ratingCount = 0;
    reviewsSnap.forEach(c => {
      const r = c.val();
      if (r.rating) { ratingSum += r.rating; ratingCount++; }
    });
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-today').textContent = todayCount;
    document.getElementById('stat-week').textContent = weekCount;
    document.getElementById('stat-clients').textContent = usersSnap.numChildren() || 0;
    document.getElementById('stat-reviews').textContent = ratingCount;
    document.getElementById('stat-rating').textContent = ratingCount ? (ratingSum/ratingCount).toFixed(1) + '★' : '—';
  } catch (e) { console.error(e); }
}

// ====== ЗАПИСИ ======
async function loadBookings() {
  const list = document.getElementById('bookings-list');
  list.innerHTML = '<p style="color:#8893a7">Загрузка...</p>';
  try {
    const snap = await db.ref('bookings').once('value');
    const bookings = [];
    snap.forEach(c => bookings.push({ id: c.key, ...c.val() }));

    const dateFilter = document.getElementById('filter-date').value;
    const statusFilter = document.getElementById('filter-status').value;
    let filtered = bookings;
    if (dateFilter) filtered = filtered.filter(b => b.date === dateFilter);
    if (statusFilter) filtered = filtered.filter(b => b.status === statusFilter);
    filtered.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    if (!filtered.length) { list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Записей не найдено</p>'; return; }

    list.innerHTML = filtered.map(b => {
      const dateStr = new Date(b.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
      return `
        <div class="booking ${b.status === 'cancelled' ? 'cancelled' : ''}">
          <div class="b-head">
            <strong>${b.serviceName}</strong>
            <span class="badge ${b.status}">${b.status === 'confirmed' ? 'Подтверждено' : 'Отменено'}</span>
          </div>
          <div class="b-info">
            👤 ${b.userName} · 📱 ${b.userPhone || '—'} ${b.userEmail ? '· ✉️ ' + b.userEmail : ''}<br>
            👨‍⚕️ ${b.doctorName || '—'}<br>
            📅 ${dateStr} в ${b.time} · 💰 ${b.price}<br>
            🆔 @${b.username || b.userId}
          </div>
          <div class="b-actions">
            ${b.status !== 'cancelled'
              ? `<button class="btn btn-danger" onclick="cancelBooking('${b.id}')">Отменить</button>`
              : `<button class="btn btn-success" onclick="restoreBooking('${b.id}')">Восстановить</button>`}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) { console.error(e); list.innerHTML = '<p style="color:#ef4444">Ошибка</p>'; }
}
async function cancelBooking(id) {
  if (!confirm('Отменить запись?')) return;
  await db.ref('bookings/' + id).update({ status: 'cancelled' });
  loadBookings(); loadStats();
}
async function restoreBooking(id) {
  await db.ref('bookings/' + id).update({ status: 'confirmed' });
  loadBookings(); loadStats();
}

// ====== КЛИЕНТЫ ======
async function loadUsers() {
  const list = document.getElementById('users-list');
  try {
    const snap = await db.ref('users').once('value');
    const users = [];
    snap.forEach(c => users.push(c.val()));
    users.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));
    if (!users.length) { list.innerHTML = '<p style="color:#8893a7">Клиентов пока нет</p>'; return; }
    list.innerHTML = users.map(u => `
      <div class="item-row">
        <div class="main">
          <div class="icon">👤</div>
          <div>
            <div class="name">${u.name}</div>
            <div class="meta">📱 ${u.phone || '—'} ${u.email ? '· ✉️ ' + u.email : ''}</div>
            <div class="meta">@${u.telegramUsername || u.telegramId} · ${u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('ru-RU') : ''}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

// ====== УСЛУГИ ======
let currentItemType = null;
let currentItemId = null;

async function loadServices() {
  const list = document.getElementById('services-list');
  try {
    const snap = await db.ref('settings/services').once('value');
    const items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    if (!items.length) { list.innerHTML = '<p style="color:#8893a7">Нет услуг. Добавьте первую.</p>'; return; }
    list.innerHTML = items.map(s => `
      <div class="item-row">
        <div class="main">
          <div class="icon">${s.icon || '🦷'}</div>
          <div>
            <div class="name">${s.name}</div>
            <div class="meta">${s.desc || ''} · ${s.price}</div>
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" onclick="openServiceModal('${s.id}')">✏️</button>
          <button class="icon-btn" onclick="toggleItem('services','${s.id}',${s.active !== false})">${s.active !== false ? '👁️' : '🚫'}</button>
          <button class="icon-btn" onclick="deleteItem('services','${s.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

function openServiceModal(id = null) {
  currentItemType = 'services';
  currentItemId = id;
  document.getElementById('modal-title').textContent = id ? 'Редактировать услугу' : 'Новая услуга';
  const form = document.getElementById('modal-form');

  const fill = (data = {}) => {
    form.innerHTML = `
      <div class="form-grid">
        <div class="full"><label>Название</label><input id="f-name" value="${data.name || ''}"></div>
        <div class="full"><label>Описание</label><input id="f-desc" value="${data.desc || ''}"></div>
        <div><label>Цена</label><input id="f-price" value="${data.price || ''}"></div>
        <div><label>Иконка (emoji)</label><input id="f-icon" value="${data.icon || '🦷'}"></div>
      </div>
    `;
  };

  if (id) {
    db.ref('settings/services/' + id).once('value').then(s => fill(s.val()));
  } else fill();

  document.getElementById('item-modal').classList.add('active');
}

// ====== ВРАЧИ ======
async function loadDoctors() {
  const list = document.getElementById('doctors-list');
  try {
    const snap = await db.ref('settings/doctors').once('value');
    const items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    if (!items.length) { list.innerHTML = '<p style="color:#8893a7">Нет врачей. Добавьте первого.</p>'; return; }
    list.innerHTML = items.map(d => `
      <div class="item-row">
        <div class="main">
          <div class="icon">${d.icon || '👨‍⚕️'}</div>
          <div>
            <div class="name">${d.name}</div>
            <div class="meta">${d.spec || ''} · Опыт: ${d.exp || '—'}</div>
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" onclick="openDoctorModal('${d.id}')">✏️</button>
          <button class="icon-btn" onclick="toggleItem('doctors','${d.id}',${d.active !== false})">${d.active !== false ? '👁️' : '🚫'}</button>
          <button class="icon-btn" onclick="deleteItem('doctors','${d.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

function openDoctorModal(id = null) {
  currentItemType = 'doctors';
  currentItemId = id;
  document.getElementById('modal-title').textContent = id ? 'Редактировать врача' : 'Новый врач';
  const form = document.getElementById('modal-form');

  const fill = (data = {}) => {
    form.innerHTML = `
      <div class="form-grid">
        <div class="full"><label>ФИО</label><input id="f-name" value="${data.name || ''}"></div>
        <div><label>Специализация</label><input id="f-spec" value="${data.spec || ''}"></div>
        <div><label>Опыт</label><input id="f-exp" value="${data.exp || ''}"></div>
        <div><label>Иконка (emoji)</label><input id="f-icon" value="${data.icon || '👨‍⚕️'}"></div>
      </div>
    `;
  };

  if (id) {
    db.ref('settings/doctors/' + id).once('value').then(s => fill(s.val()));
  } else fill();

  document.getElementById('item-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('active');
  currentItemType = null;
  currentItemId = null;
}

async function saveItem() {
  const data = {
    name: document.getElementById('f-name').value.trim(),
    active: true
  };
  if (!data.name) { alert('Укажите название'); return; }

  if (currentItemType === 'services') {
    data.desc = document.getElementById('f-desc').value.trim();
    data.price = document.getElementById('f-price').value.trim();
    data.icon = document.getElementById('f-icon').value.trim() || '🦷';
  } else {
    data.spec = document.getElementById('f-spec').value.trim();
    data.exp = document.getElementById('f-exp').value.trim();
    data.icon = document.getElementById('f-icon').value.trim() || '👨‍⚕️';
  }

  try {
    if (currentItemId) {
      await db.ref('settings/' + currentItemType + '/' + currentItemId).update(data);
    } else {
      await db.ref('settings/' + currentItemType).push().set(data);
    }
    closeModal();
    if (currentItemType === 'services') loadServices();
    else loadDoctors();
  } catch (e) { console.error(e); alert('Ошибка сохранения'); }
}

async function toggleItem(type, id, currentlyActive) {
  await db.ref('settings/' + type + '/' + id).update({ active: !currentlyActive });
  if (type === 'services') loadServices(); else loadDoctors();
}

async function deleteItem(type, id) {
  if (!confirm('Удалить?')) return;
  await db.ref('settings/' + type + '/' + id).remove();
  if (type === 'services') loadServices(); else loadDoctors();
}

// ====== ОТЗЫВЫ ======
async function loadReviews() {
  const list = document.getElementById('reviews-list');
  try {
    const snap = await db.ref('reviews').once('value');
    const reviews = [];
    snap.forEach(c => reviews.push({ id: c.key, ...c.val() }));
    reviews.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!reviews.length) { list.innerHTML = '<p style="color:#8893a7">Отзывов пока нет</p>'; return; }
    list.innerHTML = reviews.map(r => `
      <div class="review-row">
        <div class="r-head">
          <strong>${r.userName}</strong>
          <span class="r-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
        </div>
        <div class="r-text">${r.text || '—'}</div>
        <div class="r-meta">
          ${r.serviceName} · ${r.doctorName} · ${r.createdAt ? new Date(r.createdAt).toLocaleDateString('ru-RU') : ''}
          ${r.status === 'pending' ? ' · <span style="color:#f59e0b">на модерации</span>' : ''}
        </div>
        <div style="margin-top:8px;display:flex;gap:6px">
          ${r.status === 'pending' ? `<button class="btn btn-success" onclick="approveReview('${r.id}')">Одобрить</button>` : ''}
          <button class="btn btn-danger" onclick="deleteReview('${r.id}')">Удалить</button>
        </div>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}
async function approveReview(id) {
  await db.ref('reviews/' + id).update({ status: 'approved' });
  loadReviews();
}
async function deleteReview(id) {
  if (!confirm('Удалить отзыв?')) return;
  await db.ref('reviews/' + id).remove();
  loadReviews(); loadStats();
}

// ====== АНАЛИТИКА ======
let charts = {};
async function loadAnalytics() {
  try {
    const snap = await db.ref('bookings').once('value');
    const bookings = [];
    snap.forEach(c => { const b = c.val(); if (b.status !== 'cancelled') bookings.push(b); });

    // Записи за 14 дней
    const labels = [], data = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i*86400000);
      const key = d.toISOString().slice(0,10);
      labels.push(d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' }));
      data.push(bookings.filter(b => b.date === key).length);
    }

    if (charts.bookings) charts.bookings.destroy();
    charts.bookings = new Chart(document.getElementById('chart-bookings'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Записи',
          data,
          borderColor: '#5b6ef5',
          backgroundColor: 'rgba(91,110,245,.15)',
          fill: true,
          tension: .4,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });

    // Популярные услуги
    const serviceMap = {};
    bookings.forEach(b => { serviceMap[b.serviceName] = (serviceMap[b.serviceName] || 0) + 1; });
    const sLabels = Object.keys(serviceMap);
    const sData = Object.values(serviceMap);

    if (charts.services) charts.services.destroy();
    charts.services = new Chart(document.getElementById('chart-services'), {
      type: 'doughnut',
      data: {
        labels: sLabels,
        datasets: [{
          data: sData,
          backgroundColor: ['#5b6ef5','#22d3ee','#f472b6','#10b981','#f59e0b','#a78bfa']
        }]
      }
    });

    // Загрузка врачей
    const docMap = {};
    bookings.forEach(b => { if (b.doctorName) docMap[b.doctorName] = (docMap[b.doctorName] || 0) + 1; });
    const dLabels = Object.keys(docMap);
    const dData = Object.values(docMap);

    if (charts.doctors) charts.doctors.destroy();
    charts.doctors = new Chart(document.getElementById('chart-doctors'), {
      type: 'bar',
      data: {
        labels: dLabels,
        datasets: [{
          label: 'Записей',
          data: dData,
          backgroundColor: 'rgba(91,110,245,.7)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  } catch (e) { console.error(e); }
}
