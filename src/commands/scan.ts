import type { FailOnLevel } from '../constants.js';
import { executeScan } from '../scan/execute.js';
import { info, title } from '../utils/log.js';

export type ScanOptions = {
  path?: string;
  skipAudit?: boolean;
  skipOutdated?: boolean;
  skipBundle?: boolean;
  skipDeep?: boolean;
  push?: boolean;
  dryRun?: boolean;
  json?: boolean;
  failOn?: FailOnLevel;
};

export async function runScanCommand(opts: ScanOptions = {}) {
  if (!opts.json) title('Sublyzer Snapshot — scan');
  return executeScan({
    path: opts.path,
    skipAudit: opts.skipAudit,
    skipOutdated: opts.skipOutdated,
    skipBundle: opts.skipBundle,
    skipDeep: opts.skipDeep,
    push: opts.push ?? false,
    dryRun: opts.dryRun,
    json: opts.json,
    failOn: opts.failOn,
  });
}
