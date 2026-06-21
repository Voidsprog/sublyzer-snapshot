import type { BenchmarkResult } from './types.js';
import type { ProjectSnapshot } from '../scan/snapshot.js';

type RefProfile = {
  health: number;
  routes: number;
  deps: number;
  bundleMb: number;
  vulns: number;
};

const REFERENCE: Record<string, RefProfile> = {
  nextjs: { health: 78, routes: 35, deps: 40, bundleMb: 120, vulns: 3 },
  nestjs: { health: 82, routes: 50, deps: 35, bundleMb: 15, vulns: 2 },
  express: { health: 75, routes: 25, deps: 20, bundleMb: 5, vulns: 4 },
  react: { health: 76, routes: 15, deps: 30, bundleMb: 8, vulns: 3 },
  node: { health: 80, routes: 10, deps: 15, bundleMb: 2, vulns: 2 },
  python: { health: 77, routes: 0, deps: 25, bundleMb: 0, vulns: 1 },
  go: { health: 84, routes: 0, deps: 10, bundleMb: 20, vulns: 0 },
};

function sizeTier(routes: number, deps: number): BenchmarkResult['sizeTier'] {
  const score = routes + deps;
  if (score < 30) return 'small';
  if (score < 80) return 'medium';
  return 'large';
}

function percentileFromRatio(ratio: number): number {
  // ratio > 1 = better than median
  const p = 50 + Math.log2(Math.max(0.25, Math.min(4, ratio))) * 25;
  return Math.max(5, Math.min(95, Math.round(p)));
}

export function computeBenchmark(snapshot: ProjectSnapshot): BenchmarkResult {
  const stack = snapshot.stack.id;
  const ref = REFERENCE[stack] || REFERENCE.node;
  const s = snapshot.summary;
  const tier = sizeTier(s.routeCount, snapshot.dependencyCount);

  const healthRatio = snapshot.health.score / ref.health;
  const routeRatio = ref.routes > 0 ? Math.min(2, s.routeCount / ref.routes) : 1;
  const depRatio = ref.deps > 0 ? ref.deps / Math.max(1, snapshot.dependencyCount) : 1;
  const bundleRatio =
    ref.bundleMb > 0 && s.bundleMb > 0 ? ref.bundleMb / s.bundleMb : snapshot.health.score >= ref.health ? 1.1 : 0.9;
  const vulnRatio = ref.vulns > 0 ? ref.vulns / Math.max(1, s.vulnerablePackages) : s.vulnerablePackages === 0 ? 1.2 : 0.7;

  const composite = (healthRatio * 0.4 + depRatio * 0.15 + bundleRatio * 0.15 + vulnRatio * 0.2 + routeRatio * 0.1);
  const percentile = percentileFromRatio(composite);

  const stackLabel = snapshot.stack.label;
  const label =
    percentile >= 70
      ? `Your project is in the top ${100 - percentile}% of ${stackLabel} apps of similar size`
      : percentile >= 40
        ? `Your project is around the median for ${stackLabel} apps of similar size`
        : `Your project is below average for ${stackLabel} apps of similar size — room to improve`;

  return {
    stack,
    sizeTier: tier,
    percentile,
    label,
    metrics: [
      { name: 'Health score', yours: snapshot.health.score, median: ref.health, unit: 'pts', better: 'higher' },
      { name: 'Routes', yours: s.routeCount, median: ref.routes, unit: '', better: 'higher' },
      { name: 'Dependencies', yours: snapshot.dependencyCount, median: ref.deps, unit: '', better: 'lower' },
      { name: 'Build size', yours: s.bundleMb, median: ref.bundleMb, unit: 'MB', better: 'lower' },
      { name: 'Vulnerabilities', yours: s.vulnerablePackages, median: ref.vulns, unit: '', better: 'lower' },
    ],
  };
}
