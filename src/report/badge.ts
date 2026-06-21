import type { HealthScore } from '../scan/health-score.js';

function gradeColor(grade: string): string {
  const map: Record<string, string> = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444' };
  return map[grade] || '#64748b';
}

export function renderHealthBadge(health: HealthScore, projectName?: string): string {
  const color = gradeColor(health.grade);
  const label = projectName ? projectName.slice(0, 20) : 'health';
  const w = 120;
  const h = 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="health: ${health.score}/100 grade ${health.grade}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="${h}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="72" height="${h}" fill="#121820"/>
    <rect x="72" width="48" height="${h}" fill="${color}"/>
    <rect width="${w}" height="${h}" fill="url(#s)"/>
    <g fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600">
      <text x="36" y="14" fill="#e2e8f0">health</text>
      <text x="96" y="14">${health.score} ${health.grade}</text>
    </g>
  </g>
</svg>`;
}

export function renderBadgeMarkdown(health: HealthScore): string {
  const color = health.grade === 'A' || health.grade === 'B' ? 'brightgreen' : health.grade === 'C' ? 'yellow' : 'red';
  return `![Sublyzer Health](https://img.shields.io/badge/health-${health.score}%2F100_${health.grade}-${color}?style=flat-square)`;
}

export function renderReadmeBadgeBlock(health: HealthScore, projectName: string): string {
  return `<!-- sublyzer-snapshot -->
${renderBadgeMarkdown(health)}

> **Sublyzer Health:** ${health.score}/100 (grade **${health.grade}**) — _${projectName}_
`;
}
