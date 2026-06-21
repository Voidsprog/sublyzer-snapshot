import type { TrendPoint } from '../scan/history-trends.js';
import type { HealthScore } from '../scan/health-score.js';
import type { SnapshotDiff } from '../scan/history.js';
import type { ProjectSnapshot } from '../scan/snapshot.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gradeColor(grade: string): string {
  const map: Record<string, string> = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444' };
  return map[grade] || '#64748b';
}

function renderTrendSvg(trends: TrendPoint[], w = 560, h = 140): string {
  if (trends.length < 2) {
    return `<p class="muted">Run more scans to see health trends.</p>`;
  }
  const pad = 24;
  const scores = trends.map((t) => t.health);
  const min = Math.max(0, Math.min(...scores) - 10);
  const max = Math.min(100, Math.max(...scores) + 10);
  const range = max - min || 1;
  const pts = trends.map((t, i) => {
    const x = pad + (i / (trends.length - 1)) * (w - pad * 2);
    const y = h - pad - ((t.health - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = trends[trends.length - 1];
  const first = trends[0];
  const delta = last.health - first.health;
  return `
<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Health score trend">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.3"/><stop offset="100%" stop-color="#22c55e" stop-opacity="0"/></linearGradient></defs>
  <polyline fill="none" stroke="#22c55e" stroke-width="2.5" points="${pts.join(' ')}"/>
  <polygon fill="url(#g)" points="${pad},${h - pad} ${pts.join(' ')} ${w - pad},${h - pad}"/>
  ${trends.map((t, i) => {
    const x = pad + (i / (trends.length - 1)) * (w - pad * 2);
    const y = h - pad - ((t.health - min) / range) * (h - pad * 2);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#22c55e"/>`;
  }).join('')}
</svg>
<p class="trend-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} pts over ${trends.length} scans</p>`;
}

function renderTreemap(snapshot: ProjectSnapshot): string {
  const nodes = snapshot.analysis?.bundleTreemap || [];
  if (!nodes.length) return `<p class="muted">No build output found for treemap.</p>`;
  const total = nodes.reduce((s, n) => s + n.bytes, 0) || 1;
  let html = '<div class="treemap">';
  for (const root of nodes) {
    const pct = Math.max(8, Math.round((root.bytes / total) * 100));
    html += `<div class="treemap-node" style="flex:${pct}"><strong>${esc(root.name)}</strong><span>${root.mb} MB</span>`;
    if (root.children?.length) {
      html += '<div class="treemap-children">';
      for (const c of root.children.slice(0, 8)) {
        const cp = Math.max(5, Math.round((c.bytes / root.bytes) * 100));
        html += `<div class="treemap-child" style="flex:${cp}" title="${esc(c.path)}">${esc(c.name)}<br><small>${c.mb} MB</small></div>`;
      }
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
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

  const issuesHtml = issues.length
    ? `<table class="issues"><thead><tr><th>Severity</th><th>Category</th><th>Issue</th><th>File</th></tr></thead><tbody>${issues
        .slice(0, 30)
        .map(
          (i) =>
            `<tr class="sev-${i.severity}"><td>${esc(i.severity)}</td><td>${esc(i.category)}</td><td>${esc(i.message)}</td><td><code>${esc(i.file || '—')}</code></td></tr>`,
        )
        .join('')}</tbody></table>`
    : `<p class="muted">No issues detected.</p>`;

  const complexityHtml = a?.complexity?.length
    ? `<table><thead><tr><th>File</th><th>Lines</th><th>Complexity</th></tr></thead><tbody>${a.complexity
        .slice(0, 10)
        .map((c) => `<tr><td><code>${esc(c.file)}</code></td><td>${c.lines}</td><td>${c.complexity}</td></tr>`)
        .join('')}</tbody></table>`
    : '';

  const unusedHtml = a?.unusedDeps?.length
    ? `<ul>${a.unusedDeps.slice(0, 12).map((u) => `<li><code>${esc(u.name)}</code> ${esc(u.version)}${u.dev ? ' (dev)' : ''}</li>`).join('')}</ul>`
    : `<p class="muted">No unused dependencies detected.</p>`;

  const nextjsHtml = a?.nextjs
    ? `<div class="cards">
      <div class="card"><span>Client components</span><strong>${a.nextjs.clientComponents}</strong></div>
      <div class="card"><span>Server candidates</span><strong>${a.nextjs.serverCandidates}</strong></div>
      <div class="card"><span>Client ratio</span><strong>${a.nextjs.clientRatio}%</strong></div>
    </div>`
    : '';

  const stacksHtml = a?.secondaryStacks?.length
    ? `<p>Also detected: ${a.secondaryStacks.map((s) => `<span class="pill">${esc(s.label)}</span>`).join(' ')}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Sublyzer Snapshot — ${esc(snapshot.projectName)}</title>
<style>
:root{--bg:#0b0f14;--card:#121820;--border:#1e293b;--text:#e2e8f0;--muted:#94a3b8;--accent:#22c55e;--warn:#eab308;--danger:#ef4444}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
.wrap{max-width:1100px;margin:0 auto;padding:2rem 1.5rem 4rem}
header{display:flex;flex-wrap:wrap;gap:1.5rem;align-items:flex-start;margin-bottom:2rem}
h1{margin:0;font-size:1.75rem}h2{margin:2rem 0 1rem;font-size:1.15rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.muted{color:var(--muted)}.meta{color:var(--muted);font-size:.9rem}
.score-ring{width:120px;height:120px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:6px solid ${gradeColor(health.grade)};flex-shrink:0}
.score-ring strong{font-size:2rem;line-height:1}.score-ring span{font-size:.85rem;color:var(--muted)}
section{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1rem}
.chart{width:100%;max-width:560px;height:auto}
.trend-delta{font-weight:600}.trend-delta.up{color:var(--accent)}.trend-delta.down{color:var(--danger)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem}
.card{background:#0b0f14;border:1px solid var(--border);border-radius:8px;padding:1rem}.card span{display:block;font-size:.75rem;color:var(--muted)}.card strong{font-size:1.5rem}
.treemap{display:flex;gap:4px;min-height:120px;margin-top:.5rem}
.treemap-node{background:#1a2332;border-radius:6px;padding:.5rem;font-size:.75rem;display:flex;flex-direction:column;min-width:60px}
.treemap-children{display:flex;gap:2px;margin-top:.35rem;flex:1}
.treemap-child{background:#243044;border-radius:4px;padding:.25rem;text-align:center;overflow:hidden;font-size:.65rem}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th,td{padding:.5rem .6rem;text-align:left;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-weight:500}
code{font-size:.8em;background:#0b0f14;padding:.1rem .35rem;border-radius:4px}
.sev-high td:first-child{color:var(--danger)}.sev-warning td:first-child{color:var(--warn)}
.pill{display:inline-block;background:#1e293b;padding:.2rem .6rem;border-radius:999px;font-size:.8rem;margin-right:.35rem}
.bench-bar{height:8px;background:#1e293b;border-radius:4px;margin:.5rem 0 1rem;overflow:hidden}
.bench-fill{height:100%;background:linear-gradient(90deg,var(--accent),#84cc16)}
footer{margin-top:2rem;text-align:center;color:var(--muted);font-size:.8rem}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div>
    <h1>${esc(snapshot.projectName)}</h1>
    <p class="meta">${esc(snapshot.stack.label)} · ${esc(snapshot.scannedAt)}</p>
    ${dashboardUrl ? `<p class="meta"><a href="${esc(dashboardUrl)}" style="color:var(--accent)">Dashboard</a></p>` : ''}
    ${stacksHtml}
  </div>
  <div class="score-ring">
    <strong>${health.score}</strong>
    <span>Grade ${health.grade}</span>
  </div>
</header>

<section>
  <h2>Health trend</h2>
  ${renderTrendSvg(trends)}
  ${health.trend ? `<p class="muted">${esc(health.trend.label)}</p>` : ''}
</section>

${bench ? `<section>
  <h2>Benchmark</h2>
  <p>${esc(bench.label)}</p>
  <div class="bench-bar"><div class="bench-fill" style="width:${bench.percentile}%"></div></div>
  <p class="muted">Percentile: ${bench.percentile} · Size tier: ${bench.sizeTier}</p>
  <table><thead><tr><th>Metric</th><th>Yours</th><th>Median</th></tr></thead><tbody>
  ${bench.metrics.map((m) => `<tr><td>${esc(m.name)}</td><td>${m.yours}${m.unit ? ' ' + m.unit : ''}</td><td>${m.median}${m.unit ? ' ' + m.unit : ''}</td></tr>`).join('')}
  </tbody></table>
</section>` : ''}

<section>
  <h2>Summary</h2>
  <div class="cards">
    <div class="card"><span>Routes</span><strong>${snapshot.summary.routeCount}</strong></div>
    <div class="card"><span>Dependencies</span><strong>${snapshot.summary.productionDeps}+${snapshot.summary.devDeps}</strong></div>
    <div class="card"><span>Vulnerabilities</span><strong>${snapshot.summary.vulnerablePackages}</strong></div>
    <div class="card"><span>Build size</span><strong>${snapshot.summary.bundleMb} MB</strong></div>
    <div class="card"><span>Issues</span><strong>${snapshot.summary.issueCount ?? issues.length}</strong></div>
  </div>
</section>

${nextjsHtml ? `<section><h2>Next.js patterns</h2>${nextjsHtml}</section>` : ''}

<section>
  <h2>Top issues</h2>
  ${issuesHtml}
</section>

<section>
  <h2>Complexity hotspots</h2>
  ${complexityHtml || '<p class="muted">No complexity data.</p>'}
</section>

<section>
  <h2>Unused dependencies</h2>
  ${unusedHtml}
</section>

<section>
  <h2>Bundle breakdown</h2>
  ${renderTreemap(snapshot)}
</section>

<footer>Generated by <strong>sublyzer-snapshot</strong> · offline report</footer>
</div>
</body>
</html>`;
}
