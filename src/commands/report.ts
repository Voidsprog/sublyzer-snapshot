import * as fs from 'node:fs';
import * as path from 'node:path';
import { dashboardIntegrationUrl, loadConfig } from '../config.js';
import { diffSnapshots, loadLastSnapshot, loadPreviousSnapshot } from '../scan/history.js';
import { buildProjectSnapshot } from '../scan/snapshot.js';
import { computeHealthScore } from '../scan/health-score.js';
import { renderMarkdownReport } from '../report/markdown.js';
import { info, ok, title } from '../utils/log.js';

export type ReportOptions = {
  out?: string;
  rescan?: boolean;
  skipAudit?: boolean;
  json?: boolean;
};

export async function runReport(opts: ReportOptions = {}): Promise<string> {
  const config = loadConfig();
  const root = config.projectRoot || process.cwd();

  let snapshot = opts.rescan
    ? buildProjectSnapshot(root, { skipAudit: opts.skipAudit })
    : loadLastSnapshot(root);

  if (!snapshot) {
    if (!opts.rescan) {
      info('No cached scan — running fresh scan…');
      snapshot = buildProjectSnapshot(root, { skipAudit: opts.skipAudit });
    } else {
      throw new Error('Scan failed');
    }
  }

  const health = snapshot.health ?? computeHealthScore(snapshot);
  const previous = loadPreviousSnapshot(root);
  const diff =
    previous
      ? diffSnapshots(previous, snapshot, health.score - (previous.health?.score ?? previous.summary?.healthScore ?? 0))
      : null;

  const markdown = renderMarkdownReport(
    snapshot,
    health,
    diff,
    dashboardIntegrationUrl(config),
  );

  if (opts.json) {
    return JSON.stringify({ markdown, health, snapshot: { scannedAt: snapshot.scannedAt, projectName: snapshot.projectName } }, null, 2);
  }

  if (opts.out) {
    const outPath = path.resolve(root, opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, 'utf8');
    if (!opts.json) {
      title('Sublyzer Snapshot — report');
      ok(`Wrote ${outPath}`);
    }
    return markdown;
  }

  title('Sublyzer Snapshot — report');
  console.log(markdown);
  return markdown;
}
