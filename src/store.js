const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
const seedPath = path.join(dataDir, 'seed.json');
const runtimePath = process.env.RUNTIME_DATA_PATH
  ? path.resolve(process.env.RUNTIME_DATA_PATH)
  : path.join(dataDir, 'runtime.json');

let state;

function vietnamDate(offsetDays = 0) {
  const target = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(target);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function applyDemoDates() {
  const schedules = {
    'TP-001': [1, '19:30', 2, '11:15'],
    'TP-002': [1, '22:00', 2, '14:35'],
    'TP-003': [2, '08:40', 2, '23:10'],
    'TP-004': [2, '21:20', 3, '05:45'],
    'TP-005': [3, '19:30', 5, '05:20'],
    'TP-006': [4, '19:00', 6, '04:30']
  };
  state.trips.forEach((trip) => {
    const schedule = schedules[trip.id];
    if (!schedule) return;
    trip.departure = `${vietnamDate(schedule[0])}T${schedule[1]}:00+07:00`;
    trip.arrival = `${vietnamDate(schedule[2])}T${schedule[3]}:00+07:00`;
  });
}

function save() {
  fs.writeFileSync(runtimePath, JSON.stringify(state, null, 2), 'utf8');
}

function nextId(prefix, collection) {
  const max = collection.reduce((current, item) => {
    const value = Number(String(item.id || '').split('-').at(-1));
    return Number.isFinite(value) ? Math.max(current, value) : current;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

function bookingCode() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const serial = String(state.bookings.length + 1).padStart(4, '0');
  return `RG-${stamp}-${serial}`;
}

async function init() {
  if (fs.existsSync(runtimePath)) {
    state = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    return state;
  }

  state = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  state.users = [
    {
      id: 'USR-0001', fullName: 'Nguyễn Minh Anh', email: 'customer@railgo.vn',
      phone: '0912345678', role: 'CUSTOMER', active: true,
      passwordHash: await bcrypt.hash('Customer@123', 10)
    },
    {
      id: 'USR-0002', fullName: 'Trần Thu Hà', email: 'staff@railgo.vn',
      phone: '0988123456', role: 'STAFF', active: true,
      passwordHash: await bcrypt.hash('Staff@123', 10)
    },
    {
      id: 'USR-0003', fullName: 'Quản trị RailGo', email: 'admin@railgo.vn',
      phone: '0909000001', role: 'ADMIN', active: true,
      passwordHash: await bcrypt.hash('Admin@123', 10)
    }
  ];
  applyDemoDates();
  save();
  return state;
}

function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function log(action, userId, details = {}) {
  state.auditLogs.unshift({
    id: nextId('LOG', state.auditLogs), action, userId: userId || null,
    details, createdAt: new Date().toISOString()
  });
  state.auditLogs = state.auditLogs.slice(0, 500);
}

module.exports = {
  init,
  save,
  nextId,
  bookingCode,
  publicUser,
  log,
  get state() { return state; }
};
