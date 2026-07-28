/**
 * Unit tests for Star Strings install helpers (no network, fake LIVE folder).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const {
  resolveLiveDir,
  localizationPaths,
  pickZipAsset,
  hasEnglishLanguageLine,
  ensureUserCfgLanguage,
  removeLanguageLineIfOurs,
  backupExisting,
  findIniInExtract,
  installFromExtract,
  getStatus,
  installStarStrings,
  uninstallStarStrings,
  sanitizeAssetName,
  assertSafeDownloadUrl,
  LANGUAGE_LINE,
} = require("../electron/starStringsInstaller");

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return false;
  }
  console.log("PASS:", message);
  return true;
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "startracker-ss-"));
const liveDir = path.join(tmpRoot, "LIVE");
const logPath = path.join(liveDir, "Game.log");
fs.mkdirSync(liveDir, { recursive: true });
fs.writeFileSync(logPath, "fake log\n");

assert(resolveLiveDir(logPath) === liveDir, "resolveLiveDir uses Game.log dirname");
assert(
  pickZipAsset([
    { name: "readme.md" },
    { name: "StarStrings-LIVE.zip", browser_download_url: "https://example/x.zip" },
  ])?.name === "StarStrings-LIVE.zip",
  "pickZipAsset prefers StarStrings-LIVE.zip"
);

assert(!hasEnglishLanguageLine("r_displayinfo = 1\n"), "missing language line detected");
assert(
  hasEnglishLanguageLine(`${LANGUAGE_LINE}\n`),
  "english language line detected"
);

const userCfg = localizationPaths(liveDir).userCfg;
fs.writeFileSync(userCfg, "r_displayinfo = 1\r\n", "utf8");
const cfgResult = ensureUserCfgLanguage(userCfg);
assert(cfgResult.addedLanguageLine === true, "ensureUserCfgLanguage appends line");
assert(
  hasEnglishLanguageLine(fs.readFileSync(userCfg, "utf8")),
  "user.cfg now has g_language = english"
);
const again = ensureUserCfgLanguage(userCfg);
assert(again.addedLanguageLine === false, "ensureUserCfgLanguage is idempotent");

const extractDir = path.join(tmpRoot, "extract");
const iniNested = path.join(extractDir, "Data", "Localization", "english", "global.ini");
fs.mkdirSync(path.dirname(iniNested), { recursive: true });
fs.writeFileSync(iniNested, "; star strings test\nkey=value\n");
assert(findIniInExtract(extractDir) === iniNested, "findIniInExtract finds Data/…/global.ini");

const backupRoot = path.join(tmpRoot, "backup");
const oldIni = localizationPaths(liveDir).globalIni;
fs.mkdirSync(path.dirname(oldIni), { recursive: true });
fs.writeFileSync(oldIni, "; old ini\n");
const backupMeta = backupExisting(liveDir, backupRoot);
assert(backupMeta.hadGlobalIni === true, "backupExisting captures global.ini");
assert(fs.existsSync(path.join(backupRoot, "global.ini")), "backup file written");

installFromExtract(extractDir, liveDir);
assert(
  fs.readFileSync(oldIni, "utf8").includes("star strings test"),
  "installFromExtract writes new global.ini"
);

const status = getStatus({
  logPath,
  starStringsState: {
    installed: true,
    publishedAt: "2026-01-01T00:00:00Z",
    name: "old",
  },
  remote: {
    publishedAt: "2026-07-22T00:00:00Z",
    name: "new",
  },
});
assert(status.liveDirExists === true, "status sees LIVE folder");
assert(status.filesPresent === true, "status sees global.ini");
assert(status.updateAvailable === true, "status flags update when remote newer");
assert(status.languageOk === true, "status languageOk after ensure");

// Full install with mocked fetch + zip (no GitHub)
const zipPath = path.join(tmpRoot, "pack.zip");
const zip = new AdmZip();
zip.addFile(
  "Data/Localization/english/global.ini",
  Buffer.from("; from zip install\n")
);
zip.writeZip(zipPath);
const zipBuf = fs.readFileSync(zipPath);

const mockRelease = {
  tag: "latest",
  name: "SC LIVE Build (test)",
  publishedAt: "2026-07-22T07:31:01Z",
  assetName: "StarStrings-LIVE.zip",
  downloadUrl: "https://example.invalid/StarStrings-LIVE.zip",
  releaseUrl: "https://example.invalid/release",
  body: "",
};

async function mockFetch(url) {
  if (String(url).includes("api.github.com")) {
    return {
      ok: true,
      async json() {
        return {
          tag_name: mockRelease.tag,
          name: mockRelease.name,
          published_at: mockRelease.publishedAt,
          html_url: mockRelease.releaseUrl,
          body: "",
          assets: [
            {
              name: mockRelease.assetName,
              browser_download_url: mockRelease.downloadUrl,
              size: zipBuf.length,
            },
          ],
        };
      },
    };
  }
  if (String(url).includes("StarStrings-LIVE.zip")) {
    return {
      ok: true,
      headers: { get: () => String(zipBuf.length) },
      body: null,
      async arrayBuffer() {
        return zipBuf.buffer.slice(
          zipBuf.byteOffset,
          zipBuf.byteOffset + zipBuf.byteLength
        );
      },
    };
  }
  throw new Error(`Unexpected fetch: ${url}`);
}

(async () => {
  const live2 = path.join(tmpRoot, "LIVE2");
  const log2 = path.join(live2, "Game.log");
  fs.mkdirSync(live2, { recursive: true });
  fs.writeFileSync(log2, "log\n");
  fs.writeFileSync(path.join(live2, "user.cfg"), "fov = 90\n");

  const result = await installStarStrings({
    logPath: log2,
    backupRoot: path.join(tmpRoot, "backup2"),
    tempRoot: path.join(tmpRoot, "temp2"),
    fetchImpl: mockFetch,
    downloadFileImpl: async (_url, dest, onProgress) => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, zipBuf);
      onProgress?.({ received: zipBuf.length, total: zipBuf.length, percent: 100 });
      return dest;
    },
  });

  assert(result.ok === true, "installStarStrings returns ok");
  assert(
    fs.readFileSync(localizationPaths(live2).globalIni, "utf8").includes("from zip install"),
    "install writes ini from zip"
  );
  assert(
    hasEnglishLanguageLine(fs.readFileSync(path.join(live2, "user.cfg"), "utf8")),
    "install merges g_language into existing user.cfg"
  );
  assert(result.starStrings?.addedLanguageLine === true, "state tracks added language line");

  const un = await uninstallStarStrings({
    logPath: log2,
    starStringsState: result.starStrings,
    backupRoot: result.starStrings.backupRoot,
  });
  assert(un.ok === true, "uninstallStarStrings returns ok");
  assert(
    !hasEnglishLanguageLine(
      fs.existsSync(path.join(live2, "user.cfg"))
        ? fs.readFileSync(path.join(live2, "user.cfg"), "utf8")
        : ""
    ),
    "uninstall removes language line we added"
  );

  // removeLanguageLineIfOurs only when flagged
  const cfg3 = path.join(tmpRoot, "user3.cfg");
  fs.writeFileSync(cfg3, `${LANGUAGE_LINE}\n`);
assert(
  removeLanguageLineIfOurs(cfg3, { addedLanguageLine: false }) === false,
  "does not strip language line we did not add"
);

// Backup preserve: second backupExisting keeps first restore point
const live3 = path.join(tmpRoot, "LIVE3");
fs.mkdirSync(live3, { recursive: true });
const ini3 = localizationPaths(live3).globalIni;
fs.mkdirSync(path.dirname(ini3), { recursive: true });
fs.writeFileSync(ini3, "; original\n");
const backup3 = path.join(tmpRoot, "backup3");
const first = backupExisting(live3, backup3);
fs.writeFileSync(ini3, "; starstrings overwrite\n");
const second = backupExisting(live3, backup3);
assert(second.backedUpAt === first.backedUpAt, "backupExisting preserves first restore point");
assert(
  fs.readFileSync(path.join(backup3, "global.ini"), "utf8").includes("original"),
  "backup file stays original after reinstall backup call"
);

assert(
  sanitizeAssetName("../evil.zip") === "evil.zip",
  "sanitizeAssetName strips path segments"
);
assert(
  (() => {
    try {
      assertSafeDownloadUrl("https://evil.example/x.zip");
      return false;
    } catch {
      return true;
    }
  })(),
  "assertSafeDownloadUrl blocks non-GitHub hosts"
);

try {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
} catch {
  /* ignore */
}

if (process.exitCode) {
  console.error("test-star-strings-installer: FAILED");
  process.exit(1);
}
console.log("test-star-strings-installer: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
