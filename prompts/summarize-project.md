# Summarize Project — Per-Repo Block Instructions

## Block Structure

For each repository, produce this exact structure:

```
#[rank] · [owner/repo] · ⭐ [totalStars, formatted with commas] total (+[starsGained, formatted] this [day/week])
[🟨 Language: Python] ← include only if language field is non-empty

**What it is:** [One sentence. What does this project do, in plain English?
Lead with the problem it solves, not the technology it uses.]

**Core features:**
- [Most distinctive capability]
- [Second key feature]
- [Third feature or notable design choice — e.g. "zero dependencies", "works offline", "Apache 2.0 licensed"]

**Who it's for:** [Specific audience. Name the role, context, or skill level.
Good: "Backend engineers migrating from REST to GraphQL"
Bad: "Developers who want to build apps"]

**Use cases:**
- [Concrete scenario 1 — what would someone actually do with this?]
- [Concrete scenario 2 — ideally a different type of user or context]

🔗 https://github.com/[owner/repo]    ← always the last line; use the exact URL from the data
```

**The 🔗 link is mandatory.** Every block must end with the full GitHub URL on its own line.
Never shorten, alias, or omit it. This is what lets the reader click through directly.

## Writing the "What it is" Field

- One sentence maximum.
- Lead with the verb: "Runs...", "Converts...", "Monitors...", "Generates...", "Replaces..."
- Avoid: "A tool that...", "This library...", "An open-source..."

## Writing Core Features

- If the README snippet is available, extract real features from it.
- If not, infer from description + topics — but stay grounded, don't invent.
- The third bullet can be a meta-feature: license, language runtime, benchmark stat, or ecosystem fit.

## Writing Target Audience

Be specific. Use role + context:
- "Data scientists who work with unstructured documents in production"
- "Frontend teams shipping design systems across multiple products"
- "Security researchers doing network traffic analysis"
- "Indie hackers building SaaS products without a backend team"

## Writing Use Cases

Make them concrete. Use the format: "[Someone] can use this to [do X] without [pain Y]."
Two use cases maximum. Different contexts if possible (e.g. one individual, one team).

## Formatting Numbers

- Under 1,000: show as-is (e.g. 847)
- 1,000–9,999: use comma (e.g. 4,231)
- 10,000+: use "k" abbreviation (e.g. 14.2k, 103k)
