/* ホーム：進捗サマリー・締切アラート・直近の予定 */
import { getData, STAGES, stage, allAgenda, update } from '../store.js';
import { esc, icon, fmtDate, relDate, urgency, daysFromToday, todayISO, stars } from '../utils.js';

const URGENT_CLASS = { over: 'row--danger', today: 'row--danger', soon: 'row--warn' };
const URGENT_BADGE = { over: 'badge--danger', today: 'badge--danger', soon: 'badge--warn' };

export function render(ctx) {
  const d = getData();
  const agenda = allAgenda();
  const today = todayISO();

  const active = d.companies.filter(c => !c.archived);
  const inProgress = active.filter(c => stage(c.stage).active && !['offer', 'accepted'].includes(c.stage));
  const offers = active.filter(c => ['offer', 'accepted'].includes(c.stage));
  const open = d.tasks.filter(t => !t.done);
  const overdue = open.filter(t => t.due && daysFromToday(t.due) < 0);

  // 締切アラート：未完了かつ 7 日以内 or 期限切れ
  const alerts = agenda
    .filter(a => !a.done && daysFromToday(a.date) <= 7)
    .filter(a => a.kind === 'task' || a.type === 'deadline' || daysFromToday(a.date) >= 0);

  // 直近の予定（今日以降 30 日）
  const upcoming = agenda.filter(a => {
    const n = daysFromToday(a.date);
    return n >= 0 && n <= 30 && !(a.kind === 'task' && a.done);
  }).slice(0, 12);

  const greet = d.profile.name ? `${esc(d.profile.name)} さんの就活状況` : '就活の現在地';

  return `
    <div class="page-head">
      <div>
        <h1>${greet}</h1>
        <p>${fmtDate(today, { year: true })} 時点</p>
      </div>
    </div>

    <div class="stats">
      ${stat('エントリー企業', active.length, '社')}
      ${stat('選考進行中', inProgress.length, '社')}
      ${stat('内定・承諾', offers.length, '社')}
      ${stat('未完了のやること', open.length, '件', overdue.length ? `${overdue.length}件 期限超過` : '')}
    </div>

    ${alerts.length ? `
      <h2 class="section-title">${icon('alert')} 締切・直近の対応 (${alerts.length})</h2>
      ${alerts.map(alertRow).join('')}
    ` : `
      <h2 class="section-title">${icon('check')} 締切</h2>
      <div class="card"><p class="muted small">7日以内に迫っている締切はありません。</p></div>
    `}

    <h2 class="section-title">${icon('calendar')} これからの予定</h2>
    ${upcoming.length
      ? upcoming.map(agendaRow).join('')
      : `<div class="card"><p class="muted small">登録された予定はありません。企業の詳細から説明会や面接の日程を追加できます。</p></div>`}

    <h2 class="section-title">${icon('building')} 選考ステージの内訳</h2>
    ${stageBreakdown(active)}

    ${pinnedNotes(d)}

    ${active.length === 0 && d.tasks.length === 0 ? `
      <div class="card" style="margin-top:16px">
        <strong>はじめに</strong>
        <p class="muted small" style="margin-top:6px">
          まず「企業」タブから受ける企業を登録してみましょう。設定画面からサンプルデータを入れて試すこともできます。
        </p>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn btn--primary" data-go="companies">企業を登録する</button>
          <button class="btn" data-go="settings">設定を開く</button>
        </div>
      </div>` : ''}
  `;
}

function stat(label, value, unit, note = '') {
  return `<div class="stat">
    <div class="stat__label">${esc(label)}</div>
    <div class="stat__value">${value}<small>${esc(unit)}</small></div>
    ${note ? `<div class="small" style="color:var(--danger);font-weight:600">${esc(note)}</div>` : ''}
  </div>`;
}

function alertRow(a) {
  const u = urgency(a.date);
  return `<div class="row ${URGENT_CLASS[u] || ''}" data-open="${a.kind}" data-id="${esc(a.id)}" data-company="${esc(a.companyId || '')}" style="cursor:pointer">
    ${a.kind === 'task' ? `<input type="checkbox" class="tickbox" data-toggle-task="${esc(a.id)}" aria-label="完了にする">` : `<span class="dot" style="background:${a.color};margin-top:8px"></span>`}
    <div class="row__main">
      <div class="row__title">${esc(a.title)}</div>
      <div class="row__meta">
        <span class="badge ${URGENT_BADGE[u] || ''}">${esc(relDate(a.date))}</span>
        <span class="tnum">${fmtDate(a.date)}${a.time ? ' ' + esc(a.time) : ''}</span>
        ${a.companyName ? `<span>${esc(a.companyName)}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function agendaRow(a) {
  return `<div class="row" data-open="${a.kind}" data-id="${esc(a.id)}" data-company="${esc(a.companyId || '')}" style="cursor:pointer">
    <span class="dot" style="background:${a.color};margin-top:8px"></span>
    <div class="row__main">
      <div class="row__title">${esc(a.title)}</div>
      <div class="row__meta">
        <span class="tnum">${fmtDate(a.date)}${a.time ? ' ' + esc(a.time) : ''}</span>
        <span class="badge">${esc(relDate(a.date))}</span>
        ${a.companyName ? `<span>${esc(a.companyName)}</span>` : ''}
        ${a.place ? `<span>${esc(a.place)}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function stageBreakdown(companies) {
  if (!companies.length) {
    return `<div class="card"><p class="muted small">企業が登録されていません。</p></div>`;
  }
  const counts = STAGES.map(s => ({ ...s, n: companies.filter(c => c.stage === s.id).length })).filter(s => s.n);
  const total = companies.length;
  return `<div class="card">
    <div class="stagebar">
      ${counts.map(s => `<span style="background:${s.color};width:${(s.n / total) * 100}%" title="${esc(s.label)} ${s.n}社"></span>`).join('')}
    </div>
    <div class="stage-legend">
      ${counts.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)} <strong class="tnum">${s.n}</strong></span>`).join('')}
    </div>
  </div>`;
}

function pinnedNotes(d) {
  const pins = d.notes.filter(n => n.pinned);
  if (!pins.length) return '';
  return `<h2 class="section-title">${icon('pin')} 重要事項</h2>
    ${pins.map(n => `<div class="card" data-open="note" data-id="${esc(n.id)}" style="cursor:pointer">
      ${n.title ? `<strong>${esc(n.title)}</strong>` : ''}
      <p class="pre-wrap small muted" style="margin-top:4px">${esc(n.body).slice(0, 400)}</p>
    </div>`).join('')}`;
}

export function mount(root, ctx) {
  root.addEventListener('click', (e) => {
    const tick = e.target.closest('[data-toggle-task]');
    if (tick) {
      e.stopPropagation();
      const id = tick.dataset.toggleTask;
      update(d => {
        const t = d.tasks.find(x => x.id === id);
        if (t) { t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : null; }
      });
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) { ctx.navigate(go.dataset.go); return; }

    const opener = e.target.closest('[data-open]');
    if (!opener) return;
    const kind = opener.dataset.open;
    if (kind === 'task') ctx.navigate('tasks');
    else if (kind === 'note') ctx.navigate('stock');
    else if (opener.dataset.company) ctx.navigate('companies', { open: opener.dataset.company });
  });
}
