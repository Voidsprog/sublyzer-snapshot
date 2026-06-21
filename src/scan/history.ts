import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CONFIG_DIR,
  HISTORY_DIR,
  LAST_SNAPSHOT_FILE,
  MAX_HISTORY_FILES,
} from '../constants.js';
import type { ProjectSnapshot } from './snapshot.js';

function sublyzerDir(root: string): string {
  return path.join(root, CONFIG_DIR);
}

export function lastSnapshotPath(root: string): string {
  return path.join(sublyzerDir(root), LAST_SNAPSHOT_FILE);
}

export function historyDir(root: string): string {
  return path.join(sublyzerDir(root), HISTORY_DIR);
}

export function saveScanHistory(snapshot: ProjectSnapshot, root = process.cwd()): void {
  const dir = sublyzerDir(root);
  fs.mkdirSync(dir, { recursive: true });

  const payload = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(lastSnapshotPath(root), `${payload}\n`, 'utf8');

  const hist = historyDir(root);
  fs.mkdirSync(hist, { recursive: true });
  const stamp = snapshot.scannedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(hist, `${stamp}.json`), `${payload}\n`, 'utf8');

  const files = fs
    .readdirSync(hist)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();

  for (const old of files.slice(MAX_HISTORY_FILES)) {
    try {
      fs.unlinkSync(path.join(hist, old));
    } catch {
      /* ignore */
    }
  }
}

export function loadLastSnapshot(root = process.cwd()): ProjectSnapshot | null {
  const file = lastSnapshotPath(root);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ProjectSnapshot;
  } catch {
    return null;
  }
}

export function loadPreviousSnapshot(root = process.cwd()): ProjectSnapshot | null {
  const hist = historyDir(root);
  if (!fs.existsSync(hist)) return null;
  const files = fs
    .readdirSync(hist)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length < 2) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(hist, files[1]), 'utf8')) as ProjectSnapshot;
  } catch {
    return null;
  }
}

export type SnapshotDiff = {
  routesAdded: string[];
  routesRemoved: string[];
  vulnDelta: { critical: number; high: number; total: number };
  depDelta: number;
  healthDelta: number | null;
  previousAt: string | null;
  currentAt: string;
};

export function diffSnapshots(
  previous: ProjectSnapshot | null,
  current: ProjectSnapshot,
  healthDelta: number | null = null,
): SnapshotDiff {
  const prevRoutes = new Set(previous?.routes || []);
  const curRoutes = new Set(current.routes);

  return {
    routesAdded: current.routes.filter((r) => !prevRoutes.has(r)),
    routesRemoved: (previous?.routes || []).filter((r) => !curRoutes.has(r)),
    vulnDelta: {
      critical: current.summary.criticalVulns - (previous?.summary.criticalVulns ?? 0),
      high: current.summary.highVulns - (previous?.summary.highVulns ?? 0),
      total: current.summary.vulnerablePackages - (previous?.summary.vulnerablePackages ?? 0),
    },
    depDelta: current.dependencyCount - (previous?.dependencyCount ?? 0),
    healthDelta,
    previousAt: previous?.scannedAt ?? null,
    currentAt: current.scannedAt,
  };
}
