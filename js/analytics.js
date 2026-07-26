/* ============================================================
   analytics.js
   Analytics Dashboard: today/weekly/monthly completion %,
   prayer consistency, current & longest Fajr streak, a weekly
   bar chart (Chart.js), and a contribution-style heatmap.

   All numbers are computed from real localStorage data via
   RD.routine (routine.js) — nothing here is a placeholder.

   Also exposes RD.analytics helper functions so calendar.js can
   reuse the same day-status logic without duplicating it.
   ============================================================ */
(function (RD) {
  'use strict';

  var PRAYER_IDS = ['fajr', 'asr', 'maghrib', 'isha'];

  function checksFor(dateObj) {
    return RD.routine ? RD.routine.getDayChecks(RD.dateKey(dateObj)) : {};
  }
  function completionPercent(checks) {
    var ids = (RD.routine && RD.routine.allIds) ? RD.routine.allIds : [];
    if (!ids.length) return 0;
    var done = ids.filter(function (id) { return checks[id]; }).length;
    return Math.round((done / ids.length) * 100);
  }
  function hasAnyRecord(dateObj) {
    return RD.safeGet('routine_checks_' + RD.dateKey(dateObj)) !== null;
  }

  // All calendar dates that have at least one saved checklist record,
  // sorted ascending. Used for longest-streak scanning and the heatmap.
  function allRecordedDates() {
    var keys = RD.listKeysWithPrefix('routine_checks_');
    var dates = keys.map(function (k) { return k.replace('routine_checks_', ''); });
    dates.sort();
    return dates;
  }

  function currentFajrStreak() {
    var streak = 0, d = new Date();
    var checkedToday = checksFor(d)['fajr'];
    if (!checkedToday) d.setDate(d.getDate() - 1);
    while (true) {
      if (checksFor(d)['fajr']) { streak++; d.setDate(d.getDate() - 1); } else break;
      if (streak > 1000) break;
    }
    return streak;
  }

  function longestFajrStreak() {
    var dates = allRecordedDates();
    var longest = 0, run = 0, prevDate = null;
    dates.forEach(function (dateStr) {
      var checks = RD.safeGetJSON('routine_checks_' + dateStr, {});
      var d = new Date(dateStr + 'T00:00:00');
      var consecutive = prevDate && ((d - prevDate) === 86400000);
      if (checks['fajr']) {
        run = consecutive ? run + 1 : 1;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
      prevDate = d;
    });
    return longest;
  }

  function rangeStats(startOffsetDays, endOffsetDaysInclusive) {
    // offsets are "days before today" — e.g. (6,0) = last 7 days including today
    var out = [];
    for (var i = startOffsetDays; i >= endOffsetDaysInclusive; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      out.push({ date: RD.dateKey(d), pct: completionPercent(checksFor(d)), dow: d.getDay() });
    }
    return out;
  }

  function monthToDateStats() {
    var today = new Date();
    var out = [];
    for (var day = 1; day <= today.getDate(); day++) {
      var d = new Date(today.getFullYear(), today.getMonth(), day);
      out.push({ date: RD.dateKey(d), pct: hasAnyRecord(d) ? completionPercent(checksFor(d)) : 0 });
    }
    return out;
  }

  function avg(arr, key) {
    if (!arr.length) return 0;
    return Math.round(arr.reduce(function (s, x) { return s + x[key]; }, 0) / arr.length);
  }

  function prayerConsistencyPct(days) {
    var stats = rangeStats(days - 1, 0);
    var total = 0, done = 0;
    stats.forEach(function (s) {
      var checks = checksFor(new Date(s.date + 'T00:00:00'));
      PRAYER_IDS.forEach(function (id) { total++; if (checks[id]) done++; });
    });
    return total ? Math.round((done / total) * 100) : 0;
  }

  // Exposed for calendar.js
  RD.analytics = {
    checksFor: checksFor,
    completionPercent: completionPercent,
    hasAnyRecord: hasAnyRecord,
    currentFajrStreak: currentFajrStreak,
    longestFajrStreak: longestFajrStreak
  };

  /* ---------- RENDER ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('analyticsBlock');
    if (!root || !RD.routine) return;

    var week = rangeStats(6, 0);
    var monthStats = monthToDateStats();
    var todayPct = week[week.length - 1].pct;
    var weekPct = avg(week, 'pct');
    var monthPct = avg(monthStats, 'pct');
    var prayerPct = prayerConsistencyPct(7);
    var curStreak = currentFajrStreak();
    var longStreak = longestFajrStreak();

    document.getElementById('statToday').textContent = todayPct + '%';
    document.getElementById('statWeek').textContent = weekPct + '%';
    document.getElementById('statMonth').textContent = monthPct + '%';
    document.getElementById('statPrayer').textContent = prayerPct + '%';
    document.getElementById('statCurStreak').textContent = curStreak;
    document.getElementById('statLongStreak').textContent = longStreak;

    // Progress bars
    [['statToday', todayPct], ['statWeek', weekPct], ['statMonth', monthPct], ['statPrayer', prayerPct]].forEach(function (pair) {
      var bar = document.querySelector('.stat-bar[data-for="' + pair[0] + '"] > i');
      if (bar) bar.style.width = pair[1] + '%';
    });

    // Weekly bar chart (Chart.js, loaded via CDN in index.html)
    var dayNames = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
    var canvas = document.getElementById('weeklyChart');
    if (canvas && window.Chart) {
      var styles = getComputedStyle(document.documentElement);
      var gold = styles.getPropertyValue('--gold').trim() || '#C9A24B';
      var teal = styles.getPropertyValue('--teal-deep').trim() || '#0E3B36';
      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: week.map(function (w) { return dayNames[w.dow]; }),
          datasets: [{ data: week.map(function (w) { return w.pct; }), backgroundColor: gold, borderRadius: 6, maxBarThickness: 28 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.y + '%'; } } } },
          scales: {
            y: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + '%'; }, color: teal, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
            x: { ticks: { color: teal, font: { size: 11 } }, grid: { display: false } }
          }
        }
      });
    } else if (canvas) {
      // Chart.js failed to load (e.g. offline, CDN blocked) — degrade gracefully.
      canvas.replaceWith(Object.assign(document.createElement('div'), {
        className: 'chart-fallback', textContent: 'চার্ট লোড করতে ইন্টারনেট প্রয়োজন।'
      }));
    }

    // Heatmap: last 35 days, 5 rows x 7 cols (like a contribution graph)
    var heatmap = document.getElementById('heatmap');
    if (heatmap) {
      heatmap.innerHTML = '';
      var cells = rangeStats(34, 0);
      cells.forEach(function (c) {
        var cell = document.createElement('div');
        cell.className = 'heat-cell';
        var level = c.pct === 0 ? 0 : c.pct < 30 ? 1 : c.pct < 60 ? 2 : c.pct < 90 ? 3 : 4;
        cell.setAttribute('data-level', level);
        cell.title = c.date + ' — ' + c.pct + '%';
        heatmap.appendChild(cell);
      });
    }
  });

})(window.RD);
