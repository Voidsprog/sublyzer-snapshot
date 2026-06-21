import * as path from 'node:path';
import {
  DEFAULT_API_URL,
  DEFAULT_DASHBOARD_URL,
  INTEGRATION_CODE_RE,
} from '../constants.js';
import { saveConfig, type SnapshotConfig } from '../config.js';
import { detectStack, readProjectName } from '../detect/stack.js';
import { validateIntegrationCode } from '../api/sublyzer.js';
import { promptOptional, promptRequired } from '../utils/prompt.js';
import { ensureGitignore, printSdkHint } from '../utils/gitignore.js';
import { info, ok, title } from '../utils/log.js';

export type InitOptions = {
  code?: string;
  readKey?: string;
  apiUrl?: string;
  dashboardUrl?: string;
  yes?: boolean;
  skipGitignore?: boolean;
};

export async function runInit(opts: InitOptions = {}): Promise<void> {
  title('Sublyzer Snapshot — init');

  const root = process.cwd();
  const stack = detectStack(root);
  const projectName = readProjectName(root);

  info(`Project: ${projectName}`);
  info(`Detected stack: ${stack.label} (${stack.confidence})`);
  if (stack.hints.length) {
    for (const h of stack.hints) info(`  hint: ${h}`);
  }

  const apiUrl = (opts.apiUrl || process.env.SUBLYZER_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
  const dashboardUrl = (opts.dashboardUrl || process.env.SUBLYZER_DASHBOARD_URL || DEFAULT_DASHBOARD_URL).replace(/\/$/, '');

  let code = (opts.code || process.env.SUBLYZER_INTEGRATION_CODE || process.env.SUBLYZER_CODE || '')
    .trim()
    .toUpperCase();

  if (!code) {
    console.log('');
    console.log('  Get your integration code at: https://sublyzer.com/dashboard');
    console.log('  (Integrations → copy the 24-character code)');
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
    console.log('');
    console.log('  Optional: apiReadKey enables `sublyzer-snapshot pull` (read data back).');
    console.log('  Get it from: GET /integrations/{id}/read-access (dashboard JWT) or skip for now.');
    console.log('');
    readKey = (await promptOptional('Read key (optional, press Enter to skip)')) || '';
  }

  info(`Validating code against ${apiUrl}…`);
  const validation = await validateIntegrationCode(apiUrl, code);

  if (!validation.valid || !validation.integration) {
    throw new Error(validation.message || 'Integration code not found or invalid');
  }

  ok(`Integration "${validation.integration.name}" (${validation.integration.status})`);

  const now = new Date().toISOString();
  const config: SnapshotConfig = {
    version: 1,
    integrationCode: code,
    apiUrl,
    dashboardUrl,
    integrationId: validation.integration.id,
    integrationName: validation.integration.name,
    projectName,
    projectRoot: root,
    stack: stack.id,
    createdAt: now,
    updatedAt: now,
  };
  if (readKey.length >= 32) {
    config.readKey = readKey;
    ok('Read key saved — `pull` command enabled');
  }

  saveConfig(config, root);
  ok(`Wrote ${path.join('.sublyzer', 'snapshot.json')}`);

  if (!opts.skipGitignore) {
    ensureGitignore(root);
  }

  console.log('');
  console.log('  Next steps:');
  console.log('    sublyzer-snapshot run       Scan + push to Sublyzer');
  console.log('    sublyzer-snapshot report    Markdown health report');
  console.log('    sublyzer-snapshot compare   Diff vs previous scan');
  console.log('    sublyzer-snapshot ci        GitHub Actions template');
  console.log('    sublyzer-snapshot doctor    Verify setup');
  console.log('    sublyzer-snapshot open      Open dashboard');
  console.log('');

  printSdkHint(stack.id, code, apiUrl);
}
