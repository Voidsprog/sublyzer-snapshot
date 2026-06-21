import * as fs from 'node:fs';
import type { UnusedDependency } from './types.js';
import { walkSourceFiles } from './walk.js';

const BUILTIN = new Set([
  'node',
  'fs',
  'path',
  'crypto',
  'http',
  'https',
  'url',
  'util',
  'stream',
  'events',
  'buffer',
  'os',
  'child_process',
  'zlib',
  'assert',
  'typescript',
  'tsx',
  '@types/node',
]);

function depImportPatterns(name: string): RegExp[] {
  const scoped = name.startsWith('@');
  const patterns = [
    new RegExp(`from\\s+['"]${name.replace('/', '\\/')}['"]`),
    new RegExp(`require\\(\\s*['"]${name.replace('/', '\\/')}['"]\\)`),
    new RegExp(`import\\(\\s*['"]${name.replace('/', '\\/')}['"]\\)`),
  ];
  if (!scoped) {
    patterns.push(new RegExp(`from\\s+['"]${name}/`));
    patterns.push(new RegExp(`require\\(\\s*['"]${name}/`));
  }
  return patterns;
}

export function analyzeUnusedDeps(
  root: string,
  deps: { name: string; version: string; dev: boolean }[],
): UnusedDependency[] {
  const files = walkSourceFiles(root, { maxDepth: 8 });
  let corpus = '';
  for (const file of files) {
    try {
      corpus += fs.readFileSync(file, 'utf8') + '\n';
    } catch {
      /* ignore */
    }
  }

  // Also scan config files
  for (const cfg of ['next.config.js', 'next.config.mjs', 'next.config.ts', 'vite.config.ts', 'tailwind.config.js']) {
    const p = `${root}/${cfg}`;
    try {
      if (fs.existsSync(p)) corpus += fs.readFileSync(p, 'utf8');
    } catch {
      /* ignore */
    }
  }

  const unused: UnusedDependency[] = [];
  for (const dep of deps) {
    if (BUILTIN.has(dep.name)) continue;
    if (dep.name.startsWith('@types/')) continue;
    const patterns = depImportPatterns(dep.name);
    if (!patterns.some((re) => re.test(corpus))) {
      unused.push({ name: dep.name, version: dep.version, dev: dep.dev });
    }
  }

  return unused.slice(0, 20);
}
