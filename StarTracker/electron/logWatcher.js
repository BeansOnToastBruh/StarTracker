const fs = require("fs");
const { parseLine } = require("./parser");
const { LineAssembler } = require("./lineAssembler");
const { createCombatCtx } = require("./combatContext");
const { createVehicleCtx } = require("./vehicleContext");

class LogWatcher {
  /**
   * @param {{ path: string, onEvent: (event: object) => void, onError?: (err: Error) => void }} opts
   */
  constructor(opts) {
    this.path = opts.path;
    this.onEvent = opts.onEvent;
    this.onError = opts.onError || (() => {});
    this.fd = null;
    this.offset = 0;
    this.buffer = "";
    this.watcher = null;
    this.pollTimer = null;
    this.ctx = {
      playerNick: null,
      inUniverse: false,
      playerGEID: null,
      ...createCombatCtx(),
      ...createVehicleCtx(),
    };
    this.lineAssembler = new LineAssembler();
    this._closed = false;
  }

  setContext(ctx) {
    this.ctx = { ...this.ctx, ...ctx };
  }

  async start() {
    await this._open();
    await this._readNew();
    this.watcher = fs.watch(this.path, { persistent: false }, () => {
      this._scheduleRead();
    });
    this.watcher.on("error", (err) => this.onError(err));
    this.pollTimer = setInterval(() => this._scheduleRead(), 1500);
  }

  async _open() {
    this.fd = await fs.promises.open(this.path, "r");
    const stat = await this.fd.stat();
    this.offset = Math.max(0, stat.size - 2 * 1024 * 1024);
  }

  _scheduleRead() {
    if (this._readPending) return;
    this._readPending = true;
    setTimeout(() => {
      this._readPending = false;
      this._readNew().catch((e) => this.onError(e));
    }, 80);
  }

  async _readNew() {
    if (!this.fd || this._closed) return;
    const stat = await this.fd.stat();
    if (stat.size < this.offset) {
      this.offset = 0;
      this.buffer = "";
    }
    if (stat.size === this.offset) return;

    const length = stat.size - this.offset;
    const buf = Buffer.alloc(Math.min(length, 512 * 1024));
    const { bytesRead } = await this.fd.read(buf, 0, buf.length, this.offset);
    this.offset += bytesRead;

    const chunk = buf.slice(0, bytesRead).toString("utf8");
    this.buffer = this.buffer ? this.buffer + chunk : chunk;
    let lineStart = 0;
    let nl = this.buffer.indexOf("\n", lineStart);
    while (nl !== -1) {
      let line = this.buffer.slice(lineStart, nl);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      lineStart = nl + 1;
      if (line.trim()) {
        const assembled = this.lineAssembler.push(line);
        for (const ready of assembled) {
          const parsed = parseLine(ready, this.ctx);
          const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
          for (const event of events) {
            if (!event) continue;
            if (event.type === "meta" && event.detail?.playerNick) {
              this.ctx.playerNick = event.detail.playerNick;
            }
            if (event.type === "meta" && event.detail?.inUniverse) {
              this.ctx.inUniverse = true;
            }
            if (event.type === "contract" && event.detail?.action === "completed") {
              this.ctx.lastCompletedMissionId = event.detail.missionId || null;
              this.ctx.lastCompletedTitle = event.detail.title || null;
              this.ctx.lastCompletedAt = event.at;
            }
            this.onEvent(event);
          }
        }
      }
      nl = this.buffer.indexOf("\n", lineStart);
    }
    this.buffer = lineStart > 0 ? this.buffer.slice(lineStart) : this.buffer;
  }
  async close() {
    this._closed = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.watcher) this.watcher.close();
    if (this.fd) await this.fd.close();
    this.fd = null;
  }
}

module.exports = { LogWatcher };
