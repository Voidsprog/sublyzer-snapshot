import * as fs from 'node:fs';
import * as path from 'node:path';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo']);

const PAGE_EXT = /\.(tsx|ts|jsx|js)$/;
const PAGE_FILE = /\/page\.(tsx|ts|jsx|js)$/;

/** Common HTTP header names falsely matched by `.get('…')` regex on Map/Headers calls. */
const HTTP_HEADER_NAMES = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'authorization',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'cookie',
  'host',
  'origin',
  'referer',
  'user-agent',
  'x-request-id',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
  'x-csrf-token',
  'x-api-key',
]);

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

function existingSubdirs(root: string, relPaths: string[]): string[] {
  return relPaths.map((rel) => path.join(root, rel)).filter((d) => fs.existsSync(d));
}

function stripRouteGroups(segments: string[]): string[] {
  return segments.filter((s) => !(s.startsWith('(') && s.endsWith(')')));
}

function filePathToRoutePath(withoutExt: string): string {
  if (withoutExt === 'index') return '/';
  const normalized = withoutExt.replace(/\/index$/, '');
  return normalized ? `/${normalized}` : '/';
}

function isPrivatePagesFile(rel: string): boolean {
  const parts = rel.split('/');
  return parts.some((p) => p.startsWith('_'));
}

function isLikelyHttpHeaderRoute(route: string): boolean {
  const segment = route.replace(/^\//, '').split('/')[0]?.toLowerCase() ?? '';
  if (!segment) return false;
  if (HTTP_HEADER_NAMES.has(segment)) return true;
  if (segment.startsWith('x-') && !segment.includes('/')) return true;
  return false;
}

function normalizeRoute(raw: string): string | null {
  const r = raw.trim();
  if (!r || r.length >= 120) return null;
  const route = r.startsWith('/') ? r : `/${r}`;
  if (isLikelyHttpHeaderRoute(route)) return null;
  return route;
}

function collectNextAppRoutes(appDir: string): string[] {
  const routes: string[] = [];
  for (const file of walkFiles(appDir, 8)) {
    const rel = path.relative(appDir, file).replace(/\\/g, '/');
    if (!PAGE_FILE.test(`/${rel}`) && !rel.match(/^page\.(tsx|ts|jsx|js)$/)) continue;
    const withoutPage = rel
      .replace(/\/page\.(tsx|ts|jsx|js)$/, '')
      .replace(/^page\.(tsx|ts|jsx|js)$/, '');
    const segments = stripRouteGroups(withoutPage ? withoutPage.split('/') : []);
    routes.push(segments.length ? `/${segments.join('/')}` : '/');
  }
  return routes;
}

function nextAppRoutes(root: string): string[] {
  const dirs = existingSubdirs(root, ['app', 'src/app']);
  const routes = dirs.flatMap(collectNextAppRoutes);
  return [...new Set(routes)].sort();
}

function collectNextPagesRoutes(pagesDir: string): string[] {
  const routes: string[] = [];
  for (const file of walkFiles(pagesDir, 8)) {
    if (!PAGE_EXT.test(file)) continue;
    const rel = path.relative(pagesDir, file).replace(/\\/g, '/');
    if (rel.startsWith('api/')) continue;
    if (isPrivatePagesFile(rel)) continue;
    const withoutExt = rel.replace(/\.(tsx|ts|jsx|js)$/, '');
    routes.push(filePathToRoutePath(withoutExt));
  }
  return routes;
}

function nextPagesRoutes(root: string): string[] {
  const dirs = existingSubdirs(root, ['pages', 'src/pages']);
  const routes = dirs.flatMap(collectNextPagesRoutes);
  return [...new Set(routes)].sort();
}

type RoutePattern = { re: RegExp; requireLeadingSlash: boolean };

const ROUTE_PATTERNS: RoutePattern[] = [
  {
    re: /\.(?:get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]/gi,
    requireLeadingSlash: true,
  },
  { re: /@(?:Get|Post|Put|Patch|Delete)\(\s*['"`]([^'"`]+)['"`]/g, requireLeadingSlash: false },
  {
    re: /router\.(?:get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/gi,
    requireLeadingSlash: true,
  },
  {
    re: /app\.(?:get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/gi,
    requireLeadingSlash: true,
  },
];

function scanSourceRoutes(root: string): string[] {
  const skipDirs = new Set(
    existingSubdirs(root, ['pages', 'src/pages', 'app', 'src/app']).map((d) => d.replace(/\\/g, '/')),
  );
  const srcDirs = ['src', 'server', 'api', 'routes']
    .map((d) => path.join(root, d))
    .filter((d) => fs.existsSync(d) && !skipDirs.has(d.replace(/\\/g, '/')));

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
      for (const { re, requireLeadingSlash } of ROUTE_PATTERNS) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content))) {
          const raw = m[1]?.trim();
          if (!raw) continue;
          if (requireLeadingSlash && !raw.startsWith('/')) continue;
          const route = normalizeRoute(raw);
          if (route) routes.add(route);
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
