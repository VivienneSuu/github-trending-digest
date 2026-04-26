#!/usr/bin/env node
/**
 * deliver.js
 * Delivers a digest to Telegram, Email (Resend), or stdout.
 *
 * Usage:
 *   echo "digest text" | node deliver.js
 *   node deliver.js --file /tmp/gt-digest.txt
 *
 * Reads delivery config from ~/.github-trending/config.json
 * Reads secrets from ~/.github-trending/.env
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Load config ──────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(process.env.HOME, ".github-trending", "config.json"),
        "utf8"
      )
    );
  } catch (_) {
    return { delivery: { method: "stdout" } };
  }
}

// ── Load .env ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(process.env.HOME, ".github-trending", ".env");
  const env = {};
  try {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key) env[key.trim()] = rest.join("=").trim();
    }
  } catch (_) {}
  return env;
}

// ── Read digest text ─────────────────────────────────────────────────────────
function readDigest() {
  const args = process.argv.slice(2);
  const fileFlag = args.indexOf("--file");
  if (fileFlag !== -1 && args[fileFlag + 1]) {
    return fs.readFileSync(args[fileFlag + 1], "utf8");
  }
  // Read from stdin
  return fs.readFileSync("/dev/stdin", "utf8");
}

// ── HTTP POST helper ─────────────────────────────────────────────────────────
function post(hostname, path, body, headers = {}) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: data })
        );
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── Telegram delivery ────────────────────────────────────────────────────────
async function deliverTelegram(text, token, chatId) {
  // Telegram has a 4096 char limit per message — split if needed
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.slice(i, i + 4000));
  }
  for (const chunk of chunks) {
    const res = await post(
      "api.telegram.org",
      `/bot${token}/sendMessage`,
      { chat_id: chatId, text: chunk, parse_mode: "Markdown" }
    );
    if (res.status !== 200) {
      process.stderr.write(`Telegram delivery failed: ${res.body}\n`);
    }
  }
}

// ── Email delivery (Resend) ──────────────────────────────────────────────────
async function deliverEmail(text, apiKey, toEmail) {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Convert markdown-ish text to plain HTML
  const html = `<pre style="font-family: monospace; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</pre>`;

  const res = await post(
    "api.resend.com",
    "/emails",
    {
      from: "GitHub Trending Digest <digest@resend.dev>",
      to: [toEmail],
      subject: `🔥 GitHub Trending — ${date}`,
      html,
    },
    { Authorization: `Bearer ${apiKey}` }
  );

  if (res.status !== 200 && res.status !== 201) {
    process.stderr.write(`Email delivery failed: ${res.body}\n`);
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const config = loadConfig();
  const env = loadEnv();
  const text = readDigest();
  const method = config.delivery?.method || "stdout";

  if (method === "telegram") {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = config.delivery?.chatId;
    if (!token || !chatId) {
      process.stderr.write("Missing TELEGRAM_BOT_TOKEN or chatId in config.\n");
      process.stdout.write(text);
      return;
    }
    await deliverTelegram(text, token, chatId);
    process.stderr.write("✓ Delivered via Telegram\n");
  } else if (method === "email") {
    const apiKey = env.RESEND_API_KEY;
    const toEmail = config.delivery?.email;
    if (!apiKey || !toEmail) {
      process.stderr.write("Missing RESEND_API_KEY or email in config.\n");
      process.stdout.write(text);
      return;
    }
    await deliverEmail(text, apiKey, toEmail);
    process.stderr.write("✓ Delivered via Email\n");
  } else {
    process.stdout.write(text);
  }
}

main().catch((err) => {
  process.stderr.write(`Delivery error: ${err.message}\n`);
  // Fallback: print to stdout
  try {
    const text = readDigest();
    process.stdout.write(text);
  } catch (_) {}
});
