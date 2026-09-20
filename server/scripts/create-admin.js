// Creates an admin account (or resets its password) without putting a password in SQL.
//   node scripts/create-admin.js <username>
//   node scripts/create-admin.js <username> --print-hash   (prints the bcrypt hash only, no database)
const path = require('path');
const fs = require('fs');

const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}
const readline = require('readline');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
const printOnly = args.includes('--print-hash');
const username = args.find((a) => !a.startsWith('--'));

if (!username || !/^[a-z0-9._-]{3,60}$/.test(username)) {
  console.error('Usage: node scripts/create-admin.js <username> [--print-hash]');
  console.error('Username: 3 to 60 characters; lowercase letters, numbers, dot, dash or underscore.');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});

// Hide typed characters when running in a terminal.
let muted = false;
const originalWrite = rl._writeToOutput;
rl._writeToOutput = function (s) {
  if (muted && s !== '\r\n' && s !== '\n') return;
  originalWrite.call(this, s);
};

// Queue lines so piped input (several lines at once) is not lost.
const queue = [];
let waiting = null;
let closed = false;
rl.on('line', (line) => {
  if (waiting) {
    const resolve = waiting;
    waiting = null;
    resolve(line);
  } else {
    queue.push(line);
  }
});
rl.on('close', () => {
  closed = true;
  if (waiting) {
    const resolve = waiting;
    waiting = null;
    resolve(null);
  }
});

const ask = (question, mute) =>
  new Promise((resolve, reject) => {
    process.stdout.write(question);
    muted = Boolean(mute);
    const finish = (answer) => {
      muted = false;
      if (mute) process.stdout.write('\n');
      if (answer === null) reject(new Error('No input received.'));
      else resolve(answer);
    };
    if (queue.length) return finish(queue.shift());
    if (closed) return finish(null);
    waiting = finish;
  });

(async () => {
  const password = await ask('Password (at least 10 characters): ', true);
  const repeat = await ask('Repeat password: ', true);
  rl.close();
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (password !== repeat) throw new Error('Passwords do not match.');

  const hash = await bcrypt.hash(password, 12);
  if (printOnly) {
    console.log(hash);
    return;
  }
  const pool = require('../db');
  await pool.query(
    `INSERT INTO admin_user (username, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [username, hash]
  );
  console.log(`Admin "${username}" saved.`);
  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
