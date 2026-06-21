import type { ProjectSnapshot } from '../scan/snapshot.js';
import { analyzeBundleTreemap } from './bundle-treemap.js';
import { computeBenchmark } from './benchmarks.js';
import { analyzeCodeSmells } from './code-smells.js';
import { analyzeComplexity } from './complexity.js';
import { analyzeDuplicates } from './duplicates.js';
import { detectSecondaryStacks } from './multi-stack.js';
import { analyzeNextJsPatterns } from './nextjs-patterns.js';
import type { AnalysisIssue, ProjectAnalysis } from './types.js';
import { analyzeUnusedDeps } from './unused-deps.js';
import { loadCustomRulesAsync, runCustomRules } from '../rules/engine.js';

export type AnalyzeOptions = {
  skipDeep?: boolean;
  anchor?: string;
};

function nextJsToIssues(nextjs: NonNullable<ReturnType<typeof analyzeNextJsPatterns>>): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  if (nextjs.clientRatio > 60) {
    issues.push({
      id: 'nextjs-high-client-ratio',
      category: 'nextjs',
      severity: 'warning',
      message: `${nextjs.clientRatio}% client components — consider more Server Components`,
      metric: nextjs.clientRatio,
    });
  }
  for (const f of nextjs.missingUseClient) {
    issues.push({
      id: 'nextjs-missing-use-client',
      category: 'nextjs',
      severity: 'high',
      message: 'Uses hooks/browser APIs without "use client"',
      file: f,
    });
  }
  for (const f of nextjs.fetchInClient) {
    issues.push({
      id: 'nextjs-fetch-in-client',
      category: 'nextjs',
      severity: 'warning',
      message: 'fetch() in client component — prefer Server Component or SWR/React Query',
      file: f,
    });
  }
  for (const f of nextjs.largeClientPages) {
    issues.push({
      id: 'nextjs-large-client-page',
      category: 'nextjs',
      severity: 'warning',
      message: 'Large client page (>300 lines) — split or move logic server-side',
      file: f,
    });
  }
  return issues;
}

export async function runProjectAnalysis(
  snapshot: ProjectSnapshot,
  opts: AnalyzeOptions = {},
): Promise<ProjectAnalysis> {
  const start = Date.now();
  const root = snapshot.scanRoot;
  const anchor = opts.anchor || root;

  if (opts.skipDeep) {
    return {
      ran: false,
      durationMs: 0,
      issues: [],
      complexity: [],
      duplicates: [],
      nextjs: null,
      unusedDeps: [],
      bundleTreemap: [],
      benchmarks: null,
      secondaryStacks: [],
      customRules: [],
    };
  }

  const complexity = analyzeComplexity(root);
  const smells = analyzeCodeSmells(root);
  const duplicates = analyzeDuplicates(root);
  const nextjs = snapshot.stack.id === 'nextjs' ? analyzeNextJsPatterns(root) : null;
  const unusedDeps = analyzeUnusedDeps(root, snapshot.dependencies);
  const bundleTreemap = snapshot.bundle.scanned ? analyzeBundleTreemap(root) : [];
  const secondaryStacks = detectSecondaryStacks(anchor);
  const benchmarks = computeBenchmark(snapshot);

  const rules = await loadCustomRulesAsync(anchor);
  const customRules = runCustomRules(root, rules);

  const issues: AnalysisIssue[] = [...smells];
  for (const c of complexity.filter((x) => x.complexity > 25).slice(0, 5)) {
    issues.push({
      id: 'high-complexity',
      category: 'complexity',
      severity: c.complexity > 40 ? 'high' : 'warning',
      message: `Cyclomatic complexity ${c.complexity} (${c.lines} lines)`,
      file: c.file,
      metric: c.complexity,
    });
  }
  for (const d of duplicates.slice(0, 5)) {
    issues.push({
      id: 'duplicate-block',
      category: 'duplicate',
      severity: 'info',
      message: `${d.occurrences}× duplicated ${d.lines}-line block: "${d.sample}"`,
      metric: d.occurrences,
    });
  }
  if (nextjs) issues.push(...nextJsToIssues(nextjs));
  for (const u of unusedDeps.slice(0, 8)) {
    issues.push({
      id: 'unused-dependency',
      category: 'dependency',
      severity: 'warning',
      message: `Possibly unused ${u.dev ? 'dev ' : ''}dependency: ${u.name}@${u.version}`,
    });
  }
  for (const r of customRules.filter((x) => !x.passed)) {
    issues.push({
      id: `rule-${r.ruleId}`,
      category: 'rule',
      severity: r.severity,
      message: r.message,
      file: r.file,
    });
  }

  return {
    ran: true,
    durationMs: Date.now() - start,
    issues: issues.slice(0, 50),
    complexity,
    duplicates,
    nextjs,
    unusedDeps,
    bundleTreemap,
    benchmarks,
    secondaryStacks,
    customRules,
  };
}
