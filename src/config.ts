import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_DIR, CONFIG_FILE, type SnapshotMode } from './constants.js';

export type LastScanSummary = {
  scannedAt: string;
  scanRoot: string;
  routeCount: number;
  dependencyCount: number;
  vulnerablePackages: number;
  criticalVulns: number;
  highVulns: number;
  eventsSent: number;
  healthScore: number;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  pushedToCloud: boolean;
};

export type SnapshotConfig = {
  version: 1;
  mode: SnapshotMode;
  integrationCode?: string;
  apiUrl?: string;
  dashboardUrl?: string;
  integrationId?: string;
  integrationName?: string;
  readKey?: string;
  projectName: string;
  /** Config anchor directory (where .sublyzer lives) */
  configRoot: string;
  /** Preferred scan directory (may differ in monorepos) */
  scanRoot: string;
  stack: string;
  createdAt: string;
  updatedAt: string;
  lastScanAt?: string;
  lastScan?: LastScanSummary;
  /** @deprecated use configRoot */
  projectRoot?: string;
};

export function configPath(cwd = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, CONFIG_FILE);
}

export function configExists(cwd = process.cwd()): boolean {
  return fs.existsSync(configPath(cwd));
}

export function tryLoadConfig(cwd = process.cwd()): SnapshotConfig | null {
  if (!configExists(cwd)) return null;
  return loadConfig(cwd);
}

export function loadConfig(cwd = process.cwd()): SnapshotConfig {
  const file = configPath(cwd);
  if (!fs.existsSync(file)) {
    throw new Error(`Config not found at ${file}. Run: sublyzer-snapshot init --local  (or init --code … for cloud sync)`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as SnapshotConfig & { projectRoot?: string };
  if (raw.version !== 1) {
    throw new Error('Unsupported config version. Re-run: sublyzer-snapshot init');
  }
  if (!raw.mode) {
    raw.mode = raw.integrationCode ? 'cloud' : 'local';
  }
  if (!raw.configRoot) {
    raw.configRoot = raw.projectRoot || cwd;
  }
  if (!raw.scanRoot) {
    raw.scanRoot = raw.configRoot;
  }
  return raw;
}

export function saveConfig(config: SnapshotConfig, cwd = process.cwd()): void {
  const anchor = config.configRoot || cwd;
  const file = configPath(anchor);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function isCloudConfig(config: SnapshotConfig): boolean {
  return config.mode === 'cloud' && Boolean(config.integrationCode);
}

export function dashboardIntegrationUrl(config: SnapshotConfig): string | null {
  if (!isCloudConfig(config)) return null;
  const base = (config.dashboardUrl || 'https://sublyzer.com').replace(/\/$/, '');
  if (config.integrationId) {
    return `${base}/dashboard/integration/${config.integrationId}`;
  }
  return `${base}/dashboard`;
}

export function publicReadUrl(config: SnapshotConfig, params?: Record<string, string | number>): string | null {
  if (!config.readKey || !config.integrationCode || !config.apiUrl) return null;
  const base = config.apiUrl.replace(/\/$/, '');
  const url = new URL(`${base}/data-collection/integration/${config.integrationCode}/data`);
  url.searchParams.set('key', config.readKey);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export function maskSecret(value: string | undefined, visible = 4): string {
  if (!value) return '(not set)';
  if (value.length <= visible * 2) return '****';
  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}

export function resolveReadKey(config: SnapshotConfig, override?: string): string | undefined {
  const fromEnv = process.env.SUBLYZER_READ_KEY?.trim();
  const key = (override || fromEnv || config.readKey || '').trim();
  return key || undefined;
}

export function historyAnchor(config: SnapshotConfig | null, cwd = process.cwd()): string {
  return config?.configRoot || cwd;
}
