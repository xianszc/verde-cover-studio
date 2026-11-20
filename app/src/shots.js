// Fixed scenes for screenshots: ?shot=editor shows the editor with the sample photos
// loaded; ?shot=cover shows the cover alone, full frame, at the ?size post size.
// window.__shotReady is set once the scene is painted.
export async function runShot(shot, query, scene) {
  if (shot === 'cover') {
    await scene.showCoverAlone(query.get('size') || '1920x1080');
  } else {
    await scene.showEditor();
  }
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
