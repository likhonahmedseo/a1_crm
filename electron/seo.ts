import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { shell } from 'electron';

let proc: ChildProcess | null = null;
const SEO_URL = 'http://127.0.0.1:5000';

function defaultSeoPath() {
  // Sibling folder to A1 CRM
  return path.resolve(process.cwd(), '..', 'A1 SEO Dynamics');
}

function ping(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(SEO_URL, { timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function seoStatus(seoPath?: string): Promise<{
  installed: boolean;
  running: boolean;
  url: string;
  path: string;
}> {
  const p = seoPath || defaultSeoPath();
  const installed = fs.existsSync(path.join(p, 'start_app.bat'));
  const running = await ping();
  return { installed, running, url: SEO_URL, path: p };
}

export async function seoLaunch(seoPath?: string): Promise<{ ok: boolean; error?: string; url: string }> {
  const p = seoPath || defaultSeoPath();
  const bat = path.join(p, 'start_app.bat');

  if (!fs.existsSync(bat)) {
    return { ok: false, error: `start_app.bat not found at: ${bat}`, url: SEO_URL };
  }

  // Already running?
  if (await ping()) return { ok: true, url: SEO_URL };

  if (proc && !proc.killed) {
    return { ok: true, url: SEO_URL };
  }

  // Launch via cmd in a separate window so user can see logs / close it
  proc = spawn('cmd.exe', ['/c', 'start', '""', '/D', p, 'cmd', '/k', bat], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  proc.unref();

  // Wait up to ~60s for the server to come up
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    if (await ping()) return { ok: true, url: SEO_URL };
  }
  return { ok: false, error: 'Server did not start within 60s. Check the SEO Dynamics window.', url: SEO_URL };
}

export function seoOpenInBrowser() {
  shell.openExternal(SEO_URL);
}
