/** Compatibility for an Atlas app label accidentally pasted without `appName=`. */
export function normalizeMongoUri(raw: string): string {
  const uri = raw.trim();
  const queryStart = uri.indexOf('?');
  if (queryStart < 0) return uri;
  const fragments = uri.slice(queryStart + 1).split('&');
  let hasAppName = fragments.some(fragment => /^appname=/i.test(fragment));
  let changed = false;
  const normalized = fragments.flatMap(fragment => {
    if (fragment.includes('=')) return [fragment];
    let label = fragment;
    try { label = decodeURIComponent(fragment); } catch { return [fragment]; }
    if (!/^asset-esstee$/i.test(label)) return [fragment];
    changed = true;
    if (hasAppName) return [];
    hasAppName = true;
    return ['appName=' + encodeURIComponent(label)];
  });
  return changed ? uri.slice(0, queryStart + 1) + normalized.join('&') : uri;
}
