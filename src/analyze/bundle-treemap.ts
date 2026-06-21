import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BundleTreemapNode } from './types.js';

const OUTPUT_DIRS = ['.next', 'dist', 'build', 'out', '.output'];

function dirSize(dir: string, maxDepth = 3, depth = 0): number {
  if (depth > maxDepth) return 0;
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === 'cache') continue;
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

function buildTree(dir: string, rel: string, maxDepth = 2, depth = 0): BundleTreemapNode | null {
  if (depth > maxDepth) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const children: BundleTreemapNode[] = [];
  let bytes = 0;

  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === 'cache') continue;
    const full = path.join(dir, ent.name);
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    try {
      if (ent.isDirectory()) {
        const sub = buildTree(full, childRel, maxDepth, depth + 1);
        if (sub && sub.bytes > 0) {
          children.push(sub);
          bytes += sub.bytes;
        }
      } else if (ent.isFile()) {
        const size = fs.statSync(full).size;
        if (size > 0) {
          bytes += size;
          children.push({
            name: ent.name,
            path: childRel,
            bytes: size,
            mb: Math.round((size / 1024 / 1024) * 100) / 100,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (bytes === 0) return null;
  return {
    name: path.basename(dir),
    path: rel || path.basename(dir),
    bytes,
    mb: Math.round((bytes / 1024 / 1024) * 100) / 100,
    children: children.sort((a, b) => b.bytes - a.bytes).slice(0, 12),
  };
}

export function analyzeBundleTreemap(root: string): BundleTreemapNode[] {
  const nodes: BundleTreemapNode[] = [];
  for (const name of OUTPUT_DIRS) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) continue;
    const tree = buildTree(full, name, 2, 0);
    if (tree) nodes.push(tree);
  }
  return nodes.sort((a, b) => b.bytes - a.bytes);
}
