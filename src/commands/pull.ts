import { loadConfig, resolveReadKey } from '../config.js';
import { fetchPublicSnapshot } from '../api/sublyzer.js';
import { info, ok, title } from '../utils/log.js';

export type PullOptions = {
  readKey?: string;
  limit?: number;
  windowDays?: number;
  include?: string;
  json?: boolean;
};

export async function runPull(opts: PullOptions = {}): Promise<unknown> {
  const config = loadConfig();
  const readKey = resolveReadKey(config, opts.readKey);

  if (!readKey || readKey.length < 32) {
    throw new Error(
      'Read key required. Set SUBLYZER_READ_KEY, save in config via init, or pass --read-key. ' +
        'Get it from GET /integrations/{id}/read-access (dashboard JWT).',
    );
  }

  const include = opts.include
    ? opts.include.split(',').map((s) => s.trim()).filter(Boolean)
    : ['stats', 'events'];

  if (!opts.json) {
    title('Sublyzer Snapshot — pull');
    info(`Fetching from ${config.apiUrl}…`);
  }

  const result = await fetchPublicSnapshot(config.apiUrl, config.integrationCode, readKey, {
    limit: opts.limit ?? 50,
    windowDays: opts.windowDays ?? 7,
    include,
  });

  if (!result.ok) {
    throw new Error(result.error || `Pull failed (HTTP ${result.status})`);
  }

  if (opts.json) {
    return result.data;
  }

  ok('Data fetched');
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');

  return result.data;
}
