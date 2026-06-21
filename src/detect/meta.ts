import * as fs from 'node:fs';
import * as path from 'node:path';

const CANDIDATES = [
  '.env.example',
  '.env.sample',
  '.env.template',
  'env.example',
];

export type EnvFileInfo = {
  found: string[];
  hasDotEnv: boolean;
};

export function detectEnvFiles(root = process.cwd()): EnvFileInfo {
  const found: string[] = [];
  for (const name of CANDIDATES) {
    if (fs.existsSync(path.join(root, name))) found.push(name);
  }
  const hasDotEnv = fs.existsSync(path.join(root, '.env'));
  return { found, hasDotEnv };
}

export function detectScripts(root = process.cwd()): Record<string, string> {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as { scripts?: Record<string, string> };
    return pkg.scripts || {};
  } catch {
    return {};
  }
}

export function detectNodeEngine(root = process.cwd()): string | undefined {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as { engines?: { node?: string } };
    return pkg.engines?.node;
  } catch {
    return undefined;
  }
}
