/**
 * Short stable hash of a stylesheet string (FNV-1a, base 36). React 19 de-duplicates
 * `<style href>` by href, so a constant href freezes the first CSS an already-open tab ever
 * loaded (hot reload then keeps stale rules). Keying the href by content makes any change
 * insert the new rules after the old ones, where they win.
 */
export function cssVersion(css: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < css.length; i++) {
    h ^= css.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
