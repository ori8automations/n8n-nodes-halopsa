import { INodePropertyOptions } from 'n8n-workflow';

// ─── Token cache ──────────────────────────────────────────────────────────────
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getToken(
  helpers: any,
  subdomain: string,
  clientId: string,
  clientSecret: string,
  scope = 'all',
): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    throw new Error(
      `Invalid HaloPSA subdomain "${subdomain}". Use lowercase letters, numbers, and hyphens only.`,
    );
  }

  const key = `${subdomain}::${clientId}::${scope}`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const resp = await helpers.request({
    method: 'POST',
    uri: `https://${subdomain}.halopsa.com/auth/token`,
    form: {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope,
      tenant: 'halopsa',
    },
    json: true,
  });

  const token = resp.access_token as string;
  const ttl = ((resp.expires_in as number) ?? 3600) - 60;
  tokenCache.set(key, { token, expiresAt: Date.now() + ttl * 1000 });
  return token;
}

export async function haloRequest(
  helpers: any,
  subdomain: string,
  token: string,
  method: string,
  path: string,
  body?: any,
  qs?: Record<string, any>,
): Promise<any> {
  const opts: any = {
    method,
    uri: `https://${subdomain}.halopsa.com${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json: true,
  };
  if (body !== undefined) opts.body = body;
  if (qs) opts.qs = qs;
  return helpers.request(opts);
}

export function toOptions(
  items: any[],
  labelFn: (item: any) => string,
  valueField = 'id',
): INodePropertyOptions[] {
  return (items ?? []).map((item) => ({
    name: labelFn(item) || String(item[valueField]),
    value: item[valueField] as number,
  }));
}

export function normalizeTags(raw: string): Array<{ text: string }> {
  return raw
    .split(',')
    .map((t) => ({ text: t.trim() }))
    .filter((t) => t.text.length > 0);
}
