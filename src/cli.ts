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
import { runScan } from './commands/run.js';
import { runStatus } from './commands/status.js';

const program = new Command();

function handleError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}

const FAIL_ON_LEVELS: FailOnLevel[] = ['critical', 'high', 'moderate', 'any'];

program
  .name('sublyzer-snapshot')
  .description('Scan any project and push a health snapshot to Sublyzer')
  .version(SDK_VERSION);

program
  .command('init')
  .description('Detect stack and link this project to your Sublyzer integration')
  .option('--code <code>', 'Integration code (24 chars); or SUBLYZER_INTEGRATION_CODE')
  .option('--read-key <key>', 'Optional apiReadKey for pull; or SUBLYZER_READ_KEY')
  .option('--api-url <url>', 'Sublyzer API base URL')
  .option('--dashboard-url <url>', 'Dashboard base URL')
  .option('-y, --yes', 'Non-interactive when code is provided')
  .option('--skip-gitignore', 'Do not update .gitignore')
  .action(async (opts) => {
    try {
      await runInit({
        code: opts.code,
        readKey: opts.readKey,
        apiUrl: opts.apiUrl,
        dashboardUrl: opts.dashboardUrl,
        yes: opts.yes,
        skipGitignore: opts.skipGitignore,
      });
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('run')
  .description('Scan routes, dependencies, vulnerabilities and push to Sublyzer')
  .option('--dry-run', 'Scan locally without sending data')
  .option('--skip-audit', 'Skip npm audit (faster)')
  .option('--skip-outdated', 'Skip npm outdated check')
  .option('--json', 'Output machine-readable JSON (CI friendly)')
  .option('--fail-on <level>', 'Exit 1 if vulns at level: critical|high|moderate|any')
  .action(async (opts) => {
    try {
      const failOn = FAIL_ON_LEVELS.includes(opts.failOn) ? opts.failOn : undefined;
      const result = await runScan({
        dryRun: opts.dryRun,
        skipAudit: opts.skipAudit,
        skipOutdated: opts.skipOutdated,
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
  .description('Show linked integration and last scan summary')
  .option('--json', 'Output machine-readable JSON')
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
  .description('Verify config, API connectivity, integration code and read key')
  .option('--json', 'Output machine-readable JSON')
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
  .description('Diff current vs previous scan (routes, vulns, health score)')
  .option('--json', 'Output machine-readable JSON')
  .option('--rescan', 'Run a fresh scan before comparing')
  .option('--skip-audit', 'Skip audit when using --rescan')
  .action(async (opts) => {
    try {
      const data = await runCompare({
        json: opts.json,
        rescan: opts.rescan,
        skipAudit: opts.skipAudit,
      });
      if (opts.json) console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('report')
  .description('Generate a Markdown health report (stdout or --out file)')
  .option('--out <file>', 'Write report to file (e.g. sublyzer-report.md)')
  .option('--rescan', 'Run a fresh scan instead of using last cached scan')
  .option('--skip-audit', 'Skip audit when using --rescan')
  .option('--json', 'Output JSON wrapper with markdown body')
  .action(async (opts) => {
    try {
      const out = await runReport({
        out: opts.out,
        rescan: opts.rescan,
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
  .description('Print or write a GitHub Actions workflow for automated snapshots')
  .option('--out <path>', 'Write workflow file (default: .github/workflows/sublyzer-snapshot.yml)')
  .option('--print', 'Print template to stdout only')
  .action(async (opts) => {
    try {
      await runCi({ out: opts.out, print: opts.print ?? !opts.out });
    } catch (e) {
      handleError(e);
    }
  });

program
  .command('pull')
  .description('Fetch integration data from Sublyzer (requires apiReadKey)')
  .option('--read-key <key>', 'apiReadKey; or SUBLYZER_READ_KEY in env/config')
  .option('--limit <n>', 'Max events', (v) => parseInt(v, 10))
  .option('--window-days <n>', 'Lookback window in days', (v) => parseInt(v, 10))
  .option('--include <csv>', 'stats,events,telemetry,performance,sdkStatus,activeErrors')
  .option('--json', 'Output raw API JSON only')
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
  .description('Open the Sublyzer dashboard for this integration')
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
