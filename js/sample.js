/* 動作確認・使い方の把握用のサンプルデータ（日付は実行日を基準に生成） */
import { uid } from './store.js';
import { toISO } from './utils.js';

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toISO(d);
};
const now = () => new Date().toISOString();

export function sampleData() {
  const c1 = uid(), c2 = uid(), c3 = uid(), c4 = uid();
  return {
    profile: { name: '', gradYear: '2027年卒' },
    companies: [
      {
        id: c1, name: 'サンプル商事株式会社', industry: '商社', role: '総合職',
        stage: 'i2', rating: 5, source: 'ナビサイト', url: '',
        memo: '選考フロー：ES → Webテスト → 一次(GD) → 二次 → 最終\n一次の面接官は現場の若手。逆質問は3つ用意しておく。',
        archived: false, createdAt: now(), updatedAt: now(),
        events: [
          { id: uid(), type: 'interview', title: '二次面接（対面）', date: day(3), time: '14:00',
            place: '本社ビル 12F 受付', memo: '履歴書1部・筆記用具。30分前着。', done: false },
          { id: uid(), type: 'interview', title: '一次面接（Web）', date: day(-9), time: '10:00',
            place: 'Zoom', memo: '', done: true },
        ],
      },
      {
        id: c2, name: 'サンプルテック株式会社', industry: 'IT', role: 'エンジニア職',
        stage: 'es', rating: 4, source: '逆求人イベント', url: '',
        memo: 'ESは自由記述が多い。技術的な取り組みを具体的に書く。',
        archived: false, createdAt: now(), updatedAt: now(),
        events: [
          { id: uid(), type: 'deadline', title: 'ES提出締切', date: day(1), time: '23:59',
            place: 'マイページ', memo: '設問2つ・各400字', done: false },
          { id: uid(), type: 'test', title: 'Webテスト（SPI）', date: day(6), time: '',
            place: '自宅受験', memo: '受験期限内に完了させる', done: false },
        ],
      },
      {
        id: c3, name: 'サンプル製作所', industry: 'メーカー', role: '技術職',
        stage: 'offer', rating: 3, source: '学校推薦', url: '',
        memo: '内定承諾の期限は来月末。他社の結果を見てから判断する。',
        archived: false, createdAt: now(), updatedAt: now(),
        events: [
          { id: uid(), type: 'other', title: '内定者懇親会', date: day(14), time: '18:00',
            place: 'オンライン', memo: '', done: false },
        ],
      },
      {
        id: c4, name: 'サンプル銀行', industry: '金融', role: '総合職',
        stage: 'interest', rating: 2, source: '', url: '',
        memo: '説明会の日程を確認する。', archived: false, createdAt: now(), updatedAt: now(),
        events: [
          { id: uid(), type: 'info', title: '会社説明会', date: day(8), time: '13:00',
            place: 'オンライン', memo: '要事前予約', done: false },
        ],
      },
    ],
    tasks: [
      { id: uid(), title: 'サンプルテックのESを提出する', companyId: c2, category: 'ES・エントリーシート',
        priority: 'high', due: day(1), dueTime: '23:59', memo: '設問2つ・各400字',
        done: false, doneAt: null, createdAt: now() },
      { id: uid(), title: '成績証明書を大学で発行する', companyId: '', category: '履歴書・証明書',
        priority: 'high', due: day(-1), dueTime: '', memo: '証明書発行機は平日9-17時のみ',
        done: false, doneAt: null, createdAt: now() },
      { id: uid(), title: '二次面接の逆質問を3つ考える', companyId: c1, category: '面接準備',
        priority: 'normal', due: day(2), dueTime: '', memo: '',
        done: false, doneAt: null, createdAt: now() },
      { id: uid(), title: '証明写真を撮り直す', companyId: '', category: 'その他',
        priority: 'normal', due: day(5), dueTime: '', memo: 'データ（3×4cm）も保存してもらう',
        done: false, doneAt: null, createdAt: now() },
      { id: uid(), title: '一次面接のお礼メールを送る', companyId: c1, category: 'お礼メール',
        priority: 'low', due: day(-8), dueTime: '', memo: '',
        done: true, doneAt: now(), createdAt: now() },
    ],
    answers: [
      { id: uid(), question: '学生時代に力を入れたことを教えてください', limit: 400,
        body: '（ここに結論 → 課題 → 行動 → 結果 → 学び の順で書きます）\n\n※ 数字を入れると具体性が増します。',
        tags: ['ガクチカ', '400字'], updatedAt: now() },
      { id: uid(), question: '自己PR・あなたの強みを教えてください', limit: 300,
        body: '（強みを一言 → 根拠となるエピソード → 入社後にどう活かすか）',
        tags: ['自己PR'], updatedAt: now() },
      { id: uid(), question: '志望動機を教えてください', limit: 400,
        body: '（なぜこの業界か → なぜこの会社か → 入社後にやりたいこと）\n\n※ 会社ごとに書き換える部分を [ ] で囲っておくと使い回しやすいです。',
        tags: ['志望動機'], updatedAt: now() },
      { id: uid(), question: '逆質問リスト', limit: 0,
        body: '・入社後、最初の1年で期待される役割は何ですか\n・活躍している若手社員に共通する点はありますか\n・チームの1日の流れを教えてください',
        tags: ['面接'], updatedAt: now() },
    ],
    notes: [
      { id: uid(), title: '提出書類チェックリスト', pinned: true,
        body: '□ 履歴書（大学指定 / 市販）\n□ 成績証明書（発行に3日かかる）\n□ 卒業見込証明書\n□ 健康診断書\n□ 証明写真データ（3×4cm）\n\n※ 証明書は多めに発行しておく',
        updatedAt: now() },
      { id: uid(), title: '面接の持ち物テンプレ', pinned: false,
        body: '・履歴書のコピー\n・スケジュール帳／メモ帳\n・腕時計\n・予備のストッキング\n・モバイルバッテリー\n・企業の場所と最寄り駅のスクショ',
        updatedAt: now() },
    ],
    settings: { theme: 'auto', gist: { token: '', id: '', auto: false } },
  };
}
