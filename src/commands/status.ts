import {
  configExists,
  configPath,
  dashboardIntegrationUrl,
  loadConfig,
  maskSecret,
  publicReadUrl,
} from '../config.js';
import { info, title } from '../utils/log.js';

export type StatusOptions = { json?: boolean };

export async function runStatus(opts: StatusOptions = {}): Promise<Record<string, unknown>> {
  if (!configExists()) {
    throw new Error(`Not initialized. Run: sublyzer-snapshot init`);
  }

  const config = loadConfig();
  const payload = {
    initialized: true,
    configPath: configPath(),
    projectName: config.projectName,
    projectRoot: config.projectRoot,
    stack: config.stack,
    integration: {
      id: config.integrationId,
      name: config.integrationName,
      code: maskSecret(config.integrationCode, 6),
      status: 'linked',
    },
    apiUrl: config.apiUrl,
    dashboardUrl: dashboardIntegrationUrl(config),
    readKey: config.readKey ? maskSecret(config.readKey) : null,
    pullEnabled: Boolean(config.readKey || process.env.SUBLYZER_READ_KEY),
    publicReadUrl: publicReadUrl(config, { limit: 50, windowDays: 7 }),
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    lastScanAt: config.lastScanAt ?? null,
    lastScan: config.lastScan ?? null,
  };

  if (opts.json) {
    return payload;
  }

  title('Sublyzer Snapshot — status');
  info(`Project:     ${config.projectName}`);
  info(`Config:      ${configPath()}`);
  info(`Stack:       ${config.stack}`);
  info(`Integration: ${config.integrationName || '—'} (${maskSecret(config.integrationCode, 6)})`);
  info(`Dashboard:   ${dashboardIntegrationUrl(config)}`);
  info(`Read key:    ${config.readKey ? maskSecret(config.readKey) : '(not set — add via init or SUBLYZER_READ_KEY)'}`);
  if (config.lastScanAt) {
    info(`Last scan:   ${config.lastScanAt}`);
    if (config.lastScan) {
      info(
        `  health ${config.lastScan.healthScore}/100 (${config.lastScan.healthGrade}), routes ${config.lastScan.routeCount}, vulns ${config.lastScan.vulnerablePackages}`,
      );
    }
  } else {
    info('Last scan:   never — run `sublyzer-snapshot run`');
  }
  console.log('');

  return payload;
}
