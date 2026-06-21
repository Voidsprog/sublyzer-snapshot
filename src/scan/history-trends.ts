import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_DIR, HISTORY_DIR } from '../constants.js';
import type { ProjectSnapshot } from '../scan/snapshot.js';

export type TrendPoint = {
  at: string;
  health: number;
  grade: string;
  routes: number;
  vulns: number;
  bundleMb: number;
};

export function loadScanTrends(anchor: string, limit = 20): TrendPoint[] {
  const hist = path.join(anchor, CONFIG_DIR, HISTORY_DIR);
  if (!fs.existsSync(hist)) {
    const last = path.join(anchor, CONFIG_DIR, 'last-snapshot.json');
    if (!fs.existsSync(last)) return [];
    try {
      const s = JSON.parse(fs.readFileSync(last, 'utf8')) as ProjectSnapshot;
      return [snapshotToTrend(s)];
    } catch {
      return [];
    }
  }

  const files = fs
    .readdirSync(hist)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .slice(-limit);

  const points: TrendPoint[] = [];
  for (const f of files) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(hist, f), 'utf8')) as ProjectSnapshot;
      points.push(snapshotToTrend(s));
    } catch {
      /* skip */
    }
  }
  return points;
}

function snapshotToTrend(s: ProjectSnapshot): TrendPoint {
  return {
    at: s.scannedAt,
    health: s.health?.score ?? s.summary.healthScore,
    grade: s.health?.grade ?? s.summary.healthGrade,
    routes: s.summary.routeCount,
    vulns: s.summary.vulnerablePackages,
    bundleMb: s.summary.bundleMb,
  };
}

export function trendDelta(trends: TrendPoint[]): { health: number; label: string } | null {
  if (trends.length < 2) return null;
  const first = trends[0];
  const last = trends[trends.length - 1];
  const delta = last.health - first.health;
  const label =
    delta > 0
      ? `+${delta} pts since first scan`
      : delta < 0
        ? `${delta} pts since first scan`
        : 'Stable since first scan';
  return { health: delta, label };
}
