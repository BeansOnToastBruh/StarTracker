# How StarTracker releases work

Installers are **never** stored in git. Every release is built fresh in GitHub Actions from the tagged commit.

## Windows

```bash
# bump version in StarTracker/package.json, commit, push main
git tag v1.0.1
git push origin v1.0.1
```

CI publishes **only** `StarTracker-{version}-x64.exe` and `StarTracker-{version}-portable.exe` to the **v1.0.1** release page.

## Linux

```bash
git tag v1.0.1-linux
git push origin v1.0.1-linux
```

CI publishes **only** the AppImage to the **v1.0.1-linux** release page.

## Guards (automatic)

- **CI on every push to main:** fails if any `.exe`, `.AppImage`, or `dist/` is committed
- **Release workflows:** rebuild from tag, verify filenames match version, block wrong OS artifacts

## Users must download

| Platform | Download |
|----------|----------|
| Windows | Assets: `StarTracker-*-x64.exe` or `*-portable.exe` |
| Linux | Asset: `StarTracker-*-x86_64.AppImage` on `v*-linux` release |

**Never** run `StarTracker-*.exe` from a **Source code (zip)**. That zip is developer source only.
