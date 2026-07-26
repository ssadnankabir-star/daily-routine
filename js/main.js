/* ============================================================
   main.js
   App bootstrap: registers the service worker for offline/PWA
   support. Kept last and separate so it's obvious where to look
   when adding future app-wide init logic (Phase 2+ features).
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline support unavailable, app still works online */ });
  });
}
