// Used for BOTH the typed name and the stored name_key, so they always match.
// Lowercases, strips accents (Peña -> pena), collapses extra spaces.
function normalizeName(input = '') {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tidyName(input = '') {
  return String(input).replace(/\s+/g, ' ').trim();
}

function uniqueCompanionNames(names = []) {
  const seen = new Set();
  const unique = [];
  for (const raw of names) {
    const name = tidyName(raw);
    if (name.length < 2) continue;
    const key = normalizeName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique;
}

function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b);
}

module.exports = { normalizeName, tidyName, uniqueCompanionNames, namesMatch };
