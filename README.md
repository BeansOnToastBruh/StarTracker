# StarTracker
StarTracker is an optimized system tray application that hooks your Star Citizen game.log and tracks your activities!

StarTracker

Tray app for Star Citizen. Watches your `Game.log` and builds session stats while you play. Read-only; it never touches game files.

## What it tracks

- Deaths
- Kills you scored (when the log has them)
- Contracts: accepted, completed, failed, plus rewards (aUEC, rep, bundles)
- Ships lost
- Session start/end (connect, spawn, quit)

## Install

1. Go to [Releases](https://github.com/BeansOnToastBruh/StarTracker/releases) and grab the latest build.
2. **Recommended:** `StarTracker-{version}-x64.exe` (installer). Run it, then launch StarTracker from Start or the desktop shortcut.
3. **Portable:** `StarTracker-{version}-portable.exe` if you do not want an install; double-click and go.

StarTracker sits in the **system tray**. Double-click the icon for the window. Turn on **Auto-track** and it records when you are in the universe and stops when you quit.

**You need Star Citizen running** (or at least a `Game.log` on disk). Default path:

`C:\Program Files\Roberts Space Industries\StarCitizen\LIVE\Game.log`

Tray menu **Open log folder** if yours lives somewhere else.

Windows may warn the app is unsigned; choose **More info**, then **Run anyway**.

## Limitations

- No wallet balance in `Game.log`; we cannot show your bank total.
- **aUEC earned** only adds up when payout popups include amounts in the log text.
- Only the **LIVE** `Game.log` path unless you change config.

Sessions save to `%APPDATA%\startracker\sessions.json`. Old `%APPDATA%\sc-session-debrief\` data is picked up automatically.

I will add suggestions and features if i can as we go! 
