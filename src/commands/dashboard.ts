import { tryLoadConfig } from '../config.js';
import { writeHtmlDashboard } from './report.js';
import { openInBrowser } from '../utils/open-browser.js';
import { info, ok, title } from '../utils/log.js';

export type DashboardOptions = {
  rescan?: boolean;
  skipAudit?: boolean;
  path?: string;
  out?: string;
  noOpen?: boolean;
};

export async function runDashboard(opts: DashboardOptions = {}): Promise<string> {
  const config = tryLoadConfig();
  const anchor = config?.configRoot || process.cwd();

  title('Sublyzer Snapshot — dashboard');
  const outPath = await writeHtmlDashboard(anchor, {
    out: opts.out,
    rescan: opts.rescan,
    skipAudit: opts.skipAudit,
    path: opts.path,
  });

  ok(`Dashboard ready → ${outPath}`);

  if (!opts.noOpen) {
    openInBrowser(outPath);
    ok('Opened in your browser');
  } else {
    info(`Open manually: ${outPath}`);
  }

  return outPath;
}
