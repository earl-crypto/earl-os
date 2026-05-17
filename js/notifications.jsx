// js/notifications.jsx — Show-day notification scheduling for Earl OS

function _parseTime(str, baseDate) {
  if (!str?.trim()) return null;
  const m = str.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if (!m) return null;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  const p = m[3]?.toLowerCase();
  if (p === 'pm' && h !== 12) h += 12;
  if (p === 'am' && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const d = new Date(baseDate);
  d.setHours(h, min, 0, 0);
  return d;
}

function _toDateStr(d) { return d.toISOString().slice(0, 10); }

const _FP = "earl-os:notif:";
const _hasFired  = (date, type) => localStorage.getItem(`${_FP}${date}:${type}`) === "1";
const _markFired = (date, type) => localStorage.setItem(`${_FP}${date}:${type}`, "1");

function _notify(title, body) {
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "assets/earl-neal-logo.jpeg" });
  } catch (e) {
    console.warn("[earl-os] notification error:", e.message);
  }
}

function useNotifications({ showDates, journalShow }) {
  const supported = typeof Notification !== "undefined";
  const [permission, setPermission] = React.useState(supported ? Notification.permission : "denied");

  const requestPermission = React.useCallback(async () => {
    if (!supported) return "denied";
    const r = await Notification.requestPermission();
    setPermission(r);
    return r;
  }, [supported]);

  const sendTest = React.useCallback(() => {
    _notify("Earl OS", "Notifications are working ✓");
  }, []);

  React.useEffect(() => {
    if (permission !== "granted") return;

    const check = () => {
      const now     = new Date();
      const today   = _toDateStr(now);
      const isShow  = showDates.includes(today);
      const h = now.getHours(), m = now.getMinutes();

      // Daily briefing 8:00 AM
      if (h === 8 && m === 0 && !_hasFired(today, "briefing")) {
        _notify(
          "Good morning, Earl",
          isShow
            ? "Show day. Check your tasks and show journal."
            : "Daily briefing. Your tasks are ready."
        );
        _markFired(today, "briefing");
      }

      if (!isShow) return;
      const entry = journalShow[today] || {};

      // Check X minutes before a time string
      const before = (timeStr, mins, key, title, body) => {
        const t = _parseTime(timeStr, now);
        if (!t) return;
        const diff = (t - now) / 60000;
        if (diff >= mins - 1 && diff < mins + 1 && !_hasFired(today, key)) {
          _notify(title, body);
          _markFired(today, key);
        }
      };

      const v = entry.venue ? ` · ${entry.venue}` : "";

      before(entry.crew_call,  30, "crew-30",   "Crew Call in 30 min",   `Crew call soon${v}. Radios charged?`);
      before(entry.emcee_time, 15, "emcee-15",  "Emcee On in 15 min",    `Emcee time approaching${v}. Are they backstage?`);
      before(entry.show_time,  60, "show-60",   "Show in 1 Hour",        `Doors open soon${v}. Time for final walkthrough.`);
      before(entry.show_time,  30, "show-30",   "Show in 30 Minutes",    `30 minutes to showtime${v}. You got this.`);
      before(entry.curfew,     30, "curfew-30", "Curfew in 30 Minutes",  `Hard curfew in 30 min${v}. Begin wrap-up.`);
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [permission, showDates, journalShow]);

  return { permission, requestPermission, sendTest };
}

Object.assign(window, { useNotifications });
