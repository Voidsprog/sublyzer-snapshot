import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_DIR, HTML_REPORT_FILE } from '../constants.js';
import { dashboardIntegrationUrl, tryLoadConfig } from '../config.js';
import { diffSnapshots, loadLastSnapshot, loadPreviousSnapshot } from '../scan/history.js';
import { loadScanTrends } from '../scan/history-trends.js';
import { resolveScanTarget } from '../detect/scan-target.js';
import { buildProjectSnapshot } from '../scan/snapshot.js';
import { computeHealthScore } from '../scan/health-score.js';
import { renderHealthBadge, renderReadmeBadgeBlock } from '../report/badge.js';
import { renderHtmlReport } from '../report/html.js';
import { renderMarkdownReport } from '../report/markdown.js';
import { info, ok, title } from '../utils/log.js';
import { openInBrowser } from '../utils/open-browser.js';

export type ReportOptions = {
  out?: string;
  html?: boolean;
  badge?: boolean;
  open?: boolean;
  rescan?: boolean;
  skipAudit?: boolean;
  path?: string;
  json?: boolean;
};

export function defaultHtmlReportPath(anchor: string): string {
  return path.resolve(anchor, CONFIG_DIR, HTML_REPORT_FILE);
}

async function resolveSnapshotForReport(anchor: string, opts: ReportOptions) {
  const config = tryLoadConfig(anchor);
  let snapshot = opts.rescan
    ? await buildProjectSnapshot(anchor, {
        skipAudit: opts.skipAudit,
        target: resolveScanTarget(anchor, opts.path || config?.scanRoot),
        configAnchor: anchor,
      })
    : loadLastSnapshot(anchor);

  if (!snapshot) {
    info('No cached scan — running fresh scan…');
    snapshot = await buildProjectSnapshot(anchor, {
      skipAudit: opts.skipAudit,
      target: resolveScanTarget(anchor, opts.path),
      configAnchor: anchor,
    });
  }

  return { snapshot, config };
}

export async function writeHtmlDashboard(
  anchor: string,
  opts: Pick<ReportOptions, 'out' | 'rescan' | 'skipAudit' | 'path'> = {},
): Promise<string> {
  const { snapshot, config } = await resolveSnapshotForReport(anchor, opts);
  const health = snapshot.health ?? computeHealthScore(snapshot, snapshot.analysis);
  const previous = loadPreviousSnapshot(anchor);
  const diff = previous
    ? diffSnapshots(previous, snapshot, health.score - (previous.health?.score ?? previous.summary?.healthScore ?? 0))
    : null;
  const trends = loadScanTrends(anchor);
  const dash = config ? dashboardIntegrationUrl(config) : null;

  const html = renderHtmlReport(snapshot, health, trends, diff, dash);
  const outPath = path.resolve(anchor, opts.out || path.join(CONFIG_DIR, HTML_REPORT_FILE));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}

export async function runReport(opts: ReportOptions = {}): Promise<string> {
  const config = tryLoadConfig();
  const anchor = config?.configRoot || process.cwd();
  const { snapshot } = await resolveSnapshotForReport(anchor, opts);

  const health = snapshot.health ?? computeHealthScore(snapshot, snapshot.analysis);
  const previous = loadPreviousSnapshot(anchor);
  const diff = previous
    ? diffSnapshots(previous, snapshot, health.score - (previous.health?.score ?? previous.summary?.healthScore ?? 0))
    : null;
  const trends = loadScanTrends(anchor);
  const dash = config ? dashboardIntegrationUrl(config) : null;

  if (opts.json) {
    return JSON.stringify(
      {
        health,
        trends,
        snapshot: {
          scannedAt: snapshot.scannedAt,
          projectName: snapshot.projectName,
          issueCount: snapshot.summary.issueCount,
        },
        benchmarks: snapshot.analysis?.benchmarks ?? null,
      },
      null,
      2,
    );
  }

  title('Sublyzer Snapshot — report');

  if (opts.html || opts.open) {
    const outPath = await writeHtmlDashboard(anchor, opts);
    ok(`Wrote HTML dashboard → ${outPath}`);
    if (opts.open) {
      openInBrowser(outPath);
      ok('Opened dashboard in your browser');
    } else {
      info('Open in browser: npx sublyzer-snapshot dashboard');
    }
    return outPath;
  }

  if (opts.badge) {
    const svg = renderHealthBadge(health, snapshot.projectName);
    const outPath = path.resolve(anchor, opts.out || '.sublyzer/health-badge.svg');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, svg, 'utf8');
    ok(`Wrote badge → ${outPath}`);

    const readmeBlock = renderReadmeBadgeBlock(health, snapshot.projectName);
    const mdPath = path.resolve(anchor, '.sublyzer/badge-snippet.md');
    fs.writeFileSync(mdPath, readmeBlock, 'utf8');
    info(`README snippet → ${mdPath}`);
    return svg;
  }

  const markdown = renderMarkdownReport(snapshot, health, diff, dash, trends);

  if (opts.out) {
    const outPath = path.resolve(anchor, opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, 'utf8');
    ok(`Wrote ${outPath}`);
    return markdown;
  }

  console.log(markdown);
  return markdown;
}
