import { SDK_NAME, SDK_VERSION } from '../constants.js';
import type { CollectItem } from '../scan/snapshot.js';

export type ValidateResult = {
  success: boolean;
  valid: boolean;
  integration?: {
    id: string;
    name: string;
    status: string;
  };
  message?: string;
};

export type PublicReadOptions = {
  limit?: number;
  windowDays?: number;
  include?: string[];
};

export async function validateIntegrationCode(apiUrl: string, integrationCode: string): Promise<ValidateResult> {
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/data-collection/integration/${integrationCode}/validate`);
  return (await res.json()) as ValidateResult;
}

export async function pushSnapshot(
  apiUrl: string,
  integrationCode: string,
  items: CollectItem[],
): Promise<{ success: boolean; processed?: number; error?: string }> {
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/data-collection/collect-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      integrationCode,
      sdkName: SDK_NAME,
      sdkVersion: SDK_VERSION,
      data: items,
    }),
  });

  let body: any = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    return { success: false, error: body?.message || body?.error || `HTTP ${res.status}` };
  }

  return {
    success: body?.success !== false,
    processed: body?.processed ?? items.length,
    error: body?.error,
  };
}

export async function fetchPublicSnapshot(
  apiUrl: string,
  integrationCode: string,
  readKey: string,
  opts: PublicReadOptions = {},
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const base = apiUrl.replace(/\/$/, '');
  const url = new URL(`${base}/data-collection/integration/${integrationCode}/data`);
  url.searchParams.set('key', readKey);
  if (opts.limit != null) url.searchParams.set('limit', String(opts.limit));
  if (opts.windowDays != null) url.searchParams.set('windowDays', String(opts.windowDays));
  if (opts.include?.length) url.searchParams.set('include', opts.include.join(','));

  const res = await fetch(url.toString());
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errMsg =
      (data as any)?.message ||
      (data as any)?.error ||
      (typeof data === 'object' && data && 'statusCode' in (data as object) ? JSON.stringify(data) : `HTTP ${res.status}`);
    return { ok: false, status: res.status, error: String(errMsg) };
  }

  return { ok: true, status: res.status, data };
}
