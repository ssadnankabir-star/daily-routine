/* ============================================================
   storage.js
   Shared utilities used across every module: date-keying and
   safe localStorage access. Every other JS file reads/writes
   through window.RD so there is exactly one implementation of
   "today's key" and "safe get/set" in the whole app.
   Load this file FIRST, before any other script.
   ============================================================ */
window.RD = window.RD || {};

(function (RD) {
  'use strict';

  // Returns today's date as "YYYY-MM-DD" in the user's local time.
  RD.todayKey = function () {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };

  // Returns the "YYYY-MM-DD" key for an arbitrary Date object.
  RD.dateKey = function (d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };

  // localStorage can throw (private browsing, storage disabled, quota
  // exceeded, etc). Every read/write in the app goes through these two
  // wrappers so a storage failure never crashes the page.
  RD.safeGet = function (key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  };

  RD.safeSet = function (key, val) {
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
  };

  // Convenience JSON helpers (small addition, same safety guarantees).
  RD.safeGetJSON = function (key, fallback) {
    try {
      var raw = RD.safeGet(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  };

  RD.safeSetJSON = function (key, obj) {
    return RD.safeSet(key, JSON.stringify(obj));
  };

})(window.RD);
