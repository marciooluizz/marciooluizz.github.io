import { uid } from './utils.js';

const STUDY_FIELDS = ['id','term','translation','example_sentence','example_translation','pronunciation','audio','image','part_of_speech','tags','difficulty','notes','synonyms','antonyms'];
const PRACTICE_FIELDS = ['id','question','question_type','choices','correct_answer','acceptable_answers','explanation','hint','topic','difficulty','tags','media'];

const readText = (file) => file.text();

function detectDelimiter(line = '') {
  if (line.includes('|')) return '|';
  if (line.includes('\t')) return '\t';
  return ',';
}

function splitDelimitedLine(line, delimiter) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i++; continue; }
      quoted = !quoted;
      continue;
    }
    if (ch === delimiter && !quoted) { out.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function normalizeStudy(row) {
  const obj = { id: row.id || uid(), term: row.term || '', translation: row.translation || '' };
  STUDY_FIELDS.forEach((f) => {
    if (row[f] !== undefined && row[f] !== '') obj[f] = ['tags','synonyms','antonyms'].includes(f) ? parseList(row[f]) : row[f];
  });
  return obj;
}

function normalizePractice(row) {
  const obj = { id: row.id || uid(), question: row.question || '', question_type: row.question_type || 'typed' };
  PRACTICE_FIELDS.forEach((f) => {
    if (row[f] !== undefined && row[f] !== '') {
      if (['choices','acceptable_answers','tags'].includes(f)) obj[f] = parseList(row[f]);
      else obj[f] = row[f];
    }
  });
  return obj;
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  return String(value).split(';').map((x) => x.trim()).filter(Boolean);
}

function rowsFromDelimited(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = splitDelimitedLine(line, delimiter);
    return headers.reduce((acc, h, i) => (acc[h] = cols[i], acc), {});
  });
}

export async function parseStudyFile(file) {
  const name = file.name.replace(/\.[^.]+$/, '');
  if (/\.xlsx?$/i.test(file.name)) return parseStudySheet(file, name);
  const rows = rowsFromDelimited(await readText(file));
  const cards = rows.map(normalizeStudy).filter((c) => c.term && c.translation);
  return { id: uid(), name, type: 'study', cards };
}

export async function parsePracticeFile(file) {
  const name = file.name.replace(/\.[^.]+$/, '');
  if (/\.json$/i.test(file.name)) {
    const parsed = JSON.parse(await readText(file));
    const questions = (parsed.questions || []).map(normalizePractice);
    return { id: uid(), name: parsed.name || name, type: 'practice', questions };
  }
  if (/\.xlsx?$/i.test(file.name)) return parsePracticeSheet(file, name);
  const rows = rowsFromDelimited(await readText(file));
  return { id: uid(), name, type: 'practice', questions: rows.map(normalizePractice).filter((q) => q.question) };
}

async function parseStudySheet(file, name) {
  if (!window.XLSX) throw new Error('XLSX parser not loaded.');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const lowered = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));
  return { id: uid(), name, type: 'study', cards: lowered.map(normalizeStudy).filter((c) => c.term && c.translation) };
}

async function parsePracticeSheet(file, name) {
  if (!window.XLSX) throw new Error('XLSX parser not loaded.');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const lowered = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));
  return { id: uid(), name, type: 'practice', questions: lowered.map(normalizePractice).filter((q) => q.question) };
}
