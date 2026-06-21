import { spawnSync } from 'node:child_process';
import { configExists, loadConfig, resolveReadKey } from '../config.js';
import { fetchPublicSnapshot, validateIntegrationCode } from '../api/sublyzer.js';
import { detectStack } from '../detect/stack.js';
import { info, ok, title, warn } from '../utils/log.js';

export type DoctorOptions = { json?: boolean };

export type DoctorCheck = {
  name: string;
  ok: boolean;
  message: string;
};

export async function runDoctor(opts: DoctorOptions = {}): Promise<{ ok: boolean; checks: DoctorCheck[] }> {
  const checks: DoctorCheck[] = [];

  // Config
  if (!configExists()) {
    checks.push({ name: 'config', ok: false, message: 'Missing .sublyzer/snapshot.json — run init' });
  } else {
    checks.push({ name: 'config', ok: true, message: 'Config file found' });
  }

  let config;
  try {
    config = loadConfig();
  } catch (e: any) {
    checks.push({ name: 'config-parse', ok: false, message: e?.message || 'Invalid config' });
  }

  // Node version
  const nodeMajor = parseInt(process.versions.node.split('.')[0] || '0', 10);
  checks.push({
    name: 'node',
    ok: nodeMajor >= 18,
    message: nodeMajor >= 18 ? `Node ${process.versions.node}` : `Node ${process.versions.node} — require 18+`,
  });

  // npm
  const npm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], { encoding: 'utf8' });
  checks.push({
    name: 'npm',
    ok: true,
    message: npm.status === 0 ? `npm ${(npm.stdout || '').trim()}` : 'npm not found — audit will be skipped on run',
  });

  // Stack
  const stack = detectStack(config?.projectRoot || process.cwd());
  checks.push({
    name: 'stack',
    ok: stack.id !== 'unknown',
    message: stack.id !== 'unknown' ? `${stack.label} (${stack.confidence})` : 'Could not detect stack',
  });

  if (config) {
    try {
      const validation = await validateIntegrationCode(config.apiUrl, config.integrationCode);
      checks.push({
        name: 'integration',
        ok: Boolean(validation.valid),
        message: validation.valid
          ? `${validation.integration?.name} (${validation.integration?.status})`
          : validation.message || 'Invalid integration code',
      });
    } catch (e: any) {
      checks.push({ name: 'integration', ok: false, message: e?.message || 'API unreachable' });
    }

    const readKey = resolveReadKey(config);
    if (readKey) {
      try {
        const pull = await fetchPublicSnapshot(config.apiUrl, config.integrationCode, readKey, {
          limit: 1,
          include: ['stats'],
        });
        checks.push({
          name: 'read-key',
          ok: pull.ok,
          message: pull.ok ? 'Read key valid — pull enabled' : pull.error || `HTTP ${pull.status}`,
        });
      } catch (e: any) {
        checks.push({ name: 'read-key', ok: false, message: e?.message || 'Read key check failed' });
      }
    } else {
      checks.push({
        name: 'read-key',
        ok: true,
        message: 'Not configured (optional — enables pull)',
      });
    }
  }

  const allOk = checks.every((c) => c.ok);

  if (opts.json) {
    return { ok: allOk, checks };
  }

  title('Sublyzer Snapshot — doctor');
  for (const c of checks) {
    if (c.ok) ok(`${c.name}: ${c.message}`);
    else warn(`${c.name}: ${c.message}`);
  }
  console.log('');
  if (allOk) ok('All required checks passed');
  else info('Fix issues above, then re-run doctor');

  return { ok: allOk, checks };
}
