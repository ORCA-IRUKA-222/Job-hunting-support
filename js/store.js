/* データモデルと永続化 (localStorage) */

export const DATA_VERSION = 1;
const KEY = 'jhs.data.v1';

/** 選考ステージ（順序＝進捗順） */
export const STAGES = [
  { id: 'interest',  label: '気になる',   color: '#94a3b8', active: false },
  { id: 'entry',     label: 'エントリー', color: '#64748b', active: true  },
  { id: 'es',        label: 'ES提出済',   color: '#3b82f6', active: true  },
  { id: 'test',      label: 'Webテスト',  color: '#06b6d4', active: true  },
  { id: 'screening', label: '書類選考中', color: '#6366f1', active: true  },
  { id: 'i1',        label: '一次面接',   color: '#8b5cf6', active: true  },
  { id: 'i2',        label: '二次面接',   color: '#a855f7', active: true  },
  { id: 'i3',        label: '三次面接',   color: '#c026d3', active: true  },
  { id: 'final',     label: '最終面接',   color: '#ec4899', active: true  },
  { id: 'offer',     label: '内定',       color: '#22c55e', active: true  },
  { id: 'accepted',  label: '内定承諾',   color: '#059669', active: true  },
  { id: 'rejected',  label: 'お見送り',   color: '#ef4444', active: false },
  { id: 'declined',  label: '辞退',       color: '#a8a29e', active: false },
];
export const stage = (id) => STAGES.find(s => s.id === id) || STAGES[0];

/** 予定の種類 */
export const EVENT_TYPES = [
  { id: 'info',      label: '説明会',       color: '#0ea5e9' },
  { id: 'deadline',  label: '提出締切',     color: '#ef4444' },
  { id: 'test',      label: 'Webテスト',    color: '#06b6d4' },
  { id: 'interview', label: '面接',         color: '#8b5cf6' },
  { id: 'casual',    label: '面談・OB訪問', color: '#14b8a6' },
  { id: 'other',     label: 'その他',       color: '#64748b' },
];
export const eventType = (id) => EVENT_TYPES.find(t => t.id === id) || EVENT_TYPES[5];

/** タスクの分類 */
export const TASK_CATEGORIES = [
  'ES・エントリーシート', '履歴書・証明書', 'Webテスト対策', '面接準備',
  'お礼メール', '説明会・予約', '自己分析', 'その他',
];

export const PRIORITIES = [
  { id: 'high',   label: '高', color: '#ef4444' },
  { id: 'normal', label: '中', color: '#64748b' },
  { id: 'low',    label: '低', color: '#94a3b8' },
];
export const priority = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[1];

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const emptyData = () => ({
  version: DATA_VERSION,
  profile: { name: '', gradYear: '' },
  companies: [],
  tasks: [],
  answers: [],
  notes: [],
  settings: { theme: 'auto', gist: { token: '', id: '', auto: false } },
  updatedAt: new Date().toISOString(),
  lastSyncedAt: null,
});

/* ---------- 正規化（壊れた/古いデータでも落ちないように） ---------- */
function normalize(raw) {
  const d = { ...emptyData(), ...(raw && typeof raw === 'object' ? raw : {}) };
  d.profile = { name: '', gradYear: '', ...(d.profile || {}) };
  d.settings = {
    theme: 'auto', ...(d.settings || {}),
    gist: { token: '', id: '', auto: false, ...((d.settings || {}).gist || {}) },
  };
  const arr = (v) => (Array.isArray(v) ? v : []);
  d.companies = arr(d.companies).map(c => ({
    id: c.id || uid(), name: c.name || '(名称未設定)', industry: c.industry || '',
    role: c.role || '', stage: stage(c.stage).id, rating: Number(c.rating) || 3,
    url: c.url || '', source: c.source || '', memo: c.memo || '',
    archived: !!c.archived, events: arr(c.events).map(e => ({
      id: e.id || uid(), type: eventType(e.type).id, title: e.title || '',
      date: e.date || '', time: e.time || '', place: e.place || '',
      memo: e.memo || '', done: !!e.done,
    })),
    createdAt: c.createdAt || new Date().toISOString(),
    updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
  }));
  d.tasks = arr(d.tasks).map(t => ({
    id: t.id || uid(), title: t.title || '(無題)', companyId: t.companyId || '',
    category: t.category || 'その他', priority: priority(t.priority).id,
    due: t.due || '', dueTime: t.dueTime || '', memo: t.memo || '',
    done: !!t.done, doneAt: t.doneAt || null,
    createdAt: t.createdAt || new Date().toISOString(),
  }));
  d.answers = arr(d.answers).map(a => ({
    id: a.id || uid(), question: a.question || '', body: a.body || '',
    limit: Number(a.limit) || 0, tags: arr(a.tags),
    updatedAt: a.updatedAt || new Date().toISOString(),
  }));
  d.notes = arr(d.notes).map(n => ({
    id: n.id || uid(), title: n.title || '', body: n.body || '',
    pinned: !!n.pinned, updatedAt: n.updatedAt || new Date().toISOString(),
  }));
  d.version = DATA_VERSION;
  return d;
}

/* ---------- 読み書き ---------- */
let data = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch (err) {
    console.warn('データの読み込みに失敗しました', err);
    return emptyData();
  }
}

export const getData = () => data;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** mutator で state を書き換えて保存＋再描画 */
export function update(mutator, { silent = false } = {}) {
  const result = mutator(data);
  data.updatedAt = new Date().toISOString();
  persist();
  if (!silent) listeners.forEach(fn => fn(data));
  return result;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.error(err);
    alert('保存できませんでした。ブラウザの保存容量がいっぱいか、プライベートモードの可能性があります。');
  }
}

/** 外部（インポート/同期）からまるごと差し替える */
export function replaceAll(raw, { markSynced = false } = {}) {
  data = normalize(raw);
  if (markSynced) data.lastSyncedAt = data.updatedAt;
  persist();
  listeners.forEach(fn => fn(data));
}

export function markSynced() {
  data.lastSyncedAt = data.updatedAt;
  persist();
}

export const isDirty = () => data.lastSyncedAt !== data.updatedAt;

/* ---------- 便利クエリ ---------- */
export const companyById = (id) => data.companies.find(c => c.id === id) || null;
export const companyName = (id) => (companyById(id) || {}).name || '';

export const activeCompanies = () => data.companies.filter(c => !c.archived);

export const openTasks = () => data.tasks.filter(t => !t.done);

/** すべての予定を {date, ...} のフラットな配列で返す（タスク期限を含む） */
export function allAgenda() {
  const items = [];
  for (const c of data.companies) {
    for (const e of c.events) {
      if (!e.date) continue;
      items.push({
        kind: 'event', id: e.id, companyId: c.id, companyName: c.name,
        date: e.date, time: e.time, title: e.title || eventType(e.type).label,
        type: e.type, color: eventType(e.type).color, place: e.place,
        memo: e.memo, done: e.done,
      });
    }
  }
  for (const t of data.tasks) {
    if (!t.due) continue;
    items.push({
      kind: 'task', id: t.id, companyId: t.companyId,
      companyName: companyName(t.companyId),
      date: t.due, time: t.dueTime, title: t.title,
      type: 'task', color: t.done ? '#94a3b8' : '#f59e0b',
      memo: t.memo, done: t.done,
    });
  }
  return items.sort((a, b) =>
    (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')));
}

/**
 * 同期・バックアップ用の JSON。
 *
 * アクセストークンと Gist ID は絶対に含めない。
 * これらを Gist に書き込むと GitHub の secret scanning に漏洩と判定され、
 * トークンが自動的に無効化される（1回目は成功し、2回目以降や別端末で
 * 「トークンが無効です」になる原因になっていた）。
 * Gist ID も、知っていれば秘密 Gist を閲覧できてしまうため書き出さない。
 */
export function exportJSON() {
  const { gist, ...settingsRest } = data.settings;
  return JSON.stringify({
    ...data,
    settings: { ...settingsRest, gist: { token: '', id: '', auto: false } },
    exportedAt: new Date().toISOString(),
  }, null, 2);
}
