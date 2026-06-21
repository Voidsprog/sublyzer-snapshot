import { spawn } from 'node:child_process';
import { dashboardIntegrationUrl, isCloudConfig, loadConfig } from '../config.js';
import { info, ok } from '../utils/log.js';
import { openInBrowser } from '../utils/open-browser.js';

export async function runOpen(): Promise<void> {
  const config = loadConfig();
  if (!isCloudConfig(config)) {
    throw new Error('Cloud not linked. Run: npx sublyzer-snapshot init --code YOUR_CODE');
  }
  const url = dashboardIntegrationUrl(config);
  if (!url) throw new Error('Dashboard URL unavailable');
  info(`Opening ${url}`);
  openInBrowser(url);
  ok('Browser launched (or copy the URL above)');
}
