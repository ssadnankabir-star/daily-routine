window.RD = window.RD || {};

(function (RD) {
  'use strict';

  RD.todayKey = function () {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };

  RD.dateKey = function (d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };

  RD.safeGet = function (key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  };

  RD.safeSet = function (key, val) {
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
  };

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
