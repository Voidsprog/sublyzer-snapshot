import { loadConfig } from '../config.js';
import {
  diffSnapshots,
  loadLastSnapshot,
  loadPreviousSnapshot,
} from '../scan/history.js';
import { buildProjectSnapshot } from '../scan/snapshot.js';
import { info, title } from '../utils/log.js';

export type CompareOptions = {
  json?: boolean;
  rescan?: boolean;
  skipAudit?: boolean;
};

export async function runCompare(opts: CompareOptions = {}): Promise<Record<string, unknown>> {
  const config = loadConfig();
  const root = config.projectRoot || process.cwd();

  const previous = loadPreviousSnapshot(root) || loadLastSnapshot(root);
  const current = opts.rescan
    ? buildProjectSnapshot(root, { skipAudit: opts.skipAudit })
    : loadLastSnapshot(root);

  if (!current) {
    throw new Error('No scan data. Run: sublyzer-snapshot run');
  }
  if (!previous || previous.scannedAt === current.scannedAt) {
    throw new Error('Need at least two scans to compare. Run `sublyzer-snapshot run` again.');
  }

  const healthDelta =
    (current.health?.score ?? current.summary.healthScore) -
    (previous.health?.score ?? previous.summary?.healthScore ?? 0);

  const diff = diffSnapshots(previous, current, healthDelta);

  const payload = {
    previous: {
      scannedAt: previous.scannedAt,
      healthScore: previous.health?.score ?? previous.summary?.healthScore,
      routes: previous.summary.routeCount,
      vulnerabilities: previous.summary.vulnerablePackages,
    },
    current: {
      scannedAt: current.scannedAt,
      healthScore: current.health?.score ?? current.summary.healthScore,
      routes: current.summary.routeCount,
      vulnerabilities: current.summary.vulnerablePackages,
    },
    diff,
  };

  if (opts.json) return payload;

  title('Sublyzer Snapshot — compare');
  info(`Previous: ${previous.scannedAt} → health ${previous.health?.score ?? '?'}/100`);
  info(`Current:  ${current.scannedAt} → health ${current.health?.score ?? '?'}/100`);
  console.log('');

  if (healthDelta !== 0) {
    console.log(`  Health score:  ${healthDelta > 0 ? '+' : ''}${healthDelta}`);
  }
  console.log(`  Vulnerabilities: ${diff.vulnDelta.total >= 0 ? '+' : ''}${diff.vulnDelta.total} (C:${diff.vulnDelta.critical >= 0 ? '+' : ''}${diff.vulnDelta.critical} H:${diff.vulnDelta.high >= 0 ? '+' : ''}${diff.vulnDelta.high})`);
  console.log(`  Dependencies:  ${diff.depDelta >= 0 ? '+' : ''}${diff.depDelta}`);

  if (diff.routesAdded.length) {
    console.log(`  Routes added (${diff.routesAdded.length}):`);
    for (const r of diff.routesAdded.slice(0, 12)) console.log(`    + ${r}`);
  }
  if (diff.routesRemoved.length) {
    console.log(`  Routes removed (${diff.routesRemoved.length}):`);
    for (const r of diff.routesRemoved.slice(0, 12)) console.log(`    - ${r}`);
  }
  console.log('');

  return payload;
}
