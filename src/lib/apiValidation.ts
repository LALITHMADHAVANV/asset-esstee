import { TenantError } from './mongodb';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TenantError('Invalid request body.', 400);
  return value as Record<string, unknown>;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try { return record(await req.json()); }
  catch (error) {
    if (error instanceof TenantError) throw error;
    throw new TenantError('Send a valid JSON request body.', 400);
  }
}

export function identifier(value: unknown, label = 'ID'): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new TenantError(`${label} is required and must be text.`, 400);
  return value.trim();
}

export function nonnegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TenantError(`${label} must be a non-negative number.`, 400);
  return value;
}

export function pickFields(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  const input = record(value);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (key === '_id' || key.startsWith('$') || key.includes('.')) throw new TenantError('Invalid update field.', 400);
    if (allowed.includes(key)) result[key] = input[key];
  }
  return result;
}
