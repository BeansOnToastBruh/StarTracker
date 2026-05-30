/**
 * Star Citizen sometimes splits HUD notifications across multiple log lines.
 * This merges them before parsing.
 */
const MAX_PENDING_PARTS = 8;

class LineAssembler {
  constructor() {
    this.pending = null;
  }

  /**
   * @param {string} line
   * @returns {string[]} complete lines ready for parseLine
   */
  push(line) {
    const out = [];
    const m = line.match(/^<([^>]+)>\s*(.*)$/s);
    if (!m) {
      out.push(line);
      return out;
    }

    const ts = m[1];
    const body = m[2];

    if (this.pending) {
      this.pending.parts.push(body);
      const merged = this.pending.parts.join(" ");
      if (this._isComplete(merged) || this.pending.parts.length >= MAX_PENDING_PARTS) {
        out.push(`<${this.pending.ts}> ${merged}`);
        this.pending = null;
      }
      return out;
    }

    if (this._startsFragment(body)) {
      this.pending = { ts, parts: [body] };
      return out;
    }

    out.push(line);
    return out;
  }

  _startsFragment(body) {
    if (/Added notification "/.test(body) && !this._isComplete(body)) {
      return true;
    }
    if (/UpdateNotificationItem> Notification "/.test(body) && !this._isComplete(body)) {
      return true;
    }
    return false;
  }

  _isComplete(body) {
    if (/MissionId:\s*\[[^\]]+\]/i.test(body)) return true;
    if (/:\s*"\s*\[\d+\]\s*(?:,|to queue)/i.test(body)) return true;
    if (/:\s*"\s*\[\d+\]\s*,\s*Action:/i.test(body)) return true;
    return false;
  }
}

module.exports = { LineAssembler };
