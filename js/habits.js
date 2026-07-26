/* ============================================================
   habits.js
   Habit Tracker: daily check-off for a set of habits (7 defaults
   + user-added custom ones), current streak per habit, a 7-day
   mini progress row, and month-to-date completion %.

   Storage:
   - 'habits_list'            -> JSON array of {id, name, icon, custom}
   - 'habit_log_<YYYY-MM-DD>' -> JSON object {habitId: true/false}

   Exposes RD.habits so ai.js can give real habit analysis instead
   of the "not built yet" placeholder message.
   ============================================================ */
(function (RD) {
  'use strict';

  var DEFAULT_HABITS = [
    { id: 'water', name: 'পানি পান', icon: '💧', custom: false },
    { id: 'exercise', name: 'ব্যায়াম', icon: '🏃', custom: false },
    { id: 'quran', name: 'কুরআন পড়া', icon: '📖', custom: false },
    { id: 'english', name: 'ইংরেজি চর্চা', icon: '🔤', custom: false },
    { id: 'books', name: 'বই পড়া', icon: '📚', custom: false },
    { id: 'meditation', name: 'ধ্যান', icon: '🧘', custom: false },
    { id: 'sleep_early', name: 'তাড়াতাড়ি ঘুম', icon: '🌙', custom: false }
  ];

  function getHabits() {
    var list = RD.safeGetJSON('habits_list', null);
    if (!list) { list = DEFAULT_HABITS.slice(); RD.safeSetJSON('habits_list', list); }
    return list;
  }
  function saveHabits(list) { RD.safeSetJSON('habits_list', list); }

  function getLog(dateKey) { return RD.safeGetJSON('habit_log_' + dateKey, {}); }
  function setLog(dateKey, obj) { RD.safeSetJSON('habit_log_' + dateKey, obj); }

  function toggleHabit(habitId, dateKey) {
    var log = getLog(dateKey);
    log[habitId] = !log[habitId];
    setLog(dateKey, log);
    return log[habitId];
  }

  function currentStreak(habitId) {
    var streak = 0, d = new Date();
    var doneToday = getLog(RD.todayKey())[habitId];
    if (!doneToday) d.setDate(d.getDate() - 1);
    while (true) {
      var log = getLog(RD.dateKey(d));
      if (log[habitId]) { streak++; d.setDate(d.getDate() - 1); } else break;
      if (streak > 1000) break;
    }
    return streak;
  }

  function weekStatus(habitId) {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      out.push(!!getLog(RD.dateKey(d))[habitId]);
    }
    return out;
  }

  function monthPercent(habitId) {
    var today = new Date();
    var doneCount = 0;
    for (var day = 1; day <= today.getDate(); day++) {
      var d = new Date(today.getFullYear(), today.getMonth(), day);
      if (getLog(RD.dateKey(d))[habitId]) doneCount++;
    }
    return Math.round((doneCount / today.getDate()) * 100);
  }

  function overallTodayPercent() {
    var habits = getHabits();
    if (!habits.length) return 0;
    var log = getLog(RD.todayKey());
    var done = habits.filter(function (h) { return log[h.id]; }).length;
    return Math.round((done / habits.length) * 100);
  }

  // Exposed for ai.js
  RD.habits = {
    getHabits: getHabits, currentStreak: currentStreak, monthPercent: monthPercent,
    overallTodayPercent: overallTodayPercent, weekStatus: weekStatus
  };

  /* ---------- RENDER ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var drawer = document.getElementById('habitDrawer');
    var backdrop = document.getElementById('habitBackdrop');
    var navBtn = document.getElementById('habitNavBtn');
    var closeBtn = document.getElementById('habitCloseBtn');
    var gearBtn = document.getElementById('habitSettingsBtn');
    var settingsPanel = document.getElementById('habitSettingsPanel');
    var showDeleteToggle = document.getElementById('habitShowDeleteToggle');
    var resetBtn = document.getElementById('habitResetBtn');
    var listEl = document.getElementById('habitList');
    var addInput = document.getElementById('habitAddInput');
    var addBtn = document.getElementById('habitAddBtn');
    if (!listEl) return;

    var showDeleteAll = RD.safeGet('habit_show_delete_all') === '1';
    if (showDeleteToggle) showDeleteToggle.checked = showDeleteAll;

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function render() {
      var habits = getHabits();
      var today = RD.todayKey();
      var log = getLog(today);
      listEl.innerHTML = '';

      habits.forEach(function (h) {
        var done = !!log[h.id];
        var streak = currentStreak(h.id);
        var week = weekStatus(h.id);
        var pct = monthPercent(h.id);
        var canDelete = h.custom || showDeleteAll;

        var card = document.createElement('div');
        card.className = 'habit-card' + (done ? ' habit-done' : '');

        var weekDots = week.map(function (d) {
          return '<span class="habit-dot' + (d ? ' on' : '') + '"></span>';
        }).join('');

        card.innerHTML =
          '<div class="habit-top">' +
          '<button class="habit-check' + (done ? ' checked' : '') + '" data-id="' + h.id + '" aria-label="টিক দিন">' +
          '<span class="habit-icon-badge">' + h.icon + '</span>' +
          '</button>' +
          '<div class="habit-info">' +
          '<div class="habit-name-row">' +
          '<span class="habit-name">' + escapeHtml(h.name) + '</span>' +
          (streak > 0 ? '<span class="habit-streak-chip">🔥 ' + streak + '</span>' : '') +
          '</div>' +
          '<div class="habit-week">' + weekDots + '</div>' +
          '<div class="habit-progress-row">' +
          '<div class="habit-progress-bar"><i style="width:' + pct + '%"></i></div>' +
          '<span class="habit-progress-pct">' + pct + '%</span>' +
          '</div>' +
          '</div>' +
          (canDelete ? '<button class="habit-del" data-id="' + h.id + '" aria-label="মুছুন">✕</button>' : '') +
          '</div>';
        listEl.appendChild(card);
      });

      listEl.querySelectorAll('.habit-check').forEach(function (btn) {
        btn.addEventListener('click', function () {
          toggleHabit(btn.getAttribute('data-id'), RD.todayKey());
          render();
        });
      });
      listEl.querySelectorAll('.habit-del').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          if (!confirm('এই অভ্যাসটা মুছে ফেলতে চান? পুরনো লগ থাকবে কিন্তু তালিকা থেকে সরে যাবে।')) return;
          var habits = getHabits().filter(function (h) { return h.id !== id; });
          saveHabits(habits);
          render();
        });
      });
    }

    if (addBtn && addInput) {
      addBtn.addEventListener('click', function () {
        var name = addInput.value.trim();
        if (!name) return;
        var habits = getHabits();
        var id = 'custom_' + Date.now();
        habits.push({ id: id, name: name, icon: '📌', custom: true });
        saveHabits(habits);
        addInput.value = '';
        render();
      });
      addInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
      });
    }

    /* ---------- DRAWER OPEN/CLOSE ---------- */
    function openDrawer() {
      drawer.classList.add('open');
      backdrop.classList.add('open');
      navBtn.setAttribute('aria-expanded', 'true');
      render();
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      settingsPanel.classList.remove('open');
      gearBtn.setAttribute('aria-expanded', 'false');
      navBtn.setAttribute('aria-expanded', 'false');
    }
    if (navBtn) {
      navBtn.addEventListener('click', function (e) { e.preventDefault(); openDrawer(); });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    /* ---------- SETTINGS PANEL ---------- */
    if (gearBtn) {
      gearBtn.addEventListener('click', function () {
        var isOpen = settingsPanel.classList.toggle('open');
        gearBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }
    if (showDeleteToggle) {
      showDeleteToggle.addEventListener('change', function () {
        showDeleteAll = showDeleteToggle.checked;
        RD.safeSet('habit_show_delete_all', showDeleteAll ? '1' : '0');
        render();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!confirm('আজ থেকে সব হ্যাবিট লগ ও স্ট্রিক মুছে যাবে (অভ্যাসের তালিকা থাকবে)। নিশ্চিত?')) return;
        RD.listKeysWithPrefix('habit_log_').forEach(function (k) {
          try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
        });
        render();
      });
    }

    render();
  });

})(window.RD);
