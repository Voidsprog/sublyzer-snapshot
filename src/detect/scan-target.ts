import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectStack } from './stack.js';
import { detectWorkspaces } from './workspaces.js';

export type ScanTarget = {
  root: string;
  reason: string;
  stack: ReturnType<typeof detectStack>;
  score: number;
};

const COMMON_APP_DIRS = [
  'frontend',
  'backend',
  'web',
  'app',
  'client',
  'server',
  'api',
  'apps/web',
  'apps/frontend',
  'apps/api',
  'packages/web',
  'packages/app',
  'packages/frontend',
];

const STACK_SCORE: Record<string, number> = {
  nextjs: 100,
  nestjs: 95,
  sveltekit: 90,
  nuxt: 90,
  remix: 85,
  express: 80,
  fastify: 80,
  react: 60,
  vue: 60,
  node: 30,
  unknown: 0,
};

function scoreTarget(root: string): ScanTarget {
  const stack = detectStack(root);
  let score = STACK_SCORE[stack.id] ?? 20;
  const pkgPath = path.join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const depCount =
        Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;
      score += Math.min(25, depCount);
    } catch {
      /* ignore */
    }
  } else {
    score -= 50;
  }
  return { root, reason: 'candidate', stack, score };
}

function listCandidateRoots(base: string): string[] {
  const candidates = new Set<string>([base]);
  const ws = detectWorkspaces(base);
  for (const pkg of ws.packages) {
    candidates.add(path.join(base, pkg === '.' ? '' : pkg));
  }
  for (const rel of COMMON_APP_DIRS) {
    const full = path.join(base, rel);
    if (fs.existsSync(path.join(full, 'package.json'))) candidates.add(full);
  }
  return [...candidates].filter((r) => fs.existsSync(r));
}

/**
 * Pick the best directory to scan — useful for monorepos where cwd is a meta root.
 */
export function resolveScanTarget(base = process.cwd(), explicitPath?: string): ScanTarget {
  if (explicitPath) {
    const root = path.resolve(base, explicitPath);
    if (!fs.existsSync(root)) throw new Error(`Path not found: ${root}`);
    return { ...scoreTarget(root), reason: 'explicit --path' };
  }

  const candidates = listCandidateRoots(base);
  const scored = candidates.map((root) => scoreTarget(root)).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const cwdTarget = scored.find((t) => path.resolve(t.root) === path.resolve(base));

  if (cwdTarget && cwdTarget.score >= (best?.score ?? 0) - 5) {
    return { ...cwdTarget, reason: 'current directory' };
  }

  if (best && best.score > 35 && candidates.length > 1) {
    const rel = path.relative(base, best.root) || '.';
    return { ...best, reason: `auto-selected (${rel})` };
  }

  return { ...(cwdTarget || best || scoreTarget(base)), reason: 'current directory' };
}

export function findMonorepoScanHints(base = process.cwd()): ScanTarget[] {
  return listCandidateRoots(base)
    .map((root) => scoreTarget(root))
    .filter((t) => t.score > 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
