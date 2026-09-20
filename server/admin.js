const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { normalizeName, tidyName, namesMatch } = require('./normalize');
const { sendError } = require('./errors');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Compared when the username is missing so timing does not reveal that.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts. Please try again in a minute.' },
});

function adminAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');
  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (payload.role !== 'admin') {
      return sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');
    }
    req.admin = { id: Number(payload.sub), username: payload.username };
    next();
  } catch {
    return sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');
  }
}

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function letterStatus(openedAt) {
  return openedAt ? 'Opened' : 'Not opened yet';
}

function formatUtc(dt) {
  if (!dt) return '';
  return new Date(dt).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function getAdminGuest(id) {
  const [rows] = await pool.query(
    `SELECT id, full_name, role, max_companions, rsvp_status, first_opened_at
       FROM invited_guest WHERE id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const [comps] = await pool.query(
    'SELECT id, full_name FROM companion WHERE guest_id = ? ORDER BY id',
    [id]
  );
  return shapeGuest(rows[0], comps);
}

function shapeGuest(g, companions) {
  return {
    id: g.id,
    fullName: g.full_name,
    role: g.role,
    openedAt: g.first_opened_at ? new Date(g.first_opened_at).toISOString() : null,
    rsvpStatus: g.rsvp_status,
    maxCompanions: g.max_companions,
    companions: companions.map((c) => ({ id: c.id, fullName: c.full_name })),
  };
}

const router = express.Router();

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return sendError(res, 400, 'INVALID_BODY', 'Username and password are required.');
  }

  const [rows] = await pool.query(
    'SELECT id, username, password_hash FROM admin_user WHERE username = ?',
    [username]
  );
  const row = rows[0];
  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) {
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  const token = jwt.sign(
    { sub: String(row.id), role: 'admin', username: row.username },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: '2h' }
  );
  res.json({ token, admin: { username: row.username } });
}));

router.use(adminAuth);

router.get('/summary', wrap(async (req, res) => {
  const [[g]] = await pool.query(`
    SELECT
      COUNT(*) AS invited,
      SUM(first_opened_at IS NOT NULL) AS opened,
      SUM(first_opened_at IS NULL) AS notOpened,
      SUM(rsvp_status = 'attending') AS attending,
      SUM(rsvp_status = 'pending') AS pending,
      SUM(rsvp_status = 'declined') AS declined,
      COALESCE(SUM(max_companions), 0) AS maxCompanionsSum
    FROM invited_guest
  `);
  const [[allComps]] = await pool.query('SELECT COUNT(*) AS n FROM companion');
  const [[attComps]] = await pool.query(`
    SELECT COUNT(*) AS n
      FROM companion c
      JOIN invited_guest g ON g.id = c.guest_id
     WHERE g.rsvp_status = 'attending'
  `);

  const invited = Number(g.invited) || 0;
  const attending = Number(g.attending) || 0;
  const attendingCompanions = Number(attComps.n) || 0;

  res.json({
    invited,
    opened: Number(g.opened) || 0,
    notOpened: Number(g.notOpened) || 0,
    attending,
    pending: Number(g.pending) || 0,
    declined: Number(g.declined) || 0,
    companionsTotal: Number(allComps.n) || 0,
    attendingCompanions,
    confirmedHeadcount: attending + attendingCompanions,
    maxPossibleHeadcount: invited + (Number(g.maxCompanionsSum) || 0),
    updatedAt: new Date().toISOString(),
  });
}));

router.get('/guests', wrap(async (req, res) => {
  const filter = String(req.query.filter || 'all');
  const allowed = new Set(['all', 'not-opened', 'attending', 'pending', 'declined']);
  if (!allowed.has(filter)) {
    return sendError(res, 400, 'INVALID_FILTER', 'Unknown guest filter.');
  }

  const clauses = [];
  const params = [];
  if (filter === 'not-opened') clauses.push('first_opened_at IS NULL');
  if (filter === 'attending') clauses.push("rsvp_status = 'attending'");
  if (filter === 'pending') clauses.push("rsvp_status = 'pending'");
  if (filter === 'declined') clauses.push("rsvp_status = 'declined'");

  const q = normalizeName(req.query.q);
  if (q) {
    clauses.push('name_key LIKE ?');
    params.push(`%${q}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, full_name, role, max_companions, rsvp_status, first_opened_at
       FROM invited_guest ${where}
      ORDER BY name_key`,
    params
  );

  if (!rows.length) return res.json({ guests: [] });

  const ids = rows.map((r) => r.id);
  const [comps] = await pool.query(
    `SELECT id, guest_id, full_name FROM companion WHERE guest_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`,
    ids
  );
  const byGuest = new Map(ids.map((id) => [id, []]));
  for (const c of comps) byGuest.get(c.guest_id).push(c);

  res.json({
    guests: rows.map((g) => shapeGuest(g, byGuest.get(g.id) || [])),
  });
}));

router.post('/guests', wrap(async (req, res) => {
  const fullName = tidyName(req.body?.fullName);
  const role = tidyName(req.body?.role || 'Guest') || 'Guest';
  const maxCompanions = req.body?.maxCompanions === undefined || req.body?.maxCompanions === null
    ? 2
    : Number(req.body.maxCompanions);

  if (fullName.length < 3 || fullName.length > 150) {
    return sendError(res, 400, 'INVALID_NAME', 'Please enter the guest’s full name.');
  }
  if (role.length > 50) {
    return sendError(res, 400, 'INVALID_ROLE', 'Role must be 50 characters or fewer.');
  }
  if (!Number.isInteger(maxCompanions) || maxCompanions < 0 || maxCompanions > 10) {
    return sendError(res, 400, 'INVALID_LIMIT', 'Companion limit must be a whole number from 0 to 10.');
  }

  const nameKey = normalizeName(fullName);
  try {
    const [result] = await pool.query(
      `INSERT INTO invited_guest (full_name, name_key, role, max_companions)
       VALUES (?, ?, ?, ?)`,
      [fullName, nameKey, role, maxCompanions]
    );
    res.status(201).json({ guest: await getAdminGuest(result.insertId) });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'DUPLICATE_GUEST', 'That guest is already on the list.');
    }
    throw err;
  }
}));

router.patch('/guests/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return sendError(res, 404, 'NOT_FOUND', 'Guest not found.');
  }
  if (req.body?.maxCompanions === undefined || req.body?.maxCompanions === null) {
    return sendError(res, 400, 'INVALID_LIMIT', 'Companion limit must be a whole number from 0 to 10.');
  }
  const maxCompanions = Number(req.body.maxCompanions);
  if (!Number.isInteger(maxCompanions) || maxCompanions < 0 || maxCompanions > 10) {
    return sendError(res, 400, 'INVALID_LIMIT', 'Companion limit must be a whole number from 0 to 10.');
  }

  const guest = await getAdminGuest(id);
  if (!guest) return sendError(res, 404, 'NOT_FOUND', 'Guest not found.');
  if (maxCompanions < guest.companions.length) {
    return sendError(
      res,
      409,
      'LIMIT_BELOW_COMPANIONS',
      'Limits cannot be lower than companions already added.'
    );
  }

  await pool.query('UPDATE invited_guest SET max_companions = ? WHERE id = ?', [maxCompanions, id]);
  res.json({ guest: await getAdminGuest(id) });
}));

router.post('/guests/:id/companions', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return sendError(res, 404, 'NOT_FOUND', 'Guest not found.');
  }
  const fullName = tidyName(req.body?.fullName);
  if (fullName.length < 2 || fullName.length > 150) {
    return sendError(res, 400, 'INVALID_NAME', 'Please enter a companion name.');
  }

  const guest = await getAdminGuest(id);
  if (!guest) return sendError(res, 404, 'NOT_FOUND', 'Guest not found.');
  if (guest.companions.some((c) => namesMatch(c.fullName, fullName))) {
    return sendError(res, 409, 'DUPLICATE_COMPANION', 'That companion is already added.');
  }
  if (namesMatch(guest.fullName, fullName)) {
    return sendError(res, 409, 'DUPLICATE_COMPANION', 'A companion cannot have the same name as the guest.');
  }
  if (guest.companions.length >= guest.maxCompanions) {
    return sendError(res, 409, 'AT_LIMIT', 'Raise the companion limit before adding another name.');
  }

  await pool.query('INSERT INTO companion (guest_id, full_name) VALUES (?, ?)', [id, fullName]);
  res.status(201).json({ guest: await getAdminGuest(id) });
}));

router.delete('/companions/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return sendError(res, 404, 'NOT_FOUND', 'Companion not found.');
  }
  const [rows] = await pool.query('SELECT guest_id FROM companion WHERE id = ?', [id]);
  if (!rows.length) return sendError(res, 404, 'NOT_FOUND', 'Companion not found.');
  const guestId = rows[0].guest_id;
  await pool.query('DELETE FROM companion WHERE id = ?', [id]);
  res.json({ guest: await getAdminGuest(guestId) });
}));

router.get('/export.csv', wrap(async (req, res) => {
  const [guests] = await pool.query(
    `SELECT id, full_name, role, max_companions, rsvp_status, first_opened_at
       FROM invited_guest ORDER BY name_key`
  );
  const [comps] = await pool.query(
    'SELECT id, guest_id, full_name FROM companion ORDER BY id'
  );
  const byGuest = new Map();
  for (const c of comps) {
    if (!byGuest.has(c.guest_id)) byGuest.set(c.guest_id, []);
    byGuest.get(c.guest_id).push(c);
  }

  const header = [
    'Type',
    'Name',
    'Companion of',
    'Role',
    'Letter status',
    'First opened (UTC)',
    'RSVP',
    'Companion limit',
  ];
  const lines = [header.map(csvCell).join(',')];

  for (const g of guests) {
    const openedAt = g.first_opened_at;
    lines.push(
      [
        'Guest',
        g.full_name,
        '',
        g.role,
        letterStatus(openedAt),
        formatUtc(openedAt),
        g.rsvp_status,
        g.max_companions,
      ]
        .map(csvCell)
        .join(',')
    );
    for (const c of byGuest.get(g.id) || []) {
      lines.push(
        ['Companion', c.full_name, g.full_name, '', '', '', '', '']
          .map(csvCell)
          .join(',')
      );
    }
  }

  const body = `\uFEFF${lines.join('\r\n')}\r\n`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="guest-list.csv"');
  res.send(body);
}));

module.exports = router;
