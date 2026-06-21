export const SDK_NAME = 'sublyzer-snapshot';
export const SDK_VERSION = '0.5.4';

export const DEFAULT_API_URL = 'https://api.sublyzer.com';
export const DEFAULT_DASHBOARD_URL = 'https://sublyzer.com';

export const CONFIG_DIR = '.sublyzer';
export const CONFIG_FILE = 'snapshot.json';
export const LAST_SNAPSHOT_FILE = 'last-snapshot.json';
export const HTML_REPORT_FILE = 'report.html';
export const HISTORY_DIR = 'history';
export const MAX_HISTORY_FILES = 20;

export const INTEGRATION_CODE_RE = /^[A-Z0-9]{24}$/;

export const GITIGNORE_ENTRY = '.sublyzer/';

export type FailOnLevel = 'critical' | 'high' | 'moderate' | 'any';
export type SnapshotMode = 'local' | 'cloud';

export const DOCS_URL = 'https://sublyzer.com/docs/sdk';
export const DASHBOARD_URL = 'https://sublyzer.com/dashboard';
