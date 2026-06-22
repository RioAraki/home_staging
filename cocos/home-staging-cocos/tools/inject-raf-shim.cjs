// cocos/home-staging-cocos/tools/inject-raf-shim.cjs
// Post-build helper for AUTONOMOUS verification (Claude driving a headless /
// background Chrome tab).
//
// Chrome fully PAUSES requestAnimationFrame in hidden/background tabs, which
// stalls Cocos engine init + the game loop, so a build served to an automated
// background tab renders black even though the build itself is fine. This
// injects a MessageChannel-driven rAF shim (NOT throttled in background tabs)
// into a web build so it runs for screenshot-based verification.
//
// Usage (after a build):  node tools/inject-raf-shim.cjs [build/web-mobile]
// Idempotent — safe to re-run. Only touches the build output, never src.
const fs = require('node:fs');
const path = require('node:path');

const buildDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'web-mobile'));
const indexPath = path.join(buildDir, 'index.html');
const shimPath = path.join(buildDir, '__rafshim.js');

const SHIM = `// Injected by tools/inject-raf-shim.cjs — keeps rAF running in a hidden tab.
(function () {
  var ch = new MessageChannel();
  var queue = [], lastTime = 0, scheduled = false;
  function schedule() { if (!scheduled) { scheduled = true; ch.port2.postMessage(0); } }
  ch.port1.onmessage = function () {
    scheduled = false;
    var now = (performance && performance.now) ? performance.now() : Date.now();
    if (now - lastTime < 15) { schedule(); return; }
    lastTime = now;
    var cbs = queue; queue = [];
    for (var i = 0; i < cbs.length; i++) { try { cbs[i](now); } catch (e) { console.error(e); } }
  };
  var id = 0;
  window.requestAnimationFrame = function (fn) { queue.push(fn); schedule(); return ++id; };
  window.cancelAnimationFrame = function () {};
})();
`;

if (!fs.existsSync(indexPath)) {
  console.error(`[raf-shim] no index.html at ${indexPath} — build first.`);
  process.exit(1);
}
fs.writeFileSync(shimPath, SHIM, 'utf-8');

let html = fs.readFileSync(indexPath, 'utf-8');
if (html.includes('__rafshim.js')) {
  console.log('[raf-shim] already injected.');
} else {
  // Insert AFTER polyfills (which itself overwrites rAF), BEFORE the engine boot.
  const marker = /(<script src="src\/polyfills\.bundle\.js"[^>]*>\s*<\/script>)/;
  if (!marker.test(html)) { console.error('[raf-shim] polyfills script tag not found — build layout changed.'); process.exit(1); }
  html = html.replace(marker, '$1\n<script src="__rafshim.js" charset="utf-8"></script>');
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('[raf-shim] injected into index.html (after polyfills).');
}
console.log(`[raf-shim] ready → serve ${buildDir} and load it in the automated tab.`);
