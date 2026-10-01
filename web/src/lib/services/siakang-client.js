import { spawn } from 'node:child_process';
import path from 'node:path';

// Client for the Python Siakang bridge (server/siakang-sync/run.py).
//
// IMPORTANT - Vercel limitation: a serverless function cannot run a Python
// venv, so this ONLY works when the bridge is hosted separately. Set
// SIAKANG_BRIDGE_URL to an HTTP endpoint exposing the same JSON contract and
// this module POSTs to it instead. When neither is available the Siakang
// routes answer 503 with an actionable message and the rest of the app is
// unaffected.
//
// Contract (unchanged from Laravel):
//   stdin:  { action, email, password, semester? }
//   stdout: { code, message, data }

const RUNNER = 'run.py';

function bridgeUrl() {
  return (process.env.SIAKANG_BRIDGE_URL || '').replace(/\/$/, '');
}

function localScriptPath() {
  // server/ sits next to web/ in this repo.
  return path.resolve(process.cwd(), '..', 'server', 'siakang-sync', RUNNER);
}

function venvPython() {
  // .venv/bin/python on POSIX, .venv/Scripts/python.exe on Windows - the same
  // environment setup `uv sync` produces on both.
  const base = path.resolve(process.cwd(), '..', 'server', 'siakang-sync', '.venv');

  return process.platform === 'win32'
    ? path.join(base, 'Scripts', 'python.exe')
    : path.join(base, 'bin', 'python');
}

/**
 * Run a command against the bridge and decode its JSON response.
 * Throws ApiError-shaped errors with the bridge's own status code.
 */
export async function run(payload, timeoutMs = 60000) {
  if (bridgeUrl()) {
    return runOverHttp(payload, timeoutMs);
  }

  return runLocally(payload, timeoutMs);
}

async function runOverHttp(payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${bridgeUrl()}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const decoded = await response.json();

    if (!decoded || typeof decoded.code !== 'number') {
      throw new Error('Unexpected response from Siakang bridge');
    }

    return decoded;
  } finally {
    clearTimeout(timer);
  }
}

function runLocally(payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const python = process.env.SIAKANG_PYTHON || venvPython();
    const script = localScriptPath();

    // turbopackIgnore: this spawn is a runtime concern (a local Python venv)
    // and must not make the bundler trace the whole repository.
    const child = spawn(/* turbopackIgnore: true */ python, [script], {
      cwd: path.dirname(script),
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGKILL');
        reject(new Error('Siakang bridge timed out.'));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `Siakang bridge is not available (${error.message}). ` +
            'On Vercel, set SIAKANG_BRIDGE_URL to a host running server/siakang-sync.'
        )
      );
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`Siakang sync process failed (exit ${code}): ${stderr || stdout}`));
        return;
      }

      try {
        const decoded = JSON.parse(stdout);

        if (!decoded || typeof decoded.code !== 'number') {
          reject(new Error('Unexpected response from Siakang bridge'));
          return;
        }

        resolve(decoded);
      } catch {
        reject(new Error('Unexpected response from Siakang bridge'));
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export function listSemesters(email, password) {
  return run({ action: 'list_semesters', email, password });
}

export function verify(email, password) {
  return run({ action: 'verify', email, password });
}

export function getGrades(email, password, semester) {
  return run({ action: 'get_grades', email, password, semester });
}

export function getSchedule(email, password, semester) {
  // Laravel gave the schedule bridge a 120s timeout instead of the default 60.
  return run({ action: 'get_schedule', email, password, semester }, 120000);
}

/** True when Siakang features can work in the current environment. */
export function isBridgeConfigured() {
  return Boolean(bridgeUrl()) || process.env.SIAKANG_BRIDGE_ENABLED === 'true';
}
