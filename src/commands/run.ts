import { dashboardIntegrationUrl, loadConfig, saveConfig, type LastScanSummary } from '../config.js';
import { pushSnapshot } from '../api/sublyzer.js';
import type { FailOnLevel } from '../constants.js';
import {
  diffSnapshots,
  loadLastSnapshot,
  saveScanHistory,
} from '../scan/history.js';
import { failOnMessage, shouldFailOnVulns } from '../scan/policy.js';
import {
  buildProjectSnapshot,
  printLocalSummary,
  snapshotToCollectItems,
  type ProjectSnapshot,
} from '../scan/snapshot.js';
import { info, ok, title, warn } from '../utils/log.js';

export type RunOptions = {
  dryRun?: boolean;
  skipAudit?: boolean;
  skipOutdated?: boolean;
  json?: boolean;
  failOn?: FailOnLevel;
};

export type RunResult = {
  success: boolean;
  dryRun: boolean;
  snapshot: ProjectSnapshot;
  eventsSent?: number;
  dashboardUrl?: string;
  diff?: ReturnType<typeof diffSnapshots>;
  policyFailed?: boolean;
};

function applyScanToConfig(
  config: ReturnType<typeof loadConfig>,
  snapshot: ProjectSnapshot,
  eventsSent: number,
): void {
  config.updatedAt = new Date().toISOString();
  config.lastScanAt = snapshot.scannedAt;
  const lastScan: LastScanSummary = {
    scannedAt: snapshot.scannedAt,
    routeCount: snapshot.summary.routeCount,
    dependencyCount: snapshot.dependencyCount,
    vulnerablePackages: snapshot.summary.vulnerablePackages,
    criticalVulns: snapshot.summary.criticalVulns,
    highVulns: snapshot.summary.highVulns,
    eventsSent,
    healthScore: snapshot.health.score,
    healthGrade: snapshot.health.grade,
  };
  config.lastScan = lastScan;
}

export async function runScan(opts: RunOptions = {}): Promise<RunResult> {
  if (!opts.json) title('Sublyzer Snapshot — scan');

  const config = loadConfig();
  const root = config.projectRoot || process.cwd();
  const previous = loadLastSnapshot(root);

  if (!opts.json) info('Scanning project…');
  const snapshot = buildProjectSnapshot(root, {
    skipAudit: opts.skipAudit,
    skipOutdated: opts.skipOutdated,
  });

  const healthDelta = previous
    ? snapshot.health.score - (previous.health?.score ?? previous.summary?.healthScore ?? 0)
    : null;
  const diff = diffSnapshots(previous, snapshot, healthDelta);

  if (!opts.json && previous && (diff.routesAdded.length || diff.vulnDelta.total !== 0 || healthDelta !== 0)) {
    info('Changes since last scan:');
    if (healthDelta != null && healthDelta !== 0) {
      console.log(`    Health: ${healthDelta > 0 ? '+' : ''}${healthDelta} → ${snapshot.health.score}/100`);
    }
    if (diff.vulnDelta.total !== 0) {
      console.log(`    Vulnerabilities: ${diff.vulnDelta.total >= 0 ? '+' : ''}${diff.vulnDelta.total}`);
    }
    if (diff.routesAdded.length) console.log(`    Routes added: ${diff.routesAdded.length}`);
    if (diff.routesRemoved.length) console.log(`    Routes removed: ${diff.routesRemoved.length}`);
    console.log('');
  }

  if (!opts.json) printLocalSummary(snapshot);

  if (opts.failOn && shouldFailOnVulns(snapshot, opts.failOn)) {
    const msg = failOnMessage(snapshot, opts.failOn);
    if (opts.json) {
      return { success: false, dryRun: Boolean(opts.dryRun), snapshot, diff, policyFailed: true };
    }
    throw new Error(msg);
  }

  if (opts.dryRun) {
    if (!opts.json) warn('Dry run — nothing sent to Sublyzer.');
    return { success: true, dryRun: true, snapshot, diff };
  }

  const items = snapshotToCollectItems(snapshot);
  if (!opts.json) info(`Pushing ${items.length} events to ${config.apiUrl}…`);

  const result = await pushSnapshot(config.apiUrl, config.integrationCode, items);

  if (!result.success) {
    throw new Error(result.error || 'Failed to push snapshot');
  }

  const eventsSent = result.processed ?? items.length;
  const dash = dashboardIntegrationUrl(config);

  saveScanHistory(snapshot, root);
  applyScanToConfig(config, snapshot, eventsSent);
  saveConfig(config, root);

  const runResult: RunResult = {
    success: true,
    dryRun: false,
    snapshot,
    eventsSent,
    dashboardUrl: dash,
    diff,
  };

  if (opts.json) return runResult;

  ok(`Sent ${eventsSent} events`);
  console.log(`  Dashboard: ${dash}`);
  console.log('');
  console.log('  Next: sublyzer-snapshot report | compare | pull');
  console.log('');

  return runResult;
}
