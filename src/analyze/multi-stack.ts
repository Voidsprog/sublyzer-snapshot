import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SecondaryStack } from './types.js';

export function detectSecondaryStacks(root: string): SecondaryStack[] {
  const stacks: SecondaryStack[] = [];

  if (fs.existsSync(path.join(root, 'go.mod'))) {
    const hints = ['go.mod'];
    const goFiles = countFiles(root, '.go', 3);
    if (goFiles) hints.push(`${goFiles} .go files`);
    stacks.push({ id: 'go', label: 'Go', hints });
  }

  const pyMarkers = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py'];
  for (const m of pyMarkers) {
    if (fs.existsSync(path.join(root, m))) {
      const hints = [m];
      const pyFiles = countFiles(root, '.py', 3);
      if (pyFiles) hints.push(`${pyFiles} .py files`);
      stacks.push({ id: 'python', label: 'Python', hints });
      break;
    }
  }

  return stacks;
}

function countFiles(root: string, ext: string, maxDepth: number): number {
  let count = 0;
  function walk(dir: string, depth: number) {
    if (depth > maxDepth || count > 50) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (['node_modules', '.git', 'dist', 'build', '.next', 'venv', '.venv'].includes(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, depth + 1);
      else if (ent.isFile() && ent.name.endsWith(ext)) count++;
    }
  }
  walk(root, 0);
  return count;
}
