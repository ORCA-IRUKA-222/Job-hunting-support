/* カレンダー：面接・締切・やることを月表示 */
import { allAgenda } from '../store.js';
import { esc, icon, fmtDate, relDate, toISO, fromISO, todayISO, DOW, addMonths } from '../utils.js';

const now = new Date();
const state = { y: now.getFullYear(), m: now.getMonth(), selected: todayISO() };

export function render() {
  const first = new Date(state.y, state.m, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());              // 週の頭（日曜）へ
  const today = todayISO();

  const byDate = new Map();
  for (const a of allAgenda()) {
    if (!byDate.has(a.date)) byDate.set(a.date, []);
    byDate.get(a.date).push(a);
  }

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = toISO(d);
    const items = byDate.get(iso) || [];
    const out = d.getMonth() !== state.m;
    cells.push(`
      <button type="button" class="cal__cell" data-date="${iso}"
        data-out="${out ? 1 : 0}" data-today="${iso === today ? 1 : 0}"
        aria-pressed="${iso === state.selected}">
        <span class="cal__num" style="${d.getDay() === 0 ? 'color:var(--danger)' : d.getDay() === 6 ? 'color:var(--accent)' : ''}">${d.getDate()}</span>
        <span class="cal__dots">${items.slice(0, 6).map(a => `<span class="dot" style="background:${a.color}"></span>`).join('')}</span>
        ${items.slice(0, 2).map(a => `<span class="cal__label" style="background:${a.color}22;color:${a.color}">${esc(a.title)}</span>`).join('')}
        ${items.length > 2 ? `<span class="cal__label muted">+${items.length - 2}</span>` : ''}
      </button>`);
    if (i >= 34 && d.getMonth() !== state.m && d.getDay() === 6) break; // 末尾の空週を省く
  }

  const selectedItems = (byDate.get(state.selected) || []);

  return `
    <div class="page-head" style="margin-bottom:8px"><div><h1>カレンダー</h1><p>面接・締切・やることをまとめて表示します</p></div></div>

    <div class="card">
      <div class="cal__head">
        <h2 class="tnum">${state.y}年 ${state.m + 1}月</h2>
        <div class="cal__nav">
          <button class="btn btn--sm" data-nav="today">今日</button>
          <button class="icon-btn" data-nav="-1" aria-label="前の月">${icon('chevron-l')}</button>
          <button class="icon-btn" data-nav="1" aria-label="次の月">${icon('chevron-r')}</button>
        </div>
      </div>
      <div class="cal__grid">
        ${DOW.map(w => `<div class="cal__dow">${w}</div>`).join('')}
        ${cells.join('')}
      </div>
    </div>

    <h2 class="section-title">${icon('clock')} ${fmtDate(state.selected, { year: true })} の予定</h2>
    ${selectedItems.length ? selectedItems.map(a => `
      <div class="row ${a.done ? 'row--done' : ''}">
        <span class="dot" style="background:${a.color};margin-top:8px"></span>
        <div class="row__main">
          <div class="row__title">${esc(a.title)}</div>
          <div class="row__meta">
            ${a.time ? `<span class="tnum">${esc(a.time)}</span>` : ''}
            <span class="badge">${a.kind === 'task' ? 'やること' : '予定'}</span>
            ${a.companyName ? `<span>${esc(a.companyName)}</span>` : ''}
            ${a.place ? `<span>${esc(a.place)}</span>` : ''}
          </div>
          ${a.memo ? `<div class="small muted pre-wrap" style="margin-top:3px">${esc(a.memo)}</div>` : ''}
        </div>
      </div>`).join('')
      : '<div class="card"><p class="muted small">この日の予定はありません。</p></div>'}
  `;
}

export function mount(root, ctx) {
  root.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const v = nav.dataset.nav;
      if (v === 'today') {
        const t = new Date();
        state.y = t.getFullYear(); state.m = t.getMonth(); state.selected = todayISO();
      } else {
        const d = addMonths(new Date(state.y, state.m, 1), Number(v));
        state.y = d.getFullYear(); state.m = d.getMonth();
      }
      ctx.rerender();
      return;
    }
    const cell = e.target.closest('[data-date]');
    if (cell) {
      state.selected = cell.dataset.date;
      const d = fromISO(state.selected);
      state.y = d.getFullYear(); state.m = d.getMonth();
      ctx.rerender();
    }
  });
}
