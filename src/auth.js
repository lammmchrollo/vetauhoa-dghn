const jwt = require('jsonwebtoken');
const store = require('./store');

const secret = process.env.JWT_SECRET || 'railgo-change-this-secret';

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '60m' });
}

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập.' });
  try {
    const payload = jwt.verify(token, secret);
    const user = store.state.users.find((item) => item.id === payload.sub && item.active);
    if (!user) throw new Error('User is inactive');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
}

function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
}

module.exports = { issueToken, authenticate, allow };
