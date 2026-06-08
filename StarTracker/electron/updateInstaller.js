const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function filenameFromUrl(url, platform) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    if (name && !name.includes("..")) return name;
  } catch {
    /* ignore */
  }
  return platform === "linux"
    ? "StarTracker-update.AppImage"
    : "StarTracker-update.exe";
}

async function downloadFile(url, destPath, onProgress) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "StarTracker-Updater" },
  });
  if (!res.ok) {
    throw new Error(`Download failed (HTTP ${res.status})`);
  }

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    onProgress?.({ received: buf.length, total: buf.length, percent: 100 });
    return destPath;
  }

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const file = fs.createWriteStream(destPath);
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      file.write(Buffer.from(value));
      received += value.byteLength;
      const percent =
        total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null;
      onProgress?.({ received, total, percent });
    }
  } finally {
    await new Promise((resolve, reject) => {
      file.end(() => resolve());
      file.on("error", reject);
    });
  }

  onProgress?.({ received, total: total || received, percent: 100 });
  return destPath;
}

function launchWindowsInstaller(installerPath) {
  const child = spawn(installerPath, [], {
    detached: true,
    stdio: "ignore",
    shell: true,
  });
  child.unref();
}

function launchLinuxAppImage(appImagePath) {
  fs.chmodSync(appImagePath, 0o755);
  const child = spawn(appImagePath, [], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

/**
 * Download release asset and start the platform installer.
 * @param {object} opts
 * @param {string} opts.downloadUrl
 * @param {string} [opts.platform] windows | linux
 * @param {function} [opts.onProgress]
 * @param {function} [opts.getTempDir] inject for tests
 * @param {function} [opts.quitApp] inject for tests
 */
async function downloadAndInstallUpdate(opts = {}) {
  const { downloadUrl, platform, onProgress, getTempDir, quitApp } = opts;
  if (!downloadUrl || !/^https?:\/\//i.test(downloadUrl)) {
    throw new Error("Invalid download URL");
  }

  const { app } = require("electron");
  const plat =
    platform === "linux" || platform === "windows"
      ? platform
      : process.platform === "linux"
        ? "linux"
        : "windows";

  const tempRoot =
    typeof getTempDir === "function"
      ? getTempDir()
      : path.join(app.getPath("temp"), "startracker-update");
  fs.mkdirSync(tempRoot, { recursive: true });

  const fileName = filenameFromUrl(downloadUrl, plat);
  const destPath = path.join(tempRoot, fileName);

  onProgress?.({ phase: "downloading", received: 0, total: 0, percent: 0 });
  await downloadFile(downloadUrl, destPath, onProgress);
  onProgress?.({ phase: "installing", percent: 100 });

  if (plat === "linux") {
    launchLinuxAppImage(destPath);
    return {
      ok: true,
      message: "Update downloaded. Launching the new AppImage — you can close this window.",
      destPath,
    };
  }

  launchWindowsInstaller(destPath);
  const quit = typeof quitApp === "function" ? quitApp : () => app.quit();
  setTimeout(quit, 800);
  return {
    ok: true,
    message: "Update downloaded. Follow the installer, then reopen StarTracker.",
    destPath,
  };
}

module.exports = {
  filenameFromUrl,
  downloadFile,
  downloadAndInstallUpdate,
};
