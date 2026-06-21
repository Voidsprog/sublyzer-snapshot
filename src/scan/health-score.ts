import type { ProjectSnapshot } from './snapshot.js';

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type HealthScore = {
  score: number;
  grade: HealthGrade;
  factors: { label: string; impact: number }[];
};

function gradeFromScore(score: number): HealthGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function computeHealthScore(snapshot: ProjectSnapshot): HealthScore {
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

  if (snapshot.workspaces?.packages && snapshot.workspaces.packages.length > 1) {
    factors.push({ label: `Monorepo (${snapshot.workspaces.packages.length} packages)`, impact: 0 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, grade: gradeFromScore(score), factors };
}

export function formatHealthBar(score: number): string {
  const filled = Math.round(score / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `[${bar}] ${score}/100`;
}
