/* ============================================================
   theme.js
   Dark/light mode toggle + the three accent color swatches
   (Gold & Teal / Emerald & Ivory / Maroon & Sand).
   Behavior is unchanged from the original build.
   ============================================================ */
(function (RD) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;

    function applyTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
      themeBtn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    }
    applyTheme(RD.safeGet('routine_theme') || 'light');

    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(cur);
      RD.safeSet('routine_theme', cur);
    });

    function applyAccent(a) {
      document.documentElement.setAttribute('data-accent', a);
      document.querySelectorAll('.swatch').forEach(function (s) {
        s.classList.toggle('active', s.getAttribute('data-accent') === a);
      });
    }
    applyAccent(RD.safeGet('routine_accent') || 'gold');

    document.querySelectorAll('.swatch').forEach(function (s) {
      s.addEventListener('click', function () {
        var a = s.getAttribute('data-accent');
        applyAccent(a);
        RD.safeSet('routine_accent', a);
      });
    });
  });

})(window.RD);
