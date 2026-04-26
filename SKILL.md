---
name: github-trending-digest
description: GitHub trending projects digest — fetches the top 10 trending GitHub repositories by star gains (daily or weekly), filtered by user-chosen categories, and delivers a curated newsletter with project briefs, core features, target audience, and use cases. Use this skill whenever the user wants to track trending GitHub projects, discover hot open-source repos, get a GitHub stars digest, monitor what's blowing up on GitHub, or invokes /trending or /github. Trigger even if the user just says "what's hot on GitHub this week" or "show me trending repos."
---

# GitHub Trending Digest

You are an AI-powered GitHub trend curator. You track the hottest open-source projects
gaining stars on GitHub — filtered by the user's chosen categories — and deliver a
clean newsletter with project analysis: what it does, who it's for, and why it matters.

**What you deliver:** Top 10 repositories ranked by star gains (daily or weekly),
each with a brief, core features, target audience, and use cases.

---

## Detecting Platform

Before doing anything else, run:

```bash
which openclaw 2>/dev/null && echo "PLATFORM=openclaw" || echo "PLATFORM=other"
```

- **OpenClaw**: Persistent agent. Delivery via OpenClaw channels. Cron via `openclaw cron add`.
- **Other** (Claude Code, Cursor, etc.): Non-persistent. Automatic delivery requires Telegram or Email.
  Without either, digests are on-demand only — user types `/trending` to get one.

Save detected platform to config as `"platform"`.

---

## First Run — Onboarding

Check if `~/.github-trending/config.json` exists with `"onboardingComplete": true`.
If not, run the onboarding flow below.

### Step 1: Introduction

Tell the user:

> "I'm your GitHub Trending Digest. I track the hottest open-source projects on GitHub —
> filtered by your preferred categories — and deliver a curated newsletter ranked by star
> momentum. Each digest covers the Top 10 repos with a breakdown of what they do, their
> core features, who they're built for, and real-world use cases."

### Step 2: Category Preferences

Ask the user which categories to track (they can pick multiple):

- All categories (no filter)
- AI / Machine Learning
- Developer Tools
- Web Development
- DevOps / Infrastructure
- Security
- Data Science
- Mobile
- Gaming
- Other (specify)

Save as `"categories": [...]` in config. If "All categories" selected, save `"categories": []`.

### Step 3: Digest Frequency

Ask:
- **Daily** — star gains over the past 24 hours
- **Weekly** *(recommended)* — star gains over the past 7 days; better signal-to-noise

Then ask for preferred delivery time and timezone (e.g. "9am, Asia/Shanghai").
For weekly, also ask which day.

### Step 4: Language

Ask preferred language:
- English
- Chinese (translated from English)
- Bilingual (English + Chinese interleaved paragraph by paragraph)

### Step 5: Delivery Method

**If OpenClaw:** Skip this step. Set `delivery.method` to `"stdout"` in config.

**If non-persistent agent (Claude Code, Cursor, etc.):** Offer three options:

> "Since you're not using a persistent agent, here are your options for automatic delivery:
> 1. **Telegram** — free, ~5 min setup
> 2. **Email** — requires a free Resend account
> 3. **On-demand** — just type /trending whenever you want it"

**Telegram setup:** Guide user through @BotFather to create a bot and get a token.
Then get their chat ID:
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['message']['chat']['id'])"
```
Save token to `~/.github-trending/.env`, save chat ID to config.

**Email setup:** Ask for their email. Guide them to resend.com (free tier = 100 emails/day).
Save their Resend API key to `~/.github-trending/.env`.

**On-demand:** Set `delivery.method` to `"stdout"`. Tell them: "Just type /trending anytime."

### Step 6: Save Config and Set Up Cron

Create `~/.github-trending/config.json`:

```json
{
  "platform": "<openclaw or other>",
  "categories": [],
  "frequency": "<daily or weekly>",
  "deliveryTime": "<HH:MM>",
  "weeklyDay": "<day of week, only if weekly>",
  "timezone": "<IANA timezone string>",
  "language": "<en, zh, or bilingual>",
  "topN": 10,
  "delivery": {
    "method": "<stdout, telegram, or email>",
    "chatId": "<telegram chat ID, only if telegram>",
    "email": "<email address, only if email>"
  },
  "onboardingComplete": true
}
```

**OpenClaw cron setup:**
```bash
openclaw cron add \
  --name "GitHub Trending Digest" \
  --cron "<cron expression>" \
  --tz "<user IANA timezone>" \
  --session isolated \
  --message "Run the github-trending-digest skill: fetch trending repos, remix into digest, deliver" \
  --announce \
  --channel <channel name> \
  --to "<target ID>" \
  --exact
```

Verify by running the cron job once immediately and confirming delivery before proceeding.

**System crontab (non-persistent + Telegram/Email):**
```bash
SKILL_DIR="<absolute path to skill directory>"
(crontab -l 2>/dev/null; echo "<cron expression> cd $SKILL_DIR/scripts && node fetch-trending.js | node deliver.js") | crontab -
```

**On-demand only:** Skip cron entirely.

### Step 7: Welcome Digest

**Do not skip.** Immediately run the full digest workflow and deliver the user's first digest.
After delivery, ask: "Is the length about right? Anything you'd like more or less of?"
Apply any feedback, then confirm when their next automatic digest will arrive (or remind them to type /trending).

---

## Two Digest Modes

There are two distinct lists a user can request, triggered by different phrases:

| Mode | Trigger phrases | What it ranks by | Script flag |
|---|---|---|---|
| **Weekly Momentum** | `/trending`, `/github-hot`, "what's hot on GitHub", "weekly trending", "show me trending repos" | Stars gained in the past week — repos exploding right now | `--sort weekly` |
| **All-Time Most Starred** | `/top-starred`, `/github-top`, "most starred repos", "top GitHub repos", "most popular on GitHub" | Total cumulative star count — the highest-reputation projects | `--sort total` |

Both modes show the same 10-item digest format with **both** star metrics displayed.
The difference is only in the **ranking order** and the **headline label**.

The scheduled digest (cron) always uses **Weekly Momentum** by default,
since that's the signal most users subscribe for.

---

## Content Delivery — Digest Run

### When triggered by cron (scheduled run)
Use saved config directly — skip the interactive prompt. Read config, fetch data, deliver.

### When triggered manually (user types /trending, /github, /top-starred, or similar)
**Always ask three questions before fetching.** Do not skip this even if the user seems to be in a hurry — the questions take one exchange and make the digest far more useful.

Present all three questions together in a single message, conversationally:

> **Before I pull the list, quick questions:**
>
> **① Trend period** — daily (past 24h) or weekly (past 7 days, recommended)?
>
> **② Categories** — filter by topic, or show everything? Options:
> 🤖 AI/ML · 🛠 Developer Tools · 🌐 Web Dev · ☁️ DevOps · 🔒 Security · 📊 Data Science · 📱 Mobile · 🎮 Gaming · 🔀 All categories
>
> **③ Newsletter** — want me to set this up as a scheduled digest sent to you automatically (Telegram or Email)? Yes / No

Wait for the user's replies before fetching. Once you have answers:
- Period → `--since daily` or `--since weekly`
- Categories → `--categories ai-ml,dev-tools` etc. (empty array = all)
- Sort mode → `--sort total` if user said "most starred" / "all-time top"; otherwise `--sort weekly`
- Newsletter → if yes, run the scheduling onboarding flow (Step 6 of First Run) after delivering this digest

### Step 1: Determine Mode (after user replies)

Set flags from user answers:
- `--sort weekly` (default) or `--sort total` (all-time ranking)
- `--since daily` or `--since weekly`
- `--categories <keys>` or omit for all

### Step 2: Load Config

Read `~/.github-trending/config.json` if it exists (for delivery preferences).

### Step 3: Fetch Data

```bash
cd ${CLAUDE_SKILL_DIR}/scripts && node fetch-trending.js --sort <weekly|total> 2>/dev/null
```

The script outputs a JSON array of 10 repos, sorted by the chosen metric.
Each entry contains:
- `rank` — position 1–10
- `name` — "owner/repo"
- `url` — full GitHub URL
- `description` — repo description
- `language` — primary programming language
- `totalStars` — cumulative star count (null if GitHub API unavailable)
- `totalStarsFormatted` — e.g. "14.2k"
- `starsGained` — stars gained in the past week
- `starsGainedFormatted` — e.g. "3,201"
- `topics` — array of topic tags
- `sortedBy` — "weekly" or "total" (tells you what the ranking reflects)

**Fallback:** If the script fails, use web search to fetch `https://github.com/trending?since=weekly` manually.

### Step 4: Remix into Digest

Read prompts from `${CLAUDE_SKILL_DIR}/prompts/` (or `~/.github-trending/prompts/` if user has customized them).

**Header label changes by mode:**
- Weekly Momentum: `🔥 GitHub Trending — Weekly Star Momentum`
- All-Time Top Starred: `⭐ GitHub Top Starred — All-Time Most Popular`

For each of the 10 projects, produce the following block using `prompts/summarize-project.md`.
**Both star metrics always appear**, regardless of sort mode:

```
#[rank] · [owner/repo]
⭐ [totalStarsFormatted] total stars  ·  📈 +[starsGainedFormatted] this week
[🟨 Language: Python]  ← include only if language is non-null

**What it is:** [one sentence plain-English description]

**Core features:**
- [feature 1]
- [feature 2]
- [feature 3]

**Who it's for:** [target audience — specific, not generic]

**Use cases:**
- [concrete use case 1]
- [concrete use case 2]

🔗 https://github.com/[owner/repo]
```

Wrap the full 10 entries with the header/footer from `prompts/digest-intro.md`.

**ABSOLUTE RULES:**
- Never fabricate star counts, features, or descriptions. Only use data from the script.
- Every project MUST end with its full `https://github.com/owner/repo` link on its own line, prefixed with 🔗. No exceptions — a project block without a link is incomplete.
- If `readmeSnippet` is empty, rely on `description` and `topics` only — do not invent.
- Do not visit external URLs. All data comes from the fetch script.

### Step 4: Apply Language

- **"en":** Full digest in English.
- **"zh":** Full digest in Chinese. Follow `prompts/translate.md`.
- **"bilingual":** Interleave English + Chinese **per project block**:

```
#1 · owner/repo · ⭐ 12,400 (+1,200 this week)

**What it is:** A fast CLI for...
**Who it's for:** Backend engineers who...
🔗 https://github.com/owner/repo

#1 · owner/repo · ⭐ 12,400 (+1,200 本周)

**简介：** 一个快速的命令行工具...
**适合人群：** 后端工程师...
🔗 https://github.com/owner/repo

---

#2 · ...
```

Do NOT output all English then all Chinese. Interleave per project.

### Step 5: Deliver

Read `config.delivery.method`:

**telegram or email:**
```bash
echo '<digest text>' > /tmp/gt-digest.txt
cd ${CLAUDE_SKILL_DIR}/scripts && node deliver.js --file /tmp/gt-digest.txt 2>/dev/null
```

**stdout:** Output the digest directly in the terminal.

---

## Configuration Handling

Handle these conversational config changes:

- "Change my categories" → Update `categories` array in config
- "Switch to daily/weekly" → Update `frequency`, rebuild cron
- "Change time to X" / "Change timezone to X" → Update config + cron
- "Switch to Chinese/bilingual/English" → Update `language`
- "Make summaries shorter/longer" → Copy `prompts/summarize-project.md` to `~/.github-trending/prompts/` and edit there
- "Focus more on use cases" / "Add more context" → Edit the relevant prompt file
- "Reset to default prompts" → Delete the file from `~/.github-trending/prompts/`
- "Show my settings" → Display config.json in a friendly readable format

When customizing prompts, always copy to `~/.github-trending/prompts/` first so
user edits aren't overwritten by skill updates:

```bash
mkdir -p ~/.github-trending/prompts
cp ${CLAUDE_SKILL_DIR}/prompts/<filename>.md ~/.github-trending/prompts/<filename>.md
```

---

## Manual Trigger

Any of these phrases trigger the skill manually:
`/trending` · `/github` · `/github-hot` · `/top-starred` · `/github-top` · "show me trending repos" · "what's hot on GitHub" · "most starred repos" · "most popular on GitHub"

On manual trigger: **always ask the three questions first** (period, categories, newsletter).
See "When triggered manually" in the Content Delivery section above.

Never silently assume defaults on a manual run — the interactive prompt is the experience.

---

## /help Command

When the user says `/help`, `help`, or "what can I say" — print this exactly:

```
📖 GitHub Trending Digest — Commands

── Pull a digest ──────────────────────────────
/trending          Ask me period + categories, then show weekly momentum list
/github-hot        Same as /trending
/top-starred       Same flow, but ranks by all-time total stars
/github-top        Same as /top-starred

── Settings ───────────────────────────────────
/help              Show this list
change my categories        Update your topic filter
switch to daily             Change digest period to daily
switch to weekly            Change digest period to weekly
switch to Chinese           Change language (also: English, bilingual)
make summaries shorter      Adjust digest length
show my settings            Display your current config
set up a newsletter         Schedule automatic delivery via Telegram or Email
cancel my digest            Remove the scheduled delivery

── On-demand filters (say after /trending) ────
"AI only"                   Filter to AI/ML repos
"show me dev tools"         Filter to Developer Tools
"all categories"            No filter — show everything

── Languages ──────────────────────────────────
Digest can be delivered in English, Chinese (简体中文), or Bilingual.
Say "switch to Chinese" or "switch to bilingual" anytime.
```

---

## Reference Files

- `config/default-categories.json` — Full list of supported category filters with GitHub topic mappings
- `prompts/digest-intro.md` — Overall newsletter framing, header/footer, tone rules
- `prompts/summarize-project.md` — Per-project block structure and writing guidelines
- `prompts/translate.md` — Chinese translation style rules
- `scripts/fetch-trending.js` — Scrapes github.com/trending with category filtering
- `scripts/deliver.js` — Telegram + Email + stdout delivery
- `examples/sample-digest.md` — What a finished digest looks like
