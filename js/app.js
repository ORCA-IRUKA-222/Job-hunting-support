/* アプリ本体：ルーティング・ナビゲーション・テーマ */
import { getData, subscribe } from './store.js';
import { $, $$, esc, icon } from './utils.js';
import * as sync from './sync.js';

import * as dashboard from './views/dashboard.js';
import * as companies from './views/companies.js';
import * as tasks from './views/tasks.js';
import * as calendar from './views/calendar.js';
import * as stock from './views/stock.js';
import * as settings from './views/settings.js';

const VIEWS = {
  dashboard: { mod: dashboard, label: 'ホーム',     icon: 'home',     tab: true },
  companies: { mod: companies, label: '企業',       icon: 'building', tab: true },
  tasks:     { mod: tasks,     label: 'やること',   icon: 'check',    tab: true },
  calendar:  { mod: calendar,  label: 'カレンダー', icon: 'calendar', tab: true },
  stock:     { mod: stock,     label: 'ストック',   icon: 'stack',    tab: true },
  settings:  { mod: settings,  label: '設定',       icon: 'gear',     tab: false },
};

const ctx = {
  route: 'dashboard',
  params: {},
  navigate,
  rerender,
  applyTheme,
  refreshFab,
  refreshChrome,
};

/* ---------- ルーティング ---------- */
function routeFromHash() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  return VIEWS[id] ? id : 'dashboard';
}

function navigate(route, params = {}) {
  ctx.params = params;
  if (routeFromHash() === route) { ctx.route = route; rerender(); }
  else location.hash = `#/${route}`;
}

function rerender({ keepFocus = null } = {}) {
  const main = $('#main');
  const view = VIEWS[ctx.route];

  // 検索欄などのフォーカスと入力位置を保つ
  let caret = null;
  if (keepFocus) {
    const el = main.querySelector(keepFocus);
    if (el) caret = el.selectionStart;
  }
  const scrollY = window.scrollY;

  // 毎回まっさらな要素に描画して差し替える。
  // #main を使い回すと mount() のイベントリスナーが再描画のたびに積み重なり、
  // 1回のクリックが何度も処理されてしまう。
  const root = document.createElement('div');
  root.className = 'view';
  root.innerHTML = view.mod.render(ctx);
  main.replaceChildren(root);
  view.mod.mount?.(root, ctx);

  if (keepFocus) {
    const el = root.querySelector(keepFocus);
    if (el) { el.focus(); if (caret != null) el.setSelectionRange(caret, caret); }
    window.scrollTo(0, scrollY);
  }

  refreshChrome();
  refreshFab();
  sync.refreshIndicator();
}

/** 画面本体は描き直さずに、トップバーとナビだけ更新する */
function refreshChrome() {
  $('#topTitle').textContent = VIEWS[ctx.route].label;
  $('#topSub').textContent = subtitle();
  renderNav();
}

function subtitle() {
  const d = getData();
  const open = d.tasks.filter(t => !t.done).length;
  const active = d.companies.filter(c => !c.archived).length;
  return d.profile.gradYear
    ? `${d.profile.gradYear} ・ ${active}社 / やること${open}件`
    : `${active}社 / やること${open}件`;
}

/* ---------- ナビゲーション ---------- */
function renderNav() {
  const d = getData();
  const counts = {
    companies: d.companies.filter(c => !c.archived).length,
    tasks: d.tasks.filter(t => !t.done).length,
  };

  $('#tabbar').innerHTML = Object.entries(VIEWS)
    .filter(([, v]) => v.tab)
    .map(([id, v]) => `
      <button class="tabbar__item" data-route="${id}" aria-current="${ctx.route === id ? 'page' : 'false'}">
        ${icon(v.icon)}<span>${esc(v.label)}</span>
      </button>`).join('');

  $('#sidenav').innerHTML = Object.entries(VIEWS).map(([id, v]) => `
    <button class="sidenav__item" data-route="${id}" aria-current="${ctx.route === id ? 'page' : 'false'}">
      ${icon(v.icon)}<span>${esc(v.label)}</span>
      ${counts[id] ? `<span class="sidenav__count">${counts[id]}</span>` : ''}
    </button>`).join('');
}

function refreshFab() {
  const fab = $('#fab');
  const conf = VIEWS[ctx.route].mod.fab;
  if (!conf) { fab.hidden = true; fab.onclick = null; return; }
  fab.hidden = false;
  $('#fabLabel').textContent = conf.label;
  fab.onclick = () => conf.action(ctx);
}

/* ---------- テーマ ---------- */
function applyTheme() {
  const theme = getData().settings.theme || 'auto';
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#161e2c' : '#ffffff');
}

/* ---------- 起動 ---------- */
function boot() {
  applyTheme();
  ctx.route = routeFromHash();
  rerender();

  window.addEventListener('hashchange', () => {
    ctx.route = routeFromHash();
    rerender();
    window.scrollTo(0, 0);
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-route]');
    if (btn) navigate(btn.dataset.route);
  });

  $('#settingsBtn').onclick = () => navigate('settings');
  $('#brandBtn').onclick = () => navigate('dashboard');

  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', applyTheme);

  // データが変わったら再描画＋自動同期
  subscribe(() => { rerender(); sync.schedulePush(); });

  // PWA（オフライン対応）
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  sync.refreshIndicator();
  sync.autoPullOnStart().then(() => rerender());
}

boot();
