/**
 * Shared HTTP-JSON helper for the domain/intel modules in this directory.
 *
 * Every module that talks to an external API (UEX Corp, star-citizen.wiki,
 * RSI) used to define its own near-identical copy of `fetchJson`/`sleep` —
 * some with retry+backoff, most without, and with a couple of different
 * hardcoded `User-Agent` strings. This centralizes that into one place so
 * every call gets a consistent User-Agent (derived from the app's real
 * version), a per-attempt timeout (so a hung request can't block a caller
 * forever), and optional retry+backoff.
 */
const path = require("path");

let appVersion = "0.0.0";
try {
  // electron/fetchUtil.js -> ../package.json
  appVersion = require(path.join(__dirname, "..", "package.json")).version || appVersion;
} catch {
  /* fall back to default */
}

const DEFAULT_USER_AGENT = `StarTracker/${appVersion}`;
const DEFAULT_TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch() a URL and parse the JSON body, with a per-attempt abort timeout
 * and optional retry+backoff.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.retries] extra attempts after the first (default 0)
 * @param {number} [options.timeoutMs] abort timeout per attempt (default 15000)
 * @param {number} [options.retryDelayMs] base backoff between retries (default 600)
 * @param {Record<string,string>} [options.headers] extra/override headers
 */
async function fetchJson(url, options = {}) {
  const retries = options.retries ?? 0;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? 600;
  const headers = {
    Accept: "application/json",
    "User-Agent": DEFAULT_USER_AGENT,
    ...options.headers,
  };

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      lastErr =
        err?.name === "AbortError" ? new Error(`Timed out after ${timeoutMs}ms: ${url}`) : err;
      if (attempt < retries) await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

module.exports = {
  fetchJson,
  sleep,
  DEFAULT_USER_AGENT,
  DEFAULT_TIMEOUT_MS,
};
