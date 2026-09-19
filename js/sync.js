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
    const msg = res.status === 401 ? 'トークンが無効です'
      : res.status === 404 ? 'Gist が見つかりません'
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
