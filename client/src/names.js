export function normalizeName(input = '') {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function tidyName(input = '') {
  return String(input).replace(/\s+/g, ' ').trim();
}

export function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b);
}

export function uniqueCompanionNames(names = []) {
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
