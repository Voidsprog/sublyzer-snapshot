import * as fs from 'node:fs';
import type { ComplexityEntry } from './types.js';
import { relPath, walkSourceFiles } from './walk.js';

const DECISION_RE =
  /\b(if|for|while|case|catch|else\s+if)\b|\?\s*[^:]|\|\||&&|switch\s*\(/g;

export function analyzeComplexity(root: string, limit = 15): ComplexityEntry[] {
  const files = walkSourceFiles(root, { maxDepth: 7 });
  const entries: ComplexityEntry[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n').length;
    if (lines < 20) continue;

    let complexity = 1;
    const matches = content.match(DECISION_RE);
    if (matches) complexity += matches.length;

    entries.push({
      file: relPath(root, file),
      lines,
      complexity,
    });
  }

  return entries.sort((a, b) => b.complexity - a.complexity).slice(0, limit);
}
