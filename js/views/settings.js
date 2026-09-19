/* 設定：プロフィール・表示・データ・同期 */
import { getData, update, replaceAll, exportJSON, isDirty } from '../store.js';
import { esc, icon, download, toast, todayISO } from '../utils.js';
import { openForm, confirmDialog } from '../ui.js';
import * as sync from '../sync.js';
import { sampleData } from '../sample.js';

export function render() {
  const d = getData();
  const g = d.settings.gist;
  const counts = `企業 ${d.companies.length} / やること ${d.tasks.length} / 回答 ${d.answers.length} / メモ ${d.notes.length}`;

  return `
    <div class="page-head"><div><h1>設定</h1><p>${esc(counts)}</p></div></div>

    <h2 class="section-title">プロフィール</h2>
    <div class="card">
      <div class="field">
        <label class="field__label" for="setName">表示名</label>
        <input class="input" id="setName" value="${esc(d.profile.name)}" placeholder="例：山田">
      </div>
      <div class="field" style="margin-bottom:0">
        <label class="field__label" for="setGrad">卒業予定年</label>
        <input class="input" id="setGrad" value="${esc(d.profile.gradYear)}" placeholder="例：2027年卒">
      </div>
    </div>

    <h2 class="section-title">表示</h2>
    <div class="card">
      <div class="field" style="margin-bottom:0">
        <label class="field__label" for="setTheme">テーマ</label>
        <select class="select" id="setTheme">
          ${[['auto', '端末の設定に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']].map(([v, l]) =>
            `<option value="${v}"${d.settings.theme === v ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>

    <h2 class="section-title">${icon('cloud')} 端末間の同期（GitHub Gist）</h2>
    <div class="card">
      <p class="small muted">
        スマホとPCで同じデータを見るための設定です。あなた専用の非公開 Gist にデータを保存します。
        トークンはこの端末の中だけに保存され、GitHub 以外には送信されません。
      </p>
      <div class="field" style="margin-top:12px">
        <label class="field__label" for="setToken">アクセストークン（gist 権限）</label>
        <input class="input" id="setToken" type="password" value="${esc(g.token)}"
               placeholder="ghp_… / github_pat_…" autocomplete="off">
        <div class="field__hint">
          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">github.com/settings/tokens</a>
          を開き（右上のアイコン → Settings → 左サイドバーの一番下の Developer settings →
          Personal access tokens → <strong>Tokens (classic)</strong>）、
          Generate new token (classic) から <strong>gist</strong> だけにチェックして作成してください。
          Fine-grained tokens は Gist に対応していません。
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="setGistId">Gist ID</label>
        <input class="input" id="setGistId" value="${esc(g.id)}" placeholder="初回アップロードで自動作成されます" autocomplete="off">
        <div class="field__hint">2台目以降は、1台目に表示された ID をここに入力します。</div>
      </div>
      <div class="field">
        <label class="switch">
          <span class="field__label" style="margin:0">自動で同期する（起動時に取得・変更時に保存）</span>
          <input type="checkbox" id="setAuto"${g.auto ? ' checked' : ''}>
        </label>
      </div>
      <div class="btn-row">
        <button class="btn" id="btnPull"${g.token && g.id ? '' : ' disabled'}>クラウドから取り込む</button>
        <button class="btn btn--primary" id="btnPush"${g.token ? '' : ' disabled'}>クラウドに保存する</button>
      </div>
      <p class="small muted" style="margin-top:10px">
        状態：${g.token ? (d.lastSyncedAt
          ? `最終同期 ${new Date(d.lastSyncedAt).toLocaleString('ja-JP')}${isDirty() ? '（未保存の変更あり）' : ''}`
          : '未同期') : '未設定'}
      </p>
    </div>

    <h2 class="section-title">データ</h2>
    <div class="card">
      <p class="small muted">データはこの端末のブラウザに保存されています。定期的にバックアップを取ってください。</p>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn" id="btnExport">バックアップを書き出す</button>
        <button class="btn" id="btnImport">バックアップを読み込む</button>
      </div>
      <input type="file" id="fileInput" accept="application/json,.json" hidden>
      <hr class="divider">
      <div class="btn-row">
        <button class="btn" id="btnSample">サンプルデータを入れて試す</button>
        <button class="btn btn--danger" id="btnClear">すべてのデータを削除</button>
      </div>
    </div>

    <h2 class="section-title">このアプリについて</h2>
    <div class="card">
      <p class="small muted">
        就活ダッシュボード — 選考状況・提出物・締切・重要事項をひとまとめに管理します。<br>
        ブラウザの「ホーム画面に追加」でアプリのように使え、オフラインでも開けます。
      </p>
    </div>
  `;
}

export function mount(root, ctx) {
  const on = (sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); };
  const saveField = (sel, apply) => {
    const el = root.querySelector(sel);
    if (el) el.addEventListener('change', () => { update(apply(el)); toast('保存しました', 'ok'); });
  };

  saveField('#setName', el => d => { d.profile.name = el.value.trim(); });
  saveField('#setGrad', el => d => { d.profile.gradYear = el.value.trim(); });
  saveField('#setToken', el => d => { d.settings.gist.token = el.value.trim(); });
  saveField('#setGistId', el => d => { d.settings.gist.id = el.value.trim(); });

  on('#setTheme', 'change', e => {
    update(d => { d.settings.theme = e.target.value; });
    ctx.applyTheme();
  });
  on('#setAuto', 'change', e => update(d => { d.settings.gist.auto = e.target.checked; }));

  on('#btnPush', 'click', async (e) => {
    e.target.disabled = true;
    try {
      const id = await sync.push();
      ctx.rerender();
      toast(`保存しました（Gist ID: ${id}）`, 'ok');
    } catch (err) { toast(err.message, 'err'); }
    finally { e.target.disabled = false; }
  });

  on('#btnPull', 'click', async (e) => {
    if (isDirty() && !await confirmDialog(
      'この端末の未同期の変更が、クラウドの内容で上書きされます。よろしいですか？',
      { okLabel: '取り込む', danger: false })) return;
    e.target.disabled = true;
    try { await sync.pull(); ctx.rerender(); }
    catch (err) { toast(err.message, 'err'); }
    finally { e.target.disabled = false; }
  });

  on('#btnExport', 'click', () => {
    download(`就活データ_${todayISO()}.json`, exportJSON());
    toast('書き出しました', 'ok');
  });

  on('#btnImport', 'click', () => root.querySelector('#fileInput').click());
  on('#fileInput', 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const n = (parsed.companies || []).length;
      if (!await confirmDialog(
        `現在のデータを、読み込んだファイルの内容（企業 ${n} 社）で置き換えます。よろしいですか？`,
        { okLabel: '置き換える', danger: false })) return;
      const keep = { ...getData().settings.gist };
      replaceAll(parsed);
      update(d => { d.settings.gist = keep; });
      toast('読み込みました', 'ok');
      ctx.rerender();
    } catch (err) {
      toast('読み込めませんでした（JSONを確認してください）', 'err');
    } finally { e.target.value = ''; }
  });

  on('#btnSample', 'click', async () => {
    if (!await confirmDialog('現在のデータをサンプルデータで置き換えます。よろしいですか？',
      { okLabel: '入れる', danger: false })) return;
    const keep = { ...getData().settings.gist };
    replaceAll(sampleData());
    update(d => { d.settings.gist = keep; });
    toast('サンプルデータを入れました', 'ok');
    ctx.navigate('dashboard');
  });

  on('#btnClear', 'click', async () => {
    if (!await confirmDialog('すべてのデータを削除します。元に戻せません。よろしいですか？')) return;
    const keep = { ...getData().settings.gist };
    replaceAll({});
    update(d => { d.settings.gist = keep; });
    toast('削除しました');
    ctx.rerender();
  });
}
