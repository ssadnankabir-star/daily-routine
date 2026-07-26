/* ============================================================
   routine.js
   The daily checklist, Fajr streak counter, weekly progress
   strip, and the "today's focus" note. All independent of
   prayer-time data, so this module has no dependency on
   prayer.js and can run before or after it.
   ============================================================ */
(function (RD) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {

    /* ---------- FOCUS TEXT ---------- */
    var focusEl = document.getElementById('focusText');
    if (focusEl) {
      focusEl.textContent = RD.safeGet('routine_focus_' + RD.todayKey()) || '';
      focusEl.addEventListener('input', function () {
        RD.safeSet('routine_focus_' + RD.todayKey(), focusEl.textContent);
      });
    }

    /* ---------- CHECKLIST ---------- */
    var allIds = Array.from(document.querySelectorAll('.chk')).map(function (b) {
      return b.getAttribute('data-id');
    });

    function getDayChecks(key) {
      return RD.safeGetJSON('routine_checks_' + key, {});
    }
    function setDayChecks(key, obj) {
      RD.safeSetJSON('routine_checks_' + key, obj);
    }

    function renderChecks() {
      var checks = getDayChecks(RD.todayKey());
      document.querySelectorAll('.chk').forEach(function (btn) {
        var id = btn.getAttribute('data-id');
        var done = !!checks[id];
        btn.classList.toggle('done', done);
        var row = btn.closest('.row');
        if (row) row.classList.toggle('checked', done);
      });
      renderStreak();
      renderWeek();
    }

    document.querySelectorAll('.chk').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var key = RD.todayKey();
        var checks = getDayChecks(key);
        checks[id] = !checks[id];
        setDayChecks(key, checks);
        renderChecks();
      });
    });

    /* ---------- STREAK (based on Fajr checkbox) ---------- */
    function renderStreak() {
      var badge = document.getElementById('streakBadge');
      if (!badge) return;
      var streak = 0;
      var d = new Date();
      var checkedToday = getDayChecks(RD.todayKey())['fajr'];
      if (!checkedToday) d.setDate(d.getDate() - 1); // count from yesterday if today not yet marked
      while (true) {
        var key = RD.dateKey(d);
        var checks = getDayChecks(key);
        if (checks['fajr']) { streak++; d.setDate(d.getDate() - 1); } else { break; }
        if (streak > 365) break;
      }
      if (streak > 0) {
        badge.innerHTML = '🔥 Fajr জামাত ধারাবাহিক <b>' + streak + '</b> দিন';
      } else {
        badge.innerHTML = '🕌 আজ থেকে Fajr streak শুরু করুন';
      }
    }

    /* ---------- WEEKLY VIEW ---------- */
    var dayNames = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
    function renderWeek() {
      var row = document.getElementById('weekRow');
      if (!row) return;
      row.innerHTML = '';
      for (var i = 6; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        var key = RD.dateKey(d);
        var checks = getDayChecks(key);
        var doneCount = allIds.filter(function (id) { return checks[id]; }).length;
        var pct = allIds.length ? Math.round((doneCount / allIds.length) * 100) : 0;
        var isToday = i === 0;
        var wrap = document.createElement('div');
        wrap.className = 'wday' + (isToday ? ' today' : '');
        var alpha = pct === 0 ? 0.08 : 0.15 + (pct / 100) * 0.7;
        wrap.innerHTML = '<div class="wname">' + dayNames[d.getDay()] + '</div>' +
          '<div class="wdot" style="background:rgba(201,162,75,' + alpha.toFixed(2) + ')">' + (pct > 0 ? pct + '%' : '') + '</div>';
        row.appendChild(wrap);
      }
    }

    renderChecks();

    // Exposed for other modules (currently unused externally, kept for
    // future features like the analytics dashboard in a later phase).
    RD.routine = { getDayChecks: getDayChecks, allIds: allIds, renderChecks: renderChecks };
  });

})(window.RD);
