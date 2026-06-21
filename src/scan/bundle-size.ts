import * as fs from 'node:fs';
import * as path from 'node:path';

export type BundleSizeInfo = {
  scanned: boolean;
  totalBytes: number;
  totalMb: number;
  folders: { name: string; bytes: number; mb: number }[];
};

const OUTPUT_DIRS = ['dist', 'build', '.next', 'out', '.output', 'coverage'];

function dirSize(dir: string, maxDepth = 4, depth = 0): number {
  if (depth > maxDepth) return 0;
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules') continue;
    const full = path.join(dir, ent.name);
    try {
      if (ent.isDirectory()) total += dirSize(full, maxDepth, depth + 1);
      else if (ent.isFile()) total += fs.statSync(full).size;
    } catch {
      /* ignore */
    }
  }
  return total;
}

export function detectBundleSizes(root = process.cwd()): BundleSizeInfo {
  const folders: BundleSizeInfo['folders'] = [];
  for (const name of OUTPUT_DIRS) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) continue;
    const bytes = dirSize(full);
    if (bytes > 0) {
      folders.push({ name, bytes, mb: Math.round((bytes / 1024 / 1024) * 10) / 10 });
    }
  }
  const totalBytes = folders.reduce((s, f) => s + f.bytes, 0);
  return {
    scanned: folders.length > 0,
    totalBytes,
    totalMb: Math.round((totalBytes / 1024 / 1024) * 10) / 10,
    folders: folders.sort((a, b) => b.bytes - a.bytes),
  };
}
