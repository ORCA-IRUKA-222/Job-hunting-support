/*
 * 端末間同期（GitHub Gist・任意）
 *
 * 秘密の Gist を1つ作り、そこに JSON を読み書きすることでスマホ⇔PC を同期する。
 * トークンはこのブラウザの localStorage にだけ保存され、GitHub 以外には送信しない。
 */
import { getData, update, replaceAll, markSynced, isDirty, exportJSON } from './store.js';
import { toast, $ } from './utils.js';

const FILENAME = 'job-hunting-support.json';
const API = 'https://api.github.com';

export const cfg = () => getData().settings.gist;
export const isConfigured = () => !!cfg().token;

let busy = false;

function setDot(stateName, title) {
  const dot = $('#syncDot');
  if (!dot) return;
  dot.hidden = !isConfigured();
  dot.dataset.state = stateName;
  dot.title = title;
}

export function refreshIndicator() {
  if (!isConfigured()) { setDot('', ''); return; }
  if (busy) return setDot('busy', '同期中…');
  const at = getData().lastSyncedAt;
  setDot(isDirty() ? '' : 'ok',
    at ? `最終同期: ${new Date(at).toLocaleString('ja-JP')}` : '未同期');
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${cfg().token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const msg = res.status === 401 ? 'トークンが違います。「接続をテスト」で確認してください'
      : res.status === 404 ? 'Gist が見つかりません（gist 権限がないか、ID が違います）'
      : res.status === 403 ? 'アクセスが拒否されました（gist 権限を確認してください）'
      : `通信エラー (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

/** ローカル → クラウド */
export async function push({ silent = false } = {}) {
  if (!isConfigured()) throw new Error('同期が設定されていません');
  busy = true; refreshIndicator();
  try {
    const content = exportJSON();
    // 保険：万一トークンが混ざっていたら送信しない
    if (cfg().token && content.includes(cfg().token)) {
      throw new Error('内部エラーのため中止しました（送信データにトークンが含まれています）');
    }
    let id = cfg().id;
    if (id) {
      await api(`/gists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ files: { [FILENAME]: { content } } }),
      });
    } else {
      const created = await api('/gists', {
        method: 'POST',
        body: JSON.stringify({
          description: '就活ダッシュボードのデータ（自動生成）',
          public: false,
          files: { [FILENAME]: { content } },
        }),
      });
      id = created.id;
      update(d => { d.settings.gist.id = id; }, { silent: true });
    }
    markSynced();
    if (!silent) toast('クラウドに保存しました', 'ok');
    return id;
  } finally {
    busy = false; refreshIndicator();
  }
}

/** クラウド → ローカル */
export async function pull({ silent = false } = {}) {
  if (!isConfigured()) throw new Error('同期が設定されていません');
  if (!cfg().id) throw new Error('Gist ID が未設定です');
  busy = true; refreshIndicator();
  try {
    const gist = await api(`/gists/${cfg().id}`);
    const file = gist.files?.[FILENAME] || Object.values(gist.files || {})[0];
    if (!file) throw new Error('データファイルが見つかりません');
    // 大きい gist は truncated になるため raw_url から取り直す
    const text = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
    const remote = JSON.parse(text);
    const keep = { ...getData().settings.gist };   // トークンは端末ごとに保持
    replaceAll(remote, { markSynced: true });
    update(d => { d.settings.gist = keep; }, { silent: true });
    markSynced();
    if (!silent) toast('クラウドから取り込みました', 'ok');
    return remote;
  } finally {
    busy = false; refreshIndicator();
  }
}

/** 起動時の自動取り込み（ローカルに未同期の変更がなければ実行） */
export async function autoPullOnStart() {
  if (!isConfigured() || !cfg().auto || !cfg().id) return;
  try {
    if (isDirty()) {
      // ローカルにも未保存の変更がある → 上書きせずユーザーに任せる
      toast('この端末に未同期の変更があります。設定から同期してください');
      return;
    }
    await pull({ silent: true });
    toast('クラウドと同期しました', 'ok');
  } catch (err) {
    console.warn(err);
    toast(`自動同期に失敗: ${err.message}`, 'err');
  }
}

/** 変更後の自動アップロード（まとめて数秒後に1回） */
let timer = null;
export function schedulePush() {
  if (!isConfigured() || !cfg().auto) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    push({ silent: true }).catch(err => {
      console.warn(err);
      toast(`自動同期に失敗: ${err.message}`, 'err');
    });
  }, 2500);
}


/**
 * トークンの状態を調べる。
 * 401（トークンそのものが違う）と、権限不足（gist スコープなし / fine-grained）を
 * はっきり区別して伝える。
 */
export async function diagnose() {
  const token = (cfg().token || '').trim();
  if (!token) return { ok: false, message: 'アクセストークンが入力されていません。' };

  let res;
  try {
    res = await fetch(`${API}/user`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    return { ok: false, message: 'GitHub に接続できませんでした。通信環境を確認してください。' };
  }

  if (res.status === 401) {
    return {
      ok: false,
      message: 'トークンが GitHub に認識されませんでした。\n\n'
        + '・先頭の ghp_ から末尾まで、全体をコピーできていますか\n'
        + '・前後や途中に空白・改行が入っていませんか\n'
        + '・有効期限が切れていたり、削除していませんか\n'
        + '・Gist ID 欄とトークン欄を逆に入れていませんか\n\n'
        + '心当たりがなければ、トークンを作り直すのが確実です。',
    };
  }
  if (!res.ok) {
    return { ok: false, message: `GitHub がエラーを返しました (${res.status})。時間をおいて試してください。` };
  }

  const user = (await res.json()).login;
  const raw = res.headers.get('X-OAuth-Scopes');
  const scopes = (raw || '').split(',').map(x => x.trim()).filter(Boolean);

  if (!scopes.length) {
    return {
      ok: false, user,
      message: `${user} として認証できましたが、このトークンには gist 権限がありません。\n\n`
        + 'Fine-grained token は Gist に対応していません。\n'
        + 'Tokens (classic) から、gist にチェックを入れて作り直してください。',
    };
  }
  if (!scopes.includes('gist')) {
    return {
      ok: false, user,
      message: `${user} として認証できましたが、gist 権限がありません。\n\n`
        + `現在の権限: ${scopes.join(', ')}\n\n`
        + 'GitHub のトークン設定画面で gist にチェックを入れて更新してください。',
    };
  }
  return { ok: true, user, message: `${user} として接続できました。gist 権限もあります。` };
}
