// All widget panels for Earl OS.

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
function CalendarWidget({ showDay }) {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const fmt = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const todayEvents = showDay ? [
    { t: "07:30", end: "08:15", title: "Crew breakfast / call sheet review", tag: "crew" },
    { t: "09:00", end: "13:00", title: "Load-in — The Fillmore", tag: "load" },
    { t: "13:30", end: "14:30", title: "Catering / hospitality walk", tag: "ops" },
    { t: "15:00", end: "17:00", title: "Soundcheck", tag: "show" },
    { t: "18:00", end: "19:00", title: "Meet & greet — VIP", tag: "talent" },
    { t: "20:00", end: "22:30", title: "DOORS → SHOW → CURFEW", tag: "show", live: true },
    { t: "22:45", end: "23:30", title: "Settlement w/ promoter", tag: "ops" },
  ] : [
    { t: "08:30", end: "09:00", title: "Morning planning + email triage", tag: "ops" },
    { t: "09:30", end: "10:00", title: "Production call — Atlanta advance", tag: "ops" },
    { t: "10:30", end: "11:30", title: "Vendor review — Clair / 4Wall quotes", tag: "ops" },
    { t: "12:00", end: "13:00", title: "Lunch / blocked", tag: "personal" },
    { t: "14:00", end: "14:45", title: "Routing sync — June leg", tag: "crew" },
    { t: "15:30", end: "16:30", title: "Tour bus & freight bookings", tag: "ops" },
    { t: "17:00", end: "17:30", title: "EOD wrap + tomorrow prep", tag: "personal" },
  ];

  const tomorrowEvents = [
    { t: "07:00", end: "10:00", title: "Bus call → drive to Oakland", tag: "crew" },
    { t: "11:00", end: "14:00", title: "Load-in — Fox Theater", tag: "load" },
    { t: "15:30", end: "17:00", title: "Soundcheck", tag: "show" },
    { t: "20:00", end: "23:00", title: "Show → curfew", tag: "show", live: true },
  ];

  const tagColor = (t) => ({
    show: "var(--red)", load: "var(--amber)", ops: "var(--blue)",
    crew: "#7da3d9", talent: "#a685c9", personal: "var(--text-faint)",
  }[t] || "var(--text-faint)");

  const Col = ({ date, events, isToday }) => (
    <div className="cal-col">
      <div className="cal-col-hd">
        <div className="cal-day">{fmt(date)}</div>
        {isToday && <div className="cal-today">TODAY</div>}
      </div>
      <div className="cal-events">
        {events.map((e, i) => (
          <div key={i} className={"cal-ev" + (e.live ? " cal-ev-live" : "")} style={{ "--evc": tagColor(e.tag) }}>
            <div className="cal-ev-time">{e.t}<span className="cal-ev-end">→ {e.end}</span></div>
            <div className="cal-ev-title">{e.title}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="calendar">
      <Col date={today} events={todayEvents} isToday={true} />
      <div className="cal-divider" />
      <Col date={tomorrow} events={tomorrowEvents} isToday={false} />
    </div>
  );
}

// ─── GMAIL ───────────────────────────────────────────────────────────────────
function GmailWidget() {
  const [emails, setEmails] = usePersisted("gmail", [
    { id: 1, from: "Tasha — The Fillmore", subj: "RE: Tonight's load-in revisions", preview: "Confirmed — dock B is open from 8:30. Production office on 2nd floor…", time: "7:42a", unread: true, star: true, label: "Venue" },
    { id: 2, from: "Marcus (Tour Mgr)", subj: "June routing v3 attached", preview: "Couple of moves — Nashville → Atlanta swap, see PDF for the new flow…", time: "7:15a", unread: true, star: false, label: "Tour" },
    { id: 3, from: "Clair Global", subj: "Quote — June tour PA package", preview: "Hi Earl, attached is the revised quote with the additional subs you asked for…", time: "Yest", unread: true, star: false, label: "Vendor" },
    { id: 4, from: "Janelle / Mgmt", subj: "Press lines for tonight", preview: "Two outlets confirmed for post-show. Talking points attached…", time: "Yest", unread: false, star: true, label: "Talent" },
    { id: 5, from: "Sam — Catering", subj: "Crew dietary — updated", preview: "Two new vegans, one nut allergy. Will adjust hot meals for Wed onward…", time: "Yest", unread: false, star: false, label: "Hospitality" },
    { id: 6, from: "Promoter — Live Nation", subj: "Settlement docs — Phoenix", preview: "Final numbers attached. Please review and countersign by EOD…", time: "Tue", unread: false, star: false, label: "Ops" },
    { id: 7, from: "Lighting Designer", subj: "Show file v.12", preview: "Cleaned up cue 47 and rebuilt the encore. Patched the new movers…", time: "Mon", unread: false, star: false, label: "Show" },
    { id: 8, from: "Hotel — Kimpton SF", subj: "Group block confirmation", preview: "Block ENT-0426 confirmed, 14 rooms, double check-in window…", time: "Mon", unread: false, star: false, label: "Travel" },
  ]);
  const unread = emails.filter(e => e.unread).length;
  const toggle = (id, key) => setEmails(emails.map(e => e.id === id ? { ...e, [key]: !e[key] } : e));

  return (
    <div className="gmail">
      <div className="gmail-hd">
        <div className="gmail-tabs">
          <span className="gmail-tab gmail-tab-on">Inbox <span className="badge">{unread}</span></span>
          <span className="gmail-tab">Starred</span>
          <span className="gmail-tab">Sent</span>
        </div>
        <div className="gmail-search">
          <span className="search-icon">⌕</span>
          <span className="search-placeholder">Search mail</span>
        </div>
      </div>
      <div className="gmail-list">
        {emails.map(e => (
          <div key={e.id} className={"mail" + (e.unread ? " mail-unread" : "")}>
            <button className={"mail-star" + (e.star ? " on" : "")} onClick={() => toggle(e.id, "star")}>★</button>
            <div className="mail-body" onClick={() => toggle(e.id, "unread")}>
              <div className="mail-line1">
                <span className="mail-from">{e.from}</span>
                <span className="mail-time">{e.time}</span>
              </div>
              <div className="mail-line2">
                <span className="mail-label">{e.label}</span>
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

// ─── TASK LIST (generic, reused 3x) ──────────────────────────────────────────
function TaskList({ storageKey, defaults, accent, emptyText, dimmed }) {
  const [tasks, setTasks] = usePersisted(storageKey, defaults);
  const [newText, setNewText] = React.useState("");
  const toggle = (i) => setTasks(tasks.map((t, j) => j === i ? { ...t, done: !t.done } : t));
  const remove = (i) => setTasks(tasks.filter((_, j) => j !== i));
  const add = () => {
    if (!newText.trim()) return;
    setTasks([...tasks, { text: newText.trim(), done: false }]);
    setNewText("");
  };
  const done = tasks.filter(t => t.done).length;
  return (
    <div className={"tasks" + (dimmed ? " tasks-dim" : "")}>
      <div className="tasks-meter">
        <div className="tasks-meter-bar" style={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : 0, background: accent }} />
        <span className="tasks-meter-text">{done} / {tasks.length}</span>
      </div>
      <div className="tasks-list">
        {tasks.length === 0 && <div className="tasks-empty">{emptyText || "Nothing here."}</div>}
        {tasks.map((t, i) => (
          <div key={i} className={"task" + (t.done ? " task-done" : "")}>
            <button
              className="task-check"
              style={t.done ? { background: accent, borderColor: accent } : {}}
              onClick={() => toggle(i)}
            >{t.done ? "✓" : ""}</button>
            <span className="task-text">{t.text}</span>
            <button className="task-x" onClick={() => remove(i)}>×</button>
          </div>
        ))}
      </div>
      <div className="task-add">
        <input
          className="bare-input task-input"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="+ add task"
        />
      </div>
    </div>
  );
}

// ─── QUICK NOTES ─────────────────────────────────────────────────────────────
function QuickNotes() {
  const [text, setText] = usePersisted("notes", "");
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
  const [entries, setEntries] = usePersisted("journal:personal", {});
  const entry = entries[dayKey] || { mood: 3, energy: 3, grateful: "", reflection: "", win: "" };
  const update = (k, v) => setEntries({ ...entries, [dayKey]: { ...entry, [k]: v } });

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
  const [entries, setEntries] = usePersisted("journal:show", {});
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
  const entry = { ...blank, ...(entries[dayKey] || {}) };
  const update = (k, v) => setEntries({ ...entries, [dayKey]: { ...entry, [k]: v } });

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

// ─── REPEATING TASK LIST (template + per-day state) ─────────────────────────
// Use for daily repeating lists (Office). The template carries over;
// the checked state resets at the start of each day.
function RepeatingTaskList({ templateKey, stateKeyBase, dateKey, accent, seedTexts, label, dimmed }) {
  const { tasks, toggle, removeTask, addTask } = useTemplatedTasks(
    templateKey,
    stateKeyBase + ":" + dateKey,
    seedTexts,
  );
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
              onClick={() => toggle(t.id)}
            >{t.done ? "✓" : ""}</button>
            <span className="task-text">{t.text}</span>
            <button className="task-x" onClick={() => removeTask(t.id)}>×</button>
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
              addTask(newText.trim());
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

  const [expanded, setExpanded] = usePersisted("tasks:show:exp", { pre: phase === "pre", show: phase === "show", post: phase === "post" });

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
  const stateKey = `tasks:show:${phase.id}:state:${showDate || "unscheduled"}`;
  const { tasks, toggle, removeTask, addTask } = useTemplatedTasks(
    phase.templateKey, stateKey, phase.seeds,
  );
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
                onClick={() => toggle(t.id)}
              >{t.done ? "✓" : ""}</button>
              <span className="task-text">{t.text}</span>
              <button className="task-x" onClick={() => removeTask(t.id)}>×</button>
            </div>
          ))}
          <div className="task-add">
            <input
              className="bare-input task-input"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newText.trim()) {
                  addTask(newText.trim());
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
function ShowDatesManager({ dates, setDates }) {
  const [newDate, setNewDate] = React.useState("");
  const sorted = [...dates].sort();
  const todayStr = new Date().toISOString().slice(0, 10);
  const add = () => {
    if (!newDate || dates.includes(newDate)) return;
    setDates([...dates, newDate]);
    setNewDate("");
  };
  const remove = (d) => setDates(dates.filter(x => x !== d));
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



