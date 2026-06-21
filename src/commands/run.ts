import type { FailOnLevel } from '../constants.js';
import { executeScan } from '../scan/execute.js';
import { title } from '../utils/log.js';

export type RunOptions = {
  path?: string;
  dryRun?: boolean;
  push?: boolean;
  local?: boolean;
  skipAudit?: boolean;
  skipOutdated?: boolean;
  skipBundle?: boolean;
  skipDeep?: boolean;
  json?: boolean;
  failOn?: FailOnLevel;
};

export async function runRunCommand(opts: RunOptions = {}) {
  if (!opts.json) title('Sublyzer Snapshot — run');

  const push = opts.local ? false : opts.push ?? undefined;

  return executeScan({
    path: opts.path,
    dryRun: opts.dryRun,
    push,
    skipAudit: opts.skipAudit,
    skipOutdated: opts.skipOutdated,
    skipBundle: opts.skipBundle,
    skipDeep: opts.skipDeep,
    json: opts.json,
    failOn: opts.failOn,
  });
}
