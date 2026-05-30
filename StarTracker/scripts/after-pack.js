"use strict";

const path = require("path");
const rcedit = require("rcedit");

/**
 * Patch StarTracker.exe version resources so Windows Task Manager shows StarTracker
 * instead of Electron when signAndEditExecutable is false.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const pkg = require("../package.json");
  const productName = pkg.build?.productName || pkg.productName || "StarTracker";
  const exeName = `${productName}.exe`;
  const exePath = path.join(context.appOutDir, exeName);

  await rcedit(exePath, {
    "file-version": pkg.version,
    "product-version": pkg.version,
    "version-string": {
      FileDescription: productName,
      ProductName: productName,
      InternalName: productName,
      OriginalFilename: exeName,
      LegalCopyright: pkg.build?.copyright || "",
    },
  });
};
