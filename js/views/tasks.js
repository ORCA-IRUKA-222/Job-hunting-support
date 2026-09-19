/* やること・提出物 */
import { getData, update, uid, TASK_CATEGORIES, PRIORITIES, priority, companyName } from '../store.js';
import { esc, icon, fmtDate, relDate, daysFromToday, todayISO, toast } from '../utils.js';
import { openForm, confirmDialog } from '../ui.js';

const state = { tab: 'open', q: '' };

const GROUPS = [
  { id: 'over',  label: '期限超過',       cls: 'badge--danger', test: n => n !== null && n < 0 },
  { id: 'today', label: '今日',           cls: 'badge--danger', test: n => n === 0 },
  { id: 'soon',  label: '3日以内',        cls: 'badge--warn',   test: n => n > 0 && n <= 3 },
  { id: 'week',  label: '1週間以内',      cls: '',              test: n => n > 3 && n <= 7 },
  { id: 'later', label: 'それ以降',       cls: '',              test: n => n > 7 },
  { id: 'none',  label: '期限なし',       cls: 'badge--gray',   test: n => n === null },
];

function visible() {
  const d = getData();
  const q = state.q.trim().toLowerCase();
  return d.tasks
    .filter(t => (state.tab === 'open' ? !t.done : state.tab === 'done' ? t.done : true))
    .filter(t => !q || [t.title, t.memo, t.category, companyName(t.companyId)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => {
      const ad = a.due || '9999-99-99', bd = b.due || '9999-99-99';
      if (ad !== bd) return ad.localeCompare(bd);
      return PRIORITIES.findIndex(p => p.id === a.priority) - PRIORITIES.findIndex(p => p.id === b.priority);
    });
}

export function render() {
  const d = getData();
  const list = visible();
  const openCount = d.tasks.filter(t => !t.done).length;
  const overdue = d.tasks.filter(t => !t.done && t.due && daysFromToday(t.due) < 0).length;

  const grouped = GROUPS.map(g => ({
    ...g, items: list.filter(t => g.test(t.due ? daysFromToday(t.due) : null)),
  })).filter(g => g.items.length);

  return `
    <div class="page-head">
      <div><h1>やること・提出物</h1>
      <p>未完了 ${openCount} 件${overdue ? ` / <span style="color:var(--danger);font-weight:700">期限超過 ${overdue} 件</span>` : ''}</p></div>
    </div>

    <div class="tabs">
      ${[['open', '未完了'], ['done', '完了'], ['all', 'すべて']].map(([id, label]) =>
        `<button data-tab="${id}" aria-selected="${state.tab === id}">${label}</button>`).join('')}
    </div>

    <div class="field search">
      ${icon('search')}
      <input class="input" id="taskSearch" type="search" placeholder="やること・企業名で検索" value="${esc(state.q)}">
    </div>

    ${grouped.length ? grouped.map(g => `
      <h2 class="section-title">
        <span class="badge ${g.cls}">${esc(g.label)}</span>
        <span class="muted">${g.items.length}件</span>
      </h2>
      ${g.items.map(row).join('')}
    `).join('') : `<div class="card empty">
        <strong>${state.tab === 'done' ? '完了したやることはありません' : 'やることはありません'}</strong>
        <p class="small">提出物や締切を登録して、やり忘れを防ぎましょう。</p>
      </div>`}
  `;
}

function row(t) {
  const n = t.due ? daysFromToday(t.due) : null;
  const cls = !t.done && n !== null && n < 0 ? 'row--danger' : (!t.done && n !== null && n <= 3 ? 'row--warn' : '');
  const p = priority(t.priority);
  const co = companyName(t.companyId);
  return `<div class="row ${cls} ${t.done ? 'row--done' : ''}" data-edit="${esc(t.id)}" style="cursor:pointer">
    <input type="checkbox" class="tickbox" data-toggle="${esc(t.id)}"${t.done ? ' checked' : ''} aria-label="完了にする">
    <div class="row__main">
      <div class="row__title">${esc(t.title)}</div>
      <div class="row__meta">
        ${t.due ? `<span class="tnum">${fmtDate(t.due)}${t.dueTime ? ' ' + esc(t.dueTime) : ''}</span>
                   <span${!t.done && n < 0 ? ' style="color:var(--danger);font-weight:700"' : ''}>${esc(relDate(t.due))}</span>` : ''}
        ${co ? `<span>${esc(co)}</span>` : ''}
        <span class="badge">${esc(t.category)}</span>
        ${t.priority === 'high' ? `<span class="badge badge--danger">優先${esc(p.label)}</span>` : ''}
      </div>
      ${t.memo ? `<div class="small muted pre-wrap" style="margin-top:3px">${esc(t.memo)}</div>` : ''}
    </div>
  </div>`;
}

function fields(t = {}) {
  const companies = getData().companies.filter(c => !c.archived);
  return [
    { name: 'title', label: 'やること', value: t.title || '', required: true, placeholder: 'ESを提出する' },
    { name: 'companyId', label: '関連企業', type: 'select', value: t.companyId || '',
      options: [{ value: '', label: '（なし）' }, ...companies.map(c => ({ value: c.id, label: c.name }))] },
    { name: 'category', label: '分類', type: 'select', value: t.category || 'ES・エントリーシート', options: TASK_CATEGORIES },
    { name: 'due', label: '期限', type: 'date', value: t.due || '', half: true },
    { name: 'dueTime', label: '時刻', type: 'time', value: t.dueTime || '', half: true },
    { name: 'priority', label: '優先度', type: 'select', value: t.priority || 'normal',
      options: PRIORITIES.map(p => ({ value: p.id, label: p.label })) },
    { name: 'memo', label: 'メモ', type: 'textarea', rows: 3, value: t.memo || '' },
  ];
}

export async function addTask() {
  const v = await openForm({ title: 'やることを追加', fields: fields(), submitLabel: '追加' });
  if (!v) return;
  update(d => d.tasks.push({ ...v, id: uid(), done: false, doneAt: null, createdAt: new Date().toISOString() }));
  toast('追加しました', 'ok');
}

async function editTask(id) {
  const t = getData().tasks.find(x => x.id === id);
  if (!t) return;
  const v = await openForm({
    title: 'やることを編集', fields: fields(t),
    extraButtons: [{ label: '削除', value: '__delete', danger: true }],
  });
  if (!v) return;
  if (v === '__delete') {
    if (!await confirmDialog(`「${t.title}」を削除します。よろしいですか？`)) return;
    update(d => { d.tasks = d.tasks.filter(x => x.id !== id); });
    toast('削除しました');
    return;
  }
  update(d => Object.assign(d.tasks.find(x => x.id === id), v));
  toast('保存しました', 'ok');
}

export function mount(root, ctx) {
  const search = root.querySelector('#taskSearch');
  if (search) search.oninput = () => { state.q = search.value; ctx.rerender({ keepFocus: '#taskSearch' }); };

  root.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { state.tab = tab.dataset.tab; ctx.rerender(); return; }

    const tick = e.target.closest('[data-toggle]');
    if (tick) {
      e.stopPropagation();
      const id = tick.dataset.toggle;
      update(d => {
        const t = d.tasks.find(x => x.id === id);
        t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : null;
      });
      return;
    }
    const ed = e.target.closest('[data-edit]');
    if (ed) editTask(ed.dataset.edit);
  });
}

export const fab = { label: 'やることを追加', action: addTask };
