const path = require('node:path');
const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('./store');
const { issueToken, authenticate, allow } = require('./auth');

const app = express();
const port = Number(process.env.PORT || 3000);
const bugMode = String(process.env.BUG_MODE ?? 'true').toLowerCase() !== 'false';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function station(id) {
  return store.state.stations.find((item) => item.id === id);
}

function decorateTrip(trip) {
  const train = store.state.trains.find((item) => item.id === trip.trainId);
  return { ...trip, train, fromStation: station(trip.from), toStation: station(trip.to) };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

app.get('/api/health', (req, res) => {
  const demoDate = store.state.trips.find((trip) => trip.id === 'TP-001')?.departure.slice(0, 10);
  res.json({ data: { status: 'UP', version: '1.0.0', bugMode, demoDate, timestamp: new Date().toISOString() } });
});

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  const errors = {};
  if (!fullName || fullName.trim().length < 2 || fullName.trim().length > 60) errors.fullName = 'Họ tên phải từ 2 đến 60 ký tự.';
  if (!validateEmail(email)) errors.email = 'Email không đúng định dạng.';
  if (!/^0\d{9}$/.test(String(phone || ''))) errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.';
  if (!bugMode && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,32}$/.test(String(password || ''))) {
    errors.password = 'Mật khẩu dài 8–32 ký tự, có chữ hoa, chữ thường và chữ số.';
  }
  if (store.state.users.some((item) => item.email.toLowerCase() === String(email).toLowerCase())) errors.email = 'Email đã được sử dụng.';
  if (!bugMode && store.state.users.some((item) => item.phone === phone)) errors.phone = 'Số điện thoại đã được sử dụng.';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'VALIDATION_ERROR', fields: errors });

  const user = {
    id: store.nextId('USR', store.state.users), fullName: fullName.trim(),
    email: email.trim().toLowerCase(), phone, role: 'CUSTOMER', active: true,
    passwordHash: await bcrypt.hash(password, 10)
  };
  store.state.users.push(user);
  store.log('REGISTER', user.id);
  store.save();
  res.status(201).json({ data: { token: issueToken(user), user: store.publicUser(user) } });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  const user = store.state.users.find((item) => item.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !user.active || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không chính xác.' });
  }
  store.log('LOGIN', user.id);
  store.save();
  res.json({ data: { token: issueToken(user), user: store.publicUser(user) } });
}));

app.get('/api/auth/me', authenticate, (req, res) => res.json({ data: store.publicUser(req.user) }));

app.get('/api/stations', (req, res) => res.json({ data: store.state.stations }));

app.get('/api/trips/search', asyncRoute(async (req, res) => {
  const { from, to, date, passengers = '1' } = req.query;
  if (!from || !to || !date) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Vui lòng chọn ga đi, ga đến và ngày đi.' });
  }
  if (!bugMode && from === to) {
    return res.status(400).json({ error: 'SAME_STATION', message: 'Ga đi và ga đến phải khác nhau.' });
  }
  const count = Number(passengers);
  if (!Number.isInteger(count) || count < 1 || count > 6) {
    return res.status(400).json({ error: 'INVALID_PASSENGERS', message: 'Số hành khách phải từ 1 đến 6.' });
  }
  if (bugMode && count === 6) throw new Error('Search service failed while allocating a large group');
  const result = store.state.trips
    .filter((trip) => trip.status === 'OPEN')
    .filter((trip) => (from === to && bugMode) || (trip.from === from && trip.to === to))
    .filter((trip) => trip.departure.slice(0, 10) === date)
    .filter((trip) => trip.availableSeats >= count)
    .map(decorateTrip);
  res.json({ data: result, meta: { count: result.length } });
}));

app.get('/api/trips/:id', (req, res) => {
  const trip = store.state.trips.find((item) => item.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy chuyến tàu.' });
  res.json({ data: decorateTrip(trip) });
});

app.get('/api/trips/:id/seats', (req, res) => {
  const trip = store.state.trips.find((item) => item.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy chuyến tàu.' });
  const occupied = new Set(store.state.bookings.filter((b) => b.tripId === trip.id && b.status !== 'CANCELLED').flatMap((b) => b.seats));
  const seats = Array.from({ length: trip.seats }, (_, index) => {
    const number = index + 1;
    const code = `A${String(number).padStart(2, '0')}`;
    return { code, type: number <= 16 ? 'SOFT_SEAT' : number <= 48 ? 'AIR_SEAT' : 'SLEEPER', available: !occupied.has(code) };
  });
  res.json({ data: seats });
});

app.post('/api/bookings', authenticate, allow('CUSTOMER'), (req, res, next) => {
  const { tripId, passengers, seats, promoCode } = req.body;
  const trip = store.state.trips.find((item) => item.id === tripId && item.status === 'OPEN');
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND', message: 'Chuyến tàu không tồn tại hoặc đã đóng.' });
  if (!Array.isArray(passengers) || passengers.length < 1 || passengers.length > 6) {
    return res.status(400).json({ error: 'INVALID_PASSENGERS', message: 'Mỗi đơn có từ 1 đến 6 hành khách.' });
  }
  if (!Array.isArray(seats) || seats.length !== passengers.length) {
    return res.status(400).json({ error: 'INVALID_SEATS', message: 'Mỗi hành khách phải chọn đúng một ghế.' });
  }
  const invalidPassenger = passengers.find((p) => !p.fullName || !/^\d{12}$/.test(String(p.identity || '')) || Number(p.age) < 1 || Number(p.age) > 120);
  if (invalidPassenger) return res.status(400).json({ error: 'INVALID_PASSENGER', message: 'Thông tin hành khách không hợp lệ.' });

  const occupied = new Set(store.state.bookings.filter((b) => b.tripId === trip.id && b.status !== 'CANCELLED').flatMap((b) => b.seats));
  const seatsToCheck = seats;
  if (seatsToCheck.some((seatCode) => occupied.has(seatCode))) {
    return res.status(409).json({ error: 'SEAT_UNAVAILABLE', message: 'Một hoặc nhiều ghế vừa được người khác đặt.' });
  }

  const totalPrice = passengers.reduce((sum, p) => {
    const factor = !bugMode && Number(p.age) >= 6 && Number(p.age) <= 10 ? 0.75 : 1;
    return sum + Math.round(trip.basePrice * factor);
  }, 0);
  const booking = {
    id: store.nextId('BKG', store.state.bookings), code: store.bookingCode(), userId: req.user.id,
    tripId, passengers, seats, promoCode: promoCode || null, totalPrice,
    status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', createdAt: new Date().toISOString()
  };
  store.state.bookings.push(booking);
  trip.availableSeats = Math.max(0, trip.availableSeats - seats.length);
  store.log('CREATE_BOOKING', req.user.id, { bookingId: booking.id });
  store.save();
  res.status(201).json({ data: booking });
});

app.post('/api/payments/:bookingId/mock', authenticate, allow('CUSTOMER'), (req, res) => {
  const booking = store.state.bookings.find((item) => item.id === req.params.bookingId && item.userId === req.user.id);
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy đơn đặt vé.' });
  if (booking.status !== 'PENDING_PAYMENT') return res.status(409).json({ error: 'INVALID_STATE', message: 'Đơn không ở trạng thái chờ thanh toán.' });
  booking.paymentStatus = 'PAID';
  booking.status = 'CONFIRMED';
  booking.paidAt = new Date().toISOString();
  store.log('PAY_BOOKING', req.user.id, { bookingId: booking.id });
  store.save();
  res.json({ data: booking });
});

app.get('/api/bookings/me', authenticate, allow('CUSTOMER'), (req, res) => {
  const data = store.state.bookings.filter((item) => item.userId === req.user.id).map((item) => ({ ...item, trip: decorateTrip(store.state.trips.find((trip) => trip.id === item.tripId)) }));
  res.json({ data });
});

app.get('/api/bookings/lookup/:code', (req, res, next) => {
  if (bugMode) return next(new Error('Booking lookup service is unavailable'));
  const booking = store.state.bookings.find((item) => item.code.toLowerCase() === req.params.code.toLowerCase());
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy vé với mã đã nhập.' });
  const { userId, ...safeBooking } = booking;
  res.json({ data: { ...safeBooking, trip: decorateTrip(store.state.trips.find((trip) => trip.id === booking.tripId)) } });
});

app.patch('/api/bookings/:id/cancel', authenticate, allow('CUSTOMER', 'STAFF', 'ADMIN'), (req, res) => {
  if (bugMode) throw new Error('Booking cancellation service failed');
  const booking = store.state.bookings.find((item) => item.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy đơn đặt vé.' });
  if (req.user.role === 'CUSTOMER' && booking.userId !== req.user.id) return res.status(403).json({ error: 'FORBIDDEN' });
  const trip = store.state.trips.find((item) => item.id === booking.tripId);
  const hours = (new Date(trip.departure) - Date.now()) / 3600000;
  if (hours < 4) return res.status(409).json({ error: 'CANCELLATION_CLOSED', message: 'Chỉ được hủy vé trước giờ tàu chạy ít nhất 4 giờ.' });
  if (booking.status === 'CANCELLED') return res.status(409).json({ error: 'INVALID_STATE', message: 'Vé đã được hủy trước đó.' });
  booking.status = 'CANCELLED';
  booking.refundAmount = booking.paymentStatus === 'PAID' ? Math.round(booking.totalPrice * 0.8) : 0;
  trip.availableSeats += booking.seats.length;
  store.log('CANCEL_BOOKING', req.user.id, { bookingId: booking.id });
  store.save();
  res.json({ data: booking });
});

app.get('/api/admin/stats', authenticate, allow('STAFF', 'ADMIN'), asyncRoute(async (req, res) => {
  const paid = store.state.bookings.filter((item) => item.paymentStatus === 'PAID');
  res.json({ data: {
    users: store.state.users.filter((item) => item.role === 'CUSTOMER').length,
    trips: store.state.trips.length,
    bookings: store.state.bookings.length,
    revenue: paid.reduce((sum, item) => sum + item.totalPrice, 0),
    recentBookings: store.state.bookings.slice(-5).reverse()
  } });
}));

app.get('/api/admin/trips', authenticate, allow('STAFF', 'ADMIN'), (req, res) => res.json({ data: store.state.trips.map(decorateTrip) }));

app.post('/api/admin/trips', authenticate, allow('ADMIN'), (req, res) => {
  const { trainId, from, to, departure, arrival, basePrice, seats = 48 } = req.body;
  if (!trainId || !from || !to || !departure || !arrival || Number(basePrice) <= 0 || from === to || new Date(arrival) <= new Date(departure)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Thông tin chuyến tàu không hợp lệ.' });
  }
  const trip = { id: store.nextId('TP', store.state.trips), trainId, from, to, departure, arrival, basePrice: Number(basePrice), seats: Number(seats), availableSeats: Number(seats), status: 'OPEN' };
  store.state.trips.push(trip);
  store.log('CREATE_TRIP', req.user.id, { tripId: trip.id });
  store.save();
  res.status(201).json({ data: decorateTrip(trip) });
});

app.patch('/api/admin/trips/:id/status', authenticate, allow('STAFF', 'ADMIN'), (req, res) => {
  const trip = store.state.trips.find((item) => item.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'NOT_FOUND' });
  if (!['OPEN', 'CLOSED', 'DELAYED', 'CANCELLED'].includes(req.body.status)) return res.status(400).json({ error: 'INVALID_STATUS' });
  trip.status = req.body.status;
  store.log('UPDATE_TRIP_STATUS', req.user.id, { tripId: trip.id, status: trip.status });
  store.save();
  res.json({ data: decorateTrip(trip) });
});

app.get('/api/admin/users', authenticate, allow('ADMIN'), (req, res) => res.json({ data: store.state.users.map(store.publicUser) }));

app.patch('/api/admin/users/:id/status', authenticate, allow('ADMIN'), (req, res) => {
  const user = store.state.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
  user.active = Boolean(req.body.active);
  store.log('UPDATE_USER_STATUS', req.user.id, { targetUserId: user.id, active: user.active });
  store.save();
  res.json({ data: store.publicUser(user) });
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*path', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên.' }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.' });
});

store.init().then(() => {
  app.listen(port, () => console.log(`RailGo đang chạy tại http://localhost:${port} (BUG_MODE=${bugMode})`));
}).catch((error) => {
  console.error('Không thể khởi tạo dữ liệu:', error);
  process.exit(1);
});
