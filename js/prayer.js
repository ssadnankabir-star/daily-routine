/* ============================================================
   prayer.js
   Prayer times (Aladhan API), live countdown, location
   detection, Hijri date + Ramadan banner, browser notification
   reminders, and the soft adhan-time chime.

   Bug fixes applied in this pass (behavior-preserving):
   - Reminder/chime firing used a single exact-minute equality
     check against a 30s poll, so a throttled/backgrounded tab
     could skip the one matching tick and miss the alert for
     the whole day. Widened to a 2-minute window, still
     deduplicated per day so nothing fires twice.
   ============================================================ */
(function (RD) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var DHAKA = { lat: 23.8103, lon: 90.4125, name: "Dhaka" };
    var statusEl = document.getElementById('locStatus');
    var countdownEl = document.getElementById('countdown');
    var useLocBtn = document.getElementById('useLocationBtn');
    var refreshBtn = document.getElementById('refreshBtn');
    if (!statusEl || !countdownEl) return; // prayer strip not on this page

    var timings = null;

    function setStatus(text, cls) {
      statusEl.className = 'loc-status' + (cls ? ' ' + cls : '');
      statusEl.innerHTML = '<span class="dot"></span>' + text;
    }
    function to12h(t) {
      if (!t) return '--:--';
      t = t.split(' ')[0];
      var parts = t.split(':').map(Number);
      var h = parts[0], m = parts[1];
      var ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12; if (h === 0) h = 12;
      return h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    }
    function toMinutes(t) {
      var parts = t.split(' ')[0].split(':').map(Number);
      return parts[0] * 60 + parts[1];
    }

    function updateCountdownAndActive() {
      if (!timings) return;
      var order = [
        ['fajr', timings.Fajr], ['dhuhr', timings.Dhuhr], ['asr', timings.Asr],
        ['maghrib', timings.Maghrib], ['isha', timings.Isha]
      ];
      var now = new Date();
      var nowMin = now.getHours() * 60 + now.getMinutes();

      document.querySelectorAll('.p-card').forEach(function (c) { c.classList.remove('active'); });

      var next = null;
      for (var i = 0; i < order.length; i++) { if (toMinutes(order[i][1]) > nowMin) { next = order[i]; break; } }
      var activeKey = order[order.length - 1][0];
      for (var j = 0; j < order.length; j++) { if (toMinutes(order[j][1]) <= nowMin) { activeKey = order[j][0]; } else { break; } }
      var activeCard = document.getElementById('p-' + activeKey);
      if (activeCard) activeCard.classList.add('active');

      if (next) {
        var diff = toMinutes(next[1]) - nowMin;
        var h = Math.floor(diff / 60), m = diff % 60;
        var names = { fajr: 'ফজর', dhuhr: 'যোহর', asr: 'আসর', maghrib: 'মাগরিব', isha: 'ইশা' };
        countdownEl.innerHTML = names[next[0]] + ' আর <b>' + (h > 0 ? h + 'ঘ ' : '') + m + 'মি</b> পরে';
      } else {
        countdownEl.textContent = 'আজকের ওয়াক্ত শেষ — কাল Fajr থেকে আবার';
      }
    }

    async function loadTimings(lat, lon, label) {
      setStatus('লোড হচ্ছে (' + label + ')...');
      try {
        var today = new Date();
        var dateStr = String(today.getDate()).padStart(2, '0') + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + today.getFullYear();
        var url = 'https://api.aladhan.com/v1/timings/' + dateStr + '?latitude=' + lat + '&longitude=' + lon + '&method=1';
        var res = await fetch(url);
        if (!res.ok) throw new Error('API error');
        var data = await res.json();
        timings = data.data.timings;

        document.getElementById('t-fajr').textContent = to12h(timings.Fajr);
        document.getElementById('t-dhuhr').textContent = to12h(timings.Dhuhr);
        document.getElementById('t-asr').textContent = to12h(timings.Asr);
        document.getElementById('t-maghrib').textContent = to12h(timings.Maghrib);
        document.getElementById('t-isha').textContent = to12h(timings.Isha);

        updateCountdownAndActive();
        updateRamadanBanner();
        setStatus('লাইভ — ' + label + ' (Aladhan API)', 'live');
      } catch (err) {
        setStatus('লোড করা যায়নি — ইন্টারনেট চেক করুন।', 'err');
        countdownEl.textContent = '—';
      }
    }

    if (useLocBtn) {
      useLocBtn.addEventListener('click', function () {
        if (!navigator.geolocation) {
          setStatus('লোকেশন সাপোর্ট নেই — Dhaka ব্যবহার হচ্ছে।', 'err');
          loadTimings(DHAKA.lat, DHAKA.lon, DHAKA.name);
          return;
        }
        setStatus('লোকেশন খোঁজা হচ্ছে...');
        navigator.geolocation.getCurrentPosition(
          function (pos) { loadTimings(pos.coords.latitude, pos.coords.longitude, 'আপনার লোকেশন'); },
          function () {
            setStatus('লোকেশন পাওয়া যায়নি — Dhaka ব্যবহার হচ্ছে।', 'err');
            loadTimings(DHAKA.lat, DHAKA.lon, DHAKA.name);
          },
          { timeout: 8000 }
        );
      });
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () { loadTimings(DHAKA.lat, DHAKA.lon, DHAKA.name); });
    }

    loadTimings(DHAKA.lat, DHAKA.lon, DHAKA.name);
    setInterval(updateCountdownAndActive, 60000);

    /* ---------- HIJRI DATE + RAMADAN MODE ---------- */
    var hijriPill = document.getElementById('hijriPill');
    var ramadanBanner = document.getElementById('ramadanBanner');
    var hijriMonth = null;
    try {
      var fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
      var parts = fmt.formatToParts(new Date());
      var get = function (type) { var p = parts.find(function (x) { return x.type === type; }); return p ? p.value : ''; };
      if (hijriPill) hijriPill.textContent = '🌙 ' + get('day') + ' ' + get('month') + ' ' + get('year') + ' হিজরি';
      var monthNum = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric' }).format(new Date());
      hijriMonth = parseInt(monthNum, 10);
    } catch (e) {
      if (hijriPill) hijriPill.textContent = '';
    }
    function updateRamadanBanner() {
      if (!ramadanBanner) return;
      if (hijriMonth === 9 && timings) {
        ramadanBanner.classList.add('show');
        document.getElementById('rbSahri').textContent = to12h(timings.Fajr);
        document.getElementById('rbIftar').textContent = to12h(timings.Maghrib);
      } else {
        ramadanBanner.classList.remove('show');
      }
    }

    /* ---------- NOTIFICATIONS ---------- */
    var notifBtn = document.getElementById('notifBtn');
    var notifEnabled = RD.safeGet('routine_notif') === '1';
    function refreshNotifBtn() { if (notifBtn) notifBtn.textContent = notifEnabled ? 'চালু আছে ✓' : 'চালু করুন'; }
    refreshNotifBtn();

    if (notifBtn) {
      notifBtn.addEventListener('click', function () {
        if (!('Notification' in window)) { alert('এই ব্রাউজারে notification সাপোর্ট নেই।'); return; }
        Notification.requestPermission().then(function (perm) {
          if (perm === 'granted') {
            notifEnabled = true; RD.safeSet('routine_notif', '1'); refreshNotifBtn();
            new Notification('রিমাইন্ডার চালু হয়েছে', { body: 'নামাজ ও productive block শুরুর ১০ মিনিট আগে জানানো হবে।' });
          } else {
            alert('Notification permission দেওয়া হয়নি।');
          }
        });
      });
    }

    var firedToday = {};
    function reminderTargets() {
      var list = [
        ['fajr', '04:50', 'ফজর জামাত'],
        ['asr', '17:15', 'আসর জামাত'],
        ['isha', '20:30', 'ইশা জামাত'],
        ['prod1', '05:50', 'সকালের productive block'],
        ['prod2', '16:00', 'বিকালের কাজের block'],
        ['wind', '21:15', 'Wind down সময়'],
        ['sleep', '23:00', 'ঘুমানোর সময়']
      ];
      if (timings && timings.Maghrib) {
        list.push(['maghrib', timings.Maghrib.split(' ')[0], 'মাগরিব নামাজ']);
      }
      return list;
    }
    function checkReminders() {
      if (!notifEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
      var now = new Date();
      var nowMin = now.getHours() * 60 + now.getMinutes();
      var key = RD.todayKey();
      reminderTargets().forEach(function (t) {
        var parts = t[1].split(':').map(Number);
        var targetMin = parts[0] * 60 + parts[1] - 10;
        var fireKey = key + '_' + t[0];
        // Widened from exact-minute equality to a 2-minute window so a
        // throttled tab (30s poll) can't miss the only matching tick.
        if (nowMin >= targetMin && nowMin <= targetMin + 1 && !firedToday[fireKey]) {
          firedToday[fireKey] = true;
          new Notification(t[2] + ' — ১০ মিনিট বাকি', { body: 'এখনই প্রস্তুতি নিন।' });
        }
      });
    }
    setInterval(checkReminders, 30000);

    /* ---------- ADHAN-TIME CHIME (soft tone, not an actual adhan recording) ---------- */
    var soundBtn = document.getElementById('soundBtn');
    var soundEnabled = RD.safeGet('routine_sound') === '1';
    function refreshSoundBtn() { if (soundBtn) soundBtn.textContent = soundEnabled ? 'চালু আছে ✓' : 'চালু করুন'; }
    refreshSoundBtn();

    function playChime() {
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        var ctx = new Ctx();
        var notes = [660, 880, 990];
        notes.forEach(function (freq, i) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = 'sine'; osc.frequency.value = freq;
          osc.connect(gain); gain.connect(ctx.destination);
          var start = ctx.currentTime + i * 0.28;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.18, start + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
          osc.start(start); osc.stop(start + 0.65);
        });
      } catch (e) { /* AudioContext unavailable — silently skip */ }
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        soundEnabled = !soundEnabled;
        RD.safeSet('routine_sound', soundEnabled ? '1' : '0');
        refreshSoundBtn();
        if (soundEnabled) playChime();
      });
    }

    var chimedToday = {};
    function checkChime() {
      if (!soundEnabled || !timings) return;
      var now = new Date();
      var nowMin = now.getHours() * 60 + now.getMinutes();
      var key = RD.todayKey();
      [['fajr', timings.Fajr], ['dhuhr', timings.Dhuhr], ['asr', timings.Asr], ['maghrib', timings.Maghrib], ['isha', timings.Isha]].forEach(function (p) {
        var targetMin = toMinutes(p[1]);
        var fireKey = key + '_chime_' + p[0];
        if (nowMin >= targetMin && nowMin <= targetMin + 1 && !chimedToday[fireKey]) {
          chimedToday[fireKey] = true;
          playChime();
        }
      });
    }
    setInterval(checkChime, 30000);
  });

})(window.RD);
