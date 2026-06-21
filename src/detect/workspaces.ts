import * as fs from 'node:fs';
import * as path from 'node:path';

export type WorkspaceInfo = {
  type: 'npm' | 'pnpm' | 'yarn' | 'none';
  packages: string[];
};

function readPackageJson(root: string): Record<string, unknown> | null {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function expandWorkspaceGlobs(root: string, patterns: string[]): string[] {
  const found = new Set<string>();
  for (const pattern of patterns) {
    const base = pattern.replace(/\*.*$/, '').replace(/\/$/, '');
    const dir = path.join(root, base);
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      found.add(base || '.');
    }
    if (pattern.includes('*') && fs.existsSync(dir)) {
      try {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!ent.isDirectory()) continue;
          const rel = path.join(base, ent.name).replace(/\\/g, '/');
          if (fs.existsSync(path.join(root, rel, 'package.json'))) found.add(rel);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return [...found].sort();
}

export function detectWorkspaces(root = process.cwd()): WorkspaceInfo {
  if (fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) {
    const pkgs = expandWorkspaceGlobs(root, ['packages/*', 'apps/*', 'projects/*']);
    return { type: 'pnpm', packages: pkgs.length ? pkgs : ['.'] };
  }

  const pkg = readPackageJson(root);
  const workspaces = pkg?.workspaces;
  if (Array.isArray(workspaces)) {
    return { type: 'npm', packages: expandWorkspaceGlobs(root, workspaces as string[]) };
  }
  if (workspaces && typeof workspaces === 'object' && Array.isArray((workspaces as any).packages)) {
    return { type: 'npm', packages: expandWorkspaceGlobs(root, (workspaces as any).packages) };
  }

  return { type: 'none', packages: ['.'] };
}
