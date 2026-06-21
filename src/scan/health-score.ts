import type { ProjectAnalysis } from '../analyze/types.js';
import type { ProjectSnapshot } from './snapshot.js';

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type HealthScore = {
  score: number;
  grade: HealthGrade;
  factors: { label: string; impact: number }[];
  trend?: { delta: number; label: string } | null;
};

function gradeFromScore(score: number): HealthGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function computeHealthScore(
  snapshot: ProjectSnapshot,
  analysis?: ProjectAnalysis | null,
  trendDelta?: number | null,
): HealthScore {
  let score = 100;
  const factors: HealthScore['factors'] = [];
  const s = snapshot.summary;

  if (s.criticalVulns > 0) {
    const impact = Math.min(50, s.criticalVulns * 25);
    score -= impact;
    factors.push({ label: `${s.criticalVulns} critical CVE(s)`, impact: -impact });
  }
  if (s.highVulns > 0) {
    const impact = Math.min(30, s.highVulns * 10);
    score -= impact;
    factors.push({ label: `${s.highVulns} high CVE(s)`, impact: -impact });
  }
  if (snapshot.audit.moderate > 0) {
    const impact = Math.min(15, snapshot.audit.moderate * 3);
    score -= impact;
    factors.push({ label: `${snapshot.audit.moderate} moderate CVE(s)`, impact: -impact });
  }

  const webStacks = new Set(['nextjs', 'nestjs', 'express', 'fastify', 'remix', 'nuxt', 'sveltekit', 'react']);
  if (webStacks.has(snapshot.stack.id) && s.routeCount === 0) {
    score -= 8;
    factors.push({ label: 'No routes detected', impact: -8 });
  }

  if (snapshot.git.available && snapshot.git.dirty) {
    score -= 3;
    factors.push({ label: 'Uncommitted changes (dirty git)', impact: -3 });
  }

  if (snapshot.env.found.length === 0 && snapshot.dependencyCount > 0) {
    score -= 2;
    factors.push({ label: 'No .env.example found', impact: -2 });
  }

  if (snapshot.outdated?.majorCount && snapshot.outdated.majorCount > 0) {
    const impact = Math.min(12, snapshot.outdated.majorCount * 3);
    score -= impact;
    factors.push({ label: `${snapshot.outdated.majorCount} major outdated package(s)`, impact: -impact });
  }

  if (analysis?.ran) {
    const highIssues = analysis.issues.filter((i) => i.severity === 'high').length;
    const warnIssues = analysis.issues.filter((i) => i.severity === 'warning').length;
    if (highIssues > 0) {
      const impact = Math.min(15, highIssues * 4);
      score -= impact;
      factors.push({ label: `${highIssues} high-severity code issue(s)`, impact: -impact });
    }
    if (warnIssues > 3) {
      const impact = Math.min(10, (warnIssues - 3) * 2);
      score -= impact;
      factors.push({ label: `${warnIssues} code warnings`, impact: -impact });
    }
    if (analysis.unusedDeps.length > 5) {
      const impact = Math.min(8, (analysis.unusedDeps.length - 5) * 2);
      score -= impact;
      factors.push({ label: `${analysis.unusedDeps.length} possibly unused dependencies`, impact: -impact });
    }
    if (analysis.nextjs && analysis.nextjs.clientRatio > 70) {
      score -= 5;
      factors.push({ label: `High client component ratio (${analysis.nextjs.clientRatio}%)`, impact: -5 });
    }
    if (analysis.benchmarks && analysis.benchmarks.percentile >= 75) {
      factors.push({ label: `Top ${100 - analysis.benchmarks.percentile}% vs similar ${snapshot.stack.label} apps`, impact: 0 });
    }
  }

  if (snapshot.workspaces?.packages && snapshot.workspaces.packages.length > 1) {
    factors.push({ label: `Monorepo (${snapshot.workspaces.packages.length} packages)`, impact: 0 });
  }

  if (trendDelta != null && trendDelta > 0) {
    factors.push({ label: `Improving trend (+${trendDelta} pts)`, impact: 0 });
  } else if (trendDelta != null && trendDelta < 0) {
    const impact = Math.min(5, Math.abs(trendDelta));
    score -= impact;
    factors.push({ label: `Declining trend (${trendDelta} pts)`, impact: -impact });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    grade: gradeFromScore(score),
    factors,
    trend:
      trendDelta != null
        ? {
            delta: trendDelta,
            label:
              trendDelta > 0
                ? `+${trendDelta} since first recorded scan`
                : trendDelta < 0
                  ? `${trendDelta} since first recorded scan`
                  : 'Stable',
          }
        : null,
  };
}

export function formatHealthBar(score: number): string {
  const filled = Math.round(score / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `[${bar}] ${score}/100`;
}
