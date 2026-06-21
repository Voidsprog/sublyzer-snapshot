import {
  dashboardIntegrationUrl,
  isCloudConfig,
  loadConfig,
  saveConfig,
  tryLoadConfig,
  type LastScanSummary,
  type SnapshotConfig,
} from '../config.js';
import { resolveScanTarget } from '../detect/scan-target.js';
import { pushSnapshot } from '../api/sublyzer.js';
import type { FailOnLevel } from '../constants.js';
import { diffSnapshots, loadLastSnapshot, saveScanHistory } from './history.js';
import { failOnMessage, shouldFailOnVulns } from './policy.js';
import {
  buildProjectSnapshot,
  printLocalSummary,
  snapshotToCollectItems,
  type ProjectSnapshot,
} from './snapshot.js';
import { info, ok, warn } from '../utils/log.js';

export type ExecuteScanOptions = {
  path?: string;
  skipAudit?: boolean;
  skipOutdated?: boolean;
  skipBundle?: boolean;
  skipDeep?: boolean;
  dryRun?: boolean;
  push?: boolean;
  json?: boolean;
  failOn?: FailOnLevel;
  configAnchor?: string;
};

export type ExecuteScanResult = {
  success: boolean;
  localOnly: boolean;
  pushed: boolean;
  dryRun: boolean;
  snapshot: ProjectSnapshot;
  eventsSent?: number;
  dashboardUrl?: string | null;
  diff?: ReturnType<typeof diffSnapshots>;
  policyFailed?: boolean;
  scanTargetReason: string;
};

function applyScanToConfig(config: SnapshotConfig, snapshot: ProjectSnapshot, eventsSent: number, pushed: boolean): void {
  config.updatedAt = new Date().toISOString();
  config.lastScanAt = snapshot.scannedAt;
  config.scanRoot = snapshot.scanRoot;
  config.stack = snapshot.stack.id;
  const lastScan: LastScanSummary = {
    scannedAt: snapshot.scannedAt,
    scanRoot: snapshot.scanRoot,
    routeCount: snapshot.summary.routeCount,
    dependencyCount: snapshot.dependencyCount,
    vulnerablePackages: snapshot.summary.vulnerablePackages,
    criticalVulns: snapshot.summary.criticalVulns,
    highVulns: snapshot.summary.highVulns,
    eventsSent,
    healthScore: snapshot.health.score,
    healthGrade: snapshot.health.grade,
    pushedToCloud: pushed,
  };
  config.lastScan = lastScan;
}

export async function executeScan(opts: ExecuteScanOptions = {}): Promise<ExecuteScanResult> {
  const anchor = opts.configAnchor || process.cwd();
  const config = tryLoadConfig(anchor);
  const target = resolveScanTarget(anchor, opts.path);

  if (!opts.json && target.reason.startsWith('auto-selected')) {
    info(`Scan target: ${target.root} (${target.reason})`);
  }

  const previous = loadLastSnapshot(anchor);
  const snapshot = await buildProjectSnapshot(anchor, {
    skipAudit: opts.skipAudit,
    skipOutdated: opts.skipOutdated,
    skipBundle: opts.skipBundle,
    skipDeep: opts.skipDeep,
    target,
    configAnchor: anchor,
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
      return {
        success: false,
        localOnly: true,
        pushed: false,
        dryRun: Boolean(opts.dryRun),
        snapshot,
        diff,
        policyFailed: true,
        scanTargetReason: target.reason,
      };
    }
    throw new Error(msg);
  }

  saveScanHistory(snapshot, anchor);

  const wantPush = opts.push ?? (config ? isCloudConfig(config) : false);
  const canPush = config && isCloudConfig(config) && config.integrationCode && config.apiUrl;

  if (opts.dryRun || !wantPush || !canPush) {
    if (config) {
      applyScanToConfig(config, snapshot, 0, false);
      saveConfig(config, anchor);
    }
    if (!opts.json && !opts.dryRun && !canPush && wantPush) {
      warn('Cloud sync skipped — run: sublyzer-snapshot init --code YOUR_CODE');
    } else if (!opts.json && opts.dryRun) {
      warn('Dry run — scan saved locally, nothing pushed.');
    } else if (!opts.json && !wantPush) {
      info('Local-only scan saved to .sublyzer/');
      info('Optional cloud sync: npx sublyzer-snapshot init --code YOUR_CODE  then  run --push');
    }
    return {
      success: true,
      localOnly: !canPush || !wantPush,
      pushed: false,
      dryRun: Boolean(opts.dryRun),
      snapshot,
      diff,
      scanTargetReason: target.reason,
    };
  }

  const items = snapshotToCollectItems(snapshot);
  if (!opts.json) info(`Pushing ${items.length} events to ${config!.apiUrl}…`);

  const result = await pushSnapshot(config!.apiUrl!, config!.integrationCode!, items);
  if (!result.success) {
    throw new Error(result.error || 'Failed to push snapshot');
  }

  const eventsSent = result.processed ?? items.length;
  const dash = dashboardIntegrationUrl(config!);

  applyScanToConfig(config!, snapshot, eventsSent, true);
  saveConfig(config!, anchor);

  if (!opts.json) {
    ok(`Sent ${eventsSent} events`);
    if (dash) console.log(`  Dashboard: ${dash}`);
    console.log('');
  }

  return {
    success: true,
    localOnly: false,
    pushed: true,
    dryRun: false,
    snapshot,
    eventsSent,
    dashboardUrl: dash,
    diff,
    scanTargetReason: target.reason,
  };
}
