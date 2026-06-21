#!/usr/bin/env node
import { Command } from 'commander';
import { SDK_NAME, SDK_VERSION, type FailOnLevel } from './constants.js';
import { runCi } from './commands/ci.js';
import { runCompare } from './commands/compare.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runOpen } from './commands/open.js';
import { runPull } from './commands/pull.js';
import { runReport } from './commands/report.js';
import { runRunCommand } from './commands/run.js';
import { runScanCommand } from './commands/scan.js';
import { runStatus } from './commands/status.js';

const program = new Command();

function handleError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}

const FAIL_ON_LEVELS: FailOnLevel[] = ['critical', 'high', 'moderate', 'any'];

function sharedScanOptions(cmd: Command) {
  return cmd
    .option('--path <dir>', 'Scan a subfolder (e.g. frontend, backend)')
    .option('--skip-audit', 'Skip npm audit')
    .option('--skip-outdated', 'Skip npm outdated check')
    .option('--skip-bundle', 'Skip build output size scan')
    .option('--json', 'JSON output')
    .option('--fail-on <level>', 'Exit 1 on vulns: critical|high|moderate|any');
}

program
  .name('sublyzer-snapshot')
  .description('Local project health scanner — optional Sublyzer cloud sync')
  .version(SDK_VERSION);

sharedScanOptions(
  program
    .command('scan')
    .description('Scan project locally (no account, no init required)')
    .option('--push', 'Push to Sublyzer if cloud config exists'),
)
  .action(async (opts) => {
    try {
      const failOn = FAIL_ON_LEVELS.includes(opts.failOn) ? opts.failOn : undefined;
      const result = await runScanCommand({
        path: opts.path,
        push: opts.push,
        skipAudit: opts.skipAudit,
        skipOutdated: opts.skipOutdated,
        skipBundle: opts.skipBundle,
        json: opts.json,
        failOn,
      });
      if (opts.json) console.log(JSON.stringify(result, null, 2));
      if (result.policyFailed) process.exit(1);
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('init')
  .description('Save scan preferences — local-only or link Sublyzer cloud')
  .option('--local', 'Local mode only (no Sublyzer account)')
  .option('--code <code>', 'Cloud: integration code (24 chars)')
  .option('--read-key <key>', 'Cloud: apiReadKey for pull')
  .option('--path <dir>', 'Preferred scan directory in monorepos')
  .option('--api-url <url>', 'Sublyzer API URL')
  .option('--dashboard-url <url>', 'Dashboard URL')
  .option('-y, --yes', 'Non-interactive')
  .option('--skip-gitignore', 'Do not update .gitignore')
  .action(async (opts) => {
    try {
      await runInit({
        local: opts.local,
        code: opts.code,
        readKey: opts.readKey,
        path: opts.path,
        apiUrl: opts.apiUrl,
        dashboardUrl: opts.dashboardUrl,
        yes: opts.yes,
        skipGitignore: opts.skipGitignore,
      });
    } catch (e) {
      handleError(e);
    }
  });

sharedScanOptions(
  program
    .command('run')
    .description('Scan + save history (pushes only in cloud mode or with --push)')
    .option('--dry-run', 'Scan without saving push')
    .option('--push', 'Force push to Sublyzer cloud')
    .option('--local', 'Force local-only (no push)'),
)
  .action(async (opts) => {
    try {
      const failOn = FAIL_ON_LEVELS.includes(opts.failOn) ? opts.failOn : undefined;
      const result = await runRunCommand({
        path: opts.path,
        dryRun: opts.dryRun,
        push: opts.push,
        local: opts.local,
        skipAudit: opts.skipAudit,
        skipOutdated: opts.skipOutdated,
        skipBundle: opts.skipBundle,
        json: opts.json,
        failOn,
      });
      if (opts.json) console.log(JSON.stringify(result, null, 2));
      if (result.policyFailed) process.exit(1);
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('status')
  .description('Show config and last scan')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    try {
      const data = await runStatus({ json: opts.json });
      if (opts.json) console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('doctor')
  .description('Verify Node, scan target, optional cloud link')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    try {
      const result = await runDoctor({ json: opts.json });
      if (opts.json) console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exit(1);
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('compare')
  .description('Diff vs previous scan')
  .option('--json', 'JSON output')
  .option('--rescan', 'Fresh scan before compare')
  .option('--path <dir>', 'Scan path with --rescan')
  .option('--skip-audit', 'Skip audit with --rescan')
  .action(async (opts) => {
    try {
      const data = await runCompare({
        json: opts.json,
        rescan: opts.rescan,
        path: opts.path,
        skipAudit: opts.skipAudit,
      });
      if (opts.json) console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('report')
  .description('Markdown health report')
  .option('--out <file>', 'Write to file')
  .option('--rescan', 'Fresh scan')
  .option('--path <dir>', 'Scan path with --rescan')
  .option('--skip-audit', 'Skip audit')
  .option('--json', 'JSON wrapper')
  .action(async (opts) => {
    try {
      const out = await runReport({
        out: opts.out,
        rescan: opts.rescan,
        path: opts.path,
        skipAudit: opts.skipAudit,
        json: opts.json,
      });
      if (opts.json) console.log(out);
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('ci')
  .description('GitHub Actions workflow template')
  .option('--out <path>', 'Write workflow file')
  .option('--print', 'Print to stdout')
  .action(async (opts) => {
    try {
      await runCi({ out: opts.out, print: opts.print ?? !opts.out });
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('pull')
  .description('Fetch data from Sublyzer cloud (requires apiReadKey)')
  .option('--read-key <key>', 'apiReadKey')
  .option('--limit <n>', 'Max events', (v) => parseInt(v, 10))
  .option('--window-days <n>', 'Lookback days', (v) => parseInt(v, 10))
  .option('--include <csv>', 'API include list')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    try {
      const data = await runPull({
        readKey: opts.readKey,
        limit: opts.limit,
        windowDays: opts.windowDays,
        include: opts.include,
        json: opts.json,
      });
      if (opts.json) console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('open')
  .description('Open Sublyzer dashboard (cloud mode only)')
  .action(async () => {
    try {
      await runOpen();
    } catch (e) {
      handleError(e);
    }
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(`[${SDK_NAME}]`, e);
  process.exit(1);
});
