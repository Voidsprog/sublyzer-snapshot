import type { TrendPoint } from '../scan/history-trends.js';
import type { HealthScore } from '../scan/health-score.js';
import type { SnapshotDiff } from '../scan/history.js';
import type { ProjectSnapshot } from '../scan/snapshot.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A: '#5DD62C',
    B: '#6ee63f',
    C: '#d4a017',
    D: '#e65100',
    F: '#f44336',
  };
  return map[grade] || 'rgba(255,255,255,0.45)';
}

function severityBadge(sev: string): string {
  const cls = ['critical', 'high', 'moderate', 'low', 'warning', 'info'].includes(sev) ? sev : 'info';
  return `<span class="badge badge-${cls}">${esc(sev)}</span>`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function renderScoreRing(score: number, grade: string): string {
  const color = gradeColor(grade);
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return `
<div class="score-hero">
  <svg viewBox="0 0 128 128" class="score-svg" aria-label="Health ${score}/100">
    <defs>
      <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}"/>
        <stop offset="100%" stop-color="#4CAF50"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="url(#scoreGrad)" stroke-width="10"
      stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 64 64)" filter="url(#glow)"/>
    <text x="64" y="58" text-anchor="middle" class="score-num">${score}</text>
    <text x="64" y="78" text-anchor="middle" class="score-grade">Grade ${grade}</text>
  </svg>
</div>`;
}

function renderTrendChart(trends: TrendPoint[]): string {
  if (trends.length < 2) {
    return `<div class="empty-state"><span>📈</span><p>Run more scans to unlock health trends</p></div>`;
  }
  const w = 640;
  const h = 180;
  const pad = { t: 20, r: 20, b: 32, l: 36 };
  const scores = trends.map((t) => t.health);
  const min = Math.max(0, Math.min(...scores) - 8);
  const max = Math.min(100, Math.max(...scores) + 8);
  const range = max - min || 1;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const points = trends.map((t, i) => {
    const x = pad.l + (i / (trends.length - 1)) * innerW;
    const y = pad.t + innerH - ((t.health - min) / range) * innerH;
    return { x, y, ...t };
  });

  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${pad.l},${pad.t + innerH} ${line} ${pad.l + innerW},${pad.t + innerH}`;
  const delta = points[points.length - 1].health - points[0].health;

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = pad.t + innerH * (1 - f);
      const val = Math.round(min + range * f);
      return `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" class="grid-line"/>
        <text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${val}</text>`;
    })
    .join('');

  return `
<div class="chart-wrap">
  <svg viewBox="0 0 ${w} ${h}" class="trend-chart" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5DD62C" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#5DD62C" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <polygon points="${area}" fill="url(#areaGrad)"/>
    <polyline points="${line}" fill="none" stroke="#5DD62C" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${points
      .map(
        (p, i) =>
          `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#151515" stroke="#5DD62C" stroke-width="2"/>
           ${i === points.length - 1 ? `<circle cx="${p.x}" cy="${p.y}" r="8" fill="#5DD62C" opacity="0.18"/>` : ''}`,
      )
      .join('')}
  </svg>
  <div class="trend-badge ${delta >= 0 ? 'up' : 'down'}">
    ${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} pts · ${trends.length} scans
  </div>
</div>`;
}

function renderVulnBreakdown(snapshot: ProjectSnapshot): string {
  const a = snapshot.audit;
  if (!a.ran || !a.total) {
    return `<div class="empty-state small"><span>🛡️</span><p>No vulnerabilities detected</p></div>`;
  }
  const segments = [
    { label: 'Critical', count: a.critical, color: '#f87171' },
    { label: 'High', count: a.high, color: '#fb923c' },
    { label: 'Moderate', count: a.moderate, color: '#fbbf24' },
    { label: 'Low', count: a.low, color: 'rgba(255,255,255,0.35)' },
  ].filter((s) => s.count > 0);

  const total = segments.reduce((s, x) => s + x.count, 0) || 1;
  let offset = 0;
  const circles = segments
    .map((s) => {
      const pct = (s.count / total) * 100;
      const dash = `${pct} ${100 - pct}`;
      const el = `<circle cx="50" cy="50" r="40" fill="none" stroke="${s.color}" stroke-width="12"
        stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`;
      offset += pct;
      return el;
    })
    .join('');

  return `
<div class="vuln-donut-wrap">
  <svg viewBox="0 0 100 100" class="vuln-donut">
    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12"/>
    ${circles}
    <text x="50" y="48" text-anchor="middle" class="donut-num">${a.total}</text>
    <text x="50" y="60" text-anchor="middle" class="donut-label">total</text>
  </svg>
  <ul class="legend">${segments.map((s) => `<li><span style="background:${s.color}"></span>${s.label} <strong>${s.count}</strong></li>`).join('')}</ul>
</div>`;
}

function renderStatCards(snapshot: ProjectSnapshot, issues: number): string {
  const s = snapshot.summary;
  const stats = [
    { icon: '🔗', label: 'Routes', value: String(s.routeCount), tone: 'gray' },
    { icon: '📦', label: 'Dependencies', value: `${s.productionDeps}+${s.devDeps}`, tone: 'gray' },
    { icon: '🛡️', label: 'Vulnerabilities', value: String(s.vulnerablePackages), tone: s.vulnerablePackages > 0 ? 'warn' : 'green' },
    { icon: '📁', label: 'Build size', value: `${s.bundleMb} MB`, tone: 'gray' },
    { icon: '⚡', label: 'Code issues', value: String(s.issueCount ?? issues), tone: 'green' },
  ];
  return stats
    .map(
      (st) =>
        `<div class="stat-card stat-${st.tone}"><div class="stat-icon">${st.icon}</div><div class="stat-body"><span>${st.label}</span><strong>${st.value}</strong></div></div>`,
    )
    .join('');
}

function renderHealthFactors(health: HealthScore): string {
  if (!health.factors.length) return '';
  return `<div class="factors">${health.factors
    .map((f) => {
      const cls = f.impact < 0 ? 'neg' : f.impact > 0 ? 'pos' : 'neutral';
      const sign = f.impact > 0 ? '+' : '';
      return `<div class="factor ${cls}"><span>${esc(f.label)}</span><em>${sign}${f.impact || '·'}</em></div>`;
    })
    .join('')}</div>`;
}

function renderFindingsTable(
  rows: { sev: string; cols: string[] }[],
  headers: string[],
): string {
  if (!rows.length) return `<div class="empty-state small"><p>Nothing here — looking good!</p></div>`;
  return `<div class="table-scroll"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr class="row-${r.sev}"><td>${severityBadge(r.sev)}</td>${r.cols.slice(1).map((c) => `<td>${c}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody></table></div>`;
}

function renderTreemap(snapshot: ProjectSnapshot): string {
  const nodes = snapshot.analysis?.bundleTreemap || [];
  if (!nodes.length) return `<div class="empty-state small"><p>No build output found</p></div>`;
  const total = nodes.reduce((s, n) => s + n.bytes, 0) || 1;
  const colors = ['#5DD62C', '#4CAF50', '#52BE80', '#27AE60', '#6ee63f', '#2ECC71'];

  let html = '<div class="treemap-grid">';
  for (const [idx, root] of nodes.entries()) {
    const pct = Math.max(12, Math.round((root.bytes / total) * 100));
    const color = colors[idx % colors.length];
    html += `<div class="treemap-block" style="flex:${pct};--c:${color}">
      <div class="treemap-head"><strong>${esc(root.name)}</strong><span>${root.mb} MB</span></div>`;
    if (root.children?.length) {
      html += '<div class="treemap-kids">';
      for (const c of root.children.slice(0, 6)) {
        const cp = Math.max(8, Math.round((c.bytes / root.bytes) * 100));
        html += `<div class="treemap-kid" style="flex:${cp}" title="${esc(c.path)}"><span>${esc(c.name)}</span><small>${c.mb} MB</small></div>`;
      }
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderBenchmark(bench: NonNullable<ProjectSnapshot['analysis']>['benchmarks']): string {
  if (!bench) return '';
  return `
<section class="panel panel-glow" id="benchmark">
  <div class="panel-head"><h2>Benchmark</h2><span class="chip">${esc(bench.sizeTier)} project</span></div>
  <p class="bench-quote">"${esc(bench.label)}"</p>
  <div class="percentile-wrap">
    <div class="percentile-bar"><div class="percentile-fill" style="width:${bench.percentile}%"></div></div>
    <div class="percentile-label"><strong>${bench.percentile}</strong><span>percentile</span></div>
  </div>
  <div class="bench-metrics">${bench.metrics
    .map((m) => {
      const better = m.better === 'lower' ? m.yours <= m.median : m.yours >= m.median;
      return `<div class="bench-metric ${better ? 'good' : 'warn'}">
        <span>${esc(m.name)}</span>
        <strong>${m.yours}${m.unit ? ' ' + m.unit : ''}</strong>
        <small>median ${m.median}${m.unit ? ' ' + m.unit : ''}</small>
      </div>`;
    })
    .join('')}</div>
</section>`;
}

export function renderHtmlReport(
  snapshot: ProjectSnapshot,
  health: HealthScore,
  trends: TrendPoint[],
  diff?: SnapshotDiff | null,
  dashboardUrl?: string | null,
): string {
  const a = snapshot.analysis;
  const bench = a?.benchmarks;
  const issues = a?.issues || [];
  const grade = health.grade;

  const vulnRows = (snapshot.audit.findings || []).slice(0, 25).map((f) => ({
    sev: f.severity,
    cols: [
      f.severity,
      esc(f.scanner),
      `<code class="path">${esc(f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : f.name)}</code>`,
      esc(f.title),
    ],
  }));

  const issueRows = issues.slice(0, 25).map((i) => ({
    sev: i.severity,
    cols: [i.severity, esc(i.category), esc(i.message), `<code class="path">${esc(i.file || '—')}</code>`],
  }));

  const complexityRows = (a?.complexity || []).slice(0, 10).map((c) => ({
    sev: c.complexity > 40 ? 'high' : c.complexity > 25 ? 'warning' : 'info',
    cols: [
      c.complexity > 40 ? 'high' : 'info',
      `<code class="path">${esc(c.file)}</code>`,
      String(c.lines),
      `<strong>${c.complexity}</strong>`,
    ],
  }));

  const navItems = [
    ['overview', 'Overview'],
    ['trend', 'Trend'],
    ...(bench ? [['benchmark', 'Benchmark']] : []),
    ['vulns', 'Vulnerabilities'],
    ['issues', 'Issues'],
    ['bundle', 'Bundle'],
  ] as const;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(snapshot.projectName)} — Sublyzer Snapshot</title>
<style>
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#0a0a0a;--surface:#151515;--surface2:rgba(255,255,255,0.04);
  --border:rgba(255,255,255,0.08);--text:#f5f5f5;--muted:rgba(255,255,255,0.55);
  --accent:#5DD62C;--accent2:#4CAF50;--accent-dim:rgba(93,214,44,0.12);--accent-border:rgba(76,175,80,0.28);
  --glow:rgba(76,175,80,0.18);--radius:16px;--radius-sm:10px;
}
html{scroll-behavior:smooth}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:var(--bg);color:var(--text);line-height:1.55;min-height:100vh}
.bg-mesh{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(ellipse 80% 50% at 15% -5%, rgba(76,175,80,0.16), transparent 52%),
    radial-gradient(ellipse 55% 35% at 95% 5%, rgba(93,214,44,0.08), transparent 48%),
    radial-gradient(ellipse 45% 25% at 50% 100%, rgba(255,255,255,0.03), transparent 50%),
    var(--bg)}
.app{position:relative;z-index:1;display:grid;grid-template-columns:240px 1fr;min-height:100vh;max-width:1400px;margin:0 auto}
.sidebar{position:sticky;top:0;height:100vh;padding:1.5rem 1rem;border-right:1px solid var(--border);
  background:rgba(10,10,10,0.92);backdrop-filter:blur(12px);display:flex;flex-direction:column;gap:1.5rem}
.brand{display:flex;align-items:center;gap:.75rem;padding:.5rem}
.brand-icon{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#5DD62C,#4CAF50);
  display:grid;place-items:center;font-size:1rem;font-weight:800;color:#0a0a0a;box-shadow:0 0 28px var(--glow)}
.brand-text strong{display:block;font-size:.95rem;letter-spacing:-.02em}
.brand-text span{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.nav{display:flex;flex-direction:column;gap:.25rem;flex:1}
.nav a{color:var(--muted);text-decoration:none;padding:.55rem .75rem;border-radius:var(--radius-sm);font-size:.85rem;
  transition:all .2s;border:1px solid transparent}
.nav a:hover{color:var(--accent);background:var(--accent-dim);border-color:var(--accent-border)}
.sidebar-score{text-align:center;padding:1rem;background:var(--surface);border:1px solid var(--accent-border);border-radius:var(--radius);
  background:linear-gradient(135deg,rgba(76,175,80,0.12) 0%,rgba(21,21,21,1) 70%)}
.sidebar-score strong{font-size:1.75rem;color:var(--accent);font-weight:800}
.sidebar-score span{display:block;font-size:.75rem;color:var(--muted);margin-top:.25rem}
main{padding:1.5rem 2rem 3rem;overflow-x:hidden}
.hero{display:grid;grid-template-columns:1fr auto;gap:2rem;align-items:center;margin-bottom:1.75rem;
  padding:1.75rem 2rem;border-radius:var(--radius);animation:fadeUp .5s ease;position:relative;overflow:hidden;
  background:linear-gradient(135deg,rgba(76,175,80,0.18) 0%,rgba(76,175,80,0.05) 22%,rgba(21,21,21,1) 72%);
  border:1px solid var(--accent-border);box-shadow:0 4px 32px rgba(0,0,0,0.35)}
.hero::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(640px 220px at 0% 50%,rgba(76,175,80,0.14),transparent 60%)}
.hero>*{position:relative;z-index:1}
.hero h1{margin:0 0 .5rem;font-size:clamp(1.5rem,3vw,2rem);font-weight:700;letter-spacing:-.03em}
.hero-meta{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem}
.chip{display:inline-flex;align-items:center;gap:.35rem;padding:.3rem .65rem;border-radius:999px;
  font-size:.75rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--muted)}
.chip-stack{color:var(--accent);border-color:var(--accent-border);background:var(--accent-dim)}
.chip-time{color:var(--muted)}
.chip-link{color:var(--accent);border-color:var(--accent-border);background:var(--accent-dim);text-decoration:none}
.chip-link:hover{background:rgba(93,214,44,0.18)}
.score-hero{animation:fadeUp .6s ease .1s both}
.score-svg{width:140px;height:140px}
.score-num{font-size:1.75rem;font-weight:700;fill:var(--text)}
.score-grade{font-size:.65rem;fill:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem}
.stat-card{display:flex;align-items:center;gap:.85rem;padding:1rem 1.1rem;background:var(--surface);
  border:1px solid var(--border);border-radius:var(--radius);transition:transform .2s,box-shadow .2s,border-color .2s;animation:fadeUp .5s ease both}
.stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,0.35);border-color:rgba(255,255,255,0.12)}
.stat-card:nth-child(1){animation-delay:.05s}.stat-card:nth-child(2){animation-delay:.1s}
.stat-card:nth-child(3){animation-delay:.15s}.stat-card:nth-child(4){animation-delay:.2s}.stat-card:nth-child(5){animation-delay:.25s}
.stat-icon{font-size:1.35rem;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:rgba(255,255,255,0.05)}
.stat-gray .stat-icon{background:rgba(255,255,255,0.06)}
.stat-green .stat-icon{background:var(--accent-dim);border:1px solid var(--accent-border)}
.stat-warn .stat-icon{background:rgba(230,81,0,0.12);border:1px solid rgba(230,81,0,0.25)}
.stat-body span{display:block;font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.stat-body strong{font-size:1.35rem;font-weight:700;letter-spacing:-.02em}
.stat-green .stat-body strong{color:var(--accent)}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;
  margin-bottom:1.25rem;animation:fadeUp .5s ease both}
.panel-glow{border-color:var(--accent-border);box-shadow:0 0 0 1px rgba(76,175,80,0.06),0 8px 32px rgba(0,0,0,0.25)}
.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;flex-wrap:wrap;gap:.5rem}
.panel-head h2{margin:0;font-size:1rem;font-weight:600;letter-spacing:-.01em;color:var(--text)}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem}
@media(max-width:900px){.app{grid-template-columns:1fr}.sidebar{position:relative;height:auto;border-right:none;border-bottom:1px solid var(--border)}.nav{flex-direction:row;flex-wrap:wrap}.hero{grid-template-columns:1fr;text-align:center}.hero-meta{justify-content:center}.grid-2{grid-template-columns:1fr}}
.chart-wrap{position:relative}
.trend-chart{width:100%;height:auto;display:block}
.grid-line{stroke:rgba(255,255,255,0.08);stroke-width:1}
.chart-label{font-size:9px;fill:var(--muted)}
.trend-badge{display:inline-flex;align-items:center;gap:.35rem;margin-top:.75rem;padding:.35rem .75rem;
  border-radius:999px;font-size:.8rem;font-weight:600}
.trend-badge.up{background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border)}
.trend-badge.down{background:rgba(244,67,54,0.12);color:#f44336;border:1px solid rgba(244,67,54,0.25)}
.factors{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
.factor{padding:.4rem .75rem;border-radius:999px;font-size:.78rem;border:1px solid var(--border);background:rgba(255,255,255,0.03)}
.factor.neg{border-color:rgba(244,67,54,0.28);color:#ef9a9a;background:rgba(244,67,54,0.08)}
.factor.pos{border-color:var(--accent-border);color:var(--accent);background:var(--accent-dim)}
.factor.neutral{border-color:var(--border);color:var(--muted)}
.factor em{font-style:normal;opacity:.7;margin-left:.35rem}
.bench-quote{font-size:1.05rem;color:var(--text);margin:0 0 1rem;line-height:1.5}
.percentile-wrap{display:flex;align-items:center;gap:1.25rem;margin-bottom:1.25rem}
.percentile-bar{flex:1;height:10px;background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden}
.percentile-fill{height:100%;background:linear-gradient(90deg,#5DD62C,#4CAF50);border-radius:999px;transition:width .8s ease}
.percentile-label{text-align:center;min-width:64px}
.percentile-label strong{display:block;font-size:1.5rem;line-height:1;color:var(--accent)}
.percentile-label span{font-size:.65rem;color:var(--muted);text-transform:uppercase}
.bench-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem}
.bench-metric{padding:.85rem;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border)}
.bench-metric span{display:block;font-size:.7rem;color:var(--muted)}
.bench-metric strong{display:block;font-size:1.1rem;margin:.2rem 0}
.bench-metric small{font-size:.7rem;color:var(--muted)}
.bench-metric.good{border-color:var(--accent-border);background:var(--accent-dim)}
.bench-metric.warn{border-color:rgba(212,160,23,0.28);background:rgba(212,160,23,0.06)}
.vuln-donut-wrap{display:flex;align-items:center;gap:2rem;flex-wrap:wrap}
.vuln-donut{width:120px;height:120px;flex-shrink:0}
.donut-num{font-size:14px;font-weight:700;fill:var(--text)}
.donut-label{font-size:6px;fill:var(--muted);text-transform:uppercase}
.legend{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5rem}
.legend li{display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:var(--muted)}
.legend li span{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.legend strong{color:var(--text);margin-left:auto}
.table-scroll{overflow-x:auto;border-radius:var(--radius-sm);border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;font-size:.82rem}
th,td{padding:.65rem .85rem;text-align:left;border-bottom:1px solid var(--border)}
th{background:rgba(0,0,0,0.35);color:var(--muted);font-weight:500;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(93,214,44,0.04)}
code.path{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:.78rem;
  background:rgba(0,0,0,0.4);padding:.15rem .4rem;border-radius:4px;color:rgba(93,214,44,0.9);word-break:break-all}
.badge{display:inline-block;padding:.2rem .5rem;border-radius:6px;font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.badge-critical{background:rgba(244,67,54,0.15);color:#ef9a9a}
.badge-high{background:rgba(251,140,0,0.15);color:#ffcc80}
.badge-moderate,.badge-warning{background:rgba(212,160,23,0.12);color:#ffe082}
.badge-low{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.55)}
.badge-info{background:rgba(255,255,255,0.06);color:var(--muted)}
.treemap-grid{display:flex;gap:6px;min-height:140px;flex-wrap:wrap}
.treemap-block{flex:1;min-width:120px;background:linear-gradient(135deg,color-mix(in srgb,var(--c) 18%,#151515),#151515);
  border:1px solid color-mix(in srgb,var(--c) 35%,rgba(255,255,255,0.08));border-radius:var(--radius-sm);padding:.65rem;display:flex;flex-direction:column}
.treemap-head{display:flex;justify-content:space-between;align-items:center;font-size:.75rem;margin-bottom:.4rem}
.treemap-head strong{color:var(--c)}
.treemap-kids{display:flex;gap:3px;flex:1;min-height:48px}
.treemap-kid{flex:1;background:rgba(0,0,0,0.35);border-radius:4px;padding:.25rem;text-align:center;font-size:.6rem;overflow:hidden;
  display:flex;flex-direction:column;justify-content:center;color:rgba(255,255,255,0.75)}
.treemap-kid small{opacity:.65;margin-top:.1rem}
.unused-list{display:flex;flex-wrap:wrap;gap:.5rem}
.unused-list code{padding:.35rem .6rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;font-size:.78rem;color:var(--muted)}
.next-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.next-stat{text-align:center;padding:1rem;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border)}
.next-stat span{display:block;font-size:.7rem;color:var(--muted);margin-bottom:.35rem}
.next-stat strong{font-size:1.5rem;color:var(--accent)}
.empty-state{text-align:center;padding:2rem;color:var(--muted)}
.empty-state span{font-size:2rem;display:block;margin-bottom:.5rem;opacity:.5}
.empty-state.small{padding:1.25rem}
.empty-state.small span{font-size:1.25rem}
footer{text-align:center;padding:2rem 0 1rem;color:var(--muted);font-size:.75rem}
footer strong{color:var(--accent)}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>
<div class="bg-mesh"></div>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-icon">S</div>
      <div class="brand-text"><strong>Sublyzer</strong><span>Snapshot</span></div>
    </div>
    <nav class="nav">${navItems.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav>
    <div class="sidebar-score"><strong>${health.score}</strong><span>Health · Grade ${grade}</span></div>
  </aside>

  <main>
    <header class="hero" id="overview">
      <div>
        <h1>${esc(snapshot.projectName)}</h1>
        <p style="color:var(--muted);margin:0;font-size:.95rem">Project health report · offline dashboard</p>
        <div class="hero-meta">
          <span class="chip chip-stack">${esc(snapshot.stack.label)}</span>
          <span class="chip chip-time">${esc(formatDate(snapshot.scannedAt))}</span>
          ${snapshot.scanTargetReason !== 'current directory' ? `<span class="chip">${esc(snapshot.scanTargetReason)}</span>` : ''}
          ${a?.secondaryStacks?.map((s) => `<span class="chip">${esc(s.label)}</span>`).join('') || ''}
          ${dashboardUrl ? `<a class="chip chip-link" href="${esc(dashboardUrl)}" target="_blank">Live dashboard ↗</a>` : ''}
        </div>
        ${renderHealthFactors(health)}
        ${health.trend ? `<p style="margin-top:1rem;font-size:.85rem;color:var(--muted)">📈 ${esc(health.trend.label)}</p>` : ''}
      </div>
      ${renderScoreRing(health.score, grade)}
    </header>

    <div class="stats">${renderStatCards(snapshot, issues.length)}</div>

    <section class="panel" id="trend">
      <div class="panel-head"><h2>Health trend</h2></div>
      ${renderTrendChart(trends)}
    </section>

    ${bench ? renderBenchmark(bench) : ''}

    <div class="grid-2">
      <section class="panel" id="vulns">
        <div class="panel-head"><h2>Vulnerabilities</h2><span class="chip">sublyzer-runtime</span></div>
        ${renderVulnBreakdown(snapshot)}
        ${renderFindingsTable(vulnRows, ['Severity', 'Scanner', 'Location', 'Issue'])}
      </section>

      <section class="panel" id="issues">
        <div class="panel-head"><h2>Code issues</h2><span class="chip">${issues.length} found</span></div>
        ${renderFindingsTable(issueRows, ['Severity', 'Category', 'Issue', 'File'])}
      </section>
    </div>

    ${
      a?.nextjs
        ? `<section class="panel"><div class="panel-head"><h2>Next.js patterns</h2></div>
        <div class="next-grid">
          <div class="next-stat"><span>Client components</span><strong>${a.nextjs.clientComponents}</strong></div>
          <div class="next-stat"><span>Server candidates</span><strong>${a.nextjs.serverCandidates}</strong></div>
          <div class="next-stat"><span>Client ratio</span><strong>${a.nextjs.clientRatio}%</strong></div>
        </div></section>`
        : ''
    }

    <section class="panel">
      <div class="panel-head"><h2>Complexity hotspots</h2></div>
      ${renderFindingsTable(complexityRows, ['', 'File', 'Lines', 'Score'])}
    </section>

    ${
      a?.unusedDeps?.length
        ? `<section class="panel"><div class="panel-head"><h2>Unused dependencies</h2></div>
        <div class="unused-list">${a.unusedDeps
          .slice(0, 15)
          .map((u) => `<code>${esc(u.name)}@${esc(u.version)}${u.dev ? ' (dev)' : ''}</code>`)
          .join('')}</div></section>`
        : ''
    }

    <section class="panel" id="bundle">
      <div class="panel-head"><h2>Bundle breakdown</h2></div>
      ${renderTreemap(snapshot)}
    </section>

    <footer>Generated by <strong>sublyzer-snapshot</strong> · ${esc(formatDate(new Date().toISOString()))}</footer>
  </main>
</div>
</body>
</html>`;
}
