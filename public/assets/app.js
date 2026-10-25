const appState = {
  token: localStorage.getItem('railgo_token'),
  user: JSON.parse(localStorage.getItem('railgo_user') || 'null'),
  stations: [], trips: [], currentSearch: null, selectedTrip: null,
  selectedSeats: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (appState.token) headers.Authorization = `Bearer ${appState.token}`;
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || Object.values(payload.fields || {})[0] || 'Yêu cầu không thành công.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload.data;
}

function money(value) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} VNĐ`;
}

function dateTime(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function time(value) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  $('#toastStack').append(item);
  setTimeout(() => item.remove(), 3500);
}

function setLoading(target, message = 'Đang tải dữ liệu...') {
  target.className = target.className.replace('empty-state', '');
  target.innerHTML = `<div class="loading"><div class="spinner"></div><p>${message}</p></div>`;
}

function persistSession(data) {
  appState.token = data.token;
  appState.user = data.user;
  localStorage.setItem('railgo_token', data.token);
  localStorage.setItem('railgo_user', JSON.stringify(data.user));
  syncHeader();
}

function clearSession() {
  appState.token = null;
  appState.user = null;
  localStorage.removeItem('railgo_token');
  localStorage.removeItem('railgo_user');
  syncHeader();
}

function syncHeader() {
  const loggedIn = Boolean(appState.user);
  $('#loginButton').classList.toggle('hidden', loggedIn);
  $('#userMenuButton').classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    $('#userMenuButton').textContent = appState.user.fullName.split(' ').at(-1).slice(0, 1).toUpperCase();
  }
  const isOperator = ['STAFF', 'ADMIN'].includes(appState.user?.role);
  $('.admin-link').classList.toggle('hidden', !isOperator);
}

function showView(name) {
  if (name === 'admin' && !['STAFF', 'ADMIN'].includes(appState.user?.role)) name = 'home';
  $$('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === name));
  $$('[data-nav]').forEach((link) => link.classList.toggle('active', link.dataset.nav === name));
  $('.main-nav').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'account') loadBookings();
  if (name === 'admin') loadDashboard();
}

function route() {
  showView(location.hash.replace('#', '') || 'home');
}

function stationOptions(selected = '') {
  return `<option value="">Chọn ga</option>${appState.stations.map((item) => `<option value="${item.id}" ${selected === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}`;
}

async function loadStations() {
  appState.stations = await api('/api/stations');
  ['heroFrom', 'heroTo', 'searchFrom', 'searchTo'].forEach((id) => { $(`#${id}`).innerHTML = stationOptions(); });
  $('#heroFrom').value = 'ST-HN'; $('#heroTo').value = 'ST-DN';
  $('#searchFrom').value = 'ST-HN'; $('#searchTo').value = 'ST-DN';
  const defaultDate = '2026-10-24';
  $('#heroDate').value = defaultDate; $('#searchDate').value = defaultDate;
}

async function performSearch(values) {
  location.hash = 'search';
  $('#searchFrom').value = values.from; $('#searchTo').value = values.to;
  $('#searchDate').value = values.date; $('#searchPassengers').value = values.passengers;
  appState.currentSearch = values;
  setLoading($('#tripResults'), 'Đang dò lịch chạy và chỗ trống...');
  $('#resultsMeta').textContent = 'Đang tìm chuyến phù hợp...';
  try {
    const params = new URLSearchParams(values);
    appState.trips = await api(`/api/trips/search?${params}`);
    renderTrips();
  } catch (error) {
    $('#tripResults').className = 'trip-list empty-state';
    $('#tripResults').innerHTML = `<span>!</span><h3>Không thể tìm chuyến</h3><p>${error.message}</p>`;
    $('#resultsMeta').textContent = 'Vui lòng kiểm tra lại thông tin.';
  }
}

function renderTrips() {
  const sort = $('#sortTrips').value;
  const trips = [...appState.trips].sort((a, b) => sort === 'price' ? a.basePrice - b.basePrice : sort === 'seats' ? b.availableSeats - a.availableSeats : new Date(a.departure) - new Date(b.departure));
  const from = appState.stations.find((s) => s.id === appState.currentSearch?.from)?.name || '';
  const to = appState.stations.find((s) => s.id === appState.currentSearch?.to)?.name || '';
  $('#resultsTitle').textContent = `${from} → ${to}`;
  $('#resultsMeta').textContent = `${trips.length} chuyến · ${appState.currentSearch?.date || ''} · ${appState.currentSearch?.passengers || 1} hành khách`;
  if (!trips.length) {
    $('#tripResults').className = 'trip-list empty-state';
    $('#tripResults').innerHTML = '<span>∅</span><h3>Chưa có chuyến phù hợp</h3><p>Hãy thử ngày đi hoặc hành trình khác.</p>';
    return;
  }
  $('#tripResults').className = 'trip-list';
  $('#tripResults').innerHTML = trips.map((trip) => `
    <article class="trip-card">
      <div class="train-name"><small>MÃ TÀU</small><strong>${trip.train.code}</strong><small>${trip.train.name}</small></div>
      <div class="time-route"><div><strong>${time(trip.departure)}</strong><small>${trip.fromStation.name}</small></div><div class="route-line"></div><div><strong>${time(trip.arrival)}</strong><small>${trip.toStation.name}</small></div></div>
      <div class="trip-price"><small>TỪ</small><strong>${money(trip.basePrice)}</strong><span>Còn ${trip.availableSeats} chỗ</span></div>
      <button class="btn btn-primary" data-book-trip="${trip.id}">Chọn chỗ</button>
    </article>`).join('');
  $$('[data-book-trip]').forEach((button) => button.addEventListener('click', () => openBooking(button.dataset.bookTrip)));
}

async function openBooking(tripId) {
  if (!appState.user) {
    openAuth();
    toast('Vui lòng đăng nhập trước khi đặt vé.', 'error');
    return;
  }
  if (appState.user.role !== 'CUSTOMER') return toast('Chỉ tài khoản khách hàng được đặt vé.', 'error');
  const trip = appState.trips.find((item) => item.id === tripId) || await api(`/api/trips/${tripId}`);
  appState.selectedTrip = trip;
  appState.selectedSeats = [];
  $('#bookingModal').classList.remove('hidden');
  setLoading($('#bookingContent'), 'Đang tải sơ đồ ghế...');
  try {
    const seats = await api(`/api/trips/${trip.id}/seats`);
    const passengerCount = Number(appState.currentSearch?.passengers || 1);
    $('#bookingContent').innerHTML = `
      <div class="booking-step"><span class="eyebrow">${trip.train.code} · ${trip.fromStation.name} → ${trip.toStation.name}</span><h2>Chọn ${passengerCount} ghế</h2><p>Ghế màu xám đã có người đặt. Mỗi hành khách chọn một ghế.</p>
      <div class="seat-grid">${seats.map((seat) => `<button class="seat" data-seat="${seat.code}" ${seat.available ? '' : 'disabled'}>${seat.code}</button>`).join('')}</div>
      <form id="bookingForm"><h3>Thông tin hành khách</h3>${Array.from({ length: passengerCount }, (_, i) => `<div class="passenger-form"><div class="field"><label>Họ tên hành khách ${i + 1}</label><input name="name${i}" required minlength="2"></div><div class="field"><label>CCCD/Hộ chiếu</label><input name="identity${i}" required pattern="\\d{12}" maxlength="12"></div><div class="field"><label>Tuổi</label><input name="age${i}" type="number" min="1" max="120" value="25" required></div></div>`).join('')}
      <div class="field"><label>Mã ưu đãi (không bắt buộc)</label><input name="promoCode" maxlength="12" placeholder="RAILGO10"></div>
      <div class="booking-summary"><span>Tạm tính</span><strong>${money(trip.basePrice * passengerCount)}</strong></div>
      <button class="btn btn-primary btn-block">Xác nhận đặt vé</button><p class="form-hint">Vé được phép hủy trước giờ tàu chạy ít nhất 2 giờ.</p></form></div>`;
    $$('.seat', $('#bookingContent')).forEach((button) => button.addEventListener('click', () => toggleSeat(button, passengerCount)));
    $('#bookingForm').addEventListener('submit', submitBooking);
  } catch (error) { $('#bookingContent').innerHTML = `<p>${error.message}</p>`; }
}

function toggleSeat(button, limit) {
  const code = button.dataset.seat;
  if (appState.selectedSeats.includes(code)) appState.selectedSeats = appState.selectedSeats.filter((item) => item !== code);
  else if (appState.selectedSeats.length < limit) appState.selectedSeats.push(code);
  else return toast(`Chỉ được chọn ${limit} ghế.`, 'error');
  button.classList.toggle('selected', appState.selectedSeats.includes(code));
}

async function submitBooking(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const count = Number(appState.currentSearch?.passengers || 1);
  if (appState.selectedSeats.length !== count) return toast(`Vui lòng chọn đủ ${count} ghế.`, 'error');
  const passengers = Array.from({ length: count }, (_, i) => ({ fullName: form.get(`name${i}`), identity: form.get(`identity${i}`), age: Number(form.get(`age${i}`)) }));
  try {
    const booking = await api('/api/bookings', { method: 'POST', body: JSON.stringify({ tripId: appState.selectedTrip.id, passengers, seats: appState.selectedSeats, promoCode: form.get('promoCode') }) });
    $('#bookingContent').innerHTML = `<div class="booking-step"><span class="eyebrow">Đặt chỗ thành công</span><h2>${booking.code}</h2><p>Chỗ của bạn đã được giữ. Hoàn tất thanh toán giả lập để xác nhận vé.</p><div class="booking-summary"><span>Tổng thanh toán</span><strong>${money(booking.totalPrice)}</strong></div><button class="btn btn-primary btn-block" id="payNow">Thanh toán ngay</button></div>`;
    $('#payNow').addEventListener('click', () => payBooking(booking.id));
  } catch (error) { toast(error.message, 'error'); }
}

async function payBooking(id) {
  try {
    const booking = await api(`/api/payments/${id}/mock`, { method: 'POST' });
    $('#bookingContent').innerHTML = `<div class="gate-card"><span>✓</span><h2>Thanh toán thành công</h2><p>Vé <strong>${booking.code}</strong> đã được xác nhận.</p><button class="btn btn-primary" id="viewMyTickets">Xem vé của tôi</button></div>`;
    $('#viewMyTickets').addEventListener('click', () => { $('#bookingModal').classList.add('hidden'); location.hash = 'account'; });
  } catch (error) { toast(error.message, 'error'); }
}

function openAuth() { $('#authModal').classList.remove('hidden'); }
function closeAuth() { $('#authModal').classList.add('hidden'); }

async function authSubmit(event, type) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const data = await api(`/api/auth/${type}`, { method: 'POST', body: JSON.stringify(values) });
    persistSession(data); closeAuth(); toast(type === 'login' ? 'Đăng nhập thành công.' : 'Tạo tài khoản thành công.');
    route();
  } catch (error) { toast(error.message, 'error'); }
}

async function lookupBooking(event) {
  event.preventDefault();
  const code = new FormData(event.currentTarget).get('code').trim();
  const target = $('#lookupResult'); setLoading(target, 'Đang tra cứu vé...');
  try {
    const booking = await api(`/api/bookings/lookup/${encodeURIComponent(code)}`);
    target.innerHTML = `<div class="lookup-ticket"><span class="status">${booking.status}</span><h3>${booking.code}</h3><dl><div><dt>Hành trình</dt><dd>${booking.trip.fromStation.name} → ${booking.trip.toStation.name}</dd></div><div><dt>Khởi hành</dt><dd>${dateTime(booking.trip.departure)}</dd></div><div><dt>Ghế</dt><dd>${booking.seats.join(', ')}</dd></div><div><dt>Tổng tiền</dt><dd>${money(booking.totalPrice)}</dd></div></dl></div>`;
  } catch (error) { target.innerHTML = `<div class="lookup-ticket"><p>${error.message}</p></div>`; }
}

async function loadBookings() {
  const gate = $('#accountGate'), list = $('#bookingList');
  if (!appState.user || appState.user.role !== 'CUSTOMER') { gate.classList.remove('hidden'); list.classList.add('hidden'); return; }
  gate.classList.add('hidden'); list.classList.remove('hidden'); setLoading(list);
  try {
    const bookings = await api('/api/bookings/me');
    if (!bookings.length) { list.innerHTML = '<div class="gate-card"><span>◇</span><h2>Chưa có hành trình</h2><p>Chuyến tàu đầu tiên của bạn sẽ xuất hiện tại đây.</p><a class="btn btn-primary" href="#search">Tìm chuyến</a></div>'; return; }
    list.innerHTML = bookings.map((booking) => `<article class="booking-card"><div><span class="status">${booking.status}</span><h3>${booking.trip.fromStation.name} → ${booking.trip.toStation.name}</h3><p>${booking.code} · ${dateTime(booking.trip.departure)}</p></div><div><strong>${booking.seats.join(', ')}</strong><p>${booking.passengers.map((p) => p.fullName).join(', ')}</p></div><div><strong>${money(booking.totalPrice)}</strong>${booking.status !== 'CANCELLED' ? `<button class="btn btn-ghost" data-cancel="${booking.id}">Hủy vé</button>` : ''}</div></article>`).join('');
    $$('[data-cancel]').forEach((button) => button.addEventListener('click', () => cancelBooking(button.dataset.cancel)));
  } catch (error) { list.innerHTML = `<div class="gate-card"><p>${error.message}</p></div>`; }
}

async function cancelBooking(id) {
  if (!confirm('Bạn chắc chắn muốn hủy vé? Phí hủy là 20% với vé đã thanh toán.')) return;
  try { await api(`/api/bookings/${id}/cancel`, { method: 'PATCH' }); toast('Đã hủy vé.'); loadBookings(); }
  catch (error) { toast(error.message, 'error'); }
}

async function loadDashboard() {
  setLoading($('#statsGrid'), 'Đang tổng hợp số liệu...'); setLoading($('#adminTrips')); setLoading($('#recentBookings'));
  try {
    const [stats, trips] = await Promise.all([api('/api/admin/stats'), api('/api/admin/trips')]);
    $('#statsGrid').innerHTML = [['Khách hàng', stats.users], ['Chuyến tàu', stats.trips], ['Đơn đặt vé', stats.bookings], ['Doanh thu', money(stats.revenue)]].map(([label, value]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
    $('#adminTrips').innerHTML = `<table><thead><tr><th>Tàu</th><th>Hành trình</th><th>Khởi hành</th><th>Chỗ</th><th>Trạng thái</th></tr></thead><tbody>${trips.map((trip) => `<tr><td>${trip.train.code}</td><td>${trip.fromStation.name} → ${trip.toStation.name}</td><td>${dateTime(trip.departure)}</td><td>${trip.availableSeats}/${trip.seats}</td><td><span class="status">${trip.status}</span></td></tr>`).join('')}</tbody></table>`;
    $('#recentBookings').innerHTML = stats.recentBookings.length ? stats.recentBookings.map((booking) => `<div class="recent-item"><div><strong>${booking.code}</strong><br><span>${booking.status}</span></div><strong>${money(booking.totalPrice)}</strong></div>`).join('') : '<p>Chưa có đơn đặt vé.</p>';
  } catch (error) {
    if (error.status === 401) clearSession();
    toast(error.message, 'error');
  }
}

function bindEvents() {
  window.addEventListener('hashchange', route);
  $('#menuButton').addEventListener('click', () => $('.main-nav').classList.toggle('open'));
  $('#loginButton').addEventListener('click', openAuth); $('#userMenuButton').addEventListener('click', () => { location.hash = appState.user?.role === 'CUSTOMER' ? 'account' : 'admin'; });
  $$('[data-open-auth]').forEach((button) => button.addEventListener('click', openAuth));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeAuth));
  $$('[data-close-booking]').forEach((button) => button.addEventListener('click', () => $('#bookingModal').classList.add('hidden')));
  $$('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => { $$('[data-auth-tab]').forEach((item) => item.classList.toggle('active', item === button)); $('#loginForm').classList.toggle('hidden', button.dataset.authTab !== 'login'); $('#registerForm').classList.toggle('hidden', button.dataset.authTab !== 'register'); }));
  $('#loginForm').addEventListener('submit', (event) => authSubmit(event, 'login')); $('#registerForm').addEventListener('submit', (event) => authSubmit(event, 'register'));
  $('#lookupForm').addEventListener('submit', lookupBooking);
  $('#logoutButton').addEventListener('click', () => { clearSession(); toast('Đã đăng xuất.'); route(); });
  $('#refreshDashboard').addEventListener('click', loadDashboard); $('#sortTrips').addEventListener('change', renderTrips);
  [$('#heroSearchForm'), $('#searchForm')].forEach((form) => form.addEventListener('submit', (event) => { event.preventDefault(); performSearch(Object.fromEntries(new FormData(form))); }));
  $$('[data-swap]').forEach((button) => button.addEventListener('click', () => { const form = button.closest('form'); const from = $('[name="from"]', form), to = $('[name="to"]', form); [from.value, to.value] = [to.value, from.value]; }));
}

async function init() {
  syncHeader(); bindEvents(); route();
  try { await loadStations(); } catch { toast('Không tải được danh sách ga.', 'error'); }
}

init();
