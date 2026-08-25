// ====== АВТОРИЗАЦИЯ ======
function tryLogin() {
  const pwd = document.getElementById('admin-password').value;
  if (pwd === ADMIN_CONFIG.adminPassword) {
    sessionStorage.setItem('adminAuth', '1');
    showPanel();
  } else {
    alert('Неверный пароль');
  }
}

function showPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-panel').classList.add('active');
  loadStats();
  loadBookings();
  loadUsers();
  loadServices();
  loadDoctors();
  loadPromosAdmin();
  loadPortfolio();
  loadReviews();
  loadAnalytics();
}

function logout() {
  sessionStorage.removeItem('adminAuth');
  location.reload();
}

// Авто-вход если уже авторизован
if (sessionStorage.getItem('adminAuth') === '1') showPanel();

// Enter для входа
document.getElementById('admin-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryLogin();
});

// ====== TOAST ======
function showToast(msg, duration = 2500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ====== ВКЛАДКИ ======
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  };
});

// ====== СТАТИСТИКА ======
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
  } catch (e) {
    console.error(e);
  }
}

// ====== ЗАПИСИ ======
async function loadBookings() {
  const list = document.getElementById('bookings-list');
  list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Загрузка...</p>';
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

    if (!filtered.length) {
      list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Записей не найдено</p>';
      return;
    }

    list.innerHTML = filtered.map(b => {
      const dateStr = new Date(b.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
      return `
        <div class="booking ${b.status === 'cancelled' ? 'cancelled' : ''}">
          <div class="b-head">
            <strong>${b.serviceName?.ru || b.serviceName || '—'}</strong>
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
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p style="color:#ef4444">Ошибка загрузки</p>';
  }
}

async function cancelBooking(id) {
  if (!confirm('Отменить запись?')) return;
  await db.ref('bookings/' + id).update({ status: 'cancelled' });
  showToast('✅ Запись отменена');
  loadBookings();
  loadStats();
}

async function restoreBooking(id) {
  await db.ref('bookings/' + id).update({ status: 'confirmed' });
  showToast('✅ Запись восстановлена');
  loadBookings();
  loadStats();
}

// ====== КЛИЕНТЫ ======
async function loadUsers() {
  const list = document.getElementById('users-list');
  try {
    const snap = await db.ref('users').once('value');
    const users = [];
    snap.forEach(c => users.push(c.val()));
    users.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));
    if (!users.length) {
      list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Клиентов пока нет</p>';
      return;
    }
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
  } catch (e) {
    console.error(e);
  }
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
    if (!items.length) {
      list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Нет услуг. Добавьте первую.</p>';
      return;
    }
    list.innerHTML = items.map(s => `
      <div class="item-row">
        <div class="main">
          <div class="icon">${s.icon || '🦷'}</div>
          <div>
            <div class="name">${s.name?.ru || s.name || '—'}</div>
            <div class="meta">${s.desc?.ru || s.desc || ''} · ${s.price || ''}</div>
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" onclick="openServiceModal('${s.id}')" title="Редактировать">✏️</button>
          <button class="icon-btn" onclick="toggleItem('services','${s.id}',${s.active !== false})" title="Скрыть/показать">${s.active !== false ? '👁️' : '🚫'}</button>
          <button class="icon-btn" onclick="deleteItem('services','${s.id}')" title="Удалить">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

function openServiceModal(id = null) {
  currentItemType = 'services';
  currentItemId = id;
  document.getElementById('modal-title').textContent = id ? 'Редактировать услугу' : 'Новая услуга';
  const form = document.getElementById('modal-form');

  const fill = (data = {}) => {
    const nameRu = data.name?.ru || (typeof data.name === 'string' ? data.name : '');
    const nameEn = data.name?.en || '';
    const descRu = data.desc?.ru || (typeof data.desc === 'string' ? data.desc : '');
    const descEn = data.desc?.en || '';
    form.innerHTML = `
      <div class="form-grid">
        <div class="full"><label>Название (RU)</label><input id="f-name-ru" value="${nameRu}"></div>
        <div class="full"><label>Название (EN)</label><input id="f-name-en" value="${nameEn}"></div>
        <div class="full"><label>Описание (RU)</label><input id="f-desc-ru" value="${descRu}"></div>
        <div class="full"><label>Описание (EN)</label><input id="f-desc-en" value="${descEn}"></div>
        <div><label>Цена</label><input id="f-price" value="${data.price || ''}"></div>
        <div><label>Иконка (emoji)</label><input id="f-icon" value="${data.icon || '🦷'}"></div>
      </div>
    `;
  };

  if (id) {
    db.ref('settings/services/' + id).once('value').then(s => fill(s.val()));
  } else {
    fill();
  }

  document.getElementById('item-modal').classList.add('active');
}

// ====== ВРАЧИ ======
async function loadDoctors() {
  const list = document.getElementById('doctors-list');
  try {
    const snap = await db.ref('settings/doctors').once('value');
    const items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    if (!items.length) {
      list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Нет врачей. Добавьте первого.</p>';
      return;
    }
    list.innerHTML = items.map(d => `
      <div class="item-row">
        <div class="main">
          <div class="icon">${d.icon || '👨‍⚕️'}</div>
          <div>
            <div class="name">${d.name}</div>
            <div class="meta">${d.spec?.ru || d.spec || ''} · Опыт: ${d.exp || '—'} лет</div>
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" onclick="openDoctorModal('${d.id}')" title="Редактировать">✏️</button>
          <button class="icon-btn" onclick="toggleItem('doctors','${d.id}',${d.active !== false})" title="Скрыть/показать">${d.active !== false ? '👁️' : '🚫'}</button>
          <button class="icon-btn" onclick="deleteItem('doctors','${d.id}')" title="Удалить">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

function openDoctorModal(id = null) {
  currentItemType = 'doctors';
  currentItemId = id;
  document.getElementById('modal-title').textContent = id ? 'Редактировать врача' : 'Новый врач';
  const form = document.getElementById('modal-form');

  const fill = (data = {}) => {
    const specRu = data.spec?.ru || (typeof data.spec === 'string' ? data.spec : '');
    const specEn = data.spec?.en || '';
    form.innerHTML = `
      <div class="form-grid">
        <div class="full"><label>ФИО</label><input id="f-name" value="${data.name || ''}"></div>
        <div><label>Специализация (RU)</label><input id="f-spec-ru" value="${specRu}"></div>
        <div><label>Специализация (EN)</label><input id="f-spec-en" value="${specEn}"></div>
        <div><label>Опыт (лет)</label><input id="f-exp" value="${data.exp || ''}"></div>
        <div><label>Иконка (emoji)</label><input id="f-icon" value="${data.icon || '👨‍⚕️'}"></div>
      </div>
    `;
  };

  if (id) {
    db.ref('settings/doctors/' + id).once('value').then(s => fill(s.val()));
  } else {
    fill();
  }

  document.getElementById('item-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('active');
  currentItemType = null;
  currentItemId = null;
  window._savePromo = null;
}

// Универсальное сохранение (услуги/врачи)
async function saveItem() {
  // Если открыта модалка акции — используем её save
  if (window._savePromo) {
    await window._savePromo();
    return;
  }

  if (!currentItemType) return;

  const data = { active: true };

  if (currentItemType === 'services') {
    const nameRu = document.getElementById('f-name-ru').value.trim();
    const nameEn = document.getElementById('f-name-en').value.trim();
    if (!nameRu) { alert('Укажите название RU'); return; }
    data.name = { ru: nameRu, en: nameEn || nameRu };
    data.desc = {
      ru: document.getElementById('f-desc-ru').value.trim(),
      en: document.getElementById('f-desc-en').value.trim()
    };
    data.price = document.getElementById('f-price').value.trim();
    data.icon = document.getElementById('f-icon').value.trim() || '🦷';
  } else if (currentItemType === 'doctors') {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('Укажите ФИО'); return; }
    data.name = name;
    data.spec = {
      ru: document.getElementById('f-spec-ru').value.trim(),
      en: document.getElementById('f-spec-en').value.trim()
    };
    data.exp = document.getElementById('f-exp').value.trim();
    data.icon = document.getElementById('f-icon').value.trim() || '👨‍⚕️';
  }

  try {
    if (currentItemId) {
      await db.ref('settings/' + currentItemType + '/' + currentItemId).update(data);
      showToast('✅ Сохранено');
    } else {
      await db.ref('settings/' + currentItemType).push().set(data);
      showToast('✅ Добавлено');
    }
    closeModal();
    if (currentItemType === 'services') loadServices();
    else if (currentItemType === 'doctors') loadDoctors();
  } catch (e) {
    console.error(e);
    alert('Ошибка сохранения');
  }
}

async function toggleItem(type, id, currentlyActive) {
  await db.ref('settings/' + type + '/' + id).update({ active: !currentlyActive });
  showToast(currentlyActive ? '🚫 Скрыто' : '👁️ Показано');
  if (type === 'services') loadServices();
  else loadDoctors();
}

async function deleteItem(type, id) {
  if (!confirm('Удалить? Это действие нельзя отменить.')) return;
  await db.ref('settings/' + type + '/' + id).remove();
  showToast('🗑️ Удалено');
  if (type === 'services') loadServices();
  else loadDoctors();
}

// ====== АКЦИИ ======
let currentPromoId = null;

async function loadPromosAdmin() {
  const list = document.getElementById('promos-list-admin');
  try {
    const snap = await db.ref('promotions').once('value');
    const promos = [];
    snap.forEach(c => promos.push({ id: c.key, ...c.val() }));
    promos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!promos.length) {
      list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Нет акций</p>';
      return;
    }

    list.innerHTML = promos.map(p => {
      const title = p.title?.ru || '—';
      const discount = p.discount ? '-' + p.discount + '%' : '';
      const valid = p.validUntil ? 'до ' + p.validUntil : 'бессрочно';
      const status = p.active ? '✅' : '🚫';
      return `
        <div class="item-row">
          <div class="main">
            <div class="icon">🎁</div>
            <div>
              <div class="name">${title} ${discount ? '<span style="color:#f472b6;font-weight:700">' + discount + '</span>' : ''}</div>
              <div class="meta">${valid} · ${status}</div>
            </div>
          </div>
          <div class="actions">
            <button class="icon-btn" onclick="openPromoModal('${p.id}')" title="Редактировать">✏️</button>
            <button class="icon-btn" onclick="togglePromo('${p.id}', ${p.active})" title="Активировать/скрыть">${p.active ? '👁️' : '🚫'}</button>
            <button class="icon-btn" onclick="deletePromo('${p.id}')" title="Удалить">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

async function openPromoModal(id = null) {
  currentPromoId = id;
  currentItemType = null; // чтобы saveItem не сработал для услуг/врачей
  document.getElementById('modal-title').textContent = id ? 'Редактировать акцию' : 'Новая акция';

  let data = {};
  if (id) {
    const snap = await db.ref('promotions/' + id).once('value');
    data = snap.val() || {};
  }

  // Загружаем услуги для привязки
  const servicesSnap = await db.ref('settings/services').once('value');
  const services = [];
  servicesSnap.forEach(c => services.push({ id: c.key, ...c.val() }));

  const titleRu = data.title?.ru || '';
  const titleEn = data.title?.en || '';
  const descRu = data.desc?.ru || '';
  const descEn = data.desc?.en || '';

  document.getElementById('modal-form').innerHTML = `
    <div class="form-grid">
      <div class="full"><label>Название (RU)</label><input id="p-title-ru" value="${titleRu}"></div>
      <div class="full"><label>Название (EN)</label><input id="p-title-en" value="${titleEn}"></div>
      <div class="full"><label>Описание (RU)</label><textarea id="p-desc-ru" rows="2">${descRu}</textarea></div>
      <div class="full"><label>Описание (EN)</label><textarea id="p-desc-en" rows="2">${descEn}</textarea></div>
      <div><label>Скидка, %</label><input type="number" id="p-discount" value="${data.discount || ''}" min="0" max="100"></div>
      <div><label>Действует до</label><input type="date" id="p-valid" value="${data.validUntil || ''}"></div>
      <div class="full"><label>Привязать к услуге (опционально)</label>
        <select id="p-service">
          <option value="">— не привязана —</option>
          ${services.map(s => {
            const name = s.name?.ru || s.name || '';
            return `<option value="${s.id}" ${data.serviceId === s.id ? 'selected' : ''}>${name}</option>`;
          }).join('')}
        </select>
      </div>
    </div>
  `;

  window._savePromo = async () => {
    const titleRuVal = document.getElementById('p-title-ru').value.trim();
    if (!titleRuVal) { alert('Укажите название RU'); return; }

    const promo = {
      title: {
        ru: titleRuVal,
        en: document.getElementById('p-title-en').value.trim() || titleRuVal
      },
      desc: {
        ru: document.getElementById('p-desc-ru').value.trim(),
        en: document.getElementById('p-desc-en').value.trim()
      },
      discount: parseInt(document.getElementById('p-discount').value) || null,
      validUntil: document.getElementById('p-valid').value || null,
      serviceId: document.getElementById('p-service').value || null,
      active: data.active !== undefined ? data.active : true,
      createdAt: data.createdAt || Date.now()
    };

    try {
      if (currentPromoId) {
        await db.ref('promotions/' + currentPromoId).update(promo);
        showToast('✅ Акция сохранена');
      } else {
        await db.ref('promotions').push().set(promo);
        showToast('✅ Акция добавлена');
      }
      closeModal();
      loadPromosAdmin();
    } catch (e) {
      console.error(e);
      alert('Ошибка сохранения');
    }
  };

  document.getElementById('item-modal').classList.add('active');
}

async function togglePromo(id, active) {
  await db.ref('promotions/' + id).update({ active: !active });
  showToast(active ? '🚫 Акция скрыта' : '✅ Акция активирована');
  loadPromosAdmin();
}

async function deletePromo(id) {
  if (!confirm('Удалить акцию?')) return;
  await db.ref('promotions/' + id).remove();
  showToast('🗑️ Удалено');
  loadPromosAdmin();
}

// ====== ГАЛЕРЕЯ / ПОРТФОЛИО ======
let portfolioDoctorsLoaded = false;

async function loadPortfolio() {
  const select = document.getElementById('portfolio-doctor-filter');
  const list = document.getElementById('portfolio-list-admin');

  // Заполняем список врачей (один раз)
  if (!portfolioDoctorsLoaded) {
    try {
      const doctorsSnap = await db.ref('settings/doctors').once('value');
      const doctors = [];
      doctorsSnap.forEach(c => doctors.push({ id: c.key, ...c.val() }));
      select.innerHTML = '<option value="">Все врачи</option>' +
        doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      portfolioDoctorsLoaded = true;
      window._portfolioDoctors = doctors;
    } catch (e) {
      console.error(e);
    }
  }

  const filter = select.value;
  list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Загрузка...</p>';

  try {
    const photos = [];

    if (filter) {
      const snap = await db.ref('portfolio/' + filter).once('value');
      snap.forEach(c => photos.push({ doctorId: filter, photoId: c.key, ...c.val() }));
    } else {
      const snap = await db.ref('portfolio').once('value');
      snap.forEach(dc => {
        const doctorId = dc.key;
        dc.forEach(pc => photos.push({ doctorId, photoId: pc.key, ...pc.val() }));
      });
    }

    photos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!photos.length) {
      list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Фото пока нет</p>';
      return;
    }

    const doctors = window._portfolioDoctors || [];
    const doctorName = (id) => doctors.find(d => d.id === id)?.name || id;

    list.innerHTML = photos.map(p => {
      const status = p.status === 'approved' ? '✅ одобрено' :
                     p.status === 'rejected' ? '🚫 отклонено' : '⏳ на модерации';
      const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU') : '';
      return `
        <div class="item-row">
          <div class="main">
            <img src="${p.url}" style="width:60px;height:60px;object-fit:cover;border-radius:10px;flex-shrink:0" alt="">
            <div style="min-width:0">
              <div class="name">${doctorName(p.doctorId)}</div>
              <div class="meta">${p.caption || '—'}</div>
              <div class="meta">${status} · ${date}</div>
            </div>
          </div>
          <div class="actions">
            ${p.status !== 'approved' ? `<button class="icon-btn" onclick="approvePhoto('${p.doctorId}','${p.photoId}')" title="Одобрить">✅</button>` : ''}
            ${p.status !== 'rejected' ? `<button class="icon-btn" onclick="rejectPhoto('${p.doctorId}','${p.photoId}')" title="Отклонить">🚫</button>` : ''}
            <button class="icon-btn" onclick="deletePhoto('${p.doctorId}','${p.photoId}')" title="Удалить">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p style="color:#ef4444">Ошибка загрузки</p>';
  }
}

async function uploadPortfolioPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const doctorId = document.getElementById('portfolio-doctor-filter').value;
  if (!doctorId) {
    alert('Выберите врача в фильтре перед загрузкой');
    event.target.value = '';
    return;
  }

  const caption = prompt('Подпись к фото (необязательно):') || '';

  // Проверка размера (макс 5 МБ)
  if (file.size > 5 * 1024 * 1024) {
    alert('Файл слишком большой (макс. 5 МБ)');
    event.target.value = '';
    return;
  }

  const path = `portfolio/${doctorId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const ref = storage.ref(path);

  try {
    showToast('⏳ Загрузка...');
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.ref('portfolio/' + doctorId).push().set({
      url,
      caption,
      status: 'approved',
      createdAt: Date.now()
    });
    showToast('✅ Фото загружено');
    loadPortfolio();
  } catch (e) {
    console.error(e);
    alert('Ошибка загрузки: ' + e.message);
  }
  event.target.value = '';
}

async function approvePhoto(doctorId, photoId) {
  await db.ref('portfolio/' + doctorId + '/' + photoId).update({ status: 'approved' });
  showToast('✅ Одобрено');
  loadPortfolio();
}

async function rejectPhoto(doctorId, photoId) {
  await db.ref('portfolio/' + doctorId + '/' + photoId).update({ status: 'rejected' });
  showToast('🚫 Отклонено');
  loadPortfolio();
}

async function deletePhoto(doctorId, photoId) {
  if (!confirm('Удалить фото?')) return;
  try {
    // Удаляем сам файл из Storage
    const snap = await db.ref('portfolio/' + doctorId + '/' + photoId).once('value');
    const data = snap.val();
    if (data?.url) {
      try {
        await storage.refFromURL(data.url).delete();
      } catch (e) {
        console.warn('Не удалось удалить файл из Storage:', e);
      }
    }
    await db.ref('portfolio/' + doctorId + '/' + photoId).remove();
    showToast('🗑️ Удалено');
    loadPortfolio();
  } catch (e) {
    console.error(e);
    alert('Ошибка удаления');
  }
}

// ====== ОТЗЫВЫ ======
async function loadReviews() {
  const list = document.getElementById('reviews-list');
  try {
    const snap = await db.ref('reviews').once('value');
    const reviews = [];
    snap.forEach(c => reviews.push({ id: c.key, ...c.val() }));
    reviews.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!reviews.length) {
      list.innerHTML = '<p style="color:#8893a7;padding:20px;text-align:center">Отзывов пока нет</p>';
      return;
    }

    list.innerHTML = reviews.map(r => {
      const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ru-RU') : '';
      const status = r.status === 'approved' ? '✅ одобрено' :
                     r.status === 'rejected' ? '🚫 отклонено' : '⏳ на модерации';
      return `
        <div class="review-row">
          <div class="r-head">
            <strong>${r.userName || 'Аноним'}</strong>
            <span class="r-stars">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</span>
          </div>
          <div class="r-text">${r.text || '—'}</div>
          <div class="r-meta">
            ${r.serviceName?.ru || r.serviceName || '—'} · ${r.doctorName || '—'} · ${date} · ${status}
          </div>
          <div class="r-actions">
            ${r.status !== 'approved' ? `<button class="btn btn-success" onclick="approveReview('${r.id}')">Одобрить</button>` : ''}
            <button class="btn btn-danger" onclick="deleteReview('${r.id}')">Удалить</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

async function approveReview(id) {
  await db.ref('reviews/' + id).update({ status: 'approved' });
  showToast('✅ Одобрено');
  loadReviews();
  loadStats();
}

async function deleteReview(id) {
  if (!confirm('Удалить отзыв?')) return;
  await db.ref('reviews/' + id).remove();
  showToast('🗑️ Удалено');
  loadReviews();
  loadStats();
}

// ====== АНАЛИТИКА ======
let charts = {};

async function loadAnalytics() {
  try {
    const snap = await db.ref('bookings').once('value');
    const bookings = [];
    snap.forEach(c => {
      const b = c.val();
      if (b.status !== 'cancelled') bookings.push(b);
    });

    // === График 1: Записи за 14 дней ===
    const labels = [];
    const data = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
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
          borderWidth: 3,
          pointBackgroundColor: '#5b6ef5',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,.05)' } },
          x: { grid: { display: false } }
        }
      }
    });

    // === График 2: Популярные услуги ===
    const serviceMap = {};
    bookings.forEach(b => {
      const name = b.serviceName?.ru || b.serviceName || '—';
      serviceMap[name] = (serviceMap[name] || 0) + 1;
    });
    const sLabels = Object.keys(serviceMap);
    const sData = Object.values(serviceMap);

    if (charts.services) charts.services.destroy();
    charts.services = new Chart(document.getElementById('chart-services'), {
      type: 'doughnut',
      data: {
        labels: sLabels,
        datasets: [{
          data: sData,
          backgroundColor: ['#5b6ef5', '#22d3ee', '#f472b6', '#10b981', '#f59e0b', '#a78bfa', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 15, font: { size: 12 } } }
        }
      }
    });

    // === График 3: Загрузка врачей ===
    const docMap = {};
    bookings.forEach(b => {
      if (b.doctorName) docMap[b.doctorName] = (docMap[b.doctorName] || 0) + 1;
    });
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
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (e) {
    console.error('Analytics error:', e);
  }
}
