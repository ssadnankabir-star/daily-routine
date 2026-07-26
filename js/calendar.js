/* ============================================================
   calendar.js
   Monthly calendar. Each day cell shows a completion-intensity
   dot (like the heatmap) and a small mosque icon if all 4
   tracked prayers were checked that day. Clicking a day opens a
   detail panel with that day's full checklist status, focus
   note, and Quran log (if any).

   Depends on: storage.js, routine.js, analytics.js (RD.analytics)
   ============================================================ */
(function (RD) {
  'use strict';

  var PRAYER_IDS = ['fajr', 'asr', 'maghrib', 'isha'];
  var TASK_LABELS = {
    wake: 'ঘুম থেকে ওঠা', fajr: 'Fajr জামাত', exercise: 'হাঁটা/জগিং', freshup: 'Fresh up',
    productive1: 'পড়াশোনা/স্কিল', prep: 'অফিসের প্রস্তুতি', office: 'অফিস', rest1: 'রেস্ট',
    asr: 'আসর জামাত', work2: 'হালকা কাজ', rest2: 'Family time', maghrib: 'মাগরিব নামাজ',
    deenread: 'কুরআন তিলাওয়াত', isha: 'ইশা জামাত', reflect: 'দিনের রিভিউ', unwind: 'Unwind', sleep: 'ঘুম'
  };
  var MONTH_NAMES = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  var DOW_NAMES = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

  document.addEventListener('DOMContentLoaded', function () {
    var grid = document.getElementById('calGrid');
    var label = document.getElementById('calMonthLabel');
    var prevBtn = document.getElementById('calPrev');
    var nextBtn = document.getElementById('calNext');
    var todayBtn = document.getElementById('calToday');
    var detail = document.getElementById('calDetail');
    if (!grid || !RD.routine) return;

    var view = new Date(); view.setDate(1); // first-of-month cursor

    function fmtKey(y, m, day) {
      var d = new Date(y, m, day);
      return RD.dateKey(d);
    }

    function dayStatus(dateObj) {
      var checks = RD.analytics ? RD.analytics.checksFor(dateObj) : {};
      var pct = RD.analytics ? RD.analytics.completionPercent(checks) : 0;
      var hasRecord = RD.analytics ? RD.analytics.hasAnyRecord(dateObj) : false;
      var allPrayers = PRAYER_IDS.every(function (id) { return checks[id]; });
      return { checks: checks, pct: pct, hasRecord: hasRecord, allPrayers: allPrayers };
    }

    function renderDetail(dateObj) {
      var key = RD.dateKey(dateObj);
      var status = dayStatus(dateObj);
      var focus = RD.safeGet('routine_focus_' + key) || '';
      var quran = RD.safeGetJSON('routine_quran', null);
      var quranMatch = quran && quran.date === key ? quran : null;

      var dowLabel = DOW_NAMES[dateObj.getDay()];
      var html = '<div class="cal-detail-head">' +
        '<b>' + dateObj.getDate() + ' ' + MONTH_NAMES[dateObj.getMonth()] + '</b> <span class="cal-dow">(' + dowLabel + ')</span>' +
        '<button class="cal-detail-close" id="calDetailClose" aria-label="বন্ধ">✕</button></div>';

      if (!status.hasRecord) {
        html += '<p class="cal-empty">এই দিনের কোনো রেকর্ড নেই।</p>';
      } else {
        html += '<div class="cal-detail-pct">সম্পন্ন: <b>' + status.pct + '%</b></div>';
        html += '<ul class="cal-detail-list">';
        Object.keys(TASK_LABELS).forEach(function (id) {
          var done = !!status.checks[id];
          html += '<li class="' + (done ? 'done' : '') + '">' + (done ? '✅' : '⬜') + ' ' + TASK_LABELS[id] + '</li>';
        });
        html += '</ul>';
      }
      if (focus) html += '<div class="cal-detail-focus">🎯 ' + escapeHtml(focus) + '</div>';
      if (quranMatch) html += '<div class="cal-detail-quran">📖 ' + escapeHtml(quranMatch.surah || '') + (quranMatch.page ? ' — ' + escapeHtml(quranMatch.page) : '') + '</div>';

      detail.innerHTML = html;
      detail.classList.add('open');
      document.getElementById('calDetailClose').addEventListener('click', function () {
        detail.classList.remove('open');
      });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function render() {
      var y = view.getFullYear(), m = view.getMonth();
      label.textContent = MONTH_NAMES[m] + ' ' + y;
      grid.innerHTML = '';

      DOW_NAMES.forEach(function (dn) {
        var h = document.createElement('div');
        h.className = 'cal-dow-head'; h.textContent = dn;
        grid.appendChild(h);
      });

      var firstDow = new Date(y, m, 1).getDay();
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var todayKey = RD.todayKey();

      for (var i = 0; i < firstDow; i++) {
        var blank = document.createElement('div');
        blank.className = 'cal-cell cal-blank';
        grid.appendChild(blank);
      }

      for (var day = 1; day <= daysInMonth; day++) {
        var dateObj = new Date(y, m, day);
        var key = fmtKey(y, m, day);
        var status = dayStatus(dateObj);
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cal-cell' + (key === todayKey ? ' cal-today' : '');
        var level = !status.hasRecord ? 0 : status.pct === 0 ? 0 : status.pct < 30 ? 1 : status.pct < 60 ? 2 : status.pct < 90 ? 3 : 4;
        cell.setAttribute('data-level', level);
        cell.innerHTML = '<span class="cal-daynum">' + day + '</span>' + (status.allPrayers ? '<span class="cal-mosque">🕌</span>' : '');
        cell.addEventListener('click', function (dObj) {
          return function () { renderDetail(dObj); };
        }(dateObj));
        grid.appendChild(cell);
      }
    }

    prevBtn.addEventListener('click', function () { view.setMonth(view.getMonth() - 1); detail.classList.remove('open'); render(); });
    nextBtn.addEventListener('click', function () { view.setMonth(view.getMonth() + 1); detail.classList.remove('open'); render(); });
    todayBtn.addEventListener('click', function () {
      view = new Date(); view.setDate(1); detail.classList.remove('open'); render();
    });

    render();
  });

})(window.RD);
