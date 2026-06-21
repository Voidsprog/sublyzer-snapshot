import { spawn } from 'node:child_process';
import { dashboardIntegrationUrl, isCloudConfig, loadConfig } from '../config.js';
import { info, ok } from '../utils/log.js';

export async function runOpen(): Promise<void> {
  const config = loadConfig();
  if (!isCloudConfig(config)) {
    throw new Error('Cloud not linked. Run: npx sublyzer-snapshot init --code YOUR_CODE');
  }
  const url = dashboardIntegrationUrl(config);
  if (!url) throw new Error('Dashboard URL unavailable');
  info(`Opening ${url}`);

  const cmd =
    process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
      : process.platform === 'darwin'
        ? spawn('open', [url], { detached: true, stdio: 'ignore' })
        : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });

  cmd.unref();
  ok('Browser launched (or copy the URL above)');
}
