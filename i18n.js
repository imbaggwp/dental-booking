const translations = {
  ru: {
    welcomeTitle: 'Dental Care',
    welcomeSubtitle: 'Современная стоматология\nс заботой о каждом пациенте',
    startBtn: 'Записаться на приём',
    welcomeNote: 'Нажимая кнопку, вы соглашаетесь с обработкой персональных данных',
    featureFast: 'Быстрая запись',
    featureFastDesc: 'Выберите время за 30 секунд',
    featureDocs: 'Опытные врачи',
    featureDocsDesc: 'Специалисты с опытом 10+ лет',
    featurePremium: 'Премиум-оборудование',
    featurePremiumDesc: 'Безболезненное лечение',
    featureRemind: 'Напоминания',
    featureRemindDesc: 'Напомним о приёме заранее',
    registerTitle: 'Регистрация',
    registerDesc: 'Заполните данные для связи',
    labelName: 'Как к вам обращаться?',
    labelPhone: 'Телефон',
    sharePhone: 'Поделиться номером из Telegram',
    labelEmail: 'Email',
    optional: '(необязательно)',
    continueBtn: 'Продолжить',
    backBtn: '← Назад',
    bookingTitle: 'Запись на приём',
    stepService: 'Услуга',
    stepDoctor: 'Врач',
    stepDate: 'Дата',
    stepTime: 'Время',
    stepConfirm: 'Подтверждение',
    selectService: 'Выберите услугу',
    selectDoctor: 'Выберите врача',
    selectDate: 'Выберите дату',
    selectTime: 'Выберите время',
    confirmTitle: 'Подтверждение',
    confirmBtn: 'Подтвердить запись',
    service: 'Услуга',
    doctor: 'Врач',
    date: 'Дата',
    time: 'Время',
    price: 'Стоимость',
    myBookings: 'Мои записи',
    bookings: 'Запись',
    history: 'История',
    promotions: 'Акции',
    noBookings: 'У вас пока нет записей',
    noHistory: 'История пуста',
    cancel: 'Отменить',
    bookAgain: 'Записаться снова',
    leaveReview: '★ Оставить отзыв',
    confirmed: 'Подтверждено',
    cancelled: 'Отменено',
    done: 'Завершено',
    exp: 'Опыт',
    years: 'лет',
    portfolio: 'Работы врача',
    noPortfolio: 'Пока нет работ',
    currentPromos: 'Актуальные акции',
    noPromos: 'Сейчас нет активных акций',
    validUntil: 'до',
    bookPromo: 'Записаться по акции',
    hello: 'Здравствуйте',
    registered: '✅ Регистрация завершена',
    booked: '✅ Вы записаны!',
    cancelledMsg: 'Запись отменена',
    reviewSent: '✅ Спасибо за отзыв!',
    fillName: 'Укажите имя',
    fillPhone: 'Укажите телефон',
    fillRating: 'Поставьте оценку',
    reviewTitle: 'Оставить отзыв',
    reviewPlaceholder: 'Расскажите о вашем опыте...',
    sendReview: 'Отправить отзыв',
    loading: 'Загрузка',
    error: 'Ошибка',
    months: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  },
  en: {
    welcomeTitle: 'Dental Care',
    welcomeSubtitle: 'Modern dentistry\nwith care for every patient',
    startBtn: 'Book an appointment',
    welcomeNote: 'By clicking, you agree to the processing of personal data',
    featureFast: 'Fast booking',
    featureFastDesc: 'Choose a time in 30 seconds',
    featureDocs: 'Experienced doctors',
    featureDocsDesc: 'Specialists with 10+ years experience',
    featurePremium: 'Premium equipment',
    featurePremiumDesc: 'Painless treatment',
    featureRemind: 'Reminders',
    featureRemindDesc: "We'll remind you in advance",
    registerTitle: 'Registration',
    registerDesc: 'Fill in your contact details',
    labelName: 'Your name',
    labelPhone: 'Phone',
    sharePhone: 'Share number from Telegram',
    labelEmail: 'Email',
    optional: '(optional)',
    continueBtn: 'Continue',
    backBtn: '← Back',
    bookingTitle: 'Book appointment',
    stepService: 'Service',
    stepDoctor: 'Doctor',
    stepDate: 'Date',
    stepTime: 'Time',
    stepConfirm: 'Confirmation',
    selectService: 'Select a service',
    selectDoctor: 'Select a doctor',
    selectDate: 'Select a date',
    selectTime: 'Select a time',
    confirmTitle: 'Confirmation',
    confirmBtn: 'Confirm booking',
    service: 'Service',
    doctor: 'Doctor',
    date: 'Date',
    time: 'Time',
    price: 'Price',
    myBookings: 'My bookings',
    bookings: 'Bookings',
    history: 'History',
    promotions: 'Promotions',
    noBookings: 'You have no bookings yet',
    noHistory: 'No history yet',
    cancel: 'Cancel',
    bookAgain: 'Book again',
    leaveReview: '★ Leave a review',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    done: 'Completed',
    exp: 'Experience',
    years: 'years',
    portfolio: "Doctor's portfolio",
    noPortfolio: 'No works yet',
    currentPromos: 'Current promotions',
    noPromos: 'No active promotions',
    validUntil: 'until',
    bookPromo: 'Book with promo',
    hello: 'Hello',
    registered: '✅ Registration complete',
    booked: '✅ You are booked!',
    cancelledMsg: 'Booking cancelled',
    reviewSent: '✅ Thanks for the review!',
    fillName: 'Please enter your name',
    fillPhone: 'Please enter your phone',
    fillRating: 'Please rate',
    reviewTitle: 'Leave a review',
    reviewPlaceholder: 'Tell us about your experience...',
    sendReview: 'Send review',
    loading: 'Loading',
    error: 'Error',
    months: ['January','February','March','April','May','June','July','August','September','October','November','December']
  }
};

let currentLang = 'ru';

function t(key) {
  return translations[currentLang]?.[key] || translations.ru[key] || key;
}

function detectLanguage() {
  const tg = window.Telegram?.WebApp;
  const lang = tg?.initDataUnsafe?.user?.language_code || navigator.language.slice(0,2);
  currentLang = translations[lang] ? lang : 'ru';
  localStorage.setItem('dental_lang', currentLang);
}

function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('dental_lang', lang);
  applyTranslations();
  if (typeof renderServices === 'function') renderServices();
  if (typeof renderDoctors === 'function' && state?.doctor === null) {}
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const value = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = value;
    } else {
      el.innerHTML = value.replace(/\n/g, '<br>');
    }
  });
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === currentLang);
  });
}
