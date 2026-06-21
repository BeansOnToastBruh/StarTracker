#!/usr/bin/env python3
"""Scan Game.log backups for patterns StarTracker may not handle yet."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path

BACKUP_DIR = Path(
    r"C:\Program Files\Roberts Space Industries\StarCitizen\LIVE\logbackups"
)
LIVE_LOG = Path(
    r"C:\Program Files\Roberts Space Industries\StarCitizen\LIVE\Game.log"
)

TRACKED = {
    "SHUDEvent_OnNotification",
    "CreateMarker",
    "CActor::Kill",
    "ContractBroker",
    "CWallet::",
    "VehicleListQuery",
    "Awarded",
    "Transitioning from zone",
    "OnClientSpawned",
    "SystemQuit",
    "ShopBuy",
    "ShopFlow",
}

INTERESTING = [
    "AttachmentReceived",
    "LedgerService",
    "AddAccessibleDestinations",
    "GAMA_Railen",
    "Railen",
    "Tyilui",
    "GAMA_",
    "Foxwell",
    "Headhunter",
    "Defend",
    "Refuel",
    "Tactical",
    "TSG",
    "Blueprint",
    "aUEC",
    "Awarded",
    "Reputation",
    "Contract Complete",
    "Contract Accepted",
    "Contract Failed",
    "Objective Complete",
    "New Objective",
    "Incapacitated",
    "VehicleDestruction",
    "Insurance",
    "Hangar",
    "Imprint",
    "Loadout",
    "G-Force",
    "GForce",
    "greyout",
    "XenoThreat",
    "Citizens for Prosperity",
]


def scan_file(path: Path, max_bytes: int = 12_000_000) -> dict:
    st = path.stat()
    with path.open("r", encoding="utf-8", errors="replace") as f:
        if st.st_size > max_bytes:
            f.seek(st.st_size - max_bytes)
            f.readline()
        text = f.read()

    lines = text.splitlines()
    in_pu = any('gamerules="SC_Default"' in ln for ln in lines[-5000:])
    build_m = re.search(r"Build\((\d+)\)", path.name)
    build = build_m.group(1) if build_m else "?"

    counts = Counter()
    for key in INTERESTING:
        c = sum(1 for ln in lines if key in ln)
        if c:
            counts[key] = c

    notifs: list[str] = []
    for ln in lines:
        if "Added notification" not in ln:
            continue
        m = re.search(r'Added notification "([^"]+)"', ln)
        if m:
            notifs.append(m.group(1))

    awarded = [ln.strip() for ln in lines if re.search(r"Awarded\s+\d", ln, re.I)]
    markers = []
    for ln in lines:
        if "CreateMarker" in ln and "contractDefinitionId" in ln:
            markers.append(ln.strip()[-200:])

    novel_notices = Counter()
    for ln in lines:
        if "[Notice]" not in ln:
            continue
        if any(
            x in ln
            for x in (
                "ContextEstablisher",
                "Context Establisher",
                "Armistice",
                "Medical Bed",
                "Hangar Request Completed",
                "Quantum Travel:",
                "Entered ",
                "Exited ",
            )
        ):
            continue
        m = re.search(r"\[Notice\]\s*<([^>]+)>", ln)
        if m:
            tag = m.group(1).split()[0][:60]
            novel_notices[tag] += 1

    return {
        "path": path.name,
        "build": build,
        "lines": len(lines),
        "in_pu": in_pu,
        "counts": counts,
        "notifs": notifs,
        "awarded_n": len(awarded),
        "awarded_samples": awarded[:3],
        "markers_n": len(markers),
        "marker_samples": markers[:3],
        "top_notices": novel_notices.most_common(20),
    }


def main() -> None:
    files = sorted(BACKUP_DIR.glob("Game Build*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
    # Prefer recent PU-ish logs
    picked: list[Path] = []
    for p in files[:40]:
        picked.append(p)
        if len(picked) >= 8:
            break

    print(f"Scanning {len(picked)} recent backup logs (+ live tail)\n")
    all_notifs: Counter = Counter()
    global_counts: Counter = Counter()
    builds: Counter = Counter()

    for p in picked:
        r = scan_file(p)
        builds[r["build"]] += 1
        global_counts.update(r["counts"])
        for n in r["notifs"]:
            # normalize contract titles
            t = re.sub(r"\s+", " ", n.strip())[:100]
            all_notifs[t] += 1

        pu = "PU" if r["in_pu"] else "menu/frontend"
        print(f"=== {r['path']} build={r['build']} ({pu}) ===")
        if r["counts"]:
            print(" hits:", ", ".join(f"{k}={v}" for k, v in r["counts"].most_common()))
        print(f" notifications={len(r['notifs'])} awarded_lines={r['awarded_n']} markers={r['markers_n']}")
        if r["awarded_samples"]:
            for s in r["awarded_samples"]:
                print("  AWARDED", s[:160])
        if r["notifs"]:
            for n in r["notifs"][-5:]:
                print("  NOTIF", n[:120])
        interesting_notices = [
            (k, v)
            for k, v in r["top_notices"]
            if k
            not in (
                "AttachmentReceived",
                "SHUDEvent_OnNotification",
                "GameView",
                "Bind",
                "ReuseChannel",
                "Get",
            )
            and not k.startswith("Context")
        ]
        if interesting_notices[:8]:
            print("  notice tags:", ", ".join(f"{k}({v})" for k, v in interesting_notices[:8]))
        print()

    print("--- Aggregate (recent backups) ---")
    print("builds:", dict(builds))
    print("pattern totals:", dict(global_counts.most_common()))
    print("\nTop notification texts:")
    for text, n in all_notifs.most_common(25):
        print(f"  {n}x {text}")

    # Live log quick check
    if LIVE_LOG.exists():
        r = scan_file(LIVE_LOG, max_bytes=2_000_000)
        print("\n--- Live Game.log (tail) ---")
        print(f"build/session: {r['path']} notifications={len(r['notifs'])} PU={r['in_pu']}")


if __name__ == "__main__":
    main()
