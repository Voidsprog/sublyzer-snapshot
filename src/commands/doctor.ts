import { spawnSync } from 'node:child_process';
import { configExists, isCloudConfig, loadConfig, resolveReadKey } from '../config.js';
import { fetchPublicSnapshot, validateIntegrationCode } from '../api/sublyzer.js';
import { resolveScanTarget } from '../detect/scan-target.js';
import { info, ok, title, warn } from '../utils/log.js';

export type DoctorOptions = { json?: boolean };

export type DoctorCheck = {
  name: string;
  ok: boolean;
  message: string;
};

export async function runDoctor(opts: DoctorOptions = {}): Promise<{ ok: boolean; checks: DoctorCheck[] }> {
  const checks: DoctorCheck[] = [];

  if (!configExists()) {
    checks.push({
      name: 'config',
      ok: true,
      message: 'No config — `scan` works standalone; run `init --local` to save prefs',
    });
  } else {
    checks.push({ name: 'config', ok: true, message: 'Config file found' });
  }

  let config;
  try {
    config = configExists() ? loadConfig() : null;
  } catch (e: any) {
    checks.push({ name: 'config-parse', ok: false, message: e?.message || 'Invalid config' });
  }

  const nodeMajor = parseInt(process.versions.node.split('.')[0] || '0', 10);
  checks.push({
    name: 'node',
    ok: nodeMajor >= 18,
    message: nodeMajor >= 18 ? `Node ${process.versions.node}` : `Node ${process.versions.node} — require 18+`,
  });

  const npm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], { encoding: 'utf8' });
  checks.push({
    name: 'npm',
    ok: true,
    message: npm.status === 0 ? `npm ${(npm.stdout || '').trim()}` : 'npm not found — audit skipped unless in package dir',
  });

  const target = resolveScanTarget(config?.configRoot || process.cwd(), config?.scanRoot);
  checks.push({
    name: 'scan-target',
    ok: target.stack.id !== 'unknown',
    message: `${target.stack.label} @ ${target.root} (${target.reason})`,
  });

  if (config) {
    checks.push({
      name: 'mode',
      ok: true,
      message: config.mode === 'cloud' ? 'cloud (push enabled)' : 'local (no cloud required)',
    });

    if (isCloudConfig(config)) {
      try {
        const validation = await validateIntegrationCode(config.apiUrl!, config.integrationCode!);
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
          const pull = await fetchPublicSnapshot(config.apiUrl!, config.integrationCode!, readKey, {
            limit: 1,
            include: ['stats'],
          });
          checks.push({
            name: 'read-key',
            ok: pull.ok,
            message: pull.ok ? 'Read key valid' : pull.error || `HTTP ${pull.status}`,
          });
        } catch (e: any) {
          checks.push({ name: 'read-key', ok: false, message: e?.message || 'Read key check failed' });
        }
      } else {
        checks.push({ name: 'read-key', ok: true, message: 'Not set (optional)' });
      }
    }
  }

  const allOk = checks.every((c) => c.ok);

  if (opts.json) return { ok: allOk, checks };

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
