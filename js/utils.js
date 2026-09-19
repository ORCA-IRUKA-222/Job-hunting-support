/* 汎用ヘルパー：DOM・日付・文字列 */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ESC[ch]);

/* ---------- 日付 ---------- */
const pad = (n) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DD'（ローカル時刻基準） */
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DD' -> Date（ローカル0時） */
export function fromISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const todayISO = () => toISO(new Date());

export const DOW = ['日', '月', '火', '水', '木', '金', '土'];

/** 今日からの日数（過去はマイナス） */
export function daysFromToday(iso) {
  if (!iso) return null;
  return Math.round((fromISO(iso) - fromISO(todayISO())) / 86400000);
}

export function fmtDate(iso, { year = 'auto', dow = true } = {}) {
  if (!iso) return '';
  const d = fromISO(iso);
  const showYear = year === true || (year === 'auto' && d.getFullYear() !== new Date().getFullYear());
  const head = showYear ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : `${d.getMonth() + 1}/${d.getDate()}`;
  return dow ? `${head}(${DOW[d.getDay()]})` : head;
}

/** 「今日」「明日」「3日後」「2日超過」のような相対表記 */
export function relDate(iso) {
  const n = daysFromToday(iso);
  if (n === null) return '';
  if (n === 0) return '今日';
  if (n === 1) return '明日';
  if (n === 2) return '明後日';
  if (n === -1) return '昨日';
  return n > 0 ? `${n}日後` : `${-n}日超過`;
}

/** 締切の緊急度: 'over' | 'today' | 'soon' | 'later' | null */
export function urgency(iso) {
  const n = daysFromToday(iso);
  if (n === null) return null;
  if (n < 0) return 'over';
  if (n === 0) return 'today';
  if (n <= 3) return 'soon';
  return 'later';
}

export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export function fmtDateTime(iso, time) {
  return [fmtDate(iso), time].filter(Boolean).join(' ');
}

/* ---------- 文字列 ---------- */
/** ES 用の文字数カウント（改行・空白を除外） */
export const countChars = (s) => String(s || '').replace(/\s/g, '').length;

export const truncate = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + '…' : String(s || ''));

/* ---------- UI ---------- */
export function toast(message, kind = '') {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ` toast--${kind}` : '');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
  }, 2200);
}

export const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーしました', 'ok');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('コピーしました', 'ok'); }
    catch { toast('コピーできませんでした', 'err'); }
    ta.remove();
  }
}

export const icon = (name, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
