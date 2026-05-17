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

// ─── Weather helpers ──────────────────────────────────────────────────────────

// ─── News helpers ─────────────────────────────────────────────────────────────

function _relTime(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

function _xmlTag(text, tag) {
  const m = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(text);
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function _xmlEntities(s) {
  return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));
}

function _parseRSSItems(xml, feed) {
  const items = [];
  const pat = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = pat.exec(xml)) !== null && items.length < 8) {
    const c = m[1];
    const title = _xmlTag(c, 'title');
    if (!title) continue;
    const link    = _xmlTag(c, 'link').split('<')[0].trim() || _xmlTag(c, 'guid');
    const dateStr = _xmlTag(c, 'pubDate');
    const date    = dateStr ? new Date(dateStr) : new Date(0);
    items.push({
      src: feed.name, cat: feed.cat,
      title: _xmlEntities(title),
      link,
      time: _relTime(dateStr),
      hot:  date.getTime() > Date.now() - 2 * 3600000,
      _date: date.toISOString(),
    });
  }
  return items;
}

const _NEWS_CACHE_KEY = 'earl-os:news-cache';

const _NEWS_FEEDS = [
  { name: 'TOURING',  cat: 'touring',  q: 'concert+tour+live+music+production' },
  { name: 'INDUSTRY', cat: 'industry', q: 'music+industry+business+streaming'  },
  { name: 'VENUES',   cat: 'venues',   q: 'concert+venue+arena+amphitheater'   },
  { name: 'TECH',     cat: 'tech',     q: 'live+sound+audio+production+lighting+rigging' },
];

async function _fetchNewsFeeds() {
  try {
    const cached = sessionStorage.getItem(_NEWS_CACHE_KEY);
    if (cached) {
      const { ts, items } = JSON.parse(cached);
      if (Date.now() - ts < 30 * 60000) return items;
    }
  } catch(e) {}

  const results = await Promise.allSettled(
    _NEWS_FEEDS.map(async feed => {
      const rssUrl = `https://news.google.com/rss/search?q=${feed.q}&hl=en-US&gl=US&ceid=US:en`;
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`);
      if (!r.ok) throw new Error(`${feed.name}: HTTP ${r.status}`);
      const { contents } = await r.json();
      if (!contents) throw new Error(`${feed.name}: empty`);
      return _parseRSSItems(contents, feed);
    })
  );

  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
  const items  = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b._date) - new Date(a._date));

  if (!items.length) throw new Error(errors[0] || 'No news loaded');

  try { sessionStorage.setItem(_NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), items })); } catch(e) {}
  return items;
}

async function _fetchWeather(apiKey, lat, lon) {
  const loc = `${lat},${lon}`;
  const base = `https://api.tomorrow.io/v4/weather`;
  const [rt, fc] = await Promise.all([
    fetch(`${base}/realtime?location=${loc}&units=imperial&apikey=${apiKey}`),
    fetch(`${base}/forecast?location=${loc}&timesteps=1h,1d&units=imperial&apikey=${apiKey}`),
  ]);
  if (rt.status === 401 || fc.status === 401) throw Object.assign(new Error('auth'), { code: 401 });
  if (!rt.ok || !fc.ok) throw new Error('Weather error');
  return Promise.all([rt.json(), fc.json()]);
}

function _wxCode(code) {
  if ([1000, 1100].includes(code)) return 'sun';
  if (code === 1101) return 'pcloud';
  if ([1102, 1001, 2000, 2100].includes(code)) return 'cloud';
  if ([4000, 4001, 4200, 4201, 5000, 5001, 5100, 5101, 6000, 6001, 7000, 7101, 7102].includes(code)) return 'rain';
  if (code === 8000) return 'storm';
  return 'cloud';
}

function _wxLabel(code) {
  return ({
    1000:'Clear', 1100:'Mostly Clear', 1101:'Partly Cloudy', 1102:'Mostly Cloudy',
    1001:'Cloudy', 2000:'Fog', 2100:'Light Fog', 4000:'Drizzle', 4001:'Rain',
    4200:'Light Rain', 4201:'Heavy Rain', 5000:'Snow', 5001:'Flurries',
    5100:'Light Snow', 5101:'Heavy Snow', 6000:'Freezing Drizzle', 6001:'Freezing Rain',
    7000:'Ice Pellets', 8000:'Thunderstorm',
  })[code] || 'Variable';
}

function _windDir(deg) {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round((deg % 360) / 45) % 8];
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

// ─── GOOGLE DRIVE EXPORT ─────────────────────────────────────────────────────
async function _saveToDrive(token, filename, html, folderId) {
  const doUpload = async (parentId) => {
    const meta = { name: filename, mimeType: 'text/html', ...(parentId ? { parents: [parentId] } : {}) };
    const boundary = 'earl_os_b';
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
    return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  };

  let r = await doUpload(folderId);
  if (r.status === 404 && folderId) r = await doUpload(''); // bad folder — retry to Drive root
  if (r.status === 401) throw Object.assign(new Error('No Drive access — sign out and back in.'), { code: 401 });
  if (!r.ok) throw new Error(`Drive upload failed (${r.status})`);
  const { id } = await r.json();
  return `https://drive.google.com/file/d/${id}/view`;
}

function _driveHtmlShell(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;max-width:680px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#777;margin:20px 0 4px}.meta{display:flex;gap:32px;margin:16px 0}.meta-item{text-align:center}.meta-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.1em}.meta-value{font-size:22px;font-weight:bold}p,td{white-space:pre-wrap}table{width:100%;border-collapse:collapse}td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}td:first-child{width:120px;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.foot{margin-top:36px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px}</style>
</head><body>${body}</body></html>`;
}

function SaveToDriveBtn({ buildHtml, filename }) {
  const { providerToken, tweaks } = useData();
  const [state, setState] = React.useState('idle'); // idle | saving | done | err
  const [url, setUrl]     = React.useState(null);
  const [msg, setMsg]     = React.useState('');

  const save = async () => {
    if (!providerToken) { setState('err'); setMsg('No Google session.'); return; }
    setState('saving');
    try {
      const link = await _saveToDrive(providerToken, filename, buildHtml(), tweaks.driveFolderId || '');
      setUrl(link); setState('done');
    } catch(e) {
      setState('err'); setMsg(e.message);
    }
  };

  if (state === 'done') return <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "var(--blue-bright)", textDecoration: "none" }}>✓ Saved — View in Drive ↗</a>;
  if (state === 'err') return <span style={{ fontSize: "11px", color: "var(--amber)" }}>{msg}</span>;
  return (
    <button onClick={save} disabled={state === 'saving'} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: "11px", color: "var(--text-dim)", cursor: "pointer" }}>
      {state === 'saving' ? 'Saving…' : '↑ Save to Drive'}
    </button>
  );
}

// ─── PERSONAL JOURNAL ────────────────────────────────────────────────────────
function PersonalJournal() {
  const dayKey = new Date().toISOString().slice(0, 10);
  const { journalPersonal, updatePersonalJournal } = useData();
  const entry = journalPersonal[dayKey] || { mood: 3, energy: 3, grateful: "", reflection: "", win: "" };
  const update = (k, v) => updatePersonalJournal(dayKey, k, v);

  const buildHtml = () => {
    const dateStr = new Date(dayKey).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return _driveHtmlShell(`Personal Journal · ${dateStr}`, `
      <h1>Personal Journal</h1><p style="color:#888">${dateStr}</p>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">Mood</div><div class="meta-value">${entry.mood || '—'}/5</div></div>
        <div class="meta-item"><div class="meta-label">Energy</div><div class="meta-value">${entry.energy || '—'}/5</div></div>
      </div>
      <h2>Grateful For</h2><p>${entry.grateful || '—'}</p>
      <h2>Today's Win</h2><p>${entry.win || '—'}</p>
      <h2>Reflection</h2><p>${entry.reflection || '—'}</p>
      <div class="foot">Earl OS · Personal Journal · ${dateStr}</div>`);
  };

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
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 0 0" }}>
        <SaveToDriveBtn buildHtml={buildHtml} filename={`Journal-Personal-${dayKey}.html`} />
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
    crew_call: "07:30", t_load_in: "09:00", soundcheck: "15:00", doors: "20:00",
    show_time: "20:30", emcee_time: "", curfew: "23:00",
    attendance_cap: "1150", attendance_actual: "",
    arrival: "", parking: "", load_in: "", meals: "", show: "", load_out: "", depart: "", general: "",
  };
  const entry = { ...blank, ...(journalShow[dayKey] || {}) };
  const update = (k, v) => updateShowJournal(dayKey, k, v);

  const buildHtml = () => {
    const dateStr = new Date(dayKey).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const row = (label, val) => val ? `<tr><td>${label}</td><td>${val}</td></tr>` : '';
    return _driveHtmlShell(`Show Journal · ${entry.venue} · ${dateStr}`, `
      <h1>Show Journal</h1>
      <p style="color:#888">${dateStr}</p>
      <p><strong>${entry.venue}</strong></p>
      <h2>Schedule</h2>
      <table>
        ${row('Crew Call', entry.crew_call)}${row('Load-in', entry.t_load_in)}${row('Soundcheck', entry.soundcheck)}
        ${row('Doors', entry.doors)}${row('Show', entry.show_time)}${row('Emcee', entry.emcee_time)}${row('Curfew', entry.curfew)}
        ${row('Capacity', entry.attendance_cap)}${row('Actual', entry.attendance_actual)}
        ${entry.attendance_actual && entry.attendance_cap ? row('Fill', Math.round((+entry.attendance_actual / +entry.attendance_cap) * 100) + '%') : ''}
      </table>
      <h2>Notes</h2>
      <table>
        ${row('Arrival', entry.arrival)}${row('Parking', entry.parking)}${row('Load-in', entry.load_in)}
        ${row('Meals', entry.meals)}${row('Show', entry.show)}${row('Load-out', entry.load_out)}
        ${row('Depart', entry.depart)}${row('General', entry.general)}
      </table>
      <div class="foot">Earl OS · Show Journal · ${dateStr}</div>`);
  };

  const Time = ({ k, label }) => (
    <div className="show-time">
      <span className="show-time-label">{label}</span>
      <input className="bare-input show-time-input" value={entry[k]} onChange={(e) => update(k, e.target.value)} />
    </div>
  );

  const sections = [
    { k: "arrival",  label: "Arrival",   ph: "time · who's already there · access" },
    { k: "parking",  label: "Parking",   ph: "location · passes · truck/bus spots" },
    { k: "load_in",  label: "Load In",   ph: "dock · time · stewards · issues" },
    { k: "meals",    label: "Meals",     ph: "vendor · times · headcount · dietary" },
    { k: "show",     label: "Show",      ph: "doors · set times · highlights · notes" },
    { k: "load_out", label: "Load Out",  ph: "time · crew · issues" },
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
        <Time k="crew_call" label="Crew Call" />
        <Time k="t_load_in" label="Load-in" />
        <Time k="soundcheck" label="Soundcheck" />
        <Time k="doors" label="Doors" />
        <Time k="show_time" label="Show" />
        <Time k="emcee_time" label="Emcee" />
        <Time k="curfew" label="Curfew" />
      </div>

      <div className="show-attend">
        <div className="show-attend-cell">
          <label>Cap</label>
          <input className="bare-input" value={entry.attendance_cap} onChange={(e) => update("attendance_cap", e.target.value)} />
        </div>
        <div className="show-attend-cell">
          <label>Actual</label>
          <input className="bare-input" value={entry.attendance_actual} onChange={(e) => update("attendance_actual", e.target.value)} placeholder="—" />
        </div>
        <div className="show-attend-cell show-attend-fill">
          <label>Fill</label>
          <div className="show-fill-val">
            {entry.attendance_actual && entry.attendance_cap
              ? Math.round((+entry.attendance_actual / +entry.attendance_cap) * 100) + "%"
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
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 8px 8px" }}>
        <SaveToDriveBtn buildHtml={buildHtml} filename={`Journal-Show-${dayKey}-${entry.venue.replace(/[^a-z0-9]/gi, '-').slice(0,30)}.html`} />
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

// ─── WEATHER ─────────────────────────────────────────────────────────────────
function _WeatherMsg({ msg, onRetry }) {
  return (
    <div className="weather" style={{ padding: 20, color: "var(--text-faint)", fontSize: 12, lineHeight: 1.7 }}>
      {msg}
      {onRetry && (
        <button onClick={onRetry} style={{ display: "block", marginTop: 10, background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
          Retry
        </button>
      )}
    </div>
  );
}

function WeatherWidget() {
  const { tweaks, showDates } = useData();
  const apiKey = (tweaks.weatherKey || '').trim();
  const [wx, setWx]       = React.useState(null);
  const [err, setErr]     = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    if (!apiKey) return;
    setLoading(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        _fetchWeather(apiKey, coords.latitude, coords.longitude)
          .then(([rt, fc]) => { setWx({ rt, fc }); setLoading(false); })
          .catch(e => { setErr(e.code === 401 ? 'key' : 'error'); setLoading(false); });
      },
      () => { setErr('geo'); setLoading(false); }
    );
  }, [apiKey]);

  React.useEffect(load, [load]);

  if (!apiKey) return (
    <_WeatherMsg msg="Open Tweaks (bottom-right ⚙) → Weather → paste your Tomorrow.io API key to enable live weather." />
  );
  if (loading && !wx) return <_WeatherMsg msg="Loading weather…" />;
  if (err === 'geo')   return <_WeatherMsg msg="Location access denied — allow location in your browser." onRetry={load} />;
  if (err === 'key')   return <_WeatherMsg msg="Invalid API key — check your Tomorrow.io key in Tweaks." onRetry={load} />;
  if (err)             return <_WeatherMsg msg="Could not load weather." onRetry={load} />;
  if (!wx) return null;

  const rt  = wx.rt.data.values;
  const loc = wx.rt.location;
  const cityName = (loc.name || '').split(',')[0];

  const daily   = wx.fc.timelines?.daily  || [];
  const hourly  = wx.fc.timelines?.hourly || [];
  const todayD  = daily[0]?.values || {};
  const hi = Math.round(todayD.temperatureMax ?? rt.temperature);
  const lo = Math.round(todayD.temperatureMin ?? rt.temperature);

  const now = new Date();
  const nextHours = hourly.filter(h => new Date(h.time) > now).slice(0, 5).map(h => ({
    t:    new Date(h.time).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).toLowerCase().replace(' ', ''),
    temp: Math.round(h.values.temperature),
    icon: _wxCode(h.values.weatherCode),
  }));

  const dailyMap = {};
  daily.forEach(d => { dailyMap[d.time.slice(0, 10)] = d.values; });
  const showForecast = showDates.map(sd => {
    const d = dailyMap[sd];
    if (!d) return null;
    const rain = Math.round(d.precipitationProbabilityMax || 0);
    return {
      date: sd,
      temp: Math.round(d.temperatureMax),
      icon: _wxCode(d.weatherCode),
      risk: rain > 30 || d.weatherCode === 8000 ? 'high' : 'low',
      note: rain > 10 ? `${rain}% rain chance` : 'Clear · low risk',
    };
  }).filter(Boolean);

  const fmtSD = s => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  return (
    <div className="weather">
      <div className="wx-hero">
        <div className="wx-hero-icon"><WxIcon kind={_wxCode(rt.weatherCode)} size={48} /></div>
        <div className="wx-hero-temp">{Math.round(rt.temperature)}°</div>
        <div className="wx-hero-meta">
          <div className="wx-hero-city">{cityName}</div>
          <div className="wx-hero-cond">{_wxLabel(rt.weatherCode)}</div>
          <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "10px", padding: 0 }}>↻ refresh</button>
        </div>
      </div>

      <div className="wx-stats">
        <div className="wx-stat"><span className="wx-stat-label">HI/LO</span><span className="wx-stat-val">{hi}°/{lo}°</span></div>
        <div className="wx-stat"><span className="wx-stat-label">WIND</span><span className="wx-stat-val">{Math.round(rt.windSpeed)} {_windDir(rt.windDirection)}</span></div>
        <div className="wx-stat"><span className="wx-stat-label">HUMID</span><span className="wx-stat-val">{Math.round(rt.humidity)}%</span></div>
        <div className="wx-stat"><span className="wx-stat-label">GUSTS</span><span className="wx-stat-val">{Math.round(rt.windGust)} mph</span></div>
      </div>

      {nextHours.length > 0 && (
        <>
          <div className="wx-section-label">Next few hours</div>
          <div className="wx-hourly">
            {nextHours.map((h, i) => (
              <div key={i} className="wx-hour">
                <div className="wx-hour-t">{h.t}</div>
                <div className="wx-hour-icon"><WxIcon kind={h.icon} size={18} /></div>
                <div className="wx-hour-temp">{h.temp}°</div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForecast.length > 0 && (
        <>
          <div className="wx-section-label">Show date forecast</div>
          <div className="wx-upcoming">
            {showForecast.map((s, i) => (
              <div key={i} className={"wx-up wx-risk-" + s.risk}>
                <div className="wx-up-date">{fmtSD(s.date)}</div>
                <div className="wx-up-icon"><WxIcon kind={s.icon} size={18} /></div>
                <div className="wx-up-temp">{s.temp}°</div>
                <div className="wx-up-place"><div className="wx-up-note">{s.note}</div></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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


// ─── NEWS & INDUSTRY FEED ────────────────────────────────────────────────────
function NewsWidget() {
  const [filter, setFilter] = React.useState("all");
  const [stories, setStories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr]         = React.useState(null);
  const [lastRefresh, setLastRefresh] = React.useState(null);

  const load = React.useCallback(() => {
    setLoading(true); setErr(null);
    _fetchNewsFeeds()
      .then(items => { setStories(items); setLoading(false); setLastRefresh(new Date()); })
      .catch(e => { setErr(e?.message || 'Unknown error'); setLoading(false); });
  }, []);

  React.useEffect(load, [load]);

  const cats = [
    { id: "all",      label: "All",      color: "var(--text-dim)" },
    { id: "touring",  label: "Touring",  color: "var(--red)" },
    { id: "industry", label: "Industry", color: "var(--blue)" },
    { id: "venues",   label: "Venues",   color: "#7da3d9" },
    { id: "tech",     label: "Tech",     color: "var(--amber)" },
  ];
  const filtered = filter === "all" ? stories : stories.filter(s => s.cat === filter);
  const catColor = c => (cats.find(x => x.id === c) || {}).color || "var(--text-dim)";
  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '…';

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
        {loading && stories.length === 0 && <div style={{ padding: "12px", color: "var(--text-faint)", fontSize: "11px" }}>Loading feeds…</div>}
        {err && <div style={{ padding: "12px", color: "var(--amber)", fontSize: "11px", lineHeight: 1.5 }}>{err}</div>}
        {filtered.map((s, i) => (
          <a key={i} href={s.link} target="_blank" rel="noopener noreferrer"
             className={"news-item" + (s.hot ? " news-hot" : "")}
             style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div className="news-meta">
              <span className="news-src" style={{ color: catColor(s.cat) }}>{s.src}</span>
              <span className="news-dot" style={{ background: catColor(s.cat) }} />
              <span className="news-time">{s.time}</span>
              {s.hot && <span className="news-hot-tag">HOT</span>}
            </div>
            <div className="news-title">{s.title}</div>
          </a>
        ))}
      </div>
      <div className="news-foot">
        <span>Refreshed {refreshLabel}</span>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "inherit", padding: 0 }} className="news-refresh">↻ refresh</button>
      </div>
    </div>
  );
}



