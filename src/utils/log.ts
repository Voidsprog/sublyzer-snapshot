export function info(msg: string): void {
  console.log(`\x1b[36m→\x1b[0m ${msg}`);
}

export function ok(msg: string): void {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

export function warn(msg: string): void {
  console.warn(`\x1b[33m!\x1b[0m ${msg}`);
}

export function fail(msg: string): never {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}

export function title(msg: string): void {
  console.log(`\n\x1b[1m${msg}\x1b[0m\n`);
}
