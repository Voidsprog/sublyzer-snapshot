import { spawnSync } from 'node:child_process';

export type AuditSummary = {
  ran: boolean;
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  advisories: { name: string; severity: string; title: string }[];
  error?: string;
};

export function runNpmAudit(root = process.cwd()): AuditSummary {
  const empty: AuditSummary = {
    ran: false,
    total: 0,
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    advisories: [],
  };

  const res = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  const stdout = res.stdout || '';
  if (!stdout.trim()) {
    return { ...empty, error: res.stderr?.slice(0, 200) || 'npm audit produced no output' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { ...empty, error: 'Failed to parse npm audit JSON' };
  }

  const meta = parsed.metadata?.vulnerabilities || {};
  const advisories: AuditSummary['advisories'] = [];

  const vulns = parsed.vulnerabilities || parsed.advisories || {};
  if (typeof vulns === 'object') {
    for (const [name, entry] of Object.entries(vulns as Record<string, any>)) {
      const severity = String(entry?.severity || entry?.via?.[0]?.severity || 'unknown').toLowerCase();
      const title = String(entry?.via?.[0]?.title || entry?.title || name).slice(0, 200);
      advisories.push({ name, severity, title });
    }
  }

  advisories.sort((a, b) => {
    const rank = (s: string) => ({ critical: 0, high: 1, moderate: 2, low: 3 }[s] ?? 4);
    return rank(a.severity) - rank(b.severity);
  });

  return {
    ran: true,
    total: Number(meta.total ?? advisories.length) || advisories.length,
    critical: Number(meta.critical ?? 0),
    high: Number(meta.high ?? 0),
    moderate: Number(meta.moderate ?? 0),
    low: Number(meta.low ?? 0),
    advisories: advisories.slice(0, 25),
  };
}
