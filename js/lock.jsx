// js/lock.jsx — Auto-lock on idle for Earl OS

function useIdleLock(enabled, timeoutMins) {
  const [locked, setLocked] = React.useState(false);
  const lastActive = React.useRef(Date.now());

  React.useEffect(() => {
    if (!enabled) { setLocked(false); return; }

    const reset = () => { lastActive.current = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));

    const id = setInterval(() => {
      if (Date.now() - lastActive.current >= timeoutMins * 60000) setLocked(true);
    }, 15000);

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clearInterval(id);
    };
  }, [enabled, timeoutMins]);

  const unlock = React.useCallback(() => {
    lastActive.current = Date.now();
    setLocked(false);
  }, []);

  return { locked, unlock };
}

function LockScreen({ onUnlock, wallpaper = "navy" }) {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className={`lock-screen wp-${wallpaper}`} onClick={onUnlock}>
      <div className="lock-inner">
        <img src="assets/earl-neal-logo.jpeg" className="lock-logo" alt="EN" />
        <div className="lock-time">{timeStr}</div>
        <div className="lock-date">{dateStr}</div>
        <div className="lock-brand">EARL OS</div>
        <div className="lock-hint">tap anywhere to unlock</div>
      </div>
    </div>
  );
}

Object.assign(window, { useIdleLock, LockScreen });
