import * as fs from 'node:fs';
import * as path from 'node:path';

export type DetectedStack = {
  id: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  hints: string[];
  frameworkVersions: Record<string, string>;
};

type PackageJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const VERSION_KEYS = [
  'next',
  'react',
  'react-dom',
  'vue',
  'nuxt',
  '@nestjs/core',
  'express',
  'fastify',
  '@remix-run/react',
  '@sveltejs/kit',
  'typescript',
];

function readPackageJson(root: string): PackageJson | null {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as PackageJson;
  } catch {
    return null;
  }
}

function allDeps(pkg: PackageJson | null): Record<string, string> {
  if (!pkg) return {};
  return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
}

function exists(root: string, rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

function frameworkVersions(deps: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of VERSION_KEYS) {
    if (deps[key]) out[key] = deps[key];
  }
  return out;
}

export function detectStack(root = process.cwd()): DetectedStack {
  const pkg = readPackageJson(root);
  const deps = allDeps(pkg);
  const hints: string[] = [];
  const versions = frameworkVersions(deps);

  if (deps.next) {
    hints.push('package.json → next');
    if (exists(root, 'app') || exists(root, 'pages') || exists(root, 'src/app') || exists(root, 'src/pages')) {
      hints.push('app/ or pages/ directory');
    }
    return { id: 'nextjs', label: 'Next.js', confidence: 'high', hints, frameworkVersions: versions };
  }

  if (deps.nuxt || deps['nuxt3']) {
    hints.push('package.json → nuxt');
    return { id: 'nuxt', label: 'Nuxt', confidence: 'high', hints, frameworkVersions: versions };
  }

  if (deps['@sveltejs/kit']) {
    hints.push('package.json → @sveltejs/kit');
    return { id: 'sveltekit', label: 'SvelteKit', confidence: 'high', hints, frameworkVersions: versions };
  }

  if (deps['@nestjs/core']) {
    hints.push('package.json → @nestjs/core');
    if (exists(root, 'nest-cli.json')) hints.push('nest-cli.json');
    return { id: 'nestjs', label: 'NestJS', confidence: 'high', hints, frameworkVersions: versions };
  }

  if (deps.fastify) {
    hints.push('package.json → fastify');
    return { id: 'fastify', label: 'Fastify', confidence: 'high', hints, frameworkVersions: versions };
  }

  if (deps.express) {
    hints.push('package.json → express');
    return { id: 'express', label: 'Express', confidence: 'high', hints, frameworkVersions: versions };
  }

  if (deps['@remix-run/react'] || deps['@remix-run/node']) {
    hints.push('package.json → remix');
    return { id: 'remix', label: 'Remix', confidence: 'high', hints, frameworkVersions: versions };
  }

  if (deps.react && !deps.next) {
    hints.push('package.json → react');
    return { id: 'react', label: 'React', confidence: 'medium', hints, frameworkVersions: versions };
  }

  if (deps.vue) {
    hints.push('package.json → vue');
    return { id: 'vue', label: 'Vue', confidence: 'medium', hints, frameworkVersions: versions };
  }

  if (pkg?.name) hints.push(`package.json name: ${pkg.name}`);

  if (exists(root, 'package.json')) {
    return { id: 'node', label: 'Node.js', confidence: 'low', hints, frameworkVersions: versions };
  }

  return { id: 'unknown', label: 'Unknown', confidence: 'low', hints: ['No package.json found'], frameworkVersions: versions };
}

export function readProjectName(root = process.cwd()): string {
  const pkg = readPackageJson(root);
  if (pkg?.name) return pkg.name;
  return path.basename(root);
}

export function listDependencies(root = process.cwd()): { name: string; version: string; dev: boolean }[] {
  const pkg = readPackageJson(root);
  if (!pkg) return [];
  const out: { name: string; version: string; dev: boolean }[] = [];
  for (const [name, version] of Object.entries(pkg.dependencies || {})) {
    out.push({ name, version, dev: false });
  }
  for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
    out.push({ name, version, dev: true });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
