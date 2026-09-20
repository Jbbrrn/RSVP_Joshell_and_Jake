const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { normalizeName, uniqueCompanionNames, namesMatch } = require('./normalize');
const { sendError } = require('./errors');
const adminRouter = require('./admin');

for (const name of ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET === process.env.ADMIN_JWT_SECRET) {
  console.error('JWT_SECRET and ADMIN_JWT_SECRET must be different values.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy
app.use(express.json({ limit: '10kb' }));

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- Health (defined before any rate limiter so the uptime monitor is never blocked)
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// ---------- Helpers
async function getGuest(id) {
  const [rows] = await pool.query(
    'SELECT id, full_name, role, max_companions, rsvp_status FROM invited_guest WHERE id = ?',
    [id]
  );
  if (!rows.length) return null;
  const g = rows[0];
  const [comps] = await pool.query(
    'SELECT full_name FROM companion WHERE guest_id = ? ORDER BY id',
    [id]
  );
  return {
    fullName: g.full_name,
    role: g.role,
    maxCompanions: g.max_companions,
    rsvpStatus: g.rsvp_status,
    companions: comps.map((c) => c.full_name),
  };
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role === 'admin') {
      return sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');
    }
    req.guestId = Number(payload.sub);
    next();
  } catch {
    sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');
  }
}

// ---------- Name gate
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts. Please try again in a minute.' },
});

app.post('/api/verify', verifyLimiter, wrap(async (req, res) => {
  const key = normalizeName(req.body?.fullName);
  if (key.length < 3 || key.length > 150) {
    return sendError(res, 400, 'INVALID_NAME', 'Please enter your full name.');
  }
  const [rows] = await pool.query('SELECT id FROM invited_guest WHERE name_key = ?', [key]);
  if (!rows.length) {
    return sendError(res, 404, 'NOT_FOUND', "We couldn't find your name on the guest list.");
  }
  await pool.query(
    `UPDATE invited_guest
        SET first_opened_at = COALESCE(first_opened_at, NOW()),
            last_opened_at = NOW(),
            open_count = open_count + 1
      WHERE id = ?`,
    [rows[0].id]
  );
  const token = jwt.sign({ sub: String(rows[0].id) }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, guest: await getGuest(rows[0].id) });
}));

// ---------- Protected guest routes
app.get('/api/me', auth, wrap(async (req, res) => {
  const guest = await getGuest(req.guestId);
  if (!guest) return sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');
  res.json({ guest });
}));

// Full-site content only leaves the server after the name is verified.
app.get('/api/invitation', auth, (req, res) => {
  res.json({
    couple: {
      bride: 'Joshell Barrion',
      groom: 'Jake Barairo',
    },
    monogram: 'J | J',
    date: '2027-01-09',
    venue: {
      name: 'Sioree Events Place',
      url: null,
    },
    rsvpDeadline: null,
    schedule: [],
  });
});

app.post('/api/rsvp', auth, wrap(async (req, res) => {
  const { status, companions = [] } = req.body || {};
  if (!['attending', 'declined'].includes(status)) {
    return sendError(res, 400, 'INVALID_STATUS', 'Invalid RSVP status.');
  }
  const guest = await getGuest(req.guestId);
  if (!guest) return sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');

  let names = [];
  if (status === 'attending') {
    if (!Array.isArray(companions)) {
      return sendError(res, 400, 'INVALID_COMPANIONS', 'Companions must be a list of names.');
    }
    names = uniqueCompanionNames(companions).filter((n) => !namesMatch(n, guest.fullName));
    if (names.length > guest.maxCompanions) {
      return sendError(
        res,
        400,
        'COMPANION_LIMIT',
        `You can bring up to ${guest.maxCompanions} companion(s).`
      );
    }
    if (names.some((n) => n.length > 150)) {
      return sendError(res, 400, 'INVALID_NAME', 'A companion name is too long.');
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE invited_guest SET rsvp_status = ?, responded_at = NOW() WHERE id = ?',
      [status, req.guestId]
    );
    await conn.query('DELETE FROM companion WHERE guest_id = ?', [req.guestId]);
    for (const n of names) {
      await conn.query('INSERT INTO companion (guest_id, full_name) VALUES (?, ?)', [req.guestId, n]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ guest: await getGuest(req.guestId) });
}));

app.use('/api/admin', adminRouter);

// ---------- React site (same address as the API, so no CORS is needed)
const clientDist = path.join(__dirname, '../client/dist');
app.use('/api', (req, res) => sendError(res, 404, 'NOT_FOUND', 'Not found.'));
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next(err);
  });
});

// ---------- Errors
app.use((err, req, res, next) => {
  console.error(err);
  sendError(res, 500, 'SERVER_ERROR', 'Something went wrong. Please try again.');
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`API listening on ${port}`));
