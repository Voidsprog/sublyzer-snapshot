import * as fs from 'node:fs';
import * as path from 'node:path';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.output', 'coverage', '.turbo', '.sublyzer']);

export function walkSourceFiles(
  root: string,
  opts: { maxDepth?: number; extensions?: RegExp } = {},
): string[] {
  const maxDepth = opts.maxDepth ?? 6;
  const ext = opts.extensions ?? /\.(tsx?|jsx?)$/;

  function walk(dir: string, depth: number): string[] {
    if (depth > maxDepth) return [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const files: string[] = [];
    for (const ent of entries) {
      if (IGNORE.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) files.push(...walk(full, depth + 1));
      else if (ent.isFile() && ext.test(ent.name)) files.push(full);
    }
    return files;
  }

  const srcRoots = ['src', 'app', 'pages', 'lib', 'components', 'server']
    .map((d) => path.join(root, d))
    .filter((d) => fs.existsSync(d));
  if (!srcRoots.length) return walk(root, 0);
  return srcRoots.flatMap((d) => walk(d, 0));
}

export function relPath(root: string, file: string): string {
  return path.relative(root, file).replace(/\\/g, '/');
}
