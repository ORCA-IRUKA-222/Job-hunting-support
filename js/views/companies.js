/* 企業・選考管理 */
import {
  getData, update, uid, STAGES, stage, EVENT_TYPES, eventType,
  TASK_CATEGORIES, PRIORITIES, companyById,
} from '../store.js';
import { esc, icon, fmtDate, relDate, stars, daysFromToday, todayISO, toast } from '../utils.js';
import { openForm, openModal, confirmDialog } from '../ui.js';

const state = { q: '', filter: 'active', sort: 'next' };

const FILTERS = [
  { id: 'active',   label: '選考中' },
  { id: 'all',      label: 'すべて' },
  { id: 'offer',    label: '内定' },
  { id: 'closed',   label: '終了' },
  { id: 'archived', label: 'アーカイブ' },
];

const SORTS = [
  { value: 'next',   label: '次の予定が近い順' },
  { value: 'rating', label: '志望度が高い順' },
  { value: 'name',   label: '企業名順' },
  { value: 'stage',  label: '選考ステージ順' },
  { value: 'recent', label: '更新が新しい順' },
];

function nextEvent(c) {
  const today = todayISO();
  return c.events
    .filter(e => e.date && e.date >= today && !e.done)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0] || null;
}

function visibleCompanies() {
  const d = getData();
  const q = state.q.trim().toLowerCase();
  let list = d.companies.filter(c => {
    if (state.filter === 'archived') return c.archived;
    if (c.archived) return false;
    if (state.filter === 'active')  return stage(c.stage).active && !['offer', 'accepted'].includes(c.stage);
    if (state.filter === 'offer')   return ['offer', 'accepted'].includes(c.stage);
    if (state.filter === 'closed')  return ['rejected', 'declined'].includes(c.stage);
    return true;
  });
  if (q) {
    list = list.filter(c => [c.name, c.industry, c.role, c.memo, c.source]
      .join(' ').toLowerCase().includes(q));
  }
  const order = (c) => STAGES.findIndex(s => s.id === c.stage);
  const cmp = {
    next: (a, b) => (nextEvent(a)?.date || '9999').localeCompare(nextEvent(b)?.date || '9999'),
    rating: (a, b) => b.rating - a.rating,
    name: (a, b) => a.name.localeCompare(b.name, 'ja'),
    stage: (a, b) => order(b) - order(a),
    recent: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
  }[state.sort];
  return list.sort(cmp);
}

export function render() {
  const list = visibleCompanies();
  const total = getData().companies.length;
  return `
    <div class="page-head">
      <div><h1>企業・選考</h1><p>登録 ${total} 社 / 表示 ${list.length} 社</p></div>
    </div>

    <div class="field search" style="margin-bottom:10px">
      ${icon('search')}
      <input class="input" id="coSearch" type="search" placeholder="企業名・業界・メモで検索" value="${esc(state.q)}">
    </div>

    <div class="chips" style="margin-bottom:10px">
      ${FILTERS.map(f => `<button class="chip" data-filter="${f.id}" aria-pressed="${state.filter === f.id}">${esc(f.label)}</button>`).join('')}
    </div>

    <div class="field" style="margin-bottom:14px">
      <select class="select" id="coSort">
        ${SORTS.map(s => `<option value="${s.value}"${state.sort === s.value ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}
      </select>
    </div>

    ${list.length ? `<div class="co-grid">${list.map(card).join('')}</div>` : emptyState()}
  `;
}

function emptyState() {
  return `<div class="card empty">
    <strong>企業がありません</strong>
    <p class="small">右下の「企業を追加」から、受ける予定の企業を登録しましょう。</p>
  </div>`;
}

function card(c) {
  const s = stage(c.stage);
  const ne = nextEvent(c);
  const tasks = getData().tasks.filter(t => t.companyId === c.id && !t.done);
  return `<button class="card card--link co" data-co="${esc(c.id)}" type="button">
    <div class="co__head">
      <div style="min-width:0">
        <div class="co__name">${esc(c.name)}</div>
        <div class="co__sub">${[c.industry, c.role].filter(Boolean).map(esc).join(' / ') || '&nbsp;'}</div>
      </div>
      <span class="co__stars" title="志望度">${stars(c.rating)}</span>
    </div>
    <div class="co__foot">
      <span class="badge" style="background:${s.color}22;color:${s.color}">${esc(s.label)}</span>
      ${ne ? `<span>${icon('calendar', 'icon')} ${esc(eventType(ne.type).label)} ${fmtDate(ne.date)}${ne.time ? ' ' + esc(ne.time) : ''}（${esc(relDate(ne.date))}）</span>` : `<span class="muted">予定なし</span>`}
      ${tasks.length ? `<span class="badge badge--warn">やること ${tasks.length}</span>` : ''}
    </div>
  </button>`;
}

/* ---------- 企業フォーム ---------- */
function companyFields(c = {}) {
  return [
    { name: 'name', label: '企業名', value: c.name || '', required: true, placeholder: '株式会社○○' },
    { name: 'industry', label: '業界', value: c.industry || '', half: true, placeholder: 'IT / メーカー など' },
    { name: 'role', label: '職種・コース', value: c.role || '', half: true, placeholder: '総合職 / エンジニア' },
    { name: 'stage', label: '選考ステージ', type: 'select', value: c.stage || 'interest',
      options: STAGES.map(s => ({ value: s.id, label: s.label })) },
    { name: 'rating', label: '志望度', type: 'stars', value: c.rating ?? 3 },
    { name: 'source', label: '応募経路', value: c.source || '', half: true, placeholder: 'ナビサイト / 学校推薦' },
    { name: 'url', label: 'マイページURL', type: 'url', value: c.url || '', half: true, placeholder: 'https://' },
    { name: 'memo', label: 'メモ（選考フロー・感触・逆質問など）', type: 'textarea', rows: 5, value: c.memo || '' },
  ];
}

export async function addCompany(ctx) {
  const v = await openForm({ title: '企業を追加', fields: companyFields(), submitLabel: '追加' });
  if (!v) return;
  const id = uid();
  update(d => d.companies.push({
    ...v, id, events: [], archived: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }));
  toast('企業を追加しました', 'ok');
  openDetail(id, ctx);
}

async function editCompany(id) {
  const c = companyById(id);
  if (!c) return;
  const v = await openForm({
    title: '企業を編集', fields: companyFields(c),
    extraButtons: [
      { label: c.archived ? 'アーカイブ解除' : 'アーカイブ', value: '__archive' },
      { label: '削除', value: '__delete', danger: true },
    ],
  });
  if (!v) return;
  if (v === '__delete') {
    if (!await confirmDialog(`「${c.name}」を削除します。紐づく予定も消えます。よろしいですか？`)) return;
    update(d => {
      d.companies = d.companies.filter(x => x.id !== id);
      d.tasks.forEach(t => { if (t.companyId === id) t.companyId = ''; });
    });
    toast('削除しました');
    return;
  }
  if (v === '__archive') {
    update(d => {
      const t = d.companies.find(x => x.id === id);
      t.archived = !t.archived; t.updatedAt = new Date().toISOString();
    });
    toast(c.archived ? 'アーカイブを解除しました' : 'アーカイブしました', 'ok');
    return;
  }
  update(d => Object.assign(d.companies.find(x => x.id === id), v, { updatedAt: new Date().toISOString() }));
  toast('保存しました', 'ok');
}

/* ---------- 予定フォーム ---------- */
function eventFields(e = {}) {
  return [
    { name: 'type', label: '種類', type: 'select', value: e.type || 'interview',
      options: EVENT_TYPES.map(t => ({ value: t.id, label: t.label })) },
    { name: 'title', label: '内容', value: e.title || '', placeholder: '一次面接（Web）' },
    { name: 'date', label: '日付', type: 'date', value: e.date || todayISO(), half: true, required: true },
    { name: 'time', label: '時刻', type: 'time', value: e.time || '', half: true },
    { name: 'place', label: '場所・URL', value: e.place || '', placeholder: '本社3F / Zoom' },
    { name: 'memo', label: '持ち物・メモ', type: 'textarea', rows: 3, value: e.memo || '' },
    { name: 'done', label: '完了済みにする', type: 'checkbox', value: !!e.done },
  ];
}

async function addEvent(companyId) {
  const v = await openForm({ title: '予定を追加', fields: eventFields(), submitLabel: '追加' });
  if (!v) return;
  update(d => {
    const c = d.companies.find(x => x.id === companyId);
    c.events.push({ ...v, id: uid() });
    c.updatedAt = new Date().toISOString();
  });
  toast('予定を追加しました', 'ok');
}

async function editEvent(companyId, eventId) {
  const c = companyById(companyId);
  const e = c?.events.find(x => x.id === eventId);
  if (!e) return;
  const v = await openForm({
    title: '予定を編集', fields: eventFields(e),
    extraButtons: [{ label: '削除', value: '__delete', danger: true }],
  });
  if (!v) return;
  update(d => {
    const co = d.companies.find(x => x.id === companyId);
    if (v === '__delete') co.events = co.events.filter(x => x.id !== eventId);
    else Object.assign(co.events.find(x => x.id === eventId), v);
    co.updatedAt = new Date().toISOString();
  });
  toast(v === '__delete' ? '削除しました' : '保存しました', 'ok');
}

async function addTaskFor(companyId) {
  const v = await openForm({
    title: 'やることを追加',
    fields: [
      { name: 'title', label: 'やること', required: true, placeholder: 'ESを提出する' },
      { name: 'category', label: '分類', type: 'select', value: 'ES・エントリーシート', options: TASK_CATEGORIES },
      { name: 'due', label: '期限', type: 'date', value: '', half: true },
      { name: 'dueTime', label: '時刻', type: 'time', value: '', half: true },
      { name: 'priority', label: '優先度', type: 'select', value: 'normal',
        options: PRIORITIES.map(p => ({ value: p.id, label: p.label })) },
      { name: 'memo', label: 'メモ', type: 'textarea', rows: 3, value: '' },
    ],
    submitLabel: '追加',
  });
  if (!v) return;
  update(d => d.tasks.push({ ...v, id: uid(), companyId, done: false, doneAt: null, createdAt: new Date().toISOString() }));
  toast('やることを追加しました', 'ok');
}

/* ---------- 詳細シート ---------- */
export function openDetail(id, ctx) {
  const c = companyById(id);
  if (!c) return;
  const s = stage(c.stage);
  const tasks = getData().tasks.filter(t => t.companyId === c.id);
  const events = [...c.events].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  openModal({
    title: c.name,
    body: `
      <div class="btn-row" style="margin-bottom:14px">
        <span class="badge" style="background:${s.color}22;color:${s.color}">${esc(s.label)}</span>
        <span class="badge">志望度 ${stars(c.rating)}</span>
        ${c.archived ? '<span class="badge badge--gray">アーカイブ</span>' : ''}
      </div>

      <dl class="kv">
        ${c.industry ? `<dt>業界</dt><dd>${esc(c.industry)}</dd>` : ''}
        ${c.role ? `<dt>職種</dt><dd>${esc(c.role)}</dd>` : ''}
        ${c.source ? `<dt>応募経路</dt><dd>${esc(c.source)}</dd>` : ''}
        ${c.url ? `<dt>マイページ</dt><dd><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">開く</a></dd>` : ''}
      </dl>

      ${c.memo ? `<div class="card card--flat" style="margin-top:12px;background:var(--surface-2)">
        <div class="small muted" style="font-weight:700;margin-bottom:4px">メモ</div>
        <div class="pre-wrap small">${esc(c.memo)}</div></div>` : ''}

      <h3 class="section-title" style="margin-top:20px">${icon('calendar')} 選考の予定 (${events.length})</h3>
      ${events.length ? events.map(e => {
        const t = eventType(e.type);
        const past = e.date < todayISO();
        return `<div class="row" data-event="${esc(e.id)}" style="cursor:pointer;${past || e.done ? 'opacity:.6' : ''}">
          <span class="dot" style="background:${t.color};margin-top:8px"></span>
          <div class="row__main">
            <div class="row__title">${esc(e.title || t.label)}</div>
            <div class="row__meta">
              <span class="badge">${esc(t.label)}</span>
              <span class="tnum">${fmtDate(e.date)}${e.time ? ' ' + esc(e.time) : ''}</span>
              ${!past && !e.done ? `<span>${esc(relDate(e.date))}</span>` : ''}
              ${e.done ? '<span class="badge badge--ok">完了</span>' : ''}
              ${e.place ? `<span>${esc(e.place)}</span>` : ''}
            </div>
            ${e.memo ? `<div class="small muted pre-wrap" style="margin-top:4px">${esc(e.memo)}</div>` : ''}
          </div>
          ${icon('pen', 'icon muted')}
        </div>`;
      }).join('') : '<p class="muted small">予定はまだありません。</p>'}
      <button type="button" class="btn btn--sm" data-add-event style="margin-top:8px">${icon('plus')} 予定を追加</button>

      <h3 class="section-title" style="margin-top:20px">${icon('check')} この企業のやること (${tasks.filter(t => !t.done).length})</h3>
      ${tasks.length ? tasks.map(t => `
        <div class="row ${t.done ? 'row--done' : ''}">
          <input type="checkbox" class="tickbox" data-task="${esc(t.id)}"${t.done ? ' checked' : ''} aria-label="完了">
          <div class="row__main">
            <div class="row__title">${esc(t.title)}</div>
            <div class="row__meta">
              ${t.due ? `<span class="tnum">${fmtDate(t.due)} ${esc(relDate(t.due))}</span>` : ''}
              <span class="badge">${esc(t.category)}</span>
            </div>
          </div>
        </div>`).join('') : '<p class="muted small">やることはありません。</p>'}
      <button type="button" class="btn btn--sm" data-add-task style="margin-top:8px">${icon('plus')} やることを追加</button>
    `,
    foot: `<button type="button" class="btn" data-edit>${icon('pen')} 編集</button>
           <button type="button" class="btn btn--primary" data-close-sheet>閉じる</button>`,
    onMount(dlgEl, close) {
      dlgEl.querySelector('[data-close-sheet]').onclick = close;
      dlgEl.querySelector('[data-edit]').onclick = () => { close(); editCompany(id); };
      dlgEl.querySelector('[data-add-event]').onclick = () => { close(); addEvent(id); };
      dlgEl.querySelector('[data-add-task]').onclick = () => { close(); addTaskFor(id); };
      dlgEl.querySelectorAll('[data-event]').forEach(el => {
        el.onclick = () => { close(); editEvent(id, el.dataset.event); };
      });
      dlgEl.querySelectorAll('[data-task]').forEach(el => {
        el.onchange = () => {
          const tid = el.dataset.task;
          update(d => {
            const t = d.tasks.find(x => x.id === tid);
            t.done = el.checked; t.doneAt = t.done ? new Date().toISOString() : null;
          }, { silent: true });
          el.closest('.row').classList.toggle('row--done', el.checked);
        };
      });
    },
  });
}

export function mount(root, ctx) {
  const search = root.querySelector('#coSearch');
  if (search) {
    search.oninput = () => {
      state.q = search.value;
      ctx.rerender({ keepFocus: '#coSearch' });
    };
  }
  const sort = root.querySelector('#coSort');
  if (sort) sort.onchange = () => { state.sort = sort.value; ctx.rerender(); };

  root.addEventListener('click', e => {
    const f = e.target.closest('[data-filter]');
    if (f) { state.filter = f.dataset.filter; ctx.rerender(); return; }
    const co = e.target.closest('[data-co]');
    if (co) openDetail(co.dataset.co, ctx);
  });

  if (ctx.params?.open) {
    const id = ctx.params.open;
    ctx.params = {};
    setTimeout(() => openDetail(id, ctx), 60);
  }
}

export const fab = { label: '企業を追加', action: addCompany };
