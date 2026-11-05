/**
 * The one seam for attributes on the document element.
 *
 * Phase 5 is the first code in this app to write one, so it establishes the
 * convention: focus mode sets a valueless `data-focus` here rather than
 * reaching for `document.documentElement` from inside a page. Phase 6 extends
 * the same space with theme, accent, font and size, which is the whole reason
 * this file is worth its three lines — one seam to extend instead of four
 * scattered writes.
 *
 * Focus mode is deliberately not persisted, so this helper has no storage
 * half and must not grow one: a learner must not land in a stripped-down
 * lesson days later wondering where the graph went.
 *
 * Guarded in the shape of the shipped learner-key reader, so a non-browser
 * import cannot throw.
 */
export const setHtmlAttr = (name: string, value = '') => {
  try {
    document.documentElement.setAttribute(name, value);
  } catch {
    /* no document */
  }
};

export const removeHtmlAttr = (name: string) => {
  try {
    document.documentElement.removeAttribute(name);
  } catch {
    /* no document */
  }
};
