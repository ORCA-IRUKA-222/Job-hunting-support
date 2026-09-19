/* モーダル・確認ダイアログ・フォームビルダー */
import { $, esc, icon } from './utils.js';

/*
 * モーダルは開くたびに <dialog> を作り、閉じたら DOM から取り除く。
 * 1つの要素を使い回すと、閉じるときの close イベントが
 * 直後に開いた次のモーダルにも届いてしまうため（詳細→編集 の連鎖で発生）。
 */
function createDialog() {
  const d = document.createElement('dialog');
  d.className = 'modal';
  document.body.appendChild(d);
  d.addEventListener('close', () => setTimeout(() => d.remove(), 0));
  return d;
}

function shell({ title, body, foot }) {
  return `
    <form class="modal__inner" id="modalForm" novalidate>
      <div class="modal__head">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="閉じる">${icon('close')}</button>
      </div>
      <div class="modal__body">${body}</div>
      ${foot ? `<div class="modal__foot">${foot}</div>` : ''}
    </form>`;
}

export function closeModal() {
  document.querySelectorAll('dialog.modal[open]').forEach(d => d.close());
}

/** 任意 HTML のモーダルを開く。onMount(root, close) で中身を制御する */
export function openModal({ title, body, foot = '', onMount }) {
  const d = createDialog();
  d.innerHTML = shell({ title, body, foot });
  const close = () => d.close();
  d.querySelector('#modalForm').addEventListener('submit', e => e.preventDefault());
  d.querySelector('[data-close]').onclick = close;
  d.onclick = (e) => { if (e.target === d) close(); };
  onMount?.(d, close);
  d.showModal();
  return close;
}

/** はい/いいえの確認。Promise<boolean> */
export function confirmDialog(message, { okLabel = '削除する', danger = true, title = '確認', noCancel = false } = {}) {
  return new Promise(resolve => {
    let answer = false;
    const d = createDialog();
    d.innerHTML = shell({
      title,
      body: `<p class="pre-wrap">${esc(message)}</p>`,
      foot: `${noCancel ? '' : '<button type="button" class="btn" data-no>キャンセル</button>'}
             <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-yes>${esc(okLabel)}</button>`,
    });
    d.querySelector('#modalForm').addEventListener('submit', e => e.preventDefault());
    d.querySelector('[data-close]').onclick = () => d.close();
    d.querySelector('[data-no]')?.addEventListener('click', () => d.close());
    d.querySelector('[data-yes]').onclick = () => { answer = true; d.close(); };
    d.onclick = (e) => { if (e.target === d) d.close(); };
    d.addEventListener('close', () => resolve(answer), { once: true });
    d.showModal();
  });
}

/* ---------- フォームビルダー ---------- */
/*
 field: { name, label, type, value, options, placeholder, hint, required,
          rows, min, max, half }
 type: text | textarea | date | time | number | url | select | stars | checkbox | tags | counter
*/
function fieldHTML(f) {
  const v = f.value ?? '';
  const id = `f_${f.name}`;
  const label = f.label ? `<label class="field__label" for="${id}">${esc(f.label)}${f.required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>` : '';
  const hint = f.hint ? `<div class="field__hint">${esc(f.hint)}</div>` : '';
  let control = '';

  switch (f.type) {
    case 'textarea':
    case 'counter':
      control = `<textarea class="textarea" id="${id}" name="${f.name}" rows="${f.rows || 4}"
                   placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
      if (f.type === 'counter') {
        control += `<div class="field__hint" style="display:flex;justify-content:space-between">
            <span>${esc(f.hint || '')}</span>
            <span class="counter" data-counter-for="${f.name}">0字</span></div>`;
      }
      break;
    case 'select':
      control = `<select class="select" id="${id}" name="${f.name}">
        ${(f.options || []).map(o => {
          const val = typeof o === 'string' ? o : o.value;
          const lab = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`;
        }).join('')}
      </select>`;
      break;
    case 'stars':
      control = `<div class="stars" data-stars="${f.name}">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" data-on="${n <= (v || 0) ? 1 : 0}" aria-label="${n}">★</button>`).join('')}
        <input type="hidden" name="${f.name}" value="${esc(v || 3)}">
      </div>`;
      break;
    case 'checkbox':
      return `<div class="field"><label class="switch">
        <span class="field__label" style="margin:0">${esc(f.label)}</span>
        <input type="checkbox" name="${f.name}"${v ? ' checked' : ''}></label>${hint}</div>`;
    case 'tags':
      control = `<input class="input" id="${id}" name="${f.name}" value="${esc(Array.isArray(v) ? v.join(', ') : v)}"
                   placeholder="${esc(f.placeholder || 'ガクチカ, 自己PR')}">`;
      break;
    default:
      control = `<input class="input" id="${id}" type="${f.type || 'text'}" name="${f.name}"
                   value="${esc(v)}" placeholder="${esc(f.placeholder || '')}"
                   ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}
                   ${f.required ? 'required' : ''}>`;
  }
  return `<div class="field">${label}${control}${f.type === 'counter' ? '' : hint}</div>`;
}

function rowsHTML(fields) {
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.half && fields[i + 1]?.half) {
      out.push(`<div class="field-row">${fieldHTML(fields[i])}${fieldHTML(fields[i + 1])}</div>`);
      i++;
    } else {
      out.push(fieldHTML(f));
    }
  }
  return out.join('');
}

/**
 * フォームモーダルを開く。Promise<値オブジェクト|null> を返す。
 * extraButtons: [{label, value, danger}] — 押すとその value を resolve する。
 */
export function openForm({ title, fields, submitLabel = '保存', extraButtons = [] }) {
  return new Promise(resolve => {
    let result = null;
    const d = createDialog();
    d.innerHTML = shell({
      title,
      body: rowsHTML(fields),
      foot: `${extraButtons.map((b, i) =>
              `<button type="button" class="btn ${b.danger ? 'btn--danger' : ''} btn--icon" data-extra="${i}">${esc(b.label)}</button>`).join('')}
             <button type="button" class="btn" data-no>キャンセル</button>
             <button type="button" class="btn btn--primary" data-ok>${esc(submitLabel)}</button>`,
    });

    const form = d.querySelector('#modalForm');
    form.addEventListener('submit', e => e.preventDefault());

    // 星評価
    form.querySelectorAll('[data-stars]').forEach(box => {
      box.addEventListener('click', e => {
        const btn = e.target.closest('button[data-n]');
        if (!btn) return;
        const n = Number(btn.dataset.n);
        box.querySelector('input').value = n;
        box.querySelectorAll('button').forEach(b => { b.dataset.on = Number(b.dataset.n) <= n ? 1 : 0; });
      });
    });

    // 文字数カウンター
    fields.filter(f => f.type === 'counter').forEach(f => {
      const ta = form.querySelector(`[name="${f.name}"]`);
      const out = form.querySelector(`[data-counter-for="${f.name}"]`);
      const limitField = fields.find(x => x.name === 'limit');
      const render = () => {
        const n = String(ta.value || '').replace(/\s/g, '').length;
        const lim = Number(form.querySelector('[name="limit"]')?.value || (limitField?.value ?? 0));
        out.textContent = lim > 0 ? `${n} / ${lim}字` : `${n}字`;
        out.dataset.over = lim > 0 && n > lim ? '1' : '0';
      };
      ta.addEventListener('input', render);
      form.querySelector('[name="limit"]')?.addEventListener('input', render);
      render();
    });

    const collect = () => {
      const fd = new FormData(form);
      const out = {};
      for (const f of fields) {
        if (f.type === 'checkbox') out[f.name] = form.querySelector(`[name="${f.name}"]`).checked;
        else if (f.type === 'tags') {
          out[f.name] = String(fd.get(f.name) || '').split(/[,、]/).map(s => s.trim()).filter(Boolean);
        } else if (f.type === 'number' || f.type === 'stars') out[f.name] = Number(fd.get(f.name)) || 0;
        else out[f.name] = String(fd.get(f.name) ?? '').trim();
      }
      return out;
    };

    const submit = () => {
      const required = fields.filter(f => f.required);
      for (const f of required) {
        const el = form.querySelector(`[name="${f.name}"]`);
        if (!String(el.value || '').trim()) { el.focus(); el.reportValidity?.(); return; }
      }
      result = collect();
      d.close();
    };

    d.querySelector('[data-close]').onclick = () => d.close();
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-ok]').onclick = submit;
    form.querySelectorAll('[data-extra]').forEach(btn => {
      btn.onclick = () => { result = extraButtons[Number(btn.dataset.extra)].value; d.close(); };
    });
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); }
    });
    d.onclick = (e) => { if (e.target === d) d.close(); };
    d.addEventListener('close', () => resolve(result), { once: true });
    d.showModal();

    const first = form.querySelector('.input, .textarea, .select');
    if (window.matchMedia('(min-width: 880px)').matches) first?.focus();
  });
}
