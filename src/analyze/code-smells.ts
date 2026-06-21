import * as fs from 'node:fs';
import type { AnalysisIssue } from './types.js';
import { relPath, walkSourceFiles } from './walk.js';

const SMELL_CHECKS: {
  id: string;
  test: (content: string, lines: string[]) => boolean;
  message: string;
  severity: AnalysisIssue['severity'];
}[] = [
  {
    id: 'long-file',
    test: (_c, lines) => lines.length > 500,
    message: 'File exceeds 500 lines — consider splitting',
    severity: 'warning',
  },
  {
    id: 'deep-nesting',
    test: (content) => {
      const max = Math.max(...content.split('\n').map((l) => l.match(/^(\s*)/)?.[1].length ?? 0));
      return max > 24;
    },
    message: 'Deep indentation detected (>6 levels) — simplify nesting',
    severity: 'warning',
  },
  {
    id: 'console-log',
    test: (content) => /\bconsole\.(log|debug|info)\(/.test(content),
    message: 'console.log/debug left in source',
    severity: 'info',
  },
  {
    id: 'todo-fixme',
    test: (content) => /\b(TODO|FIXME|HACK|XXX)\b/.test(content),
    message: 'TODO/FIXME marker found',
    severity: 'info',
  },
  {
    id: 'any-type',
    test: (content) => /:\s*any\b/.test(content),
    message: 'Explicit `any` type usage',
    severity: 'info',
  },
  {
    id: 'empty-catch',
    test: (content) => /catch\s*\([^)]*\)\s*\{\s*\}/.test(content),
    message: 'Empty catch block swallows errors',
    severity: 'warning',
  },
];

export function analyzeCodeSmells(root: string, limit = 25): AnalysisIssue[] {
  const files = walkSourceFiles(root, { maxDepth: 7 });
  const issues: AnalysisIssue[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    const rel = relPath(root, file);

    for (const check of SMELL_CHECKS) {
      if (!check.test(content, lines)) continue;
      const lineNum = lines.findIndex((l) => {
        if (check.id === 'console-log') return /\bconsole\.(log|debug|info)\(/.test(l);
        if (check.id === 'todo-fixme') return /\b(TODO|FIXME|HACK|XXX)\b/.test(l);
        if (check.id === 'any-type') return /:\s*any\b/.test(l);
        if (check.id === 'empty-catch') return /catch\s*\([^)]*\)\s*\{\s*\}/.test(l);
        return false;
      });
      issues.push({
        id: check.id,
        category: 'smell',
        severity: check.severity,
        message: check.message,
        file: rel,
        line: lineNum >= 0 ? lineNum + 1 : undefined,
      });
      if (issues.length >= limit) return issues;
    }
  }

  return issues;
}
