import * as path from 'node:path';
import {
  DEFAULT_API_URL,
  DEFAULT_DASHBOARD_URL,
  DOCS_URL,
  INTEGRATION_CODE_RE,
} from '../constants.js';
import { saveConfig, type SnapshotConfig } from '../config.js';
import { readProjectName } from '../detect/stack.js';
import { resolveScanTarget, findMonorepoScanHints } from '../detect/scan-target.js';
import { validateIntegrationCode } from '../api/sublyzer.js';
import { promptOptional, promptRequired } from '../utils/prompt.js';
import { ensureGitignore } from '../utils/gitignore.js';
import { info, ok, title } from '../utils/log.js';

export type InitOptions = {
  code?: string;
  readKey?: string;
  apiUrl?: string;
  dashboardUrl?: string;
  yes?: boolean;
  skipGitignore?: boolean;
  local?: boolean;
  path?: string;
};

export async function runInit(opts: InitOptions = {}): Promise<void> {
  title('Sublyzer Snapshot — init');

  const configRoot = process.cwd();
  const target = resolveScanTarget(configRoot, opts.path);
  const stack = target.stack;
  const projectName = readProjectName(target.root);

  info(`Project: ${projectName}`);
  info(`Scan root: ${target.root} (${target.reason})`);
  info(`Detected stack: ${stack.label} (${stack.confidence})`);
  if (stack.hints.length) {
    for (const h of stack.hints) info(`  hint: ${h}`);
  }

  const hints = findMonorepoScanHints(configRoot);
  if (hints.length > 1 && !opts.path) {
    info('Other scannable packages in this repo:');
    for (const h of hints.slice(0, 5)) {
      const rel = path.relative(configRoot, h.root) || '.';
      if (path.resolve(h.root) === path.resolve(target.root)) continue;
      info(`  • ${rel} (${h.stack.label})`);
    }
  }

  const now = new Date().toISOString();
  const localMode = Boolean(opts.local);

  if (localMode) {
    const config: SnapshotConfig = {
      version: 1,
      mode: 'local',
      projectName,
      configRoot,
      scanRoot: target.root,
      stack: stack.id,
      createdAt: now,
      updatedAt: now,
    };
    saveConfig(config, configRoot);
    ok(`Wrote ${path.join('.sublyzer', 'snapshot.json')} (local mode)`);
    if (!opts.skipGitignore) ensureGitignore(configRoot);
    printNextSteps(false);
    return;
  }

  const apiUrl = (opts.apiUrl || process.env.SUBLYZER_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
  const dashboardUrl = (opts.dashboardUrl || process.env.SUBLYZER_DASHBOARD_URL || DEFAULT_DASHBOARD_URL).replace(/\/$/, '');

  let code = (opts.code || process.env.SUBLYZER_INTEGRATION_CODE || process.env.SUBLYZER_CODE || '')
    .trim()
    .toUpperCase();

  if (!code) {
    console.log('');
    console.log('  Cloud sync (optional): link to Sublyzer dashboard');
    console.log('  Or use local-only: sublyzer-snapshot init --local');
    console.log('');
    code = (await promptRequired('Integration code (24 chars)', (v) => {
      const c = v.trim().toUpperCase();
      if (!INTEGRATION_CODE_RE.test(c)) return 'Code must be 24 uppercase letters/digits (A-Z, 0-9)';
      return null;
    })).trim().toUpperCase();
  } else if (!INTEGRATION_CODE_RE.test(code)) {
    throw new Error('Invalid integration code format (expected 24 uppercase alphanumeric characters)');
  }

  let readKey = (opts.readKey || process.env.SUBLYZER_READ_KEY || '').trim();
  if (!readKey && !opts.yes) {
    readKey = (await promptOptional('Read key (optional, Enter to skip)')) || '';
  }

  info(`Validating code against ${apiUrl}…`);
  const validation = await validateIntegrationCode(apiUrl, code);
  if (!validation.valid || !validation.integration) {
    throw new Error(validation.message || 'Integration code not found or invalid');
  }

  ok(`Integration "${validation.integration.name}" (${validation.integration.status})`);

  const config: SnapshotConfig = {
    version: 1,
    mode: 'cloud',
    integrationCode: code,
    apiUrl,
    dashboardUrl,
    integrationId: validation.integration.id,
    integrationName: validation.integration.name,
    projectName,
    configRoot,
    scanRoot: target.root,
    stack: stack.id,
    createdAt: now,
    updatedAt: now,
  };
  if (readKey.length >= 32) {
    config.readKey = readKey;
    ok('Read key saved — `pull` enabled');
  }

  saveConfig(config, configRoot);
  ok(`Wrote ${path.join('.sublyzer', 'snapshot.json')} (cloud mode)`);
  if (!opts.skipGitignore) ensureGitignore(configRoot);

  printNextSteps(true, stack.id, code, apiUrl);
}

function printNextSteps(cloud: boolean, stackId?: string, code?: string, apiUrl?: string): void {
  console.log('');
  console.log('  Next steps:');
  console.log('    npx sublyzer-snapshot scan          Local scan (no account needed)');
  console.log('    npx sublyzer-snapshot run           Scan + save history');
  if (cloud) {
    console.log('    npx sublyzer-snapshot run --push    Push to Sublyzer dashboard');
  } else {
    console.log('    npx sublyzer-snapshot init --code … Optional cloud link');
  }
  console.log('    npx sublyzer-snapshot report        Markdown report');
  console.log('');

  if (cloud && stackId && code && apiUrl) {
    info('Optional live SDK (Sublyzer cloud):');
    console.log('');
    console.log(`  <script src="/sdks/sublyzer.js" defer data-integration-code="${code}" data-api-url="${apiUrl}"></script>`);
    console.log('');
    console.log(`  Docs: ${DOCS_URL}`);
    console.log('');
  }
}
