import { spawnSync } from 'node:child_process';

export type OutdatedSummary = {
  ran: boolean;
  total: number;
  majorCount: number;
  packages: { name: string; current: string; wanted: string; latest: string; kind: 'major' | 'minor' | 'patch' }[];
  error?: string;
};

function classify(current: string, latest: string): 'major' | 'minor' | 'patch' {
  const c = current.replace(/^[\^~]/, '').split('.').map(Number);
  const l = latest.replace(/^[\^~]/, '').split('.').map(Number);
  if (l[0] > (c[0] || 0)) return 'major';
  if (l[1] > (c[1] || 0)) return 'minor';
  return 'patch';
}

export function runNpmOutdated(root = process.cwd()): OutdatedSummary {
  const empty: OutdatedSummary = { ran: false, total: 0, majorCount: 0, packages: [] };

  const res = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['outdated', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 5 * 1024 * 1024,
  });

  const stdout = (res.stdout || '').trim();
  if (!stdout) {
    if (res.status === 0) return { ...empty, ran: true, total: 0, majorCount: 0 };
    return { ...empty, error: res.stderr?.slice(0, 120) || 'npm outdated failed' };
  }

  let parsed: Record<string, { current?: string; wanted?: string; latest?: string }>;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { ...empty, error: 'Failed to parse npm outdated JSON' };
  }

  const packages: OutdatedSummary['packages'] = [];
  let majorCount = 0;

  for (const [name, info] of Object.entries(parsed)) {
    const current = String(info.current || '');
    const latest = String(info.latest || '');
    const wanted = String(info.wanted || latest);
    const kind = classify(current, latest);
    if (kind === 'major') majorCount += 1;
    packages.push({ name, current, wanted, latest, kind });
  }

  packages.sort((a, b) => {
    const rank = { major: 0, minor: 1, patch: 2 };
    return rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name);
  });

  return {
    ran: true,
    total: packages.length,
    majorCount,
    packages: packages.slice(0, 30),
  };
}
