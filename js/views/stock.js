/* ストック：ES・面接の回答集 ＋ メモ／重要事項 */
import { getData, update, uid } from '../store.js';
import { esc, icon, countChars, copyText, toast, fmtDate } from '../utils.js';
import { openForm, openModal, confirmDialog } from '../ui.js';

const state = { tab: 'answers', q: '', tag: '' };

const PRESETS = [
  '学生時代に力を入れたこと（ガクチカ）',
  '自己PR・強み',
  '志望動機',
  '挫折経験と乗り越え方',
  '長所と短所',
  '入社後にやりたいこと',
  '逆質問リスト',
];

export function render() {
  return `
    <div class="page-head"><div><h1>ストック</h1>
      <p>ESや面接で使い回す回答と、重要事項メモを保管します</p></div></div>

    <div class="tabs">
      <button data-tab="answers" aria-selected="${state.tab === 'answers'}">回答集</button>
      <button data-tab="notes" aria-selected="${state.tab === 'notes'}">メモ・重要事項</button>
    </div>

    ${state.tab === 'answers' ? renderAnswers() : renderNotes()}
  `;
}

/* ---------- 回答集 ---------- */
function renderAnswers() {
  const d = getData();
  const q = state.q.trim().toLowerCase();
  const tags = [...new Set(d.answers.flatMap(a => a.tags))].sort();
  let list = d.answers;
  if (state.tag) list = list.filter(a => a.tags.includes(state.tag));
  if (q) list = list.filter(a => (a.question + a.body + a.tags.join(' ')).toLowerCase().includes(q));
  list = [...list].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return `
    <div class="field search">${icon('search')}
      <input class="input" id="ansSearch" type="search" placeholder="設問・本文で検索" value="${esc(state.q)}"></div>

    ${tags.length ? `<div class="chips" style="margin-bottom:12px">
      <button class="chip" data-tag="" aria-pressed="${!state.tag}">すべて</button>
      ${tags.map(t => `<button class="chip" data-tag="${esc(t)}" aria-pressed="${state.tag === t}">${esc(t)}</button>`).join('')}
    </div>` : ''}

    ${list.length ? list.map(answerCard).join('') : `<div class="card empty">
      <strong>回答がありません</strong>
      <p class="small">ガクチカ・自己PR・志望動機などを登録しておくと、ES作成が一気に楽になります。</p>
      <div class="btn-row" style="justify-content:center;margin-top:12px">
        <button class="btn btn--primary" data-preset>よくある設問から作る</button>
      </div>
    </div>`}
  `;
}

function answerCard(a) {
  const n = countChars(a.body);
  const over = a.limit > 0 && n > a.limit;
  return `<div class="card" data-ans="${esc(a.id)}">
    <div class="ans__q">${esc(a.question || '(設問未設定)')}</div>
    <div class="ans__body ans__body--clamp">${esc(a.body) || '<span class="muted">（未記入）</span>'}</div>
    <div class="row__meta" style="margin-top:9px">
      <span class="counter" data-over="${over ? 1 : 0}">${n}${a.limit > 0 ? ` / ${a.limit}` : ''}字</span>
      ${a.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      <span style="margin-left:auto;display:flex;gap:4px">
        <button class="icon-btn" data-copy="${esc(a.id)}" aria-label="本文をコピー">${icon('copy')}</button>
        <button class="icon-btn" data-edit-ans="${esc(a.id)}" aria-label="編集">${icon('pen')}</button>
      </span>
    </div>
  </div>`;
}

function answerFields(a = {}) {
  return [
    { name: 'question', label: '設問', value: a.question || '', required: true, placeholder: '学生時代に力を入れたことを教えてください' },
    { name: 'limit', label: '文字数の上限（0で無制限）', type: 'number', value: a.limit ?? 400, min: 0 },
    { name: 'body', label: '回答', type: 'counter', rows: 10, value: a.body || '',
      hint: '空白・改行を除いてカウントします' },
    { name: 'tags', label: 'タグ（カンマ区切り）', type: 'tags', value: a.tags || [], placeholder: 'ガクチカ, 400字' },
  ];
}

export async function addAnswer(ctx, preset = '') {
  const v = await openForm({
    title: '回答を追加',
    fields: answerFields({ question: preset }),
    submitLabel: '追加',
  });
  if (!v) return;
  update(d => d.answers.push({ ...v, id: uid(), updatedAt: new Date().toISOString() }));
  toast('追加しました', 'ok');
}

async function editAnswer(id) {
  const a = getData().answers.find(x => x.id === id);
  if (!a) return;
  const v = await openForm({
    title: '回答を編集', fields: answerFields(a),
    extraButtons: [{ label: '削除', value: '__delete', danger: true }],
  });
  if (!v) return;
  if (v === '__delete') {
    if (!await confirmDialog(`「${a.question}」を削除します。よろしいですか？`)) return;
    update(d => { d.answers = d.answers.filter(x => x.id !== id); });
    toast('削除しました');
    return;
  }
  update(d => Object.assign(d.answers.find(x => x.id === id), v, { updatedAt: new Date().toISOString() }));
  toast('保存しました', 'ok');
}

function openAnswer(id) {
  const a = getData().answers.find(x => x.id === id);
  if (!a) return;
  const n = countChars(a.body);
  openModal({
    title: a.question || '回答',
    body: `<div class="row__meta" style="margin-bottom:10px">
        <span class="counter" data-over="${a.limit > 0 && n > a.limit ? 1 : 0}">${n}${a.limit > 0 ? ` / ${a.limit}` : ''}字</span>
        ${a.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>
      <div class="pre-wrap">${esc(a.body) || '<span class="muted">（未記入）</span>'}</div>`,
    foot: `<button type="button" class="btn" data-copy2>${icon('copy')} コピー</button>
           <button type="button" class="btn btn--primary" data-edit2>${icon('pen')} 編集</button>`,
    onMount(dlgEl, close) {
      dlgEl.querySelector('[data-copy2]').onclick = () => copyText(a.body);
      dlgEl.querySelector('[data-edit2]').onclick = () => { close(); editAnswer(id); };
    },
  });
}

/* ---------- メモ ---------- */
function renderNotes() {
  const d = getData();
  const q = state.q.trim().toLowerCase();
  let list = d.notes;
  if (q) list = list.filter(n => (n.title + n.body).toLowerCase().includes(q));
  list = [...list].sort((a, b) =>
    (b.pinned - a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return `
    <div class="field search">${icon('search')}
      <input class="input" id="noteSearch" type="search" placeholder="メモを検索" value="${esc(state.q)}"></div>
    ${list.length ? list.map(n => `
      <div class="card" data-note="${esc(n.id)}" style="cursor:pointer">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <strong>${esc(n.title) || '(無題)'}</strong>
            <p class="pre-wrap small muted" style="margin-top:4px">${esc(n.body).slice(0, 300)}${n.body.length > 300 ? '…' : ''}</p>
          </div>
          ${n.pinned ? `<span class="badge badge--warn">${icon('pin')} 重要</span>` : ''}
        </div>
      </div>`).join('')
      : `<div class="card empty"><strong>メモがありません</strong>
         <p class="small">提出書類の一覧、証明写真のサイズ、持ち物、締切のルールなどを控えておけます。</p></div>`}
  `;
}

function noteFields(n = {}) {
  return [
    { name: 'title', label: 'タイトル', value: n.title || '', placeholder: '提出書類チェックリスト' },
    { name: 'body', label: '内容', type: 'textarea', rows: 10, value: n.body || '' },
    { name: 'pinned', label: 'ホーム画面に「重要事項」として表示', type: 'checkbox', value: !!n.pinned },
  ];
}

export async function addNote() {
  const v = await openForm({ title: 'メモを追加', fields: noteFields(), submitLabel: '追加' });
  if (!v) return;
  update(d => d.notes.push({ ...v, id: uid(), updatedAt: new Date().toISOString() }));
  toast('追加しました', 'ok');
}

async function editNote(id) {
  const n = getData().notes.find(x => x.id === id);
  if (!n) return;
  const v = await openForm({
    title: 'メモを編集', fields: noteFields(n),
    extraButtons: [{ label: '削除', value: '__delete', danger: true }],
  });
  if (!v) return;
  if (v === '__delete') {
    if (!await confirmDialog(`「${n.title || '(無題)'}」を削除します。よろしいですか？`)) return;
    update(d => { d.notes = d.notes.filter(x => x.id !== id); });
    toast('削除しました');
    return;
  }
  update(d => Object.assign(d.notes.find(x => x.id === id), v, { updatedAt: new Date().toISOString() }));
  toast('保存しました', 'ok');
}

async function pickPreset(ctx) {
  const v = await openForm({
    title: 'よくある設問',
    fields: [{ name: 'q', label: '設問を選ぶ', type: 'select', value: PRESETS[0], options: PRESETS }],
    submitLabel: 'これで作る',
  });
  if (v) addAnswer(ctx, v.q);
}

/* ---------- mount ---------- */
export function mount(root, ctx) {
  const bind = (sel) => {
    const el = root.querySelector(sel);
    if (el) el.oninput = () => { state.q = el.value; ctx.rerender({ keepFocus: sel }); };
  };
  bind('#ansSearch'); bind('#noteSearch');

  root.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { state.tab = tab.dataset.tab; state.q = ''; ctx.rerender(); ctx.refreshFab(); return; }

    const tag = e.target.closest('[data-tag]');
    if (tag) { state.tag = tag.dataset.tag; ctx.rerender(); return; }

    if (e.target.closest('[data-preset]')) { pickPreset(ctx); return; }

    const copy = e.target.closest('[data-copy]');
    if (copy) {
      e.stopPropagation();
      const a = getData().answers.find(x => x.id === copy.dataset.copy);
      if (a) copyText(a.body);
      return;
    }
    const ed = e.target.closest('[data-edit-ans]');
    if (ed) { e.stopPropagation(); editAnswer(ed.dataset.editAns); return; }

    const ans = e.target.closest('[data-ans]');
    if (ans) { openAnswer(ans.dataset.ans); return; }

    const note = e.target.closest('[data-note]');
    if (note) editNote(note.dataset.note);
  });
}

export const fab = {
  get label() { return state.tab === 'answers' ? '回答を追加' : 'メモを追加'; },
  action(ctx) { return state.tab === 'answers' ? addAnswer(ctx) : addNote(); },
};
