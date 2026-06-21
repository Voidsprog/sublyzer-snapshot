import type { SnapshotDiff } from '../scan/history.js';
import type { TrendPoint } from '../scan/history-trends.js';
import { computeHealthScore, type HealthScore } from '../scan/health-score.js';
import type { ProjectSnapshot } from '../scan/snapshot.js';
import { renderBadgeMarkdown } from './badge.js';

export function renderMarkdownReport(
  snapshot: ProjectSnapshot,
  health: HealthScore,
  diff?: SnapshotDiff | null,
  dashboardUrl?: string | null,
  trends?: TrendPoint[],
): string {
  const lines: string[] = [];
  const s = snapshot.summary;
  const a = snapshot.analysis;

  lines.push(`# Sublyzer Snapshot — ${snapshot.projectName}`);
  lines.push('');
  lines.push(renderBadgeMarkdown(health));
  lines.push('');
  lines.push(`**Generated:** ${snapshot.scannedAt}  `);
  lines.push(`**Stack:** ${snapshot.stack.label}  `);
  if (snapshot.scanRoot) lines.push(`**Scan root:** \`${snapshot.scanRoot}\`  `);
  lines.push(`**Health:** ${health.score}/100 (grade ${health.grade})  `);
  if (health.trend) lines.push(`**Trend:** ${health.trend.label}  `);
  if (dashboardUrl) lines.push(`**Dashboard:** ${dashboardUrl}  `);
  lines.push('');

  if (a?.benchmarks) {
    lines.push('## Benchmark');
    lines.push('');
    lines.push(`> ${a.benchmarks.label}`);
    lines.push('');
    lines.push(`Percentile: **${a.benchmarks.percentile}** · Size tier: ${a.benchmarks.sizeTier}`);
    lines.push('');
    lines.push('| Metric | Yours | Median |');
    lines.push('|--------|-------|--------|');
    for (const m of a.benchmarks.metrics) {
      lines.push(`| ${m.name} | ${m.yours}${m.unit ? ' ' + m.unit : ''} | ${m.median}${m.unit ? ' ' + m.unit : ''} |`);
    }
    lines.push('');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Routes | ${s.routeCount} |`);
  lines.push(`| Dependencies | ${s.productionDeps} prod / ${s.devDeps} dev |`);
  lines.push(`| Vulnerabilities | ${s.vulnerablePackages} (C:${s.criticalVulns} H:${s.highVulns}) |`);
  if (snapshot.outdated?.ran) {
    lines.push(`| Outdated packages | ${snapshot.outdated.total} (${snapshot.outdated.majorCount} major) |`);
  }
  if (snapshot.bundle?.scanned) {
    lines.push(`| Build output | ${snapshot.bundle.totalMb} MB |`);
  }
  if (s.issueCount != null) {
    lines.push(`| Code issues | ${s.issueCount} |`);
  }
  if (snapshot.git.available) {
    lines.push(`| Git | \`${snapshot.git.branch}@${snapshot.git.commit}\`${snapshot.git.dirty ? ' *(dirty)*' : ''} |`);
  }
  lines.push('');

  if (trends && trends.length > 1) {
    lines.push('## Health history');
    lines.push('');
    lines.push('| Scan | Score | Grade | Routes | Vulns |');
    lines.push('|------|-------|-------|--------|-------|');
    for (const t of trends.slice(-10)) {
      const date = t.at.slice(0, 19).replace('T', ' ');
      lines.push(`| ${date} | ${t.health} | ${t.grade} | ${t.routes} | ${t.vulns} |`);
    }
    lines.push('');
  }

  if (health.factors.length) {
    lines.push('## Health factors');
    lines.push('');
    for (const f of health.factors) {
      const sign = f.impact >= 0 ? '+' : '';
      lines.push(`- ${f.label} (${sign}${f.impact})`);
    }
    lines.push('');
  }

  if (diff && diff.previousAt) {
    lines.push('## Changes since last scan');
    lines.push('');
    lines.push(`Previous scan: ${diff.previousAt}`);
    lines.push('');
    if (diff.healthDelta != null) {
      const arrow = diff.healthDelta >= 0 ? '↑' : '↓';
      lines.push(`- Health score: ${arrow} ${Math.abs(diff.healthDelta)} points`);
    }
    if (diff.vulnDelta.total !== 0) {
      lines.push(`- Vulnerabilities: ${diff.vulnDelta.total >= 0 ? '+' : ''}${diff.vulnDelta.total}`);
    }
    if (diff.routesAdded.length) {
      lines.push(`- Routes added (${diff.routesAdded.length}): ${diff.routesAdded.slice(0, 10).join(', ')}`);
    }
    if (diff.routesRemoved.length) {
      lines.push(`- Routes removed (${diff.routesRemoved.length}): ${diff.routesRemoved.slice(0, 10).join(', ')}`);
    }
    lines.push('');
  }

  if (a?.nextjs) {
    lines.push('## Next.js analysis');
    lines.push('');
    lines.push(`- Client components: ${a.nextjs.clientComponents}`);
    lines.push(`- Server candidates: ${a.nextjs.serverCandidates}`);
    lines.push(`- Client ratio: ${a.nextjs.clientRatio}%`);
    if (a.nextjs.missingUseClient.length) {
      lines.push(`- Missing \`use client\`: ${a.nextjs.missingUseClient.slice(0, 5).join(', ')}`);
    }
    lines.push('');
  }

  if (a?.issues?.length) {
    lines.push('## Top issues');
    lines.push('');
    lines.push('| Severity | Category | Issue | File |');
    lines.push('|----------|----------|-------|------|');
    for (const i of a.issues.slice(0, 15)) {
      lines.push(`| ${i.severity} | ${i.category} | ${i.message.replace(/\|/g, '/')} | ${i.file || '—'} |`);
    }
    lines.push('');
  }

  if (a?.complexity?.length) {
    lines.push('## Complexity hotspots');
    lines.push('');
    lines.push('| File | Lines | Complexity |');
    lines.push('|------|-------|------------|');
    for (const c of a.complexity.slice(0, 8)) {
      lines.push(`| \`${c.file}\` | ${c.lines} | ${c.complexity} |`);
    }
    lines.push('');
  }

  if (a?.unusedDeps?.length) {
    lines.push('## Possibly unused dependencies');
    lines.push('');
    for (const u of a.unusedDeps.slice(0, 12)) {
      lines.push(`- \`${u.name}\` ${u.version}${u.dev ? ' *(dev)*' : ''}`);
    }
    lines.push('');
  }

  if (snapshot.audit.findings?.length) {
    lines.push('## Vulnerabilities (sublyzer-runtime)');
    lines.push('');
    lines.push('| Severity | Scanner | Package / File | Issue |');
    lines.push('|----------|---------|----------------|-------|');
    for (const f of snapshot.audit.findings.slice(0, 15)) {
      const loc = f.file ? `\`${f.file}${f.line ? `:${f.line}` : ''}\`` : f.name;
      lines.push(`| ${f.severity} | ${f.scanner} | ${loc} | ${f.title.replace(/\|/g, '/')} |`);
    }
    lines.push('');
  }

  if (snapshot.routes.length) {
    lines.push('## Routes');
    lines.push('');
    for (const r of snapshot.routes.slice(0, 50)) {
      lines.push(`- \`${r}\``);
    }
    if (snapshot.routes.length > 50) {
      lines.push(`- … +${snapshot.routes.length - 50} more`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by [sublyzer-snapshot](https://www.npmjs.com/package/sublyzer-snapshot)*');
  lines.push('');

  return lines.join('\n');
}
