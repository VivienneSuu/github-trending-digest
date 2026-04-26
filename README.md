# GitHub Trending Digest

A skill for AI agents that tracks the hottest open-source projects on GitHub and delivers a curated newsletter — ranked by weekly star momentum or all-time total stars, filtered by the categories you care about.

**Philosophy:** Star momentum is signal. Know what developers are actually building and using right now, not just what's been popular for years.

## What You Get

A daily or weekly digest with the **Top 10 trending GitHub repositories**, each with:

- ⭐ Total star count + 📈 Stars gained this week — both metrics, always
- Plain-English description of what the project actually does
- Core features (what makes it stand out)
- Target audience (who it's built for)
- Real-world use cases
- Direct GitHub link to click through

Two lists, two commands:

| Command | What it ranks by |
|---|---|
| `/trending` | Stars gained this week — repos exploding right now |
| `/top-starred` | All-time cumulative stars — highest-reputation projects |

## Quick Start

1. Install the skill in your agent (Claude Code or OpenClaw)
2. Say `/trending` or `/help` to get started
3. The agent asks you three questions — period, categories, newsletter — then delivers your first digest immediately

## Commands

```
/trending       Interactive prompt → weekly momentum digest
/top-starred    Interactive prompt → all-time most starred digest
/github-hot     Alias for /trending
/github-top     Alias for /top-starred
/help           Show all commands
```

**Settings (say anytime):**
```
change my categories         Update your topic filter
switch to daily / weekly     Change digest period
switch to Chinese            Change language (English / Chinese / Bilingual)
make summaries shorter       Adjust digest length
show my settings             Display your current config
set up a newsletter          Schedule automatic delivery (Telegram or Email)
cancel my digest             Remove scheduled delivery
```

## Every Run is Interactive

Unlike a static RSS feed, every manual `/trending` run asks:

1. **Period** — daily (past 24h) or weekly (past 7 days)?
2. **Categories** — AI/ML · Dev Tools · Web Dev · DevOps · Security · Data Science · Mobile · Gaming · All
3. **Newsletter** — want to schedule this as automatic delivery?

Scheduled digests skip the questions and use your saved preferences.

## Delivery

Supports three delivery methods:

- **Stdout** — output directly in your agent terminal (default, no setup)
- **Telegram** — delivered to a Telegram chat (~5 min setup, free)
- **Email** — delivered to your inbox via Resend (free tier = 100 emails/day)

## Languages

Digests can be delivered in:

- 🇺🇸 **English** (default)
- 🇨🇳 **Chinese** (简体中文, translated)
- 🌐 **Bilingual** — English + Chinese interleaved per project block

Say `switch to Chinese` or `switch to bilingual` anytime to change.

## Categories

Filter your digest to only the topics you care about:

| Category | Key |
|---|---|
| AI / Machine Learning | `ai-ml` |
| Developer Tools | `dev-tools` |
| Web Development | `web-dev` |
| DevOps / Infrastructure | `devops` |
| Security | `security` |
| Data Science | `data-science` |
| Mobile | `mobile` |
| Gaming | `gaming` |

Leave empty to track all categories with no filter.

## Installation

### Claude Code

```bash
git clone https://github.com/VivienneSuu/github-trending-digest ~/.claude/skills/github-trending-digest
```

Then in Claude Code, the skill is available automatically. Type `/trending` to start.

### OpenClaw

```bash
git clone https://github.com/VivienneSuu/github-trending-digest ~/skills/github-trending-digest
```

Or install from ClawhHub (coming soon):
```bash
clawhub install github-trending-digest
```

## Requirements

- Node.js (v18+)
- No API keys required for basic use
- **Optional:** `GITHUB_TOKEN` environment variable for higher API rate limits (improves total star count accuracy)
- **Optional:** Telegram bot token or Resend API key for automatic delivery

### Getting a GitHub Token (optional but recommended)

Without a token, the GitHub API allows 60 requests/hour. With one, it's 5,000/hour.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate a new token (classic) with no scopes needed — public repo data only
3. Add to your environment: `export GITHUB_TOKEN=your_token_here`

## How It Works

**Weekly Momentum mode (`/trending`):**
1. Fetches `github.com/trending?since=weekly` (no auth needed)
2. Parses repo names, descriptions, languages, and weekly star gains
3. Optionally enriches with total star count via GitHub API
4. AI agent remixes raw data into a readable newsletter

**All-Time Top Starred mode (`/top-starred`):**
1. Queries GitHub Search API sorted by `stars` descending
2. Cross-references the trending page to add weekly gain data
3. AI agent remixes into the same newsletter format

**Delivery:**
- Stdout: printed directly in your terminal
- Telegram: sent via bot to your chat
- Email: sent via Resend API

## Customizing the Digest

The skill uses plain-English prompt files to control how content is summarized.
Edit them directly or tell your agent what you want:

> "Make the use cases more specific"
> "Add a TL;DR line at the top of each project"
> "Focus more on who the target audience is"

The agent updates the prompts for you. Changes take effect on the next digest.

**Direct editing (power users):**

```
prompts/
├── digest-intro.md       Overall newsletter format, header/footer, tone
├── summarize-project.md  Per-project block structure and writing rules
└── translate.md          Chinese translation style guide
```

## Privacy

- No data is sent anywhere except to GitHub's public API (for trending data) and your chosen delivery service
- Your config and preferences are stored locally in `~/.github-trending/`
- GitHub trending data is fully public — no authentication required to fetch it

## Sample Output

See [examples/sample-digest.md](examples/sample-digest.md) for what a finished digest looks like.

## License

MIT
