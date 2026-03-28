const { spawn, execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

/**
 * Manages communication with the Python OCR backend via stdio JSON-RPC.
 *
 * Protocol: newline-delimited JSON over stdin/stdout.
 * Startup:  Python sends {"ready": true} or {"ready": false, "error": "..."}
 * Request:  { "id": 1, "method": "start_ocr", "params": {...} }
 * Response: { "id": 1, "result": {...} }  or  { "id": 1, "error": "..." }
 * Event:    { "id": null, "event": "progress", "data": {...} }
 */

const REQUIRED_PACKAGES = [
  "pytesseract",
  "Pillow",
  "pdf2image",
  "pikepdf",
  "reportlab",
];

class PythonBridge {
  constructor() {
    this._process = null;
    this._requestId = 0;
    this._pending = new Map();
    this._buffer = "";
    this._ready = false;
    this._readyPromise = null;
    this._startupError = null;
    this._pythonPath = null; // cached python executable path

    this._init();
  }

  /**
   * Initialize: find Python, ensure packages, spawn bridge.
   */
  async _init() {
    this._pythonPath = this._findPython();
    this._readyPromise = this._ensurePackagesAndSpawn();
  }

  _findPython() {
    const candidates = [];

    // 1. ~/Library/Application Support/Ancient PDF Master/.venv
    const appSupportVenv = path.join(
      app.getPath("userData"),
      ".venv",
      "bin",
      "python3"
    );
    candidates.push(appSupportVenv);

    // 2. Project-local .venv (dev mode)
    const projectRoot = path.join(__dirname, "../..");
    const localVenv = path.join(projectRoot, ".venv", "bin", "python3");
    candidates.push(localVenv);

    // 3. Homebrew Python paths
    candidates.push("/opt/homebrew/bin/python3");
    candidates.push("/usr/local/bin/python3");

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        console.log(`[Python] Using: ${p}`);
        return p;
      }
    }

    console.log("[Python] Using: python3 (system)");
    return "python3";
  }

  /**
   * Get the pip executable next to the Python interpreter.
   * For venv: /path/to/.venv/bin/pip3
   */
  _findPip() {
    if (!this._pythonPath || this._pythonPath === "python3") {
      return "pip3";
    }
    const dir = path.dirname(this._pythonPath);
    const pip = path.join(dir, "pip3");
    if (fs.existsSync(pip)) return pip;
    const pip2 = path.join(dir, "pip");
    if (fs.existsSync(pip2)) return pip2;
    return "pip3";
  }

  _getSrcPath() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "python");
    }
    return path.join(__dirname, "../../src");
  }

  _getEnvPath() {
    const existing = process.env.PATH || "";
    const extraPaths = [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/opt/homebrew/sbin",
      "/usr/local/sbin",
    ];
    const parts = existing.split(":");
    for (const p of extraPaths) {
      if (!parts.includes(p)) {
        parts.unshift(p);
      }
    }
    return parts.join(":");
  }

  _getBrewPrefix() {
    try {
      return execFileSync("brew", ["--prefix"], { encoding: "utf8" }).trim();
    } catch {
      if (fs.existsSync("/opt/homebrew")) return "/opt/homebrew";
      if (fs.existsSync("/usr/local/Cellar")) return "/usr/local";
      return null;
    }
  }

  /**
   * Check if required packages are installed, install them if not.
   * Then spawn the bridge process.
   */
  async _ensurePackagesAndSpawn() {
    const python = this._pythonPath;
    const envPath = this._getEnvPath();
    const env = { ...process.env, PATH: envPath };

    // Quick check: can Python import all required packages?
    const checkScript = REQUIRED_PACKAGES
      .map((p) => {
        const mod = p === "Pillow" ? "PIL" : p;
        return `__import__('${mod}')`;
      })
      .join("; ");

    let needsInstall = false;
    try {
      execFileSync(python, ["-c", checkScript], {
        env,
        timeout: 10000,
        stdio: "pipe",
      });
      console.log("[Python] All packages already installed");
    } catch {
      console.log("[Python] Missing packages — auto-installing...");
      needsInstall = true;
    }

    if (needsInstall) {
      await this._installPackages(env);
    }

    return this._spawnBridge();
  }

  /**
   * Auto-install required Python packages via pip.
   */
  _installPackages(env) {
    return new Promise((resolve, reject) => {
      const pip = this._findPip();
      const brewPrefix = this._getBrewPrefix();

      // Set C flags for pikepdf/qpdf compilation
      const installEnv = { ...env };
      if (brewPrefix) {
        installEnv.CFLAGS = `-I${brewPrefix}/include`;
        installEnv.LDFLAGS = `-L${brewPrefix}/lib`;
        installEnv.CPPFLAGS = `-I${brewPrefix}/include`;
        installEnv.PKG_CONFIG_PATH = `${brewPrefix}/lib/pkgconfig`;
      }

      console.log(`[Python] Running: ${pip} install ${REQUIRED_PACKAGES.join(" ")}`);

      const proc = spawn(pip, ["install", ...REQUIRED_PACKAGES], {
        env: installEnv,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120000,
      });

      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => {
        stdout += d.toString();
      });
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      proc.on("exit", (code) => {
        if (code === 0) {
          console.log("[Python] Packages installed successfully");
          resolve();
        } else {
          const lastLine = stderr.trim().split("\n").pop() || stdout.trim().split("\n").pop();
          console.error("[Python] pip install failed:", lastLine);
          // Don't reject — still try to spawn, bridge.py will report the exact missing packages
          resolve();
        }
      });

      proc.on("error", (err) => {
        console.error("[Python] pip not found:", err.message);
        resolve(); // still try to spawn
      });
    });
  }

  /**
   * Spawn the Python bridge process and wait for ready signal.
   */
  _spawnBridge() {
    return new Promise((resolve, reject) => {
      const python = this._pythonPath;
      const srcPath = this._getSrcPath();
      const envPath = this._getEnvPath();

      console.log(`[Python] Spawning bridge... PYTHONPATH: ${srcPath}`);

      this._ready = false;
      this._startupError = null;

      const timeout = setTimeout(() => {
        if (!this._ready) {
          const err = this._stderrBuffer
            ? `Python startup timeout. ${this._stderrBuffer.trim().split("\n").pop()}`
            : "Python backend did not start within 15 seconds";
          this._startupError = err;
          reject(new Error(err));
        }
      }, 15000);

      this._process = spawn(python, ["-u", "-m", "ancient_pdf_master.bridge"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONPATH: srcPath,
          PATH: envPath,
        },
      });

      this._process.stdout.on("data", (chunk) => {
        this._buffer += chunk.toString();
        this._processLines((msg) => {
          // Handle ready signal
          if ("ready" in msg) {
            clearTimeout(timeout);
            if (msg.ready) {
              this._ready = true;
              console.log("[Python] Backend ready");
              resolve();
            } else {
              const err = msg.error || "Python backend initialization failed";
              console.error("[Python] Not ready:", err);
              this._startupError = err;
              reject(new Error(err));
            }
            return true; // consumed
          }
          return false;
        });
      });

      this._stderrBuffer = "";
      this._process.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        this._stderrBuffer += text;
        console.error("[Python stderr]", text);
      });

      this._process.on("error", (err) => {
        console.error("[Python] Failed to start:", err.message);
        clearTimeout(timeout);
        const msg = `Failed to start Python: ${err.message}`;
        this._startupError = msg;
        reject(new Error(msg));
        for (const handler of this._pending.values()) {
          handler.reject(new Error(msg));
        }
        this._pending.clear();
      });

      this._process.on("exit", (code) => {
        console.log(`[Python] Process exited with code ${code}`);
        clearTimeout(timeout);
        const errorDetail = this._stderrBuffer.trim();
        const lastLine = errorDetail ? errorDetail.split("\n").pop() : "";

        if (!this._ready) {
          const msg = lastLine
            ? `Python failed to start: ${lastLine}`
            : `Python process exited (code ${code})`;
          this._startupError = msg;
          reject(new Error(msg));
        }

        for (const handler of this._pending.values()) {
          const msg = lastLine
            ? `Python error: ${lastLine}`
            : `Python process exited (code ${code})`;
          handler.reject(new Error(msg));
        }
        this._pending.clear();
      });
    });
  }

  _processLines(onMessage) {
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        // Let caller handle special messages first
        if (onMessage && onMessage(msg)) continue;
        this._handleMessage(msg);
      } catch (e) {
        console.error("[Python] Invalid JSON:", line);
      }
    }
  }

  _handleMessage(msg) {
    if (msg.event === "progress" && msg.data) {
      for (const handler of this._pending.values()) {
        if (handler.onProgress) handler.onProgress(msg.data);
      }
      return;
    }

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
   * Waits for Python to be ready (including auto-install) before sending.
   */
  async send(method, params, onProgress = null) {
    // Wait for init (package check + spawn) to complete
    await this._readyPromise;

    return new Promise((resolve, reject) => {
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
