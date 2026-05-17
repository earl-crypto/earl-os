// All widget panels for Earl OS.

// ─── Google API helpers ───────────────────────────────────────────────────────

async function _fetchGmailMessages(token) {
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (listRes.status === 401) throw Object.assign(new Error('auth'), { code: 401 });
  if (!listRes.ok) throw new Error('Gmail error');
  const { messages = [] } = await listRes.json();

  const details = await Promise.all(messages.map(({ id }) =>
    fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json())
  ));

  const now = new Date();
  return details.map(m => {
    const hdr = n => (m.payload?.headers?.find(h => h.name === n) || {}).value || '';
    const fromRaw = hdr('From');
    const from = fromRaw.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '') || fromRaw.split('@')[0];
    const date = new Date(hdr('Date'));
    const diffH = (now - date) / 3600000;
    const time = diffH < 18
      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '')
      : diffH < 36 ? 'Yest'
      : date.toLocaleDateString('en-US', { weekday: 'short' });
    return {
      id: m.id,
      from,
      subj: hdr('Subject') || '(no subject)',
      preview: m.snippet || '',
      time,
      unread: (m.labelIds || []).includes('UNREAD'),
      star: (m.labelIds || []).includes('STARRED'),
      label: fromRaw.match(/@([\w-]+)\./)?.[1] || '',
    };
  });
}

async function _fetchCalendarEvents(token, dateStr) {
  const start = new Date(dateStr + 'T00:00:00');
  const end   = new Date(dateStr + 'T23:59:59');
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=20`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw Object.assign(new Error('auth'), { code: 401 });
  if (!r.ok) throw new Error('Calendar error');
  const { items = [] } = await r.json();
  return items.map(e => {
    const s  = e.start.dateTime ? new Date(e.start.dateTime) : null;
    const en = e.end.dateTime   ? new Date(e.end.dateTime)   : null;
    const fmt = d => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const t = (e.summary || '').toLowerCase();
    const tag =
      /load.?in|load.?out|dock/.test(t)          ? 'load'     :
      /show|doors|curfew|soundcheck/.test(t)      ? 'show'     :
      /crew|call sheet|debrief/.test(t)           ? 'crew'     :
      /vip|meet.*greet|talent|artist/.test(t)     ? 'talent'   :
      /personal|workout|gym|lunch|dinner/.test(t) ? 'personal' : 'ops';
    const desc = (e.description || '').toLowerCase();
    const venueType = /#outdoor\b/.test(desc) ? 'outdoor' : /#indoor\b/.test(desc) ? 'indoor' : null;
    return { t: s ? fmt(s) : 'All day', end: en ? fmt(en) : '', title: e.summary || '(no title)', tag, venueType };
  });
}

// ─── PERSONAL WINDOW ─────────────────────────────────────────────────────────
function PersonalWidget({ showDay, setShowDay, profile, setProfile }) {
  const quotes = [
    { q: "Plans are nothing; planning is everything.", a: "Eisenhower" },
    { q: "Amateurs sit and wait for inspiration. The rest of us just get up and go to work.", a: "Stephen King" },
    { q: "The show must go on.", a: "Touring law" },
    { q: "Slow is smooth, smooth is fast.", a: "Old crew saying" },
    { q: "Discipline equals freedom.", a: "Jocko Willink" },
    { q: "Every detail matters when the lights go up.", a: "—" },
  ];
  // Stable quote per calendar date
  const dayKey = new Date().toISOString().slice(0, 10);
  const quote = quotes[Math.abs(dayKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % quotes.length];

  const statuses = [
    { id: "available", label: "Available", color: "var(--green)" },
    { id: "focused", label: "Deep work", color: "var(--amber)" },
    { id: "onsite", label: "On site", color: "var(--red)" },
    { id: "offline", label: "Offline", color: "var(--text-faint)" },
  ];
  const status = statuses.find(s => s.id === profile.status) || statuses[0];

  return (
    <div className="personal">
      <div className="personal-top">
        <div className="avatar">
          <img src="assets/earl-avatar.jpeg" alt="Earl Neal" />
        </div>
        <div className="personal-id">
          <input
            className="bare-input personal-name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
          <input
            className="bare-input personal-title"
            value={profile.title}
            onChange={(e) => setProfile({ ...profile, title: e.target.value })}
          />
          <div className="status-row">
            <span className="status-dot" style={{ background: status.color }} />
            <select
              className="bare-select"
              value={profile.status}
              onChange={(e) => setProfile({ ...profile, status: e.target.value })}
            >
              {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="now-block">
        <div className="now-label">Now Running</div>
        <input
          className="bare-input now-artist"
          value={profile.event}
          onChange={(e) => setProfile({ ...profile, event: e.target.value })}
        />
        <input
          className="bare-input now-venue"
          value={profile.venue}
          onChange={(e) => setProfile({ ...profile, venue: e.target.value })}
        />
      </div>

      <div className="mode-toggle">
        <button
          className={"mode-btn" + (!showDay ? " mode-btn-on" : "")}
          onClick={() => setShowDay(false)}
        >
          <span className="mode-label">Work Day</span>
          <span className="mode-sub">Office mode</span>
        </button>
        <button
          className={"mode-btn mode-btn-show" + (showDay ? " mode-btn-on" : "")}
          onClick={() => setShowDay(true)}
        >
          <span className="mode-label">Show Day</span>
          <span className="mode-sub">Live mode</span>
        </button>
      </div>

      <div className="quote">
        <div className="quote-mark">“</div>
        <div className="quote-text">{quote.q}</div>
        <div className="quote-author">— {quote.a}</div>
      </div>
    </div>
  );
}

// ─── CALENDAR (2 DAYS) ───────────────────────────────────────────────────────
function CalendarWidget() {
  const { providerToken } = useData();
  const today    = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const todayStr = today.toISOString().slice(0, 10);
  const tomStr   = tomorrow.toISOString().slice(0, 10);
  const fmt = d => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const [cal, setCal] = React.useState({ today: null, tomorrow: null, err: null });

  React.useEffect(() => {
    if (!providerToken) return;
    Promise.all([
      _fetchCalendarEvents(providerToken, todayStr),
      _fetchCalendarEvents(providerToken, tomStr),
    ])
    .then(([te, tt]) => setCal({ today: te, tomorrow: tt, err: null }))
    .catch(e => setCal(prev => ({ ...prev, err: e.code === 401 ? 'session' : 'error' })));
  }, [providerToken]);

  const tagColor = t => ({
    show: "var(--red)", load: "var(--amber)", ops: "var(--blue)",
    crew: "#7da3d9", talent: "#a685c9", personal: "var(--text-faint)",
  }[t] || "var(--text-faint)");

  const notice = t => <div style={{ padding: "8px 0", color: "var(--text-faint)", fontSize: "11px", fontStyle: "italic" }}>{t}</div>;

  const Col = ({ date, events, isToday }) => (
    <div className="cal-col">
      <div className="cal-col-hd">
        <div className="cal-day">{fmt(date)}</div>
        {isToday && <div className="cal-today">TODAY</div>}
      </div>
      <div className="cal-events">
        {cal.err === 'session' && notice("Session expired — sign out and back in.")}
        {cal.err === 'error'   && notice("Could not load calendar.")}
        {!cal.err && events === null && notice("Loading…")}
        {!cal.err && events?.length === 0 && notice("No events scheduled.")}
        {!cal.err && (events || []).map((e, i) => (
          <div key={i} className="cal-ev" style={{ "--evc": tagColor(e.tag) }}>
            <div className="cal-ev-time">{e.t}{e.end && <span className="cal-ev-end">→ {e.end}</span>}</div>
            <div className="cal-ev-title">
              {e.title}
              {e.venueType && (
                <span style={{
                  marginLeft: 6, fontSize: "9px", letterSpacing: "0.1em",
                  padding: "1px 5px", borderRadius: 3, fontFamily: "var(--ff-display)",
                  fontWeight: 600, textTransform: "uppercase", verticalAlign: "middle",
                  background: e.venueType === "outdoor" ? "rgba(212,164,55,0.15)" : "rgba(66,103,163,0.15)",
                  color: e.venueType === "outdoor" ? "var(--amber)" : "var(--blue-bright)",
                }}>
                  {e.venueType === "outdoor" ? "Outdoor" : "Indoor"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="calendar">
      <Col date={today} events={cal.today} isToday={true} />
      <div className="cal-divider" />
      <Col date={tomorrow} events={cal.tomorrow} isToday={false} />
    </div>
  );
}

// ─── GMAIL ───────────────────────────────────────────────────────────────────
function GmailWidget() {
  const { providerToken } = useData();
  const [emails, setEmails]       = React.useState(null);
  const [localState, setLocal]    = React.useState({});
  const [loading, setLoading]     = React.useState(true);
  const [err, setErr]             = React.useState(null);

  const load = React.useCallback(() => {
    if (!providerToken) { setLoading(false); return; }
    setLoading(true); setErr(null);
    _fetchGmailMessages(providerToken)
      .then(msgs => { setEmails(msgs); setLoading(false); })
      .catch(e => { setErr(e.code === 401 ? 'session' : 'error'); setLoading(false); });
  }, [providerToken]);

  React.useEffect(load, [load]);

  const displayed = (emails || []).map(e => ({
    ...e,
    unread: localState[e.id]?.unread ?? e.unread,
    star:   localState[e.id]?.star   ?? e.star,
  }));
  const unread = displayed.filter(e => e.unread).length;

  const toggle = (id, key) => setLocal(prev => {
    const cur = displayed.find(e => e.id === id);
    return { ...prev, [id]: { ...prev[id], [key]: !(prev[id]?.[key] ?? cur?.[key]) } };
  });

  return (
    <div className="gmail">
      <div className="gmail-hd">
        <div className="gmail-tabs">
          <span className="gmail-tab gmail-tab-on">Inbox {unread > 0 && <span className="badge">{unread}</span>}</span>
          <span className="gmail-tab">Starred</span>
          <span className="gmail-tab">Sent</span>
        </div>
        <button className="gmail-search" onClick={load} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <span className="search-icon" style={{ opacity: loading ? 0.4 : 1 }}>↻</span>
          <span className="search-placeholder">{loading ? 'Loading…' : 'Refresh'}</span>
        </button>
      </div>
      <div className="gmail-list">
        {err === 'session' && <div style={{ padding: "12px", color: "var(--text-faint)", fontSize: "11px" }}>Session expired — sign out and back in to reload Gmail.</div>}
        {err === 'error'   && <div style={{ padding: "12px", color: "var(--text-faint)", fontSize: "11px" }}>Could not load Gmail. Check the API is enabled.</div>}
        {!err && loading && !emails && <div style={{ padding: "12px", color: "var(--text-faint)", fontSize: "11px" }}>Loading inbox…</div>}
        {!err && !loading && displayed.length === 0 && <div style={{ padding: "12px", color: "var(--text-faint)", fontSize: "11px" }}>Inbox empty.</div>}
        {displayed.map(e => (
          <div key={e.id} className={"mail" + (e.unread ? " mail-unread" : "")}>
            <button className={"mail-star" + (e.star ? " on" : "")} onClick={() => toggle(e.id, "star")}>★</button>
            <div className="mail-body" onClick={() => toggle(e.id, "unread")}>
              <div className="mail-line1">
                <span className="mail-from">{e.from}</span>
                <span className="mail-time">{e.time}</span>
              </div>
              <div className="mail-line2">
                {e.label && <span className="mail-label">{e.label}</span>}
                <span className="mail-subj">{e.subj}</span>
              </div>
              <div className="mail-preview">{e.preview}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TASK LIST (one-off tasks) ───────────────────────────────────────────────
function TaskList({ accent, emptyText, dimmed }) {
  const { oneoffTasks: tasks, toggleOneoff, addOneoff, removeOneoff } = useData();
  const [newText, setNewText] = React.useState("");
  const done = tasks.filter(t => t.done).length;
  return (
    <div className={"tasks" + (dimmed ? " tasks-dim" : "")}>
      <div className="tasks-meter">
        <div className="tasks-meter-bar" style={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : 0, background: accent }} />
        <span className="tasks-meter-text">{done} / {tasks.length}</span>
      </div>
      <div className="tasks-list">
        {tasks.length === 0 && <div className="tasks-empty">{emptyText || "Nothing here."}</div>}
        {tasks.map(t => (
          <div key={t.id} className={"task" + (t.done ? " task-done" : "")}>
            <button
              className="task-check"
              style={t.done ? { background: accent, borderColor: accent } : {}}
              onClick={() => toggleOneoff(t.id)}
            >{t.done ? "✓" : ""}</button>
            <span className="task-text">{t.text}</span>
            <button className="task-x" onClick={() => removeOneoff(t.id)}>×</button>
          </div>
        ))}
      </div>
      <div className="task-add">
        <input
          className="bare-input task-input"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newText.trim()) {
              addOneoff(newText.trim());
              setNewText("");
            }
          }}
          placeholder="+ add task"
        />
      </div>
    </div>
  );
}

// ─── QUICK NOTES ─────────────────────────────────────────────────────────────
function QuickNotes() {
  const { notes: text, setNotes: setText } = useData();
  return (
    <div className="notes">
      <textarea
        className="notes-area"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="brain dump · ideas · phone numbers · serial numbers · anything …"
      />
      <div className="notes-foot">
        <span className="notes-stamp">{text.length} chars</span>
        <span className="notes-stamp">Autosaved</span>
      </div>
    </div>
  );
}

// ─── PERSONAL JOURNAL ────────────────────────────────────────────────────────
function PersonalJournal() {
  const dayKey = new Date().toISOString().slice(0, 10);
  const { journalPersonal, updatePersonalJournal } = useData();
  const entry = journalPersonal[dayKey] || { mood: 3, energy: 3, grateful: "", reflection: "", win: "" };
  const update = (k, v) => updatePersonalJournal(dayKey, k, v);

  const Scale = ({ label, value, onChange, colors }) => (
    <div className="scale-row">
      <span className="scale-label">{label}</span>
      <div className="scale-dots">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            className={"scale-dot" + (n <= value ? " on" : "")}
            style={n <= value ? { background: colors[Math.min(n - 1, colors.length - 1)] } : {}}
            onClick={() => onChange(n)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="journal">
      <div className="journal-date">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
      <div className="journal-scales">
        <Scale label="Mood" value={entry.mood} onChange={(v) => update("mood", v)}
               colors={["#7a3838", "#a16632", "#c4a437", "#6ea34a", "#4caf6a"]} />
        <Scale label="Energy" value={entry.energy} onChange={(v) => update("energy", v)}
               colors={["#3a4d6e", "#4267a3", "#5a8ad4", "#7ab2e8", "#a8d4f4"]} />
      </div>
      <div className="journal-field">
        <label>One thing I'm grateful for</label>
        <input className="bare-input" value={entry.grateful} onChange={(e) => update("grateful", e.target.value)} placeholder="…" />
      </div>
      <div className="journal-field">
        <label>Win of the day</label>
        <input className="bare-input" value={entry.win} onChange={(e) => update("win", e.target.value)} placeholder="…" />
      </div>
      <div className="journal-field journal-field-grow">
        <label>Reflection</label>
        <textarea className="bare-textarea" value={entry.reflection} onChange={(e) => update("reflection", e.target.value)} placeholder="how was today …" />
      </div>
    </div>
  );
}

// ─── SHOW JOURNAL (show days only) ───────────────────────────────────────────
function ShowJournal() {
  const dayKey = new Date().toISOString().slice(0, 10);
  const { journalShow, updateShowJournal } = useData();
  const blank = {
    venue: "The Fillmore — San Francisco, CA",
    crewCall: "07:30", tLoadIn: "09:00", soundcheck: "15:00", doors: "20:00", showTime: "20:30", curfew: "23:00",
    attendanceCap: "1150", attendanceActual: "",
    arrival: "",
    parking: "",
    loadIn: "",
    meals: "",
    show: "",
    loadOut: "",
    depart: "",
    general: "",
  };
  const entry = { ...blank, ...(journalShow[dayKey] || {}) };
  const update = (k, v) => updateShowJournal(dayKey, k, v);

  const Time = ({ k, label }) => (
    <div className="show-time">
      <span className="show-time-label">{label}</span>
      <input className="bare-input show-time-input" value={entry[k]} onChange={(e) => update(k, e.target.value)} />
    </div>
  );

  const sections = [
    { k: "arrival",  label: "Arrival",   ph: "time · who's already there · access" },
    { k: "parking",  label: "Parking",   ph: "location · passes · truck/bus spots" },
    { k: "loadIn",   label: "Load In",   ph: "dock · time · stewards · issues" },
    { k: "meals",    label: "Meals",     ph: "vendor · times · headcount · dietary" },
    { k: "show",     label: "Show",      ph: "doors · set times · highlights · notes" },
    { k: "loadOut",  label: "Load Out",  ph: "time · crew · issues" },
    { k: "depart",   label: "Depart",    ph: "time · destination · next call" },
    { k: "general",  label: "General Notes", ph: "anything else worth remembering…" },
  ];

  return (
    <div className="show-journal">
      <div className="show-hd">
        <div className="show-hd-venue">
          <input className="bare-input show-venue" value={entry.venue} onChange={(e) => update("venue", e.target.value)} />
        </div>
        <div className="show-hd-date">SHOW #042 · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
      </div>

      <div className="show-times">
        <Time k="crewCall" label="Crew Call" />
        <Time k="tLoadIn" label="Load-in" />
        <Time k="soundcheck" label="Soundcheck" />
        <Time k="doors" label="Doors" />
        <Time k="showTime" label="Show" />
        <Time k="curfew" label="Curfew" />
      </div>

      <div className="show-attend">
        <div className="show-attend-cell">
          <label>Cap</label>
          <input className="bare-input" value={entry.attendanceCap} onChange={(e) => update("attendanceCap", e.target.value)} />
        </div>
        <div className="show-attend-cell">
          <label>Actual</label>
          <input className="bare-input" value={entry.attendanceActual} onChange={(e) => update("attendanceActual", e.target.value)} placeholder="—" />
        </div>
        <div className="show-attend-cell show-attend-fill">
          <label>Fill</label>
          <div className="show-fill-val">
            {entry.attendanceActual && entry.attendanceCap
              ? Math.round((+entry.attendanceActual / +entry.attendanceCap) * 100) + "%"
              : "—"}
          </div>
        </div>
      </div>

      <div className="show-fields">
        {sections.map(({ k, label, ph }) => (
          <div key={k} className="show-field">
            <label>{label}</label>
            <textarea
              className="bare-textarea"
              rows={k === "general" ? 3 : 2}
              value={entry[k]}
              onChange={(e) => update(k, e.target.value)}
              placeholder={ph}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── REPEATING TASK LIST (office daily tasks) ────────────────────────────────
function RepeatingTaskList({ accent, dimmed }) {
  const { getTasksForKind, toggleTask, addTask: ctxAddTask, removeTask: ctxRemoveTask } = useData();
  const dateKey = new Date().toISOString().slice(0, 10);
  const tasks = getTasksForKind("office", dateKey);
  const [newText, setNewText] = React.useState("");
  const done = tasks.filter(t => t.done).length;

  return (
    <div className={"tasks tasks-repeating" + (dimmed ? " tasks-dim" : "")}>
      <div className="tasks-meter">
        <div className="tasks-meter-bar" style={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : 0, background: accent }} />
        <span className="tasks-meter-text">{done} / {tasks.length}</span>
        <span className="tasks-cycle">↻ resets daily</span>
      </div>
      <div className="tasks-list">
        {tasks.length === 0 && <div className="tasks-empty">No template tasks. Add some below.</div>}
        {tasks.map(t => (
          <div key={t.id} className={"task" + (t.done ? " task-done" : "")}>
            <button
              className="task-check"
              style={t.done ? { background: accent, borderColor: accent } : {}}
              onClick={() => toggleTask("office", t.id, dateKey)}
            >{t.done ? "✓" : ""}</button>
            <span className="task-text">{t.text}</span>
            <button className="task-x" onClick={() => ctxRemoveTask("office", t.id)}>×</button>
          </div>
        ))}
      </div>
      <div className="task-add">
        <input
          className="bare-input task-input"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newText.trim()) {
              ctxAddTask("office", newText.trim());
              setNewText("");
            }
          }}
          placeholder="+ add to daily template"
        />
      </div>
    </div>
  );
}

// ─── SHOW TASKS (3-phase: day before / show day / day after) ─────────────────
// Each phase has a TEMPLATE that carries over to every show. Check-off state
// is keyed by the show date, so each show starts with a fresh checklist.
function ShowTasksWidget({ phase, showDate }) {
  const phases = [
    {
      id: "pre", label: "Day Before", accent: "var(--amber)",
      templateKey: "tasks:show:pre:template",
      seeds: [
        "Send call sheet to crew",
        "Confirm load-in time w/ venue",
        "Final headcount to catering",
        "Print stage plot + patch sheets",
        "Review weather + contingencies",
        "Confirm hotel block & roster",
        "Charge radios, batteries, comms",
      ],
    },
    {
      id: "show", label: "Show Day", accent: "var(--red)",
      templateKey: "tasks:show:day:template",
      seeds: [
        "Crew breakfast / coffee on deck",
        "Walk venue with house manager",
        "Patch sheet to FOH",
        "RF coordination check",
        "Catering headcount → runner",
        "Confirm meet & greet list",
        "Settlement sheet prepped",
        "Post-show crew debrief",
      ],
    },
    {
      id: "post", label: "Day After", accent: "var(--blue)",
      templateKey: "tasks:show:post:template",
      seeds: [
        "Settlement docs filed",
        "Per diem reconciled",
        "Crew shoutouts sent",
        "Show journal archived",
        "Advance check for next stop",
        "Expense receipts uploaded",
      ],
    },
  ];

  const [expanded, setExpanded] = React.useState({ pre: phase === "pre", show: phase === "show", post: phase === "post" });

  return (
    <div className="show-tasks">
      {phases.map(p => (
        <ShowTaskPhase
          key={p.id}
          phase={p}
          showDate={showDate}
          active={p.id === phase}
          isOpen={expanded[p.id]}
          onToggle={() => setExpanded({ ...expanded, [p.id]: !expanded[p.id] })}
        />
      ))}
    </div>
  );
}

function ShowTaskPhase({ phase, showDate, active, isOpen, onToggle }) {
  const { getTasksForKind, toggleTask, addTask: ctxAddTask, removeTask: ctxRemoveTask } = useData();
  const kindMap = { pre: "show:pre", show: "show:day", post: "show:post" };
  const kind = kindMap[phase.id];
  const scopeDate = showDate || new Date().toISOString().slice(0, 10);
  const tasks = getTasksForKind(kind, scopeDate);
  const [newText, setNewText] = React.useState("");
  const done = tasks.filter(t => t.done).length;

  return (
    <div className={"phase" + (active ? " phase-active" : "") + (isOpen ? " phase-open" : "")}>
      <button className="phase-hd" onClick={onToggle} style={{ "--phase-accent": phase.accent }}>
        <span className="phase-chev">{isOpen ? "▾" : "▸"}</span>
        <span className="phase-label">{phase.label}</span>
        {active && <span className="phase-pill">NOW</span>}
        <span className="phase-meter">
          <span className="phase-meter-bar" style={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : 0, background: phase.accent }} />
        </span>
        <span className="phase-count">{done}/{tasks.length}</span>
      </button>
      {isOpen && (
        <div className="phase-body">
          {tasks.map(t => (
            <div key={t.id} className={"task" + (t.done ? " task-done" : "")}>
              <button
                className="task-check"
                style={t.done ? { background: phase.accent, borderColor: phase.accent } : {}}
                onClick={() => toggleTask(kind, t.id, scopeDate)}
              >{t.done ? "✓" : ""}</button>
              <span className="task-text">{t.text}</span>
              <button className="task-x" onClick={() => ctxRemoveTask(kind, t.id)}>×</button>
            </div>
          ))}
          <div className="task-add">
            <input
              className="bare-input task-input"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newText.trim()) {
                  ctxAddTask(kind, newText.trim());
                  setNewText("");
                }
              }}
              placeholder="+ add to template"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SHOW DATES MANAGER (lives in Tweaks panel) ─────────────────────────────
function ShowDatesManager({ dates, addDate, removeDate }) {
  const [newDate, setNewDate] = React.useState("");
  const sorted = [...dates].sort();
  const todayStr = new Date().toISOString().slice(0, 10);
  const add = () => {
    if (!newDate || dates.includes(newDate)) return;
    addDate(newDate);
    setNewDate("");
  };
  const remove = (d) => removeDate(d);
  const fmt = (s) => {
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return (
    <div className="show-dates-mgr">
      <div className="sdm-list">
        {sorted.length === 0 && <div className="sdm-empty">No show dates yet</div>}
        {sorted.map(d => (
          <div key={d} className={"sdm-row" + (d === todayStr ? " sdm-row-today" : "")}>
            <span className="sdm-date">{fmt(d)}</span>
            {d === todayStr && <span className="sdm-tag">today</span>}
            <button className="sdm-x" onClick={() => remove(d)}>×</button>
          </div>
        ))}
      </div>
      <div className="sdm-add">
        <input
          type="date"
          className="sdm-date-input"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        <button className="sdm-add-btn" onClick={add}>＋ add</button>
      </div>
    </div>
  );
}

Object.assign(window, { ShowTasksWidget, ShowDatesManager,
  PersonalWidget, CalendarWidget, GmailWidget,
  TaskList, RepeatingTaskList, QuickNotes, PersonalJournal, ShowJournal,
  WeatherWidget, NewsWidget,
});

// ─── WEATHER (outdoor events focus) ──────────────────────────────────────────
function WxIcon({ kind, size = 22 }) {
  const ICONS = {
    sun: (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 2v3" /><path d="M12 19v3" />
          <path d="M2 12h3" /><path d="M19 12h3" />
          <path d="M4.9 4.9l2.1 2.1" /><path d="M17 17l2.1 2.1" />
          <path d="M4.9 19.1l2.1-2.1" /><path d="M17 7l2.1-2.1" />
        </g>
      </svg>
    ),
    pcloud: (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.7" />
        <path d="M9 18h9c2 0 3.5-1.5 3.5-3.5S20 11 18 11c-0.4 0-0.8 0.1-1.2 0.2C16 9 13.8 7.5 11.2 7.5c-3 0-5.4 2.4-5.4 5.4 0 0.4 0 0.7 0.1 1C4.5 14 3.5 15 3.5 16.2 3.5 17.2 4.3 18 5.3 18z" fill="currentColor" />
      </svg>
    ),
    cloud: (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path d="M7 18h11c2.5 0 4-2 4-4.5S20 9 17.5 9c-0.5 0-1 0.1-1.5 0.3C15 6.5 12.5 5 9.5 5 6 5 3 7.5 3 11c0 0.5 0.1 1 0.2 1.5C1.8 13.2 1 14.5 1 16c0 1.2 1 2 2.5 2z" fill="currentColor" />
      </svg>
    ),
    rain: (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path d="M7 14h10c2.2 0 3.5-1.5 3.5-3.5S19 7 17 7c-0.5 0-1 0.1-1.5 0.3C14.5 5 12 3.5 9.5 3.5 6.5 3.5 4 5.5 4 8.5c0 0.5 0.1 1 0.2 1.5C2.8 10.5 2 11.5 2 13c0 0.7 1 1 2 1z" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
          <path d="M7.5 17l-1.2 4" /><path d="M12 17l-1.2 4" /><path d="M16.5 17l-1.2 4" />
        </g>
      </svg>
    ),
    storm: (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path d="M7 12h10c2.2 0 3.5-1.5 3.5-3.5S19 5 17 5c-0.5 0-1 0.1-1.5 0.3C14.5 3 12 1.5 9.5 1.5 6.5 1.5 4 3.5 4 6.5c0 0.5 0.1 1 0.2 1.5C2.8 8.5 2 9.5 2 11c0 0.7 1 1 2 1z" fill="currentColor" />
        <path d="M13 14l-4 5h3l-1.5 4 5-6h-3l1-3z" fill="#d4a437" />
      </svg>
    ),
  };
  return <span className="wx-i" style={{ display: "inline-flex" }}>{ICONS[kind] || ICONS.cloud}</span>;
}

function WeatherWidget() {
  const current = {
    city: "San Francisco, CA",
    venue: "The Fillmore — INDOOR",
    temp: 58, condition: "Partly Cloudy", icon: "pcloud",
    high: 64, low: 52, wind: "12 NW", humidity: 72,
    feel: 56, gusts: "22 mph",
  };
  const hourly = [
    { t: "3p",  temp: 62, icon: "pcloud" },
    { t: "5p",  temp: 60, icon: "pcloud" },
    { t: "7p",  temp: 58, icon: "cloud" },
    { t: "9p",  temp: 55, icon: "cloud" },
    { t: "11p", temp: 53, icon: "cloud" },
  ];
  const upcoming = [
    { date: "MAY 22", venue: "BottleRock Napa",    city: "Napa, CA",      temp: 78, icon: "sun",    risk: "low",  note: "Heat warning 1–4p" },
    { date: "MAY 25", venue: "Edgefield Lawn",     city: "Troutdale, OR", temp: 64, icon: "rain",   risk: "high", note: "60% rain, doors-curfew" },
    { date: "JUN 02", venue: "Red Rocks",          city: "Morrison, CO",  temp: 81, icon: "sun",    risk: "low",  note: "Clear · low wind" },
    { date: "JUN 14", venue: "Bonnaroo MainStage", city: "Manchester, TN",temp: 88, icon: "storm",  risk: "high", note: "Afternoon T-storms" },
  ];

  return (
    <div className="weather">
      <div className="wx-hero">
        <div className="wx-hero-icon"><WxIcon kind={current.icon} size={48} /></div>
        <div className="wx-hero-temp">{current.temp}°</div>
        <div className="wx-hero-meta">
          <div className="wx-hero-city">{current.city}</div>
          <div className="wx-hero-cond">{current.condition}</div>
          <div className="wx-hero-venue">{current.venue}</div>
        </div>
      </div>

      <div className="wx-stats">
        <div className="wx-stat"><span className="wx-stat-label">HI/LO</span><span className="wx-stat-val">{current.high}°/{current.low}°</span></div>
        <div className="wx-stat"><span className="wx-stat-label">WIND</span><span className="wx-stat-val">{current.wind}</span></div>
        <div className="wx-stat"><span className="wx-stat-label">HUMID</span><span className="wx-stat-val">{current.humidity}%</span></div>
        <div className="wx-stat"><span className="wx-stat-label">GUSTS</span><span className="wx-stat-val">{current.gusts}</span></div>
      </div>

      <div className="wx-section-label">Show-time hourly</div>
      <div className="wx-hourly">
        {hourly.map((h, i) => (
          <div key={i} className="wx-hour">
            <div className="wx-hour-t">{h.t}</div>
            <div className="wx-hour-icon"><WxIcon kind={h.icon} size={18} /></div>
            <div className="wx-hour-temp">{h.temp}°</div>
          </div>
        ))}
      </div>

      <div className="wx-section-label">Upcoming Outdoor</div>
      <div className="wx-upcoming">
        {upcoming.map((u, i) => (
          <div key={i} className={"wx-up wx-risk-" + u.risk}>
            <div className="wx-up-date">{u.date}</div>
            <div className="wx-up-icon"><WxIcon kind={u.icon} size={18} /></div>
            <div className="wx-up-temp">{u.temp}°</div>
            <div className="wx-up-place">
              <div className="wx-up-venue">{u.venue}</div>
              <div className="wx-up-city">{u.city}</div>
            </div>
            <div className="wx-up-note">{u.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NEWS & INDUSTRY FEED ────────────────────────────────────────────────────
function NewsWidget() {
  const [filter, setFilter] = React.useState("all");
  const stories = [
    { src: "POLLSTAR",      cat: "touring",  time: "2h", title: "Q1 2026 mid-year report: arena tour grosses up 14% YoY", hot: true },
    { src: "BILLBOARD",     cat: "industry", time: "4h", title: "Live Nation finalizes acquisition of secondary-market venue chain" },
    { src: "IQ MAGAZINE",   cat: "venues",   time: "5h", title: "New 8,000-cap amphitheater breaks ground in Charlotte" },
    { src: "FOH MAGAZINE",  cat: "tech",     time: "8h", title: "Clair Global announces refreshed V-Tour line array, ships Q3" },
    { src: "MIX",           cat: "tech",     time: "1d", title: "Carbon-neutral touring: AEG commits to 60% reduction by 2028" },
    { src: "POLLSTAR",      cat: "touring",  time: "1d", title: "Q2 routing trends — secondary markets continue to outperform" },
    { src: "VARIETY",       cat: "industry", time: "2d", title: "IATSE Local 1 ratifies new national touring agreement" },
    { src: "TPI MAG",       cat: "tech",     time: "2d", title: "FAA finalizes drone show permits ahead of summer festival season" },
    { src: "BILLBOARD",     cat: "industry", time: "3d", title: "Dynamic pricing backlash forces three artists to switch platforms" },
    { src: "IQ MAGAZINE",   cat: "venues",   time: "3d", title: "Madison Square Garden trials new staffing model for production" },
  ];
  const cats = [
    { id: "all",      label: "All",      color: "var(--text-dim)" },
    { id: "touring",  label: "Touring",  color: "var(--red)" },
    { id: "industry", label: "Industry", color: "var(--blue)" },
    { id: "tech",     label: "Tech",     color: "var(--amber)" },
    { id: "venues",   label: "Venues",   color: "#7da3d9" },
  ];
  const filtered = filter === "all" ? stories : stories.filter(s => s.cat === filter);
  const catColor = (c) => (cats.find(x => x.id === c) || {}).color || "var(--text-dim)";

  return (
    <div className="news">
      <div className="news-tabs">
        {cats.map(c => (
          <button
            key={c.id}
            className={"news-tab" + (filter === c.id ? " news-tab-on" : "")}
            style={filter === c.id ? { background: c.color, color: "white", borderColor: c.color } : { color: c.color, borderColor: "transparent" }}
            onClick={() => setFilter(c.id)}
          >{c.label}</button>
        ))}
      </div>
      <div className="news-list">
        {filtered.map((s, i) => (
          <div key={i} className={"news-item" + (s.hot ? " news-hot" : "")}>
            <div className="news-meta">
              <span className="news-src" style={{ color: catColor(s.cat) }}>{s.src}</span>
              <span className="news-dot" style={{ background: catColor(s.cat) }} />
              <span className="news-time">{s.time}</span>
              {s.hot && <span className="news-hot-tag">HOT</span>}
            </div>
            <div className="news-title">{s.title}</div>
          </div>
        ))}
      </div>
      <div className="news-foot">
        <span>Last refresh: just now</span>
        <span className="news-refresh">↻ refresh</span>
      </div>
    </div>
  );
}



