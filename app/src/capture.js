// capture.js — screenshot scenes for the entry's screenshots.
//
// The editor answers ?shot=cover&size=1080x1350 (or 1920x1080) by showing
// only the exported cover, and ?shot=editor by showing the editor as-is.
// The test harness screenshots the page in each mode; nothing here is
// part of the cover art itself.

/**
 * Runs one screenshot scene.
 * kind: 'cover' shows the cover alone at params.size; 'editor' shows the
 * editor. hooks.showCoverAlone(sizeKey) / hooks.showEditor() do the work.
 */
export async function runShot(kind, params, hooks) {
  if (kind === 'cover') {
    const size = params.get('size') || '1920x1080';
    const known = ['1080x1080', '1080x1350', '1920x1080'];
    await hooks.showCoverAlone(known.includes(size) ? size : '1920x1080');
    return;
  }
  await hooks.showEditor();
}
