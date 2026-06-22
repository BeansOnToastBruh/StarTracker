const { BrowserWindow } = require("electron");

const RSI_ALPHA_48_URL =
  "https://robertsspaceindustries.com/en/comm-link/Patch-Notes/21168-Star-Citizen-Alpha-48";

let hiddenWin = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function expandRsiPatchSections(win) {
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const nodes = [...document.querySelectorAll("button, a, span, div")];
        for (const el of nodes) {
          const t = (el.innerText || "").trim();
          if (/^EXPAND ALL$/i.test(t)) {
            el.click();
          }
        }
      })()
    `);
  } catch {
    /* optional */
  }
}

/**
 * Load an RSI comm-link page in a hidden window and return visible plain text.
 * RSI patch pages are client-rendered; this only works inside Electron.
 */
async function fetchRsiPlainText(
  url = RSI_ALPHA_48_URL,
  { timeoutMs = 15000, settleMs = 1200 } = {}
) {
  if (!BrowserWindow) {
    throw new Error("RSI patch fetch requires Electron BrowserWindow");
  }

  if (!hiddenWin || hiddenWin.isDestroyed()) {
    hiddenWin = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
  }

  await hiddenWin.loadURL(url, { userAgent: "StarTracker/1.0" });
  const deadline = Date.now() + timeoutMs;
  let text = "";

  while (Date.now() < deadline) {
    text = await hiddenWin.webContents.executeJavaScript(
      'document.body?.innerText || ""'
    );
    if (
      /Star Citizen Alpha 4\.8(?:\.\d+)? LIVE/i.test(text) ||
      /Build Information/i.test(text)
    ) {
      break;
    }
    await sleep(400);
  }

  await expandRsiPatchSections(hiddenWin);
  await sleep(settleMs);
  text = await hiddenWin.webContents.executeJavaScript(
    'document.body?.innerText || ""'
  );
  return text;
}

function closeRsiPatchWindow() {
  if (hiddenWin && !hiddenWin.isDestroyed()) {
    hiddenWin.destroy();
  }
  hiddenWin = null;
}

module.exports = {
  RSI_ALPHA_48_URL,
  fetchRsiPlainText,
  closeRsiPatchWindow,
};
