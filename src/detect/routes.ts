import * as fs from 'node:fs';
import * as path from 'node:path';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo']);

function walkFiles(dir: string, maxDepth = 6, depth = 0): string[] {
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
    if (ent.isDirectory()) {
      files.push(...walkFiles(full, maxDepth, depth + 1));
    } else if (ent.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function nextAppRoutes(root: string): string[] {
  const routes: string[] = [];
  const appDir = path.join(root, 'app');
  if (!fs.existsSync(appDir)) return routes;

  for (const file of walkFiles(appDir, 8)) {
    const rel = path.relative(appDir, file).replace(/\\/g, '/');
    if (rel.endsWith('/page.tsx') || rel.endsWith('/page.ts') || rel.endsWith('/page.jsx') || rel.endsWith('/page.js')) {
      const routePath = '/' + rel.replace(/\/page\.(tsx|ts|jsx|js)$/, '').replace(/^page\.(tsx|ts|jsx|js)$/, '');
      routes.push(routePath === '/' ? '/' : routePath.replace(/\/index$/, '') || '/');
    }
  }
  return [...new Set(routes)].sort();
}

function nextPagesRoutes(root: string): string[] {
  const pagesDir = path.join(root, 'pages');
  if (!fs.existsSync(pagesDir)) return [];
  const routes: string[] = [];
  for (const file of walkFiles(pagesDir, 6)) {
    if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue;
    const rel = path.relative(pagesDir, file).replace(/\\/g, '/');
    if (rel.startsWith('api/')) continue;
    const withoutExt = rel.replace(/\.(tsx|ts|jsx|js)$/, '');
    if (withoutExt === 'index') routes.push('/');
    else routes.push('/' + withoutExt.replace(/\/index$/, ''));
  }
  return [...new Set(routes)].sort();
}

const ROUTE_PATTERNS = [
  /\.(?:get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]/gi,
  /@(?:Get|Post|Put|Patch|Delete)\(\s*['"`]([^'"`]+)['"`]/g,
  /router\.(?:get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/gi,
  /app\.(?:get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/gi,
];

function scanSourceRoutes(root: string): string[] {
  const srcDirs = ['src', 'server', 'api', 'routes', 'app'].map((d) => path.join(root, d)).filter((d) => fs.existsSync(d));
  const routes = new Set<string>();
  for (const dir of srcDirs) {
    for (const file of walkFiles(dir, 5)) {
      if (!/\.(tsx?|jsx?)$/.test(file)) continue;
      let content: string;
      try {
        content = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const re of ROUTE_PATTERNS) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content))) {
          const r = m[1]?.trim();
          if (r && r.length < 120) routes.add(r.startsWith('/') ? r : `/${r}`);
        }
      }
    }
  }
  return [...routes].sort();
}

export function detectRoutes(stackId: string, root = process.cwd()): string[] {
  if (stackId === 'nextjs') {
    const app = nextAppRoutes(root);
    const pages = nextPagesRoutes(root);
    const merged = [...new Set([...app, ...pages])];
    if (merged.length) return merged.slice(0, 200);
  }
  return scanSourceRoutes(root).slice(0, 200);
}
