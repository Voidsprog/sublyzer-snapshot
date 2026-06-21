import { SDK_NAME, SDK_VERSION } from '../constants.js';
import type { ScanTarget } from '../detect/scan-target.js';
import { detectGit, type GitInfo } from '../detect/git.js';
import { detectEnvFiles, detectNodeEngine, detectScripts } from '../detect/meta.js';
import { detectRoutes } from '../detect/routes.js';
import { detectStack, listDependencies, readProjectName } from '../detect/stack.js';
import { detectWorkspaces, type WorkspaceInfo } from '../detect/workspaces.js';
import { detectBundleSizes, type BundleSizeInfo } from './bundle-size.js';
import { computeHealthScore, formatHealthBar, type HealthScore } from './health-score.js';
import { runNpmAudit, type AuditSummary } from './audit.js';
import { runNpmOutdated, type OutdatedSummary } from './outdated.js';
import { runProjectAnalysis } from '../analyze/index.js';
import type { ProjectAnalysis } from '../analyze/types.js';
import { loadScanTrends, trendDelta } from './history-trends.js';

export type ProjectSnapshot = {
  scannedAt: string;
  projectName: string;
  scanRoot: string;
  scanTargetReason: string;
  stack: ReturnType<typeof detectStack>;
  routes: string[];
  dependencies: ReturnType<typeof listDependencies>;
  dependencyCount: number;
  git: GitInfo;
  env: ReturnType<typeof detectEnvFiles>;
  nodeEngine?: string;
  scripts: Record<string, string>;
  workspaces: WorkspaceInfo;
  outdated: OutdatedSummary;
  bundle: BundleSizeInfo;
  audit: AuditSummary;
  health: HealthScore;
  analysis?: ProjectAnalysis;
  summary: {
    routeCount: number;
    productionDeps: number;
    devDeps: number;
    vulnerablePackages: number;
    criticalVulns: number;
    highVulns: number;
    healthScore: number;
    healthGrade: HealthScore['grade'];
    bundleMb: number;
    issueCount?: number;
  };
};

export type BuildSnapshotOptions = {
  skipAudit?: boolean;
  skipOutdated?: boolean;
  skipBundle?: boolean;
  skipDeep?: boolean;
  target?: ScanTarget;
  configAnchor?: string;
};
export async function buildProjectSnapshot(
  root = process.cwd(),
  opts: BuildSnapshotOptions = {},
): Promise<ProjectSnapshot> {
  const scanRoot = opts.target?.root || root;
  const anchor = opts.configAnchor || root;
  const stack = opts.target?.stack || detectStack(scanRoot);
  const routes = detectRoutes(stack.id, scanRoot);
  const dependencies = listDependencies(scanRoot);
  const audit = opts.skipAudit
    ? { ran: false, total: 0, critical: 0, high: 0, moderate: 0, low: 0, advisories: [], error: 'skipped' }
    : runNpmAudit(scanRoot);
  const outdated = opts.skipOutdated
    ? { ran: false, total: 0, majorCount: 0, packages: [], error: 'skipped' }
    : runNpmOutdated(scanRoot);
  const git = detectGit(root);
  const env = detectEnvFiles(scanRoot);
  const scripts = detectScripts(scanRoot);
  const nodeEngine = detectNodeEngine(scanRoot);
  const workspaces = detectWorkspaces(root);
  const bundle = opts.skipBundle ? { scanned: false, totalBytes: 0, totalMb: 0, folders: [] } : detectBundleSizes(scanRoot);

  const productionDeps = dependencies.filter((d) => !d.dev).length;
  const devDeps = dependencies.filter((d) => d.dev).length;

  const partial: ProjectSnapshot = {
    scannedAt: new Date().toISOString(),
    projectName: readProjectName(scanRoot),
    scanRoot,
    scanTargetReason: opts.target?.reason || 'current directory',
    stack,
    routes,
    dependencies,
    dependencyCount: dependencies.length,
    git,
    env,
    nodeEngine,
    scripts,
    workspaces,
    outdated,
    bundle,
    audit,
    health: { score: 0, grade: 'F', factors: [] },
    summary: {
      routeCount: routes.length,
      productionDeps,
      devDeps,
      vulnerablePackages: audit.total,
      criticalVulns: audit.critical,
      highVulns: audit.high,
      healthScore: 0,
      healthGrade: 'F',
      bundleMb: bundle.totalMb,
    },
  };

  const analysis = await runProjectAnalysis(partial, { skipDeep: opts.skipDeep, anchor });
  const trends = loadScanTrends(anchor);
  const td = trendDelta(trends);
  const health = computeHealthScore(partial, analysis, td?.health ?? null);

  partial.health = health;
  partial.analysis = analysis;
  partial.summary.healthScore = health.score;
  partial.summary.healthGrade = health.grade;
  partial.summary.issueCount = analysis.issues.length;

  return partial;
}
export type CollectItem = {
  dataType: 'custom_event' | 'vulnerability' | 'performance';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  data: Record<string, unknown>;
};

export function snapshotToCollectItems(snapshot: ProjectSnapshot): CollectItem[] {
  const items: CollectItem[] = [
    {
      dataType: 'custom_event',
      source: SDK_NAME,
      data: {
        eventType: 'project_snapshot',
        sdkVersion: SDK_VERSION,
        projectName: snapshot.projectName,
        scanRoot: snapshot.scanRoot,
        stack: snapshot.stack,
        health: snapshot.health,
        routes: snapshot.routes.slice(0, 100),
        routeCount: snapshot.summary.routeCount,
        dependencyCount: snapshot.dependencyCount,
        productionDeps: snapshot.summary.productionDeps,
        devDeps: snapshot.summary.devDeps,
        workspaces: snapshot.workspaces,
        bundle: snapshot.bundle.scanned ? { totalMb: snapshot.bundle.totalMb, folders: snapshot.bundle.folders } : null,
        outdated: snapshot.outdated.ran
          ? { total: snapshot.outdated.total, majorCount: snapshot.outdated.majorCount }
          : null,
        git: snapshot.git.available
          ? { branch: snapshot.git.branch, commit: snapshot.git.commit, dirty: snapshot.git.dirty }
          : null,
        env: { exampleFiles: snapshot.env.found, hasDotEnv: snapshot.env.hasDotEnv },
        nodeEngine: snapshot.nodeEngine,
        scriptNames: Object.keys(snapshot.scripts).slice(0, 30),
        audit: {
          ran: snapshot.audit.ran,
          total: snapshot.audit.total,
          critical: snapshot.audit.critical,
          high: snapshot.audit.high,
          moderate: snapshot.audit.moderate,
          low: snapshot.audit.low,
        },
        scannedAt: snapshot.scannedAt,
      },
    },
  ];

  for (const adv of snapshot.audit.advisories.slice(0, 15)) {
    const sev = adv.severity as CollectItem['severity'];
    items.push({
      dataType: 'vulnerability',
      severity: sev === 'critical' || sev === 'high' || sev === 'medium' || sev === 'low' ? sev : 'medium',
      source: SDK_NAME,
      data: {
        type: 'dependency_audit',
        package: adv.name,
        title: adv.title,
        severity: adv.severity,
        scanner: 'npm-audit',
        projectName: snapshot.projectName,
      },
    });
  }

  items.push({
    dataType: 'performance',
    source: SDK_NAME,
    data: {
      metric: 'snapshot_health_score',
      value: snapshot.health.score,
      unit: 'score',
      grade: snapshot.health.grade,
      projectName: snapshot.projectName,
      stack: snapshot.stack.id,
    },
  });

  if (snapshot.summary.routeCount > 0) {
    items.push({
      dataType: 'performance',
      source: SDK_NAME,
      data: {
        metric: 'snapshot_route_count',
        value: snapshot.summary.routeCount,
        unit: 'routes',
        projectName: snapshot.projectName,
        stack: snapshot.stack.id,
      },
    });
  }

  if (snapshot.bundle.scanned && snapshot.bundle.totalMb > 0) {
    items.push({
      dataType: 'performance',
      source: SDK_NAME,
      data: {
        metric: 'snapshot_build_size_mb',
        value: snapshot.bundle.totalMb,
        unit: 'mb',
        folders: snapshot.bundle.folders,
        projectName: snapshot.projectName,
      },
    });
  }

  return items;
}

export function printLocalSummary(snapshot: ProjectSnapshot): void {
  console.log('');
  console.log(`  Project:       ${snapshot.projectName}`);
  if (snapshot.scanTargetReason !== 'current directory') {
    console.log(`  Scan root:     ${snapshot.scanRoot} (${snapshot.scanTargetReason})`);
  }
  console.log(`  Stack:         ${snapshot.stack.label} (${snapshot.stack.confidence})`);
  console.log(`  Health:        ${formatHealthBar(snapshot.health.score)}  grade ${snapshot.health.grade}`);
  const fw = Object.entries(snapshot.stack.frameworkVersions).slice(0, 4);
  if (fw.length) {
    console.log(`  Frameworks:    ${fw.map(([k, v]) => `${k}@${v}`).join(', ')}`);
  }
  if (snapshot.workspaces.packages.length > 1) {
    console.log(`  Monorepo:      ${snapshot.workspaces.type} — ${snapshot.workspaces.packages.length} packages`);
  }
  console.log(`  Routes:        ${snapshot.summary.routeCount}`);
  console.log(`  Dependencies:  ${snapshot.summary.productionDeps} prod / ${snapshot.summary.devDeps} dev`);
  if (snapshot.bundle.scanned) {
    console.log(`  Build output:  ${snapshot.bundle.totalMb} MB (${snapshot.bundle.folders.map((f) => f.name).join(', ')})`);
  }
  if (snapshot.outdated.ran && snapshot.outdated.total > 0) {
    console.log(`  Outdated:      ${snapshot.outdated.total} (${snapshot.outdated.majorCount} major)`);
  }
  if (snapshot.git.available) {
    const dirty = snapshot.git.dirty ? ' (dirty)' : '';
    console.log(`  Git:           ${snapshot.git.branch} @ ${snapshot.git.commit}${dirty}`);
  }
  if (snapshot.audit.ran) {
    console.log(
      `  Vulnerabilities: ${snapshot.audit.total} (critical ${snapshot.audit.critical}, high ${snapshot.audit.high})`,
    );
  } else {
    console.log(`  Vulnerabilities: skipped (${snapshot.audit.error || 'npm audit unavailable'})`);
  }
  if (snapshot.analysis?.ran) {
    console.log(`  Code issues:   ${snapshot.summary.issueCount ?? snapshot.analysis.issues.length}`);
    if (snapshot.analysis.benchmarks) {
      console.log(`  Benchmark:     ${snapshot.analysis.benchmarks.label}`);
    }
    if (snapshot.analysis.secondaryStacks?.length) {
      console.log(`  Also found:    ${snapshot.analysis.secondaryStacks.map((s) => s.label).join(', ')}`);
    }
  }
  if (snapshot.routes.length) {
    console.log('  Sample routes:');
    for (const r of snapshot.routes.slice(0, 8)) {
      console.log(`    • ${r}`);
    }
    if (snapshot.routes.length > 8) {
      console.log(`    … +${snapshot.routes.length - 8} more`);
    }
  }
  console.log('');
}
