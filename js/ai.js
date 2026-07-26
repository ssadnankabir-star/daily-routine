/* ============================================================
   ai.js
   AI Assistant — chat interface + insight engine.

   IMPORTANT DESIGN NOTE:
   True open-ended LLM chat requires a server-side API key. This
   app is a static site on GitHub Pages with no backend, so any
   API key placed in client JS would be visible to anyone via
   "view source" and could be stolen/abused. Until there is a
   backend (or the user wires their own key through a private
   proxy), this assistant is a rule-based engine that reasons
   over the user's REAL stored data (checklist, streak, Quran
   log) rather than faking generic responses.

   Depends on: storage.js (RD), routine.js (RD.routine — must be
   loaded before this file).
   ============================================================ */
(function (RD) {
  'use strict';

  // Schedule metadata mirrors the checklist in index.html.
  // startMin = approximate minutes-after-midnight for sorting only;
  // Maghrib/Isha vary by season so these are rough anchors, not the
  // authoritative prayer times (those come live from prayer.js).
  var TASKS = [
    { id: 'wake', label: 'ঘুম থেকে ওঠা', tag: 'Wake', startMin: 275 },
    { id: 'fajr', label: 'Fajr জামাত', tag: 'Salah', startMin: 290 },
    { id: 'exercise', label: 'হাঁটা / জগিং', tag: 'Exercise', startMin: 305 },
    { id: 'freshup', label: 'Fresh up', tag: 'Fresh up', startMin: 335 },
    { id: 'productive1', label: 'পড়াশোনা / স্কিল ডেভেলপমেন্ট', tag: 'Productive', startMin: 350 },
    { id: 'prep', label: 'অফিসের প্রস্তুতি', tag: 'Prep', startMin: 390 },
    { id: 'office', label: 'অফিস', tag: 'Work', startMin: 420 },
    { id: 'rest1', label: 'রেস্ট + চা', tag: 'Rest', startMin: 930 },
    { id: 'work2', label: 'হালকা কাজ / reading', tag: 'Work', startMin: 960 },
    { id: 'rest2', label: 'Family time', tag: 'Rest', startMin: 1020 },
    { id: 'asr', label: 'আসর জামাত', tag: 'Salah', startMin: 1035 },
    { id: 'maghrib', label: 'মাগরিব নামাজ', tag: 'Salah', startMin: 1110 },
    { id: 'deenread', label: 'কুরআন তিলাওয়াত', tag: 'Deen', startMin: 1140 },
    { id: 'isha', label: 'ইশা জামাত', tag: 'Salah', startMin: 1230 },
    { id: 'reflect', label: 'দিনের রিভিউ + planning', tag: 'Reflect', startMin: 1230 },
    { id: 'unwind', label: 'ফোন কম, হালকা reading', tag: 'Unwind', startMin: 1275 },
    { id: 'sleep', label: 'ঘুমাতে যাওয়া', tag: 'Sleep', startMin: 1380 }
  ];
  var PRAYER_IDS = ['fajr', 'asr', 'maghrib', 'isha'];

  function nowMinutes() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- DATA LAYER (reuses RD.routine from routine.js) ---------- */
  function todayChecks() {
    if (!RD.routine) return {};
    return RD.routine.getDayChecks(RD.todayKey());
  }
  function completionPercent(checks) {
    var ids = (RD.routine && RD.routine.allIds) ? RD.routine.allIds : TASKS.map(function (t) { return t.id; });
    if (!ids.length) return 0;
    var done = ids.filter(function (id) { return checks[id]; }).length;
    return Math.round((done / ids.length) * 100);
  }
  function fajrStreak() {
    if (!RD.routine) return 0;
    var streak = 0, d = new Date();
    var checkedToday = RD.routine.getDayChecks(RD.todayKey())['fajr'];
    if (!checkedToday) d.setDate(d.getDate() - 1);
    while (true) {
      var checks = RD.routine.getDayChecks(RD.dateKey(d));
      if (checks['fajr']) { streak++; d.setDate(d.getDate() - 1); } else { break; }
      if (streak > 365) break;
    }
    return streak;
  }
  function lastNDaysStats(n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var checks = RD.routine ? RD.routine.getDayChecks(RD.dateKey(d)) : {};
      out.push({ date: RD.dateKey(d), pct: completionPercent(checks), checks: checks });
    }
    return out;
  }
  function quranLoggedToday() {
    var q = RD.safeGetJSON('routine_quran', null);
    return !!(q && q.date === RD.todayKey() && (q.surah || q.page));
  }
  function nextPrayerText() {
    var el = document.getElementById('countdown');
    return el ? el.textContent.trim() : null;
  }

  /* ---------- INSIGHT ENGINE ---------- */
  function productivityScore() {
    var pct = completionPercent(todayChecks());
    var streak = fajrStreak();
    var score = Math.round(pct * 0.7);
    score += Math.min(streak, 10) * 1.5;
    if (quranLoggedToday()) score += 8;
    if (todayChecks()['fajr']) score += 5;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function scoreLabel(score) {
    if (score >= 85) return 'দারুণ 🌟';
    if (score >= 65) return 'ভালো চলছে 👍';
    if (score >= 40) return 'মোটামুটি — আরেকটু চেষ্টা 💪';
    return 'শুরু করার সময় হয়েছে 🌱';
  }

  function taskPriorityList() {
    var checks = todayChecks();
    var now = nowMinutes();
    var pending = TASKS.filter(function (t) { return !checks[t.id]; });
    pending.forEach(function (t) { t.diff = t.startMin - now; });
    // Overdue-but-recent first (within last 4 hours), then soonest upcoming, then the rest.
    pending.sort(function (a, b) {
      var aOverdue = a.diff < 0 && a.diff >= -240;
      var bOverdue = b.diff < 0 && b.diff >= -240;
      if (aOverdue && !bOverdue) return -1;
      if (bOverdue && !aOverdue) return 1;
      if (aOverdue && bOverdue) return b.diff - a.diff; // closest-to-now overdue first
      return a.diff - b.diff; // soonest upcoming first
    });
    return pending.slice(0, 5);
  }

  function weeklyAdvice() {
    var stats = lastNDaysStats(7);
    var avg = Math.round(stats.reduce(function (s, d) { return s + d.pct; }, 0) / stats.length);
    var firstHalf = stats.slice(0, 3).reduce(function (s, d) { return s + d.pct; }, 0) / 3;
    var secondHalf = stats.slice(4).reduce(function (s, d) { return s + d.pct; }, 0) / 3;
    var trend = secondHalf - firstHalf;
    var best = stats.reduce(function (a, b) { return b.pct > a.pct ? b : a; });
    var worst = stats.reduce(function (a, b) { return b.pct < a.pct ? b : a; });
    var trendText = trend > 8 ? 'সপ্তাহের শেষদিকে আপনার ধারাবাহিকতা বেড়েছে 📈'
      : trend < -8 ? 'সপ্তাহের শেষদিকে কিছুটা কমেছে — মাঝে কী বদলেছে একটু ভাবুন 📉'
        : 'সপ্তাহজুড়ে মোটামুটি স্থিতিশীল ছিলেন ⚖️';
    return {
      avg: avg, best: best, worst: worst, trendText: trendText
    };
  }

  function prayerConsistency() {
    var stats = lastNDaysStats(7);
    var total = 0, count = 0;
    stats.forEach(function (d) {
      PRAYER_IDS.forEach(function (id) { total++; if (d.checks[id]) count++; });
    });
    return Math.round((count / total) * 100);
  }

  var MOTIVATION = [
    'ছোট ছোট ধারাবাহিক কাজই বড় পরিবর্তন আনে — আজকের একটা কাজ শেষ করেই দেখুন।',
    'যতটুকু করেছেন সেটাই গণনায় আসে, বাকিটা এখনো সময় আছে।',
    'রুটিন মানে perfect হওয়া না, ধারাবাহিক থাকা।',
    '"নিশ্চয়ই কষ্টের সাথে স্বস্তি আছে" — আজকের কষ্টটুকু কালকের জন্য বিনিয়োগ।',
    'একদিন miss হলেই সব শেষ না — কালকেই আবার শুরু করা যায়।',
    'আপনার Fajr streak যতই থাকুক, আজকেরটাই সবচেয়ে গুরুত্বপূর্ণ।',
    'ছোট কাজ, কিন্তু নিয়মিত — এটাই আসল প্রোডাক্টিভিটি।'
  ];
  function motivationalMessage() {
    var dayIdx = Math.floor(Date.now() / 86400000) % MOTIVATION.length;
    return MOTIVATION[dayIdx];
  }

  var STUDY_TIPS = [
    'পড়ার আগে ৫ মিনিট আজকের লক্ষ্য লিখে ফেলুন — ফোকাস অনেক বাড়ে।',
    'একটানা ২৫ মিনিট পড়ে ৫ মিনিট বিরতি — Pomodoro method try করুন।',
    'নতুন কিছু শেখার পর নিজের ভাষায় ৩ লাইনে লিখে ফেলুন, মনে থাকবে বেশি।',
    'সকালের productive block-এ সবচেয়ে কঠিন কাজটা আগে রাখুন।'
  ];
  var HEALTH_TIPS = [
    'সকালের হাঁটা/জগিং miss হলে বিকেলে ১৫ মিনিট হলেও হাঁটুন।',
    'প্রতি ঘণ্টায় অফিসে অন্তত ১ মিনিট দাঁড়িয়ে স্ট্রেচ করুন।',
    'ঘুমানোর আগে ফোন কম দেখলে ঘুমের মান ভালো হয় — Unwind ব্লকটা কাজে লাগান।',
    'পানি খাওয়ার কথা মনে না থাকলে প্রতিটা নামাজের পর ১ গ্লাস পানি — এই অভ্যাসটা try করুন।'
  ];
  function pickByDay(arr) { return arr[Math.floor(Date.now() / 86400000) % arr.length]; }

  /* ---------- RESPONSE BUILDERS (return HTML strings, already escaped where needed) ---------- */
  function respDailyPlan() {
    var pri = taskPriorityList();
    var pct = completionPercent(todayChecks());
    var html = '<b>আজকের অবস্থা:</b> ' + pct + '% সম্পন্ন।<br><br>';
    if (pri.length === 0) {
      html += 'আজকের সব কাজ শেষ — চমৎকার! 🎉';
    } else {
      html += '<b>এখন যা করা দরকার:</b><br>';
      pri.forEach(function (t) {
        var when = t.diff < 0 ? '(সময় পার হয়ে গেছে, এখনই করুন)' : '(' + Math.round(t.diff / 60 * 10) / 10 + ' ঘণ্টা পরে)';
        html += '• ' + escapeHtml(t.tag) + ' — ' + escapeHtml(t.label) + ' ' + when + '<br>';
      });
    }
    var next = nextPrayerText();
    if (next) html += '<br>🕌 ' + escapeHtml(next);
    return html;
  }

  function respScore() {
    var score = productivityScore();
    return '<b>আজকের Productivity Score: ' + score + '/100</b><br>' + scoreLabel(score) +
      '<br><br>স্কোর হিসাব হয় checklist completion, Fajr streak, ও Quran log থেকে।';
  }

  function respPriority() {
    var pri = taskPriorityList();
    if (pri.length === 0) return 'আজকের কোনো কাজ বাকি নেই — দারুণ! 🎉';
    var html = '<b>অগ্রাধিকার অনুযায়ী বাকি কাজ:</b><br>';
    pri.forEach(function (t, i) {
      html += (i + 1) + '. ' + escapeHtml(t.tag) + ' — ' + escapeHtml(t.label) + '<br>';
    });
    return html;
  }

  function respWeekly() {
    var w = weeklyAdvice();
    return '<b>গত ৭ দিনের গড় completion: ' + w.avg + '%</b><br>' +
      w.trendText + '<br><br>' +
      '🏆 সেরা দিন: ' + w.best.pct + '% (' + w.best.date + ')<br>' +
      '📉 দুর্বল দিন: ' + w.worst.pct + '% (' + w.worst.date + ')';
  }

  function respPrayer() {
    var pct = prayerConsistency();
    var streak = fajrStreak();
    var html = '<b>গত ৭ দিনে নামাজ ধারাবাহিকতা: ' + pct + '%</b><br>🔥 Fajr streak: ' + streak + ' দিন<br>';
    var next = nextPrayerText();
    if (next) html += '<br>' + escapeHtml(next);
    if (pct < 60) html += '<br><br>একটা ওয়াক্তকে target করুন প্রথমে (যেমন Fajr) — বাকিগুলো এমনিই সহজ হয়ে যাবে।';
    return html;
  }

  function respMotivation() { return '💛 ' + motivationalMessage(); }
  function respStudy() { return '📚 ' + pickByDay(STUDY_TIPS); }
  function respHealth() { return '🏃 ' + pickByDay(HEALTH_TIPS); }

  function respExpense() {
    return 'Expense Tracker মডিউলটা এখনো তৈরি হয়নি — এটা পরের ধাপে যোগ হবে। তখন থেকে আমি আপনার আসল খরচের ডেটা বিশ্লেষণ করে দিতে পারব (এখন placeholder সংখ্যা দেখিয়ে বিভ্রান্ত করব না)।';
  }
  function respHabit() {
    return 'আলাদা Habit Tracker মডিউলটা এখনো তৈরি হয়নি। তবে আপনার দৈনিক checklist থেকে আমি Fajr streak আর সামগ্রিক completion দেখতে পারছি — জিজ্ঞেস করুন "score" বা "সপ্তাহ" লিখে।';
  }

  function respHelp() {
    return 'আমি এই বিষয়ে সাহায্য করতে পারি:<br>' +
      '• "প্ল্যান" — আজকের বাকি কাজ ও অগ্রাধিকার<br>' +
      '• "স্কোর" — আজকের productivity score<br>' +
      '• "সপ্তাহ" — সাপ্তাহিক পর্যালোচনা<br>' +
      '• "নামাজ" — নামাজের ধারাবাহিকতা<br>' +
      '• "পড়াশোনা" / "স্বাস্থ্য" — পরামর্শ<br>' +
      '• "মোটিভেশন" — একটা অনুপ্রেরণামূলক কথা<br><br>' +
      'নিচের চিপ বাটনগুলোতে চাপলেও সরাসরি উত্তর পাবেন।';
  }

  /* ---------- ROUTER ---------- */
  function routeMessage(raw) {
    var m = raw.toLowerCase();
    function has(words) { return words.some(function (w) { return m.indexOf(w) !== -1; }); }

    if (has(['প্ল্যান', 'plan', 'রুটিন', 'routine', 'schedule'])) return respDailyPlan();
    if (has(['স্কোর', 'score'])) return respScore();
    if (has(['অগ্রাধিকার', 'priorit', 'টাস্ক', 'task'])) return respPriority();
    if (has(['সপ্তাহ', 'week'])) return respWeekly();
    if (has(['নামাজ', 'salah', 'prayer', 'namaz', 'namaj'])) return respPrayer();
    if (has(['মোটিভেশন', 'motivat', 'উৎসাহ'])) return respMotivation();
    if (has(['পড়া', 'study', 'পড়াশোনা'])) return respStudy();
    if (has(['স্বাস্থ্য', 'health', 'ব্যায়াম', 'exercise'])) return respHealth();
    if (has(['খরচ', 'expense', 'টাকা', 'money', 'বাজেট', 'budget'])) return respExpense();
    if (has(['অভ্যাস', 'habit'])) return respHabit();
    if (has(['সাহায্য', 'help', 'কি পার', 'কী পার'])) return respHelp();

    return 'ঠিক বুঝিনি 🙏 নিচের চিপ বাটনগুলো ব্যবহার করুন, অথবা "সাহায্য" লিখে দেখুন আমি কী কী পারি।';
  }

  /* ---------- CHAT UI ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var fab = document.getElementById('aiFab');
    var panel = document.getElementById('aiPanel');
    var backdrop = document.getElementById('aiBackdrop');
    var closeBtn = document.getElementById('aiClose');
    var messagesEl = document.getElementById('aiMessages');
    var inputEl = document.getElementById('aiInput');
    var sendBtn = document.getElementById('aiSend');
    var chips = document.querySelectorAll('.ai-chip');
    if (!fab || !panel) return;

    var opened = false;
    var greeted = false;

    function addMessage(html, who) {
      var row = document.createElement('div');
      row.className = 'ai-msg ' + (who === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
      row.innerHTML = html;
      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function botReply(text) {
      // small delay makes the exchange feel conversational rather than instant-dump
      setTimeout(function () { addMessage(text, 'bot'); }, 250);
    }

    function sendUserText(text) {
      text = text.trim();
      if (!text) return;
      addMessage(escapeHtml(text), 'user');
      inputEl.value = '';
      botReply(routeMessage(text));
    }

    function openPanel() {
      panel.classList.add('open');
      backdrop.classList.add('open');
      fab.setAttribute('aria-expanded', 'true');
      opened = true;
      if (!greeted) {
        greeted = true;
        var score = productivityScore();
        addMessage('আসসালামু আলাইকুম! আমি আপনার routine সহকারী। আজকের score <b>' + score + '/100</b> — ' + scoreLabel(score) + '<br><br>নিচের বাটনে চাপুন বা কিছু জিজ্ঞেস করুন।', 'bot');
      }
    }
    function closePanel() {
      panel.classList.remove('open');
      backdrop.classList.remove('open');
      fab.setAttribute('aria-expanded', 'false');
      opened = false;
    }

    fab.addEventListener('click', function () { opened ? closePanel() : openPanel(); });
    closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);

    sendBtn.addEventListener('click', function () { sendUserText(inputEl.value); });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendUserText(inputEl.value); }
    });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var label = chip.textContent.trim();
        sendUserText(label);
      });
    });
  });

})(window.RD);
