import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NextJsAnalysis } from './types.js';
import { relPath, walkSourceFiles } from './walk.js';

function isClientComponent(content: string): boolean {
  return /^\s*['"]use client['"]\s*;?/m.test(content);
}

function usesHooksOrBrowser(content: string): boolean {
  return (
    /\buse(State|Effect|Ref|Context|Reducer|Memo|Callback|LayoutEffect)\b/.test(content) ||
    /\b(window|document|localStorage)\b/.test(content)
  );
}

function usesFetch(content: string): boolean {
  return /\bfetch\s*\(/.test(content);
}

export function analyzeNextJsPatterns(root: string): NextJsAnalysis | null {
  const appDirs = ['app', 'src/app'].map((d) => path.join(root, d)).filter((d) => fs.existsSync(d));
  const pageDirs = ['pages', 'src/pages'].map((d) => path.join(root, d)).filter((d) => fs.existsSync(d));
  if (!appDirs.length && !pageDirs.length) return null;

  const files = walkSourceFiles(root, { maxDepth: 8, extensions: /\.(tsx|jsx)$/ });
  let clientComponents = 0;
  let serverCandidates = 0;
  const missingUseClient: string[] = [];
  const fetchInClient: string[] = [];
  const largeClientPages: string[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = relPath(root, file);
    const isPage = /\/(page|layout)\.(tsx|jsx)$/.test(rel) || /^pages\//.test(rel);
    const isClient = isClientComponent(content);

    if (isClient) {
      clientComponents++;
      if (isPage && content.split('\n').length > 300) largeClientPages.push(rel);
      if (usesFetch(content)) fetchInClient.push(rel);
    } else if (isPage || rel.includes('/components/')) {
      serverCandidates++;
      if (usesHooksOrBrowser(content) && !rel.includes('.test.')) {
        missingUseClient.push(rel);
      }
    }
  }

  const total = clientComponents + serverCandidates;
  return {
    clientComponents,
    serverCandidates,
    clientRatio: total ? Math.round((clientComponents / total) * 100) : 0,
    missingUseClient: missingUseClient.slice(0, 10),
    fetchInClient: fetchInClient.slice(0, 8),
    largeClientPages: largeClientPages.slice(0, 8),
  };
}
