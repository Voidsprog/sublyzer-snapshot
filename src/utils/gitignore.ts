import * as fs from 'node:fs';
import * as path from 'node:path';
import { GITIGNORE_ENTRY } from '../constants.js';
import { ok, info } from './log.js';

export function ensureGitignore(root = process.cwd()): boolean {
  const file = path.join(root, '.gitignore');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `# Sublyzer Snapshot (local integration config)\n${GITIGNORE_ENTRY}\n`, 'utf8');
    ok(`Created .gitignore with ${GITIGNORE_ENTRY}`);
    return true;
  }
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('.sublyzer') || content.includes(GITIGNORE_ENTRY)) {
    return false;
  }
  const next = content.endsWith('\n') ? content : `${content}\n`;
  fs.writeFileSync(file, `${next}\n# Sublyzer Snapshot\n${GITIGNORE_ENTRY}\n`, 'utf8');
  ok(`Added ${GITIGNORE_ENTRY} to .gitignore`);
  return true;
}

export function printSdkHint(stackId: string, integrationCode: string, apiUrl: string): void {
  info('Production monitoring (optional — install the browser SDK):');
  console.log('');
  if (stackId === 'nextjs') {
    console.log(`  <script src="/sdks/sublyzer.js" defer data-integration-code="${integrationCode}" data-api-url="${apiUrl}"></script>`);
  } else {
    console.log(`  <script src="/sdks/sublyzer.js" defer data-integration-code="${integrationCode}" data-api-url="${apiUrl}"></script>`);
  }
  console.log('');
  console.log('  Docs: https://sublyzer.com/docs/sdk');
  console.log('');
}
