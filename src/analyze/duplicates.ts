import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import type { DuplicateBlock } from './types.js';
import { relPath, walkSourceFiles } from './walk.js';

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

export function analyzeDuplicates(root: string, limit = 8): DuplicateBlock[] {
  const files = walkSourceFiles(root, { maxDepth: 6 });
  const blockMap = new Map<string, { files: Set<string>; sample: string; lines: number }>();

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    const rel = relPath(root, file);
    const window = 5;

    for (let i = 0; i <= lines.length - window; i++) {
      const chunk = lines.slice(i, i + window).map(normalizeLine).filter(Boolean);
      if (chunk.length < window) continue;
      if (chunk.every((l) => l.startsWith('//') || l.startsWith('*'))) continue;
      const key = crypto.createHash('md5').update(chunk.join('\n')).digest('hex');
      const existing = blockMap.get(key);
      if (existing) {
        existing.files.add(rel);
      } else {
        blockMap.set(key, { files: new Set([rel]), sample: chunk[0].slice(0, 80), lines: window });
      }
    }
  }

  return [...blockMap.entries()]
    .map(([, v]) => ({
      lines: v.lines,
      occurrences: v.files.size,
      sample: v.sample,
      files: [...v.files],
    }))
    .filter((b) => b.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limit);
}
