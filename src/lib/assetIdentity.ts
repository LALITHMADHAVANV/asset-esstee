/** Only stored application IDs can link assets to repairs, PPM and QR codes. */
export function hasAssetId<T extends { id?: unknown }>(value: T | null | undefined): value is T & { id: string } {
  return !!value && typeof value.id === 'string' && value.id.trim().length > 0;
}
