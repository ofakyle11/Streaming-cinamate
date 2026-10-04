/* Lastframe.tv theme bootstrap. Loaded as the first script in <head> so the
   saved theme is on <html> before the first paint (no flash on reload). The
   CSP is script-src 'self' with no nonce, so this cannot be inline.
   Mirror of src/theme/theme.ts: keep the key, values and colours in sync. */
(function () {
  var KEY = 'lf.theme';
  var LIGHT = '#f6f5ff';
  var DARK = '#141126';
  var pref = null;
  try {
    pref = window.localStorage.getItem(KEY);
  } catch (e) {
    /* storage blocked: follow the device */
  }
  var root = document.documentElement;
  if (pref === 'light' || pref === 'dark') {
    root.setAttribute('data-theme', pref);
  } else {
    root.removeAttribute('data-theme');
  }
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) {
    var m = metas[i];
    var own =
      m.getAttribute('media') && m.getAttribute('media').indexOf('dark') !== -1 ? DARK : LIGHT;
    m.setAttribute('content', pref === 'dark' ? DARK : pref === 'light' ? LIGHT : own);
  }
})();
