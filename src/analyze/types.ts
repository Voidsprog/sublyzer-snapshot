export type AnalysisIssue = {
  id: string;
  category: 'smell' | 'complexity' | 'duplicate' | 'nextjs' | 'dependency' | 'rule' | 'security';
  severity: 'info' | 'warning' | 'high';
  message: string;
  file?: string;
  line?: number;
  metric?: number;
};

export type ComplexityEntry = {
  file: string;
  lines: number;
  complexity: number;
};

export type DuplicateBlock = {
  lines: number;
  occurrences: number;
  sample: string;
  files: string[];
};

export type NextJsAnalysis = {
  clientComponents: number;
  serverCandidates: number;
  clientRatio: number;
  missingUseClient: string[];
  fetchInClient: string[];
  largeClientPages: string[];
};

export type UnusedDependency = {
  name: string;
  version: string;
  dev: boolean;
};

export type BundleTreemapNode = {
  name: string;
  path: string;
  bytes: number;
  mb: number;
  children?: BundleTreemapNode[];
};

export type BenchmarkResult = {
  stack: string;
  sizeTier: 'small' | 'medium' | 'large';
  percentile: number;
  label: string;
  metrics: { name: string; yours: number; median: number; unit: string; better: 'lower' | 'higher' }[];
};

export type SecondaryStack = {
  id: string;
  label: string;
  hints: string[];
};

export type CustomRuleResult = {
  ruleId: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'high';
  file?: string;
};

export type ProjectAnalysis = {
  ran: boolean;
  durationMs: number;
  issues: AnalysisIssue[];
  complexity: ComplexityEntry[];
  duplicates: DuplicateBlock[];
  nextjs: NextJsAnalysis | null;
  unusedDeps: UnusedDependency[];
  bundleTreemap: BundleTreemapNode[];
  benchmarks: BenchmarkResult | null;
  secondaryStacks: SecondaryStack[];
  customRules: CustomRuleResult[];
};
