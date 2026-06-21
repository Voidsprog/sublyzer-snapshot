import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Open a URL or local file path in the default browser. */
export function openInBrowser(target: string): void {
  const isUrl = /^https?:\/\//i.test(target);
  const href = isUrl ? target : pathToFileURL(target).href;

  const cmd =
    process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', href], { detached: true, stdio: 'ignore' })
      : process.platform === 'darwin'
        ? spawn('open', [href], { detached: true, stdio: 'ignore' })
        : spawn('xdg-open', [href], { detached: true, stdio: 'ignore' });

  cmd.unref();
}
