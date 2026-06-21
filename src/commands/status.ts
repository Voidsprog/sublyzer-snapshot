import {
  configExists,
  configPath,
  dashboardIntegrationUrl,
  isCloudConfig,
  loadConfig,
  maskSecret,
  publicReadUrl,
} from '../config.js';
import { info, title } from '../utils/log.js';

export type StatusOptions = { json?: boolean };

export async function runStatus(opts: StatusOptions = {}): Promise<Record<string, unknown>> {
  if (!configExists()) {
    throw new Error('Not initialized. Run: npx sublyzer-snapshot init --local  (or scan without init)');
  }

  const config = loadConfig();
  const cloud = isCloudConfig(config);

  const payload = {
    initialized: true,
    mode: config.mode,
    configPath: configPath(config.configRoot),
    projectName: config.projectName,
    configRoot: config.configRoot,
    scanRoot: config.scanRoot,
    stack: config.stack,
    cloudLinked: cloud,
    integration: cloud
      ? {
          id: config.integrationId,
          name: config.integrationName,
          code: maskSecret(config.integrationCode, 6),
        }
      : null,
    apiUrl: config.apiUrl ?? null,
    dashboardUrl: dashboardIntegrationUrl(config),
    readKey: config.readKey ? maskSecret(config.readKey) : null,
    pullEnabled: cloud && Boolean(config.readKey || process.env.SUBLYZER_READ_KEY),
    publicReadUrl: cloud ? publicReadUrl(config, { limit: 50, windowDays: 7 }) : null,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    lastScanAt: config.lastScanAt ?? null,
    lastScan: config.lastScan ?? null,
  };

  if (opts.json) return payload;

  title('Sublyzer Snapshot — status');
  info(`Mode:        ${config.mode}`);
  info(`Project:     ${config.projectName}`);
  info(`Scan root:   ${config.scanRoot}`);
  info(`Config:      ${configPath(config.configRoot)}`);
  if (cloud) {
    info(`Integration: ${config.integrationName || '—'} (${maskSecret(config.integrationCode, 6)})`);
    info(`Dashboard:   ${dashboardIntegrationUrl(config) || '—'}`);
  } else {
    info('Cloud:       not linked (local-only — optional: init --code …)');
  }
  if (config.lastScanAt) {
    info(`Last scan:   ${config.lastScanAt}`);
    if (config.lastScan) {
      info(
        `  health ${config.lastScan.healthScore}/100 (${config.lastScan.healthGrade}), routes ${config.lastScan.routeCount}, pushed ${config.lastScan.pushedToCloud ? 'yes' : 'no'}`,
      );
    }
  } else {
    info('Last scan:   never — run `npx sublyzer-snapshot scan`');
  }
  console.log('');

  return payload;
}
