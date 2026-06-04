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

