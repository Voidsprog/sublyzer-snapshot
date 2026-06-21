import { spawnSync } from 'node:child_process';

export type GitInfo = {
  available: boolean;
  branch?: string;
  commit?: string;
  dirty?: boolean;
  remote?: string;
};

function runGit(args: string[], root: string): string | null {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10_000 });
  if (res.status !== 0) return null;
  return (res.stdout || '').trim() || null;
}

export function detectGit(root = process.cwd()): GitInfo {
  const inside = runGit(['rev-parse', '--is-inside-work-tree'], root);
  if (inside !== 'true') {
    return { available: false };
  }

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], root) || undefined;
  const commit = runGit(['rev-parse', '--short', 'HEAD'], root) || undefined;
  const dirtyOut = runGit(['status', '--porcelain'], root);
  const remote = runGit(['remote', 'get-url', 'origin'], root) || undefined;

  return {
    available: true,
    branch,
    commit,
    dirty: dirtyOut ? dirtyOut.length > 0 : undefined,
    remote,
  };
}
