const { spawn } = require("child_process");
const path = require("path");
const { app } = require("electron");

/**
 * Manages communication with the Python OCR backend via stdio JSON-RPC.
 *
 * Protocol: newline-delimited JSON over stdin/stdout.
 * Request:  { "id": 1, "method": "start_ocr", "params": {...} }
 * Response: { "id": 1, "result": {...} }  or  { "id": 1, "error": "..." }
 * Event:    { "id": null, "event": "progress", "data": {...} }
 */
class PythonBridge {
  constructor() {
    this._process = null;
    this._requestId = 0;
    this._pending = new Map(); // id -> { resolve, reject, onProgress }
    this._buffer = "";

    this._spawn();
  }

  _findPython() {
    const fs = require("fs");

    // Check for project venv first (created by install-mac.sh / run-dev.sh)
    const projectRoot = app.isPackaged
      ? path.join(process.resourcesPath, "..")
      : path.join(__dirname, "../..");
    const venvPython = path.join(projectRoot, ".venv", "bin", "python3");

    if (fs.existsSync(venvPython)) {
      return venvPython;
    }

    // Fallback to system Python
    return "python3";
  }

  _getProjectRoot() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "..");
    }
    return path.join(__dirname, "../..");
  }

  _spawn() {
    const python = this._findPython();
    const projectRoot = this._getProjectRoot();

    // Run as module (-m) so relative imports work correctly.
    // In dev mode, PYTHONPATH points to src/ so "ancient_pdf_master.bridge" resolves.
    // In production, the package is installed in the venv.
    const srcDir = path.join(projectRoot, "src");

    this._process = spawn(python, ["-u", "-m", "ancient_pdf_master.bridge"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: projectRoot,
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONPATH: srcDir },
    });

    this._process.stdout.on("data", (chunk) => {
      this._buffer += chunk.toString();
      this._processBuffer();
    });

    this._stderrBuffer = "";
    this._process.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      this._stderrBuffer += text;
      console.error("[Python stderr]", text);
    });

    this._process.on("exit", (code) => {
      console.log(`[Python] Process exited with code ${code}`);
      const errorDetail = this._stderrBuffer.trim();
      // Reject all pending requests with stderr output for debugging
      for (const [id, handler] of this._pending) {
        const msg = errorDetail
          ? `Python backend error (code ${code}): ${errorDetail.split("\n").pop()}`
          : `Python process exited (code ${code})`;
        handler.reject(new Error(msg));
      }
      this._pending.clear();
    });
  }

  _processBuffer() {
    const lines = this._buffer.split("\n");
    // Keep incomplete last line in buffer
    this._buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        this._handleMessage(msg);
      } catch (e) {
        console.error("[Python] Invalid JSON:", line);
      }
    }
  }

  _handleMessage(msg) {
    // Progress event (no id)
    if (msg.event === "progress" && msg.data) {
      // Forward to all pending requests that have onProgress
      for (const handler of this._pending.values()) {
        if (handler.onProgress) handler.onProgress(msg.data);
      }
      return;
    }

    // Response to a request
    if (msg.id != null && this._pending.has(msg.id)) {
      const handler = this._pending.get(msg.id);
      this._pending.delete(msg.id);

      if (msg.error) {
        handler.reject(new Error(msg.error));
      } else {
        handler.resolve(msg.result);
      }
    }
  }

  /**
   * Send a request to the Python backend.
   * @param {string} method
   * @param {object} params
   * @param {function} [onProgress] - optional progress callback
   * @returns {Promise<any>}
   */
  send(method, params, onProgress = null) {
    return new Promise((resolve, reject) => {
      if (!this._process || this._process.killed) {
        this._spawn();
      }

      const id = ++this._requestId;
      this._pending.set(id, { resolve, reject, onProgress });

      const request = JSON.stringify({ id, method, params }) + "\n";
      this._process.stdin.write(request);
    });
  }

  kill() {
    if (this._process && !this._process.killed) {
      this._process.kill();
      this._process = null;
    }
  }
}

module.exports = { PythonBridge };
