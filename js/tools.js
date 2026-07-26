/* ============================================================
   tools.js
   Small standalone widgets: Quran tracker (surah/page log) and
   the exercise stopwatch. Neither depends on prayer-time data.
   ============================================================ */
(function (RD) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {

    /* ---------- QURAN TRACKER ---------- */
    var surahEl = document.getElementById('quranSurah');
    var pageEl = document.getElementById('quranPage');
    var quranLastEl = document.getElementById('quranLast');

    if (surahEl && pageEl && quranLastEl) {
      function loadQuran() {
        var data = RD.safeGetJSON('routine_quran', null);
        if (data) {
          surahEl.value = data.surah || '';
          pageEl.value = data.page || '';
          if (data.surah || data.page) {
            quranLastEl.textContent = 'সর্বশেষ: ' + (data.surah || '') + (data.page ? ' — ' + data.page : '') + (data.date ? ' (' + data.date + ')' : '');
          }
        }
      }
      function saveQuran() {
        var data = { surah: surahEl.value.trim(), page: pageEl.value.trim(), date: RD.todayKey() };
        RD.safeSetJSON('routine_quran', data);
        if (data.surah || data.page) {
          quranLastEl.textContent = 'সর্বশেষ: ' + data.surah + (data.page ? ' — ' + data.page : '') + ' (' + data.date + ')';
        }
      }
      surahEl.addEventListener('change', saveQuran);
      pageEl.addEventListener('change', saveQuran);
      loadQuran();
    }

    /* ---------- EXERCISE STOPWATCH ---------- */
    var swDisplay = document.getElementById('swDisplay');
    var swStart = document.getElementById('swStart');
    var swReset = document.getElementById('swReset');

    if (swDisplay && swStart && swReset) {
      var swSeconds = 0, swRunning = false, swInterval = null;
      function renderSw() {
        var m = Math.floor(swSeconds / 60), s = swSeconds % 60;
        swDisplay.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      }
      swStart.addEventListener('click', function () {
        swRunning = !swRunning;
        swStart.textContent = swRunning ? 'পজ' : 'শুরু';
        if (swRunning) {
          swInterval = setInterval(function () { swSeconds++; renderSw(); }, 1000);
        } else {
          clearInterval(swInterval);
        }
      });
      swReset.addEventListener('click', function () {
        swRunning = false; clearInterval(swInterval); swSeconds = 0; renderSw();
        swStart.textContent = 'শুরু';
      });
      renderSw();
    }

  });

})(window.RD);
