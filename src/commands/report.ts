import * as fs from 'node:fs';
import * as path from 'node:path';
import { dashboardIntegrationUrl, tryLoadConfig } from '../config.js';
import { diffSnapshots, loadLastSnapshot, loadPreviousSnapshot } from '../scan/history.js';
import { resolveScanTarget } from '../detect/scan-target.js';
import { buildProjectSnapshot } from '../scan/snapshot.js';
import { computeHealthScore } from '../scan/health-score.js';
import { renderMarkdownReport } from '../report/markdown.js';
import { info, ok, title } from '../utils/log.js';

export type ReportOptions = {
  out?: string;
  rescan?: boolean;
  skipAudit?: boolean;
  path?: string;
  json?: boolean;
};

export async function runReport(opts: ReportOptions = {}): Promise<string> {
  const config = tryLoadConfig();
  const anchor = config?.configRoot || process.cwd();

  let snapshot = opts.rescan
    ? buildProjectSnapshot(anchor, {
        skipAudit: opts.skipAudit,
        target: resolveScanTarget(anchor, opts.path || config?.scanRoot),
      })
    : loadLastSnapshot(anchor);

  if (!snapshot) {
    info('No cached scan — running fresh scan…');
    snapshot = buildProjectSnapshot(anchor, {
      skipAudit: opts.skipAudit,
      target: resolveScanTarget(anchor, opts.path),
    });
  }

  const health = snapshot.health ?? computeHealthScore(snapshot);
  const previous = loadPreviousSnapshot(anchor);
  const diff = previous
    ? diffSnapshots(previous, snapshot, health.score - (previous.health?.score ?? previous.summary?.healthScore ?? 0))
    : null;

  const markdown = renderMarkdownReport(snapshot, health, diff, config ? dashboardIntegrationUrl(config) : null);

  if (opts.json) {
    return JSON.stringify(
      { markdown, health, snapshot: { scannedAt: snapshot.scannedAt, projectName: snapshot.projectName } },
      null,
      2,
    );
  }

  if (opts.out) {
    const outPath = path.resolve(anchor, opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, 'utf8');
    title('Sublyzer Snapshot — report');
    ok(`Wrote ${outPath}`);
    return markdown;
  }

  title('Sublyzer Snapshot — report');
  console.log(markdown);
  return markdown;
}
