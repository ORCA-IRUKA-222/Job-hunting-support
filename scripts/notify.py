#!/usr/bin/env python3
"""就活ダッシュボードのやること・予定をメールで通知する。

GitHub Actions から1日1回実行する想定。
Gist に同期されたデータを読み、期限が近い/超過しているものがあればメールを送る。
知らせることが何もない日は送らない。

必要な環境変数:
  JHS_GIST_TOKEN  gist 権限のあるアクセストークン
  JHS_GIST_ID     データが入っている Gist の ID
  SMTP_USER       送信に使うメールアドレス
  SMTP_PASS       そのアプリパスワード
任意:
  MAIL_TO         宛先（既定: SMTP_USER）
  SMTP_HOST       既定: smtp.gmail.com
  SMTP_PORT       既定: 587
  SMTP_SECURITY   starttls（既定） / ssl / none
  NOTIFY_DAYS     何日先まで知らせるか（既定: 3）
  APP_URL         アプリのURL（メールにリンクを載せる）
  TIMEZONE        既定: Asia/Tokyo
  ALWAYS_SEND     1 にすると何もない日も送る
"""

import json
import os
import smtplib
import ssl
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from zoneinfo import ZoneInfo

FILENAME = "job-hunting-support.json"
API = "https://api.github.com"
DOW = ["月", "火", "水", "木", "金", "土", "日"]


# ---------- 取得 ----------
def fetch_data(token: str, gist_id: str) -> dict:
    req = urllib.request.Request(
        f"{API}/gists/{gist_id}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "job-hunting-support-notifier",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            gist = json.load(res)
    except urllib.error.HTTPError as err:
        hint = {
            401: "トークンが無効です。作り直して Secrets を更新してください。",
            404: "Gist が見つかりません。JHS_GIST_ID と gist 権限を確認してください。",
        }.get(err.code, "")
        raise SystemExit(f"Gist を取得できませんでした (HTTP {err.code}) {hint}")

    files = gist.get("files") or {}
    entry = files.get(FILENAME) or next(iter(files.values()), None)
    if not entry:
        raise SystemExit("Gist にデータファイルがありません。")

    if entry.get("truncated") and entry.get("raw_url"):
        with urllib.request.urlopen(entry["raw_url"], timeout=30) as res:
            text = res.read().decode("utf-8")
    else:
        text = entry.get("content") or ""

    try:
        return json.loads(text)
    except json.JSONDecodeError as err:
        raise SystemExit(f"Gist の中身を解釈できませんでした: {err}")


# ---------- 集計 ----------
def parse_day(value):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def fmt_day(d: date, today: date) -> str:
    head = f"{d.month}/{d.day}({DOW[d.weekday()]})"
    return f"{d.year}/{head}" if d.year != today.year else head


def rel_day(d: date, today: date) -> str:
    n = (d - today).days
    if n == 0:
        return "今日"
    if n == 1:
        return "明日"
    if n == 2:
        return "明後日"
    return f"{n}日後" if n > 0 else f"{-n}日超過"


def build_report(data: dict, today: date, horizon: int) -> dict:
    companies = data.get("companies") or []
    names = {c.get("id"): c.get("name", "") for c in companies if isinstance(c, dict)}
    limit = today + timedelta(days=horizon)

    overdue, due_today, soon = [], [], []
    for t in data.get("tasks") or []:
        if not isinstance(t, dict) or t.get("done"):
            continue
        due = parse_day(t.get("due"))
        if due is None:
            continue
        item = {
            "title": t.get("title") or "(無題)",
            "due": due,
            "time": t.get("dueTime") or "",
            "company": names.get(t.get("companyId"), ""),
            "high": t.get("priority") == "high",
        }
        if due < today:
            overdue.append(item)
        elif due == today:
            due_today.append(item)
        elif due <= limit:
            soon.append(item)

    events = []
    for c in companies:
        if not isinstance(c, dict):
            continue
        for e in c.get("events") or []:
            if not isinstance(e, dict) or e.get("done"):
                continue
            day = parse_day(e.get("date"))
            if day is None or not (today <= day <= limit):
                continue
            events.append({
                "title": e.get("title") or "予定",
                "due": day,
                "time": e.get("time") or "",
                "company": c.get("name", ""),
                "place": e.get("place") or "",
            })

    key = lambda x: (x["due"], x["time"] or "99:99", x["title"])
    return {
        "overdue": sorted(overdue, key=key),
        "today": sorted(due_today, key=key),
        "soon": sorted(soon, key=key),
        "events": sorted(events, key=key),
    }


def is_empty(report: dict) -> bool:
    return not any(report[k] for k in ("overdue", "today", "soon", "events"))


# ---------- メール本文 ----------
def subject_line(report: dict) -> str:
    """急ぎのものから順に、件名に出す項目を決める。"""
    parts = []
    if report["overdue"]:
        parts.append(f"期限超過{len(report['overdue'])}件")
    if report["today"]:
        parts.append(f"本日締切{len(report['today'])}件")
    if not parts and report["events"]:
        parts.append(f"予定{len(report['events'])}件")
    if not parts and report["soon"]:
        parts.append(f"まもなく締切{len(report['soon'])}件")
    return "【就活】" + (" / ".join(parts) if parts else "リマインド")


def line_of(item: dict, today: date) -> str:
    bits = [f"{fmt_day(item['due'], today)}"]
    if item.get("time"):
        bits.append(item["time"])
    bits.append(f"[{rel_day(item['due'], today)}]")
    head = " ".join(bits)
    tail = []
    if item.get("company"):
        tail.append(item["company"])
    if item.get("place"):
        tail.append(item["place"])
    mark = "★ " if item.get("high") else ""
    suffix = f"（{' / '.join(tail)}）" if tail else ""
    return f"  {head}  {mark}{item['title']}{suffix}"


def render_text(report: dict, today: date, app_url: str) -> str:
    out = [f"{today.year}年{today.month}月{today.day}日({DOW[today.weekday()]}) の就活リマインド", ""]
    sections = [
        ("■ 期限が過ぎています", report["overdue"]),
        ("■ 今日が締切", report["today"]),
        ("■ まもなく締切", report["soon"]),
        ("■ これからの予定", report["events"]),
    ]
    for title, items in sections:
        if not items:
            continue
        out.append(title)
        out.extend(line_of(i, today) for i in items)
        out.append("")
    if app_url:
        out.append(f"アプリを開く: {app_url}")
    return "\n".join(out)


def render_html(report: dict, today: date, app_url: str) -> str:
    css_row = "padding:6px 10px;border-bottom:1px solid #e6e9f0;font-size:14px;"
    blocks = []
    sections = [
        ("期限が過ぎています", report["overdue"], "#d9394a"),
        ("今日が締切", report["today"], "#d9394a"),
        ("まもなく締切", report["soon"], "#c2760a"),
        ("これからの予定", report["events"], "#1c6fe0"),
    ]
    for title, items, color in sections:
        if not items:
            continue
        rows = []
        for i in items:
            meta = " ".join(filter(None, [
                fmt_day(i["due"], today), i.get("time", ""),
            ]))
            tail = " / ".join(filter(None, [i.get("company", ""), i.get("place", "")]))
            rows.append(
                f'<tr><td style="{css_row}">'
                f'<span style="color:{color};font-weight:700">{escape(meta)}</span>'
                f' <span style="color:#64748b">[{escape(rel_day(i["due"], today))}]</span><br>'
                f'{"★ " if i.get("high") else ""}<strong>{escape(i["title"])}</strong>'
                + (f'<br><span style="color:#64748b;font-size:12px">{escape(tail)}</span>' if tail else "")
                + "</td></tr>"
            )
        blocks.append(
            f'<h2 style="font-size:15px;margin:22px 0 6px;color:{color}">{escape(title)}'
            f' <span style="color:#94a3b8;font-weight:400">{len(items)}件</span></h2>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
            f' style="border:1px solid #e6e9f0;border-radius:10px;border-collapse:separate;'
            f'border-spacing:0;overflow:hidden">{"".join(rows)}</table>'
        )

    link = (f'<p style="margin-top:26px"><a href="{escape(app_url)}"'
            f' style="background:#1c6fe0;color:#fff;text-decoration:none;'
            f'padding:10px 18px;border-radius:8px;display:inline-block">'
            f'ダッシュボードを開く</a></p>') if app_url else ""

    return (
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Hiragino Sans\','
        '\'Noto Sans JP\',sans-serif;color:#16202e;max-width:600px;margin:0 auto;padding:8px">'
        f'<p style="color:#64748b;font-size:13px;margin:0">'
        f'{today.year}年{today.month}月{today.day}日({DOW[today.weekday()]}) の就活リマインド</p>'
        + "".join(blocks) + link +
        '<p style="color:#94a3b8;font-size:11px;margin-top:28px">'
        '就活ダッシュボードの自動通知です。</p></div>'
    )


# ---------- 送信 ----------
def send_mail(subject: str, text: str, html: str, cfg: dict) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr(("就活ダッシュボード", cfg["user"]))
    msg["To"] = cfg["to"]
    # base64 を明示する。既定のままだと 8bit 扱いになり、
    # 8BITMIME に対応しない SMTP サーバー経由で日本語が
    # \u5e74 のようなエスケープ列に化けてしまう。
    msg.set_content(text, charset="utf-8", cte="base64")
    msg.add_alternative(html, subtype="html", charset="utf-8", cte="base64")

    host, port, security = cfg["host"], cfg["port"], cfg["security"]
    if security == "ssl":
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=30) as s:
            s.login(cfg["user"], cfg["password"])
            s.send_message(msg)
        return
    with smtplib.SMTP(host, port, timeout=30) as s:
        s.ehlo()
        if security == "starttls":
            s.starttls(context=ssl.create_default_context())
            s.ehlo()
        if cfg["password"]:
            s.login(cfg["user"], cfg["password"])
        s.send_message(msg)


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"環境変数 {name} が設定されていません。")
    return value


def main() -> int:
    tz = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Tokyo"))
    today = datetime.now(tz).date()
    horizon = max(0, int(os.environ.get("NOTIFY_DAYS", "3") or 3))
    app_url = os.environ.get("APP_URL", "").strip()

    # 設定不足は、送る日まで気づけないと困るので最初に確かめる
    gist_token = require("JHS_GIST_TOKEN")
    gist_id = require("JHS_GIST_ID")
    user = require("SMTP_USER")
    cfg = {
        "user": user,
        "password": require("SMTP_PASS"),
        "to": os.environ.get("MAIL_TO", "").strip() or user,
        "host": os.environ.get("SMTP_HOST", "").strip() or "smtp.gmail.com",
        "port": int(os.environ.get("SMTP_PORT", "").strip() or 587),
        "security": os.environ.get("SMTP_SECURITY", "").strip() or "starttls",
    }

    data = fetch_data(gist_token, gist_id)
    report = build_report(data, today, horizon)

    if is_empty(report) and os.environ.get("ALWAYS_SEND", "") != "1":
        print("知らせることがないため送信しません。")
        return 0

    send_mail(subject_line(report), render_text(report, today, app_url),
              render_html(report, today, app_url), cfg)
    counts = {k: len(v) for k, v in report.items()}
    print(f"送信しました: {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
