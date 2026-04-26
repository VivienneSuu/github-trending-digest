#!/usr/bin/env node
/**
 * fetch-trending.js
 *
 * Two modes controlled by --sort flag:
 *   --sort weekly  (default) → scrapes github.com/trending, ranks by stars gained this week
 *   --sort total             → uses GitHub Search API, ranks by total cumulative stars
 *
 * Other flags:
 *   --since daily|weekly     → trending period (only used in weekly mode)
 *   --categories key1,key2   → filter by category keys
 *   --top N                  → number of results (default 10)
 *
 * Outputs: JSON array to stdout.
 */

const https = require("https");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i !== -1 && args[i+1] ? args[i+1] : def; };
const hasFlag = (flag) => args.includes(flag);

let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".github-trending", "config.json"), "utf8")); } catch(_) {}

const sortMode = getArg("--sort", "weekly");   // "weekly" | "total"
const since    = getArg("--since", config.frequency === "daily" ? "daily" : "weekly");
const topN     = parseInt(getArg("--top", config.topN || 10));
const categoryKeys = getArg("--categories", (config.categories || []).join(",")).split(",").filter(Boolean);
const githubToken  = process.env.GITHUB_TOKEN || config.githubToken || null;

// ── Category map ─────────────────────────────────────────────────────────────
let categoryMap = {};
try {
  const catData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "default-categories.json"), "utf8"));
  for (const cat of catData.categories) categoryMap[cat.key] = cat;
} catch(_) {}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fetchUrl(url, hops=0, extraHeaders={}) {
  if (hops > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((res, rej) => {
    const headers = {
      "User-Agent": "github-trending-digest/1.0 (https://github.com)",
      Accept: "text/html,application/json",
      ...extraHeaders,
    };
    https.get(url, { headers }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location)
        return res(fetchUrl(r.headers.location, hops+1, extraHeaders));
      let d = ""; r.on("data", c => d += c); r.on("end", () => res(d));
    }).on("error", rej);
  });
}

function apiHeaders() {
  const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (githubToken) h["Authorization"] = `Bearer ${githubToken}`;
  return h;
}

function clean(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ")
    .replace(/\s+/g," ").trim();
}

function parseNum(s) {
  const n = parseInt((s||"").replace(/[^0-9]/g,""), 10);
  return (n && n < 1e9) ? n : 0;
}

function fmt(n) {
  if (!n) return "N/A";
  if (n >= 10000) return (n/1000).toFixed(1).replace(/\.0$/,"")+"k";
  if (n >= 1000) return n.toLocaleString("en-US");
  return String(n);
}

function matchesCats(repo, keys) {
  if (!keys || keys.length === 0) return true;
  if (keys.includes("all")) return true;
  const text = `${repo.name} ${repo.description} ${(repo.topics||[]).join(" ")}`.toLowerCase();
  for (const key of keys) {
    const cat = categoryMap[key];
    if (!cat) continue;
    for (const t of cat.topics) if (text.includes(t.toLowerCase())) return true;
  }
  return false;
}

// ── Mode A: Weekly Momentum (github.com/trending scraper) ────────────────────
function parseTrending(html) {
  const repos = [];
  const blocks = html.split('<article class="Box-row">').slice(1);
  for (const block of blocks) {
    try {
      const h2m = block.match(/class="h3 lh-condensed"[\s\S]{1,800}?href="\/([A-Za-z0-9_.\-]+\/[A-Za-z0-9_.\-]+)"/);
      if (!h2m) continue;
      const name = h2m[1];

      let desc = "";
      const pm = block.match(/<p[^>]+col-9[^>]*>([\s\S]*?)<\/p>/);
      if (pm) desc = clean(pm[1]);

      let lang = null;
      const lm = block.match(/itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/);
      if (lm) lang = clean(lm[1]) || null;

      let gained = 0;
      const gm = block.match(/([\d,]+)\s+stars?\s+(?:today|this week|this month)/i);
      if (gm) gained = parseNum(gm[1]);

      repos.push({ name, url: `https://github.com/${name}`, description: desc, language: lang, totalStars: null, starsGained: gained, topics: [] });
    } catch(_) {}
  }
  return repos;
}

async function fetchWeeklyMode() {
  const html = await fetchUrl(`https://github.com/trending?since=${since}`);
  let repos = parseTrending(html);

  // Enrich totalStars via API
  repos = await Promise.all(repos.map(async repo => {
    try {
      const raw = await fetchUrl(`https://api.github.com/repos/${repo.name}`, 0, apiHeaders());
      const data = JSON.parse(raw);
      if (data.stargazers_count) repo.totalStars = data.stargazers_count;
      if (data.topics?.length) repo.topics = data.topics;
      if (data.description && !repo.description) repo.description = data.description;
    } catch(_) {}
    return repo;
  }));

  return repos;
}

// ── Mode B: All-Time Top Starred (GitHub Search API) ─────────────────────────
async function fetchTotalMode() {
  // Build search query based on categories
  let q = "stars:>1000";

  // If categories are set, add topic filters
  if (categoryKeys.length > 0 && !categoryKeys.includes("all")) {
    const topicTerms = [];
    for (const key of categoryKeys) {
      const cat = categoryMap[key];
      if (cat) topicTerms.push(...cat.topics.slice(0, 2)); // first 2 topics per category
    }
    if (topicTerms.length > 0) {
      // GitHub Search doesn't support OR for topics easily, so we fetch broader and filter
      q = `stars:>1000`;
    }
  }

  const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${topN * 3}`;
  let data;
  try {
    const raw = await fetchUrl(searchUrl, 0, apiHeaders());
    data = JSON.parse(raw);
  } catch(_) {
    data = {};
  }

  if (!data.items) {
    process.stderr.write("Note: GitHub API unreachable or rate-limited. Set GITHUB_TOKEN env var for --sort total mode.\n");
    process.stderr.write("Falling back to trending page sorted by total stars (may be less accurate).\n");
    // Fallback: use trending page data sorted by totalStars
    const html = await fetchUrl(`https://github.com/trending?since=weekly`);
    const trendingRepos = parseTrending(html);
    return trendingRepos.sort((a, b) => (b.totalStars || 0) - (a.totalStars || 0));
  }

  const repos = data.items.map(item => ({
    name: item.full_name,
    url: item.html_url,
    description: item.description || "",
    language: item.language || null,
    totalStars: item.stargazers_count,
    starsGained: null, // not available from this endpoint
    topics: item.topics || [],
  }));

  // Now fetch weekly star gains from trending page to enrich
  try {
    const html = await fetchUrl(`https://github.com/trending?since=weekly`);
    const trendingRepos = parseTrending(html);
    const trendingMap = {};
    for (const r of trendingRepos) trendingMap[r.name.toLowerCase()] = r.starsGained;

    for (const r of repos) {
      r.starsGained = trendingMap[r.name.toLowerCase()] || null;
    }
  } catch(_) { /* enrichment optional */ }

  return repos;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  let repos;

  if (sortMode === "total") {
    repos = await fetchTotalMode();
  } else {
    repos = await fetchWeeklyMode();
  }

  // Apply category filter
  repos = repos.filter(r => matchesCats(r, categoryKeys));

  // Rank and trim
  repos = repos.slice(0, topN).map((r, i) => ({
    rank: i + 1,
    sortedBy: sortMode,
    period: since,
    ...r,
    totalStarsFormatted: fmt(r.totalStars),
    starsGainedFormatted: r.starsGained != null ? fmt(r.starsGained) : "N/A",
  }));

  process.stdout.write(JSON.stringify(repos, null, 2));
}

main().catch(e => { process.stderr.write(`Error: ${e.message}\n`); process.exit(1); });
