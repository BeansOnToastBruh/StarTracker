# StarTracker
StarTracker is an optimized system tray application that hooks your Star Citizen game.log and tracks your activities!

StarTracker

Tray app for Star Citizen. Watches your `Game.log` and builds session stats while you play. Read-only; it never touches game files.

## What it tracks

- Deaths
- Kills you scored (when the log has them)
- Contracts: accepted, completed, failed, plus rewards (aUEC, rep, bundles)
- Blueprint unlocks (when Game.log names them)
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

<img width="1574" height="712" alt="Screenshot 2026-05-30 013446" src="https://github.com/user-attachments/assets/4debcecf-68c9-485b-b4ac-b440c7397220" />

This hasn't cost me anything other than time! But for those that like the work, use it and wish to support you can! I will be updating and building new things based on suggestion and ability within Star Citizen and maybe other games too! 
https://ko-fi.com/beansontoastbruh

Remember, i am limited by CIG. If they do not have a log feed for it in the Game log, i cannot add it to the tracker. No game files are edited or will be - this is not allowed. So hopefully soon there is more implementation to logs. 