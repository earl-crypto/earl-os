// Earl OS — main app.

// Initial window layout, calibrated for ~1480×900 viewport.
const LAYOUTS = {
  personal:     { pos: { x:  16, y:  52 }, size: { w: 320, h: 388 } },
  calendar:     { pos: { x: 348, y:  52 }, size: { w: 460, h: 388 } },
  gmail:        { pos: { x: 820, y:  52 }, size: { w: 320, h: 388 } },
  weather:      { pos: { x:1152, y:  52 }, size: { w: 312, h: 388 } },

  news:         { pos: { x:  16, y: 452 }, size: { w: 792, h: 216 } },
  tasksShow:    { pos: { x: 820, y: 452 }, size: { w: 320, h: 216 } },
  tasksOneOff:  { pos: { x:1152, y: 452 }, size: { w: 312, h: 216 } },

  journal:      { pos: { x:  16, y: 680 }, size: { w: 480, h: 200 } },
  tasksNonShow: { pos: { x: 508, y: 680 }, size: { w: 300, h: 200 } },
  notes:        { pos: { x: 820, y: 680 }, size: { w: 644, h: 200 } },

  showJournal:  { pos: { x: 360, y:  84 }, size: { w: 760, h: 600 } },
};

function toDateStr(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }

function App({ session }) {
  const { profile, setProfile, showDay, setShowDay, tweaks, setTweak, closed, setClosed, showDates, addShowDate, removeShowDate } = useData();
  const t = tweaks;

  // Compute today's relationship to nearest show date.
  const showContext = React.useMemo(() => {
    const today = new Date();
    const todayS = toDateStr(today);
    const tomS   = toDateStr(addDays(today, 1));
    const yestS  = toDateStr(addDays(today, -1));
    if (showDates.includes(todayS)) return { phase: "show", label: "today",        showDate: todayS };
    if (showDates.includes(tomS))   return { phase: "pre",  label: "show tomorrow", showDate: tomS };
    if (showDates.includes(yestS))  return { phase: "post", label: "day after",     showDate: yestS };
    return null;
  }, [showDates]);

  const close = (id) => setClosed({ ...closed, [id]: true });
  const open  = (id) => setClosed({ ...closed, [id]: false });

  const now = useNow();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const docks = [
    { id: "personal",     label: "Me" },
    { id: "calendar",     label: "Cal" },
    { id: "gmail",        label: "Mail" },
    { id: "weather",      label: "Wx" },
    { id: "news",         label: "News" },
    { id: "tasksShow",    label: "T·Show", showDateOnly: true },
    { id: "tasksNonShow", label: "T·Office" },
    { id: "tasksOneOff",  label: "T·One-off" },
    { id: "notes",        label: "Notes" },
    { id: "journal",      label: "Journal" },
    { id: "showJournal",  label: "Show Log", showOnly: true },
  ];

  return (
    <div className={"app dens-" + t.density + " wp-" + t.wallpaper + " ac-" + t.accent + (showDay ? " mode-show" : " mode-work") + (t.showGrid ? " show-grid" : "")}>
      {/* Top menu bar */}
      <div className="menubar">
        <div className="menubar-l">
          <img className="menubar-logo" src="assets/earl-neal-logo.jpeg" alt="EN" />
          <span className="menubar-brand">EARL OS</span>
          <span className="menubar-sep">·</span>
          <span className={"menubar-mode " + (showDay ? "menubar-mode-show" : "menubar-mode-work")}>
            <span className="mode-pulse" />
            {showDay ? "SHOW DAY" : "WORK DAY"}
          </span>
        </div>
        <div className="menubar-c">
          <span className="menubar-date">{dateStr}</span>
        </div>
        <div className="menubar-r">
          <div className="dock">
            {docks.filter(d => {
            if (d.showOnly && !showDay) return false;
            if (d.showDateOnly && !showContext) return false;
            return true;
          }).map(d => (
              <button
                key={d.id}
                className={"dock-btn" + (closed[d.id] ? " dock-btn-closed" : "")}
                onClick={() => closed[d.id] ? open(d.id) : window.dispatchEvent(new CustomEvent("focus-win", { detail: d.id }))}
              >{d.label}</button>
            ))}
          </div>
          <a href="tech-design.html" className="menubar-techdoc" title="Tech Design Document">Tech Doc</a>
          <button className="menubar-signout" title="Sign out" onClick={() => _sb.auth.signOut()}>
            {session?.user?.user_metadata?.avatar_url
              ? <img src={session.user.user_metadata.avatar_url} className="menubar-avatar" alt="" />
              : '⎋'}
          </button>
          <span className="menubar-time">{timeStr}</span>
        </div>
      </div>

      {/* Window surface */}
      <WindowManager>
        <Window
          id="personal" title="Personal" accent="var(--red)" icon="◆"
          defaultPos={LAYOUTS.personal.pos} defaultSize={LAYOUTS.personal.size}
          hidden={closed.personal} onClose={() => close("personal")}
        >
          <PersonalWidget showDay={showDay} setShowDay={setShowDay} profile={profile} setProfile={setProfile} />
        </Window>

        <Window
          id="calendar" title="Calendar" accent="var(--blue)" icon="▤"
          hint="next 2 days"
          defaultPos={LAYOUTS.calendar.pos} defaultSize={LAYOUTS.calendar.size}
          hidden={closed.calendar} onClose={() => close("calendar")}
        >
          <CalendarWidget showDay={showDay} />
        </Window>

        <Window
          id="gmail" title="Gmail" accent="var(--red)" icon="✉"
          defaultPos={LAYOUTS.gmail.pos} defaultSize={LAYOUTS.gmail.size}
          hidden={closed.gmail} onClose={() => close("gmail")}
        >
          <GmailWidget />
        </Window>

        <Window
          id="weather" title="Weather" accent="#7da3d9" icon="☀"
          hint="outdoor focus"
          defaultPos={LAYOUTS.weather.pos} defaultSize={LAYOUTS.weather.size}
          hidden={closed.weather} onClose={() => close("weather")}
        >
          <WeatherWidget />
        </Window>

        <Window
          id="news" title="News & Industry" accent="var(--amber)" icon="◈"
          hint="live feed"
          defaultPos={LAYOUTS.news.pos} defaultSize={LAYOUTS.news.size}
          hidden={closed.news} onClose={() => close("news")}
        >
          <NewsWidget />
        </Window>

        {showContext && (
          <Window
            id="tasksShow" title="Show Tasks" accent="var(--red)" icon="●"
            hint={showContext.label}
            defaultPos={LAYOUTS.tasksShow.pos} defaultSize={LAYOUTS.tasksShow.size}
            hidden={closed.tasksShow} onClose={() => close("tasksShow")}
          >
            <ShowTasksWidget phase={showContext.phase} showDate={showContext.showDate} />
          </Window>
        )}

        <Window
          id="tasksNonShow" title="Tasks · Daily (Office)" accent="var(--blue)" icon="●"
          hint="resets daily"
          defaultPos={LAYOUTS.tasksNonShow.pos} defaultSize={LAYOUTS.tasksNonShow.size}
          hidden={closed.tasksNonShow} onClose={() => close("tasksNonShow")}
        >
          <RepeatingTaskList accent="var(--blue)" />
        </Window>

        <Window
          id="tasksOneOff" title="Tasks · One-offs" accent="var(--amber)" icon="◇"
          defaultPos={LAYOUTS.tasksOneOff.pos} defaultSize={LAYOUTS.tasksOneOff.size}
          hidden={closed.tasksOneOff} onClose={() => close("tasksOneOff")}
        >
          <TaskList accent="var(--amber)" />
        </Window>

        <Window
          id="notes" title="Quick Notes" accent="var(--amber)" icon="✎"
          defaultPos={LAYOUTS.notes.pos} defaultSize={LAYOUTS.notes.size}
          hidden={closed.notes} onClose={() => close("notes")}
        >
          <QuickNotes />
        </Window>

        <Window
          id="journal" title="Daily Journal · Personal" accent="var(--blue)" icon="❖"
          defaultPos={LAYOUTS.journal.pos} defaultSize={LAYOUTS.journal.size}
          hidden={closed.journal} onClose={() => close("journal")}
        >
          <PersonalJournal />
        </Window>

        {showDay && (
          <Window
            id="showJournal" title="Daily Show Journal" accent="var(--red)" icon="★"
            hint="show day only"
            defaultPos={LAYOUTS.showJournal.pos} defaultSize={LAYOUTS.showJournal.size}
            hidden={closed.showJournal} onClose={() => close("showJournal")}
          >
            <ShowJournal />
          </Window>
        )}
      </WindowManager>

      <TweaksPanel>
        <TweakSection label="Mode" />
        <TweakRadio
          label="Day Mode"
          value={showDay ? "show" : "work"}
          options={["work", "show"]}
          onChange={(v) => setShowDay(v === "show")}
        />
        <TweakSection label="Look" />
        <TweakRadio
          label="Density"
          value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)}
        />
        <TweakRadio
          label="Accent"
          value={t.accent}
          options={["red", "balanced", "blue"]}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakSelect
          label="Wallpaper"
          value={t.wallpaper}
          options={["navy", "ink", "carbon", "logoTile"]}
          onChange={(v) => setTweak("wallpaper", v)}
        />
        <TweakToggle
          label="Show grid"
          value={t.showGrid}
          onChange={(v) => setTweak("showGrid", v)}
        />
        <TweakSection label="Show Schedule" />
        <div className="tweak-note">
          Show Tasks panel auto-appears the day before, day of, and day after each show date.
        </div>
        <ShowDatesManager dates={showDates} addDate={addShowDate} removeDate={removeShowDate} />
        <TweakSection label="Layout" />
        <TweakButton onClick={() => {
          if (!confirm("Reset all window positions and sizes?")) return;
          Object.keys(localStorage).filter(k => k.startsWith("earl-os:win:")).forEach(k => localStorage.removeItem(k));
          localStorage.removeItem("earl-os:closed");
          location.reload();
        }}>Reset window layout</TweakButton>
        <TweakButton onClick={() => {
          if (!confirm("Clear ALL Earl OS data (tasks, notes, journal)?")) return;
          Object.keys(localStorage).filter(k => k.startsWith("earl-os:")).forEach(k => localStorage.removeItem(k));
          location.reload();
        }}>Clear all data</TweakButton>
      </TweaksPanel>
    </div>
  );
}

function useNow() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Root() {
  const session = useAuth();
  if (session === undefined) return null;
  if (!session) return <LoginScreen />;
  return (
    <DataProvider session={session}>
      <App session={session} />
    </DataProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
