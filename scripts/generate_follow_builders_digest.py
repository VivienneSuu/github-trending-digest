#!/usr/bin/env python3
"""Generate a Follow Builders digest and send it to Telegram.

Designed for GitHub Actions. It fetches the public follow-builders feeds, creates
a concise Chinese digest, and sends it with Telegram Bot API.
"""

from __future__ import annotations

import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from typing import Any


FEED_BASE = "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main"
FEED_X_URL = f"{FEED_BASE}/feed-x.json"
FEED_PODCASTS_URL = f"{FEED_BASE}/feed-podcasts.json"
FEED_BLOGS_URL = f"{FEED_BASE}/feed-blogs.json"
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
TELEGRAM_SEND_URL = "https://api.telegram.org/bot{token}/sendMessage"


def request_json(
    method: str,
    url: str,
    headers: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
    timeout: int = 60,
) -> dict[str, Any]:
    data = None
    request_headers = headers.copy() if headers else {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(url, data=data, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed: HTTP {exc.code} {detail}") from exc


def fetch_feeds() -> dict[str, Any]:
    return {
        "x": request_json("GET", FEED_X_URL),
        "podcasts": request_json("GET", FEED_PODCASTS_URL),
        "blogs": request_json("GET", FEED_BLOGS_URL),
    }


def compact_text(value: str, limit: int) -> str:
    text = html.unescape(re.sub(r"\s+", " ", value)).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "..."


def is_substantive_tweet(text: str) -> bool:
    lowered = text.lower()
    if len(text.strip()) < 45:
        return False
    skip_markers = [
        "thank god",
        "tfw",
        "great working",
        "such a privilege",
        "congrats",
        "happy to",
        "excited to see",
    ]
    return not any(marker in lowered for marker in skip_markers)


def select_tweets(feed_x: dict[str, Any], max_builders: int = 10) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for builder in feed_x.get("x", []):
        tweets = [
            tweet
            for tweet in builder.get("tweets", [])
            if tweet.get("url") and is_substantive_tweet(tweet.get("text", ""))
        ]
        if not tweets:
            continue
        selected.append(
            {
                "name": builder.get("name", ""),
                "handle": builder.get("handle", ""),
                "bio": builder.get("bio", ""),
                "tweets": tweets[:2],
            }
        )
    return selected[:max_builders]


def transcript_key_points(transcript: str) -> list[str]:
    cleaned = compact_text(transcript, 12000)
    candidates = []
    patterns = [
        r"as we get closer to AGI[^.?!]*[.?!]",
        r"the hard part[^.?!]*[.?!]",
        r"AI agent[^.?!]*[.?!]",
        r"simulation[^.?!]*[.?!]",
        r"radically inconsistent[^.?!]*[.?!]",
        r"A/B test[^.?!]*[.?!]",
        r"Fortune 500[^.?!]*[.?!]",
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned, flags=re.IGNORECASE)
        if match:
            candidates.append(compact_text(match.group(0), 180))
    return list(dict.fromkeys(candidates))[:4]


def build_source_payload(feeds: dict[str, Any]) -> dict[str, Any]:
    podcasts = []
    for podcast in feeds["podcasts"].get("podcasts", [])[:1]:
        podcasts.append(
            {
                "name": podcast.get("name"),
                "title": podcast.get("title"),
                "url": podcast.get("url"),
                "publishedAt": podcast.get("publishedAt"),
                "transcript_excerpt": compact_text(podcast.get("transcript", ""), 9000),
            }
        )
    return {
        "feedGeneratedAt": {
            "x": feeds["x"].get("generatedAt"),
            "podcasts": feeds["podcasts"].get("generatedAt"),
            "blogs": feeds["blogs"].get("generatedAt"),
        },
        "x": select_tweets(feeds["x"]),
        "blogs": feeds["blogs"].get("blogs", [])[:5],
        "podcasts": podcasts,
    }


def summarize_with_openai(source: dict[str, Any]) -> str | None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    today = dt.datetime.now(dt.timezone.utc).astimezone().strftime("%Y-%m-%d")
    prompt = (
        "请基于下面 JSON 生成一份中文 AI Builders Digest。\n"
        "要求：\n"
        "1. 只使用 JSON 中的信息，不要编造。\n"
        "2. 结构为：X / Twitter、Official Blogs、Podcasts。\n"
        "3. 每条内容必须保留 URL。\n"
        "4. 写给关注 AI 产品、agent、SaaS、创业和开发者工具的人。\n"
        "5. 简洁、有判断，不要机械翻译。\n"
        f"日期：{today}\n\n"
        f"JSON：{json.dumps(source, ensure_ascii=False)}"
    )
    payload = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
        "input": [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
    }
    data = request_json(
        "POST",
        OPENAI_RESPONSES_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        payload=payload,
        timeout=90,
    )
    parts: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"}:
                parts.append(content.get("text", ""))
    return "\n".join(part for part in parts if part).strip() or None


def fallback_digest(source: dict[str, Any]) -> str:
    today = dt.datetime.now(dt.timezone.utc).astimezone().strftime("%Y-%m-%d")
    lines = [
        f"AI Builders Digest｜{today}",
        "",
        "说明：这是一份无 OpenAI API 的规则版摘要，基于 follow-builders 公开 feed 自动生成。",
        f"Feed 时间：X {source['feedGeneratedAt'].get('x')}; Podcasts {source['feedGeneratedAt'].get('podcasts')}",
        "",
        "X / Twitter",
    ]
    for builder in source["x"]:
        lines.append("")
        lines.append(f"{builder['name']}（{builder['handle']} on X）")
        if builder.get("bio"):
            lines.append(compact_text(builder["bio"], 120))
        for tweet in builder["tweets"]:
            lines.append(f"- {compact_text(tweet.get('text', ''), 260)}")
            lines.append(f"  {tweet['url']}")

    blogs = source.get("blogs", [])
    lines.extend(["", "Official Blogs"])
    if blogs:
        for blog in blogs:
            lines.append(f"- {blog.get('title') or blog.get('name')}: {blog.get('url')}")
    else:
        lines.append("今天 feed 里没有新的官方博客。")

    lines.extend(["", "Podcasts"])
    for podcast in source.get("podcasts", []):
        lines.append("")
        lines.append(f"{podcast['name']}｜{podcast['title']}")
        points = transcript_key_points(podcast.get("transcript_excerpt", ""))
        if points:
            lines.append("核心线索：")
            for point in points:
                lines.append(f"- {point}")
        lines.append(podcast["url"])

    lines.extend(["", "Generated through the Follow Builders skill: https://github.com/zarazhangrui/follow-builders"])
    return "\n".join(lines).strip()


def build_digest(feeds: dict[str, Any]) -> str:
    source = build_source_payload(feeds)
    digest = summarize_with_openai(source)
    if digest:
        return f"{digest}\n\nGenerated through the Follow Builders skill: https://github.com/zarazhangrui/follow-builders"
    return fallback_digest(source)


def split_message(text: str, limit: int = 3900) -> list[str]:
    chunks: list[str] = []
    remaining = text.strip()
    while len(remaining) > limit:
        split_at = remaining.rfind("\n\n", 0, limit)
        if split_at < 1:
            split_at = remaining.rfind("\n", 0, limit)
        if split_at < 1:
            split_at = limit
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


def send_telegram(text: str) -> None:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    for chunk in split_message(text):
        request_json(
            "POST",
            TELEGRAM_SEND_URL.format(token=token),
            payload={
                "chat_id": chat_id,
                "text": chunk,
                "disable_web_page_preview": True,
            },
        )
        time.sleep(0.5)


def main() -> int:
    missing = [name for name in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID") if not os.environ.get(name)]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
    feeds = fetch_feeds()
    digest = build_digest(feeds)
    print(digest)
    send_telegram(digest)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
