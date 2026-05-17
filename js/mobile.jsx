// js/mobile.jsx — Mobile layout for Earl OS (bottom tab navigation)

function useMobile() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function MobileApp({ session }) {
  const {
    profile, setProfile, showDay, setShowDay, tweaks,
    showDates, journalShow,
  } = useData();
  const { permission: notifPerm, requestPermission } = useNotifications({ showDates, journalShow });
  const [tab, setTab] = React.useState("tasks");
  const t = tweaks;

  const now = React.useMemo(() => new Date(), []);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const liveNow = React.useMemo(() => new Date(), [tick]);
  const timeStr = liveNow.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const showContext = React.useMemo(() => {
    const d = new Date();
    const todayS = d.toISOString().slice(0, 10);
    const tomS   = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    const yestS  = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
    if (showDates.includes(todayS)) return { phase: "show", label: "today",        showDate: todayS };
    if (showDates.includes(tomS))   return { phase: "pre",  label: "show tomorrow", showDate: tomS };
    if (showDates.includes(yestS))  return { phase: "post", label: "day after",     showDate: yestS };
    return null;
  }, [showDates]);

  const tabs = [
    { id: "me",      icon: "◆", label: "Me"      },
    { id: "tasks",   icon: "●", label: "Tasks"   },
    ...(showDay ? [{ id: "show", icon: "★", label: "Show" }] : []),
    { id: "journal", icon: "❖", label: "Journal" },
    { id: "notes",   icon: "✎", label: "Notes"   },
  ];

  React.useEffect(() => {
    if (!tabs.find(tb => tb.id === tab)) setTab("tasks");
  }, [showDay]);

  return (
    <div className={`m-app dens-${t.density} ac-${t.accent}`}>
      <div className="m-header">
        <img src="assets/earl-neal-logo.jpeg" className="m-logo" alt="" />
        <span className="m-brand">EARL OS</span>
        <span className={`m-mode-badge ${showDay ? "m-mode-show" : ""}`}>
          <span className="mode-pulse" />
          {showDay ? "SHOW" : "WORK"}
        </span>
        <span className="m-spacer" />
        <span className="m-time">{timeStr}</span>
        <button className="m-gear" title="Settings"
          onClick={() => window.postMessage({ type: '__activate_edit_mode' }, '*')}>⚙</button>
      </div>

      <div className="m-content">
        {tab === "me"      && <div className="m-pad"><PersonalWidget showDay={showDay} setShowDay={setShowDay} profile={profile} setProfile={setProfile} /></div>}
        {tab === "tasks"   && <MobileTasks showContext={showContext} />}
        {tab === "show"    && <div className="m-pad"><ShowJournal /></div>}
        {tab === "journal" && <div className="m-pad"><PersonalJournal /></div>}
        {tab === "notes"   && <div className="m-pad"><QuickNotes /></div>}
      </div>

      <div className="m-tabbar">
        {tabs.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`m-tab${tab === id ? " m-tab-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <span className="m-tab-icon">{icon}</span>
            <span className="m-tab-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileTasks({ showContext }) {
  return (
    <div className="m-tasks">
      {showContext && (
        <div className="m-section">
          <div className="m-section-hd">
            Show Tasks <span className="m-section-hint">{showContext.label}</span>
          </div>
          <ShowTasksWidget phase={showContext.phase} showDate={showContext.showDate} />
        </div>
      )}
      <div className="m-section">
        <div className="m-section-hd">Daily Office</div>
        <RepeatingTaskList accent="var(--blue)" />
      </div>
      <div className="m-section">
        <div className="m-section-hd">One-offs</div>
        <TaskList accent="var(--amber)" />
      </div>
    </div>
  );
}

Object.assign(window, { useMobile, MobileApp });
