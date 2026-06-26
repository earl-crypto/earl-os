// js/db.jsx — Supabase data layer for Earl OS.
// Loads all user data on login, migrates localStorage on first sign-in,
// and exposes read/write operations via DataContext.

const DATA_CTX = React.createContext(null);
function useData() { return React.useContext(DATA_CTX); }

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const DEFAULT_PROFILE = {
  name: "Earl Neal",
  title: "Founder · Tour Production Manager",
  status: "available",
  event: "",
  venue: "",
};

const TWEAK_DEFAULTS = {
  density: "regular", accent: "balanced", showGrid: false, wallpaper: "navy",
};

const TASK_KINDS = ["office", "show:pre", "show:day", "show:post"];

const TASK_SEEDS = {
  office:     ["Inbox to zero before 10a","Review next advance pack","Travel & per diem reconciled","Vendor invoices reviewed","Weekly forecast call","30 min workout / walk","End-of-day tomorrow prep"],
  "show:pre":  ["Send call sheet to crew","Confirm load-in time w/ venue","Final headcount to catering","Print stage plot + patch sheets","Review weather + contingencies","Confirm hotel block & roster","Charge radios, batteries, comms"],
  "show:day":  ["Crew breakfast / coffee on deck","Walk venue with house manager","Patch sheet to FOH","RF coordination check","Catering headcount → runner","Confirm meet & greet list","Settlement sheet prepped","Post-show crew debrief"],
  "show:post": ["Settlement docs filed","Per diem reconciled","Crew shoutouts sent","Show journal archived","Advance check for next stop","Expense receipts uploaded"],
};

function DataProvider({ session, children }) {
  const uid = session.user.id;
  const [providerToken, _setProviderToken] = React.useState(session.provider_token || null);
  const [ready, setReady] = React.useState(false);

  // Keep provider token fresh — Supabase auto-refreshes the JWT every ~50 min
  // and the new session will carry an updated Google access token.
  React.useEffect(() => {
    const { data: { subscription } } = _sb.auth.onAuthStateChange((_e, s) => {
      if (s?.provider_token) _setProviderToken(s.provider_token);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshProviderToken = React.useCallback(async () => {
    const { data } = await _sb.auth.refreshSession();
    if (data?.session?.provider_token) {
      _setProviderToken(data.session.provider_token);
      return data.session.provider_token;
    }
    return null;
  }, []);

  // ── Core state (initialised from localStorage as fast default) ─────────────
  const [profile,   _setProfile]   = React.useState(LS.get("profile", DEFAULT_PROFILE));
  const [showDay,   _setShowDay]   = React.useState(LS.get("mode:show", true));
  const [tweaks,    _setTweaks]    = React.useState({ ...TWEAK_DEFAULTS, ...LS.get("tweaks", {}) });
  const [closed,    _setClosed]    = React.useState(LS.get("closed", {}));
  const [showDates, _setShowDates] = React.useState(LS.get("showDates", []));
  const [notes,     _setNotes]     = React.useState(LS.get("notes", ""));

  // ── Journal state ────────────────────────────────────────────────────────
  const [journalPersonal, _setJournalPersonal] = React.useState(LS.get("journal:personal", {}));
  const [journalShow,     _setJournalShow]     = React.useState(LS.get("journal:show", {}));

  // ── Task state ────────────────────────────────────────────────────────────
  // { [kind]: { templates: [{id, text, ord}], state: {[template_id]: {[scope_date]: done}} } }
  const [taskData,    _setTaskData]    = React.useState({});
  const [oneoffTasks, _setOneoffTasks] = React.useState([]);

  // ── Load everything from Supabase on mount ─────────────────────────────────
  React.useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          syncProfileSettings(),
          syncShowDates(),
          syncNotes(),
          syncJournals(),
          syncTasks(),
        ]);
      } catch (e) {
        console.error("Earl OS data load error:", e);
      } finally {
        setReady(true);
      }
    })();
  }, [uid]);

  // ── Realtime subscriptions (push changes from any device instantly) ──────────
  React.useEffect(() => {
    if (!ready) return;

    const ch = _sb.channel(`earl-os:${uid}`)

      // task check-offs
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_state', filter: `user_id=eq.${uid}` },
        ({ new: row }) => {
          if (!row?.template_id) return;
          _setTaskData(prev => {
            for (const kind of TASK_KINDS) {
              if (!prev[kind]?.templates?.some(t => t.id === row.template_id)) continue;
              const sm = prev[kind].stateMap;
              return { ...prev, [kind]: { ...prev[kind], stateMap: { ...sm, [row.template_id]: { ...(sm[row.template_id] || {}), [row.scope_date]: row.done } } } };
            }
            return prev;
          });
        })

      // template task added
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_templates', filter: `user_id=eq.${uid}` },
        ({ new: row }) => {
          if (!row?.id) return;
          _setTaskData(prev => {
            const data = prev[row.kind] || { templates: [], stateMap: {} };
            if (data.templates.some(t => t.id === row.id)) return prev;
            const templates = [...data.templates, { id: row.id, text: row.text, ord: row.ord }].sort((a, b) => a.ord - b.ord);
            return { ...prev, [row.kind]: { ...data, templates } };
          });
        })

      // template task removed
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_templates', filter: `user_id=eq.${uid}` },
        ({ old: row }) => {
          if (!row?.id) return;
          _setTaskData(prev => {
            for (const kind of TASK_KINDS) {
              if (!prev[kind]?.templates?.some(t => t.id === row.id)) continue;
              return { ...prev, [kind]: { ...prev[kind], templates: prev[kind].templates.filter(t => t.id !== row.id) } };
            }
            return prev;
          });
        })

      // one-off tasks
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks_oneoff', filter: `user_id=eq.${uid}` },
        ({ new: row }) => {
          if (!row?.id) return;
          _setOneoffTasks(prev => prev.some(t => t.id === row.id) ? prev : [...prev, { id: row.id, text: row.text, done: row.done }]);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks_oneoff', filter: `user_id=eq.${uid}` },
        ({ new: row }) => {
          if (!row?.id) return;
          _setOneoffTasks(prev => prev.map(t => t.id === row.id ? { ...t, done: row.done } : t));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks_oneoff', filter: `user_id=eq.${uid}` },
        ({ old: row }) => {
          if (!row?.id) return;
          _setOneoffTasks(prev => prev.filter(t => t.id !== row.id));
        })

      // notes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${uid}` },
        ({ new: row }) => { if (row?.text != null) _setNotes(row.text); })

      // journals
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_personal', filter: `user_id=eq.${uid}` },
        ({ new: row }) => {
          if (!row?.date) return;
          const { user_id, updated_at, ...entry } = row;
          _setJournalPersonal(prev => ({ ...prev, [row.date]: entry }));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_show', filter: `user_id=eq.${uid}` },
        ({ new: row }) => {
          if (!row?.show_date) return;
          const { user_id, updated_at, ...rest } = row;
          _setJournalShow(prev => ({ ...prev, [row.show_date]: rest }));
        })

      // settings (tweaks, show mode, closed windows)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `user_id=eq.${uid}` },
        ({ new: s }) => {
          if (!s) return;
          if (s.tweaks && Object.keys(s.tweaks).length) _setTweaks({ ...TWEAK_DEFAULTS, ...s.tweaks });
          if (s.show_day != null) _setShowDay(s.show_day);
          if (s.closed_windows) _setClosed(s.closed_windows);
        })

      // show dates (re-fetch on any change to avoid needing REPLICA IDENTITY FULL)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'show_dates', filter: `user_id=eq.${uid}` },
        () => {
          _sb.from("show_dates").select("date").eq("user_id", uid).order("date")
            .then(({ data }) => { if (data) _setShowDates(data.map(r => r.date)); });
        })

      .subscribe((status, err) => {
        console.log("[earl-os] realtime:", status, err || "");
      });

    return () => { _sb.removeChannel(ch); };
  }, [ready, uid]);

  // ─── Sync functions (load cloud → migrate localStorage if first time) ───────

  async function syncProfileSettings() {
    const [{ data: prof }, { data: sett }] = await Promise.all([
      _sb.from("profiles").select("*").eq("id", uid).single(),
      _sb.from("settings").select("*").eq("user_id", uid).single(),
    ]);

    if (prof?.name) {
      _setProfile({ name: prof.name, title: prof.title, status: prof.status, event: prof.event, venue: prof.venue });
    } else {
      _sb.from("profiles").upsert({ id: uid, ...LS.get("profile", DEFAULT_PROFILE) });
    }

    if (sett) {
      if (sett.tweaks && Object.keys(sett.tweaks).length) _setTweaks({ ...TWEAK_DEFAULTS, ...sett.tweaks });
      if (sett.show_day != null) _setShowDay(sett.show_day);
      if (sett.closed_windows) _setClosed(sett.closed_windows);
    } else {
      _sb.from("settings").upsert({
        user_id: uid,
        tweaks: LS.get("tweaks", TWEAK_DEFAULTS),
        show_day: LS.get("mode:show", true),
        closed_windows: LS.get("closed", {}),
      });
    }
  }

  async function syncShowDates() {
    const { data } = await _sb.from("show_dates").select("date").eq("user_id", uid).order("date");
    if (data?.length) {
      _setShowDates(data.map(r => r.date));
    } else {
      const local = LS.get("showDates", []);
      if (local.length) await Promise.all(local.map(date => _sb.from("show_dates").upsert({ user_id: uid, date })));
    }
  }

  async function syncNotes() {
    const { data, error } = await _sb.from("notes").select("text").eq("user_id", uid).single();
    if (data != null) {
      _setNotes(data.text || "");
    } else {
      _sb.from("notes").upsert({ user_id: uid, text: LS.get("notes", "") });
    }
  }

  async function syncJournals() {
    const [{ data: pData }, { data: sData }] = await Promise.all([
      _sb.from("journal_personal").select("*").eq("user_id", uid),
      _sb.from("journal_show").select("*").eq("user_id", uid),
    ]);

    if (pData?.length) {
      const map = {};
      pData.forEach(r => { map[r.date] = { mood: r.mood, energy: r.energy, grateful: r.grateful, win: r.win, reflection: r.reflection }; });
      _setJournalPersonal(map);
    } else {
      const local = LS.get("journal:personal", {});
      if (Object.keys(local).length)
        await Promise.all(Object.entries(local).map(([date, e]) => _sb.from("journal_personal").upsert({ user_id: uid, date, ...e })));
    }

    if (sData?.length) {
      const map = {};
      sData.forEach(r => {
        const { user_id, updated_at, ...rest } = r;
        map[rest.show_date] = rest;
      });
      _setJournalShow(map);
    } else {
      const local = LS.get("journal:show", {});
      if (Object.keys(local).length)
        await Promise.all(Object.entries(local).map(([show_date, e]) => _sb.from("journal_show").upsert({ user_id: uid, show_date, ...e })));
    }
  }

  async function syncTasks() {
    const [{ data: templates, error: tplErr }, { data: stateRows }, { data: oneoffs }] = await Promise.all([
      _sb.from("task_templates").select("*").eq("user_id", uid).order("ord"),
      _sb.from("task_state").select("*").eq("user_id", uid),
      _sb.from("tasks_oneoff").select("*").eq("user_id", uid).order("ord"),
    ]);

    // null means query error — bail rather than clobber with seed data
    if (tplErr || templates === null) {
      console.error("[earl-os] task_templates load failed:", tplErr?.message);
    } else if (templates.length > 0) {
      // Build state map: { [template_id]: { [scope_date]: done } }
      const stateMap = {};
      (stateRows || []).forEach(s => {
        if (!stateMap[s.template_id]) stateMap[s.template_id] = {};
        stateMap[s.template_id][s.scope_date] = s.done;
      });
      const data = {};
      TASK_KINDS.forEach(kind => {
        data[kind] = { templates: templates.filter(t => t.kind === kind), stateMap };
      });
      _setTaskData(data);
    } else {
      // templates is [] — genuinely first time, migrate from localStorage
      const data = {};
      const lsKeyMap = { office: "tasks:office:template", "show:pre": "tasks:show:pre:template", "show:day": "tasks:show:day:template", "show:post": "tasks:show:post:template" };
      for (const kind of TASK_KINDS) {
        const local = LS.get(lsKeyMap[kind], null);
        const tpls = local || TASK_SEEDS[kind].map((text, i) => ({ id: genId(), text, ord: i }));
        await Promise.all(tpls.map(t => _sb.from("task_templates").upsert({ id: t.id, user_id: uid, kind, text: t.text, ord: t.ord || 0 })));
        data[kind] = { templates: tpls, stateMap: {} };
      }
      _setTaskData(data);
    }

    // One-off tasks
    if (oneoffs?.length) {
      _setOneoffTasks(oneoffs.map(r => ({ id: r.id, text: r.text, done: r.done })));
    } else {
      const local = LS.get("tasks:oneoff", [
        { text: "Renew passport (exp Sep)", done: false },
        { text: "EU work permit — sign + return", done: false },
        { text: "Q2 invoice → artist mgmt", done: false },
        { text: "Wire transfer · lighting vendor", done: false },
        { text: "Book dental cleaning", done: false },
        { text: "Update tour book template", done: true },
      ]);
      for (const [i, t] of local.entries()) {
        const { data: row } = await _sb.from("tasks_oneoff").insert({ user_id: uid, text: t.text, done: t.done, ord: i }).select().single();
        if (row) _setOneoffTasks(prev => [...prev, { id: row.id, text: row.text, done: row.done }]);
      }
    }
  }

  // ─── Setters ────────────────────────────────────────────────────────────────

  const setProfile = React.useCallback((updates) => {
    _setProfile(prev => {
      const next = { ...prev, ...updates };
      _sb.from("profiles").upsert({ id: uid, ...next })
        .then(({ error }) => { if (error) console.error("[earl-os] setProfile failed:", error.message); });
      return next;
    });
  }, [uid]);

  const setShowDay = React.useCallback((val) => {
    _setShowDay(val);
    _sb.from("settings").upsert({ user_id: uid, show_day: val })
      .then(({ error }) => { if (error) console.error("[earl-os] setShowDay failed:", error.message); });
  }, [uid]);

  const setTweak = React.useCallback((key, val) => {
    _setTweaks(prev => {
      const next = { ...prev, [key]: val };
      LS.set("tweaks", next);
      _sb.from("settings").upsert({ user_id: uid, tweaks: next });
      return next;
    });
  }, [uid]);

  const setClosed = React.useCallback((obj) => {
    _setClosed(obj);
    _sb.from("settings").upsert({ user_id: uid, closed_windows: obj })
      .then(({ error }) => { if (error) console.error("[earl-os] setClosed failed:", error.message); });
  }, [uid]);

  const addShowDate = React.useCallback((date) => {
    _setShowDates(prev => {
      if (prev.includes(date)) return prev;
      _sb.from("show_dates").upsert({ user_id: uid, date })
        .then(({ error }) => { if (error) console.error("[earl-os] addShowDate failed:", error.message); });
      return [...prev, date];
    });
  }, [uid]);

  const removeShowDate = React.useCallback((date) => {
    _setShowDates(prev => prev.filter(d => d !== date));
    _sb.from("show_dates").delete().eq("user_id", uid).eq("date", date)
      .then(({ error }) => { if (error) console.error("[earl-os] removeShowDate failed:", error.message); });
  }, [uid]);

  const _saveNotes = React.useMemo(() => debounce((text) => {
    _sb.from("notes").upsert({ user_id: uid, text })
      .then(({ error }) => { if (error) console.error("[earl-os] saveNotes failed:", error.message); });
  }, 1000), [uid]);

  const setNotes = React.useCallback((text) => {
    _setNotes(text);
    _saveNotes(text);
  }, [_saveNotes]);

  // ── Journals ────────────────────────────────────────────────────────────────

  const _savePersonal = React.useMemo(() => debounce((date, entry) => {
    _sb.from("journal_personal").upsert({ user_id: uid, date, ...entry })
      .then(({ error }) => { if (error) console.error("[earl-os] savePersonalJournal failed:", error.message); });
  }, 800), [uid]);

  const updatePersonalJournal = React.useCallback((date, key, val) => {
    _setJournalPersonal(prev => {
      const entry = { mood: 3, energy: 3, grateful: "", win: "", reflection: "", ...(prev[date] || {}), [key]: val };
      _savePersonal(date, entry);
      return { ...prev, [date]: entry };
    });
  }, [_savePersonal]);

  const _saveShow = React.useMemo(() => debounce((date, entry) => {
    _sb.from("journal_show").upsert({ user_id: uid, show_date: date, ...entry })
      .then(({ error }) => { if (error) console.error("[earl-os] saveShowJournal failed:", error.message); });
  }, 800), [uid]);

  const updateShowJournal = React.useCallback((date, key, val) => {
    _setJournalShow(prev => {
      const entry = { ...(prev[date] || {}), [key]: val };
      _saveShow(date, entry);
      return { ...prev, [date]: entry };
    });
  }, [_saveShow]);

  // ── Tasks ────────────────────────────────────────────────────────────────────

  const getTasksForKind = React.useCallback((kind, scopeDate) => {
    const data = taskData[kind] || { templates: [], stateMap: {} };
    return data.templates.map(t => ({
      ...t,
      done: !!(data.stateMap[t.id] && data.stateMap[t.id][scopeDate]),
    }));
  }, [taskData]);

  const toggleTask = React.useCallback((kind, id, scopeDate) => {
    _setTaskData(prev => {
      const data = prev[kind] || { templates: [], stateMap: {} };
      const curDone = !!(data.stateMap[id] && data.stateMap[id][scopeDate]);
      const newDone = !curDone;
      const newStateMap = {
        ...data.stateMap,
        [id]: { ...(data.stateMap[id] || {}), [scopeDate]: newDone },
      };
      _sb.from("task_state").upsert({ user_id: uid, template_id: id, scope_date: scopeDate, done: newDone })
        .then(({ error }) => { if (error) console.error("[earl-os] toggleTask failed:", error.message); });
      return { ...prev, [kind]: { ...data, stateMap: newStateMap } };
    });
  }, [uid]);

  const addTask = React.useCallback((kind, text) => {
    const id = genId();
    _setTaskData(prev => {
      const data = prev[kind] || { templates: [], stateMap: {} };
      const ord = data.templates.length;
      _sb.from("task_templates").insert({ id, user_id: uid, kind, text, ord })
        .then(({ error }) => { if (error) console.error("[earl-os] addTask failed:", error.message); });
      return { ...prev, [kind]: { ...data, templates: [...data.templates, { id, text, ord }] } };
    });
  }, [uid]);

  const removeTask = React.useCallback((kind, id) => {
    _setTaskData(prev => {
      const data = prev[kind] || { templates: [], stateMap: {} };
      const { [id]: _, ...rest } = data.stateMap;
      _sb.from("task_templates").delete().eq("id", id).eq("user_id", uid)
        .then(({ error }) => { if (error) console.error("[earl-os] removeTask failed:", error.message); });
      return { ...prev, [kind]: { templates: data.templates.filter(t => t.id !== id), stateMap: rest } };
    });
  }, [uid]);

  // ── One-off tasks ────────────────────────────────────────────────────────────

  const toggleOneoff = React.useCallback((id) => {
    _setOneoffTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, done: !t.done } : t);
      const task = next.find(t => t.id === id);
      _sb.from("tasks_oneoff").update({ done: task.done }).eq("id", id).eq("user_id", uid)
        .then(({ error }) => { if (error) console.error("[earl-os] toggleOneoff failed:", error.message); });
      return next;
    });
  }, [uid]);

  const addOneoff = React.useCallback((text) => {
    _sb.from("tasks_oneoff")
      .insert({ user_id: uid, text, done: false, ord: oneoffTasks.length })
      .select().single()
      .then(({ data }) => {
        if (data) _setOneoffTasks(prev => [...prev, { id: data.id, text: data.text, done: false }]);
      });
  }, [uid, oneoffTasks.length]);

  const removeOneoff = React.useCallback((id) => {
    _setOneoffTasks(prev => prev.filter(t => t.id !== id));
    _sb.from("tasks_oneoff").delete().eq("id", id).eq("user_id", uid)
      .then(({ error }) => { if (error) console.error("[earl-os] removeOneoff failed:", error.message); });
  }, [uid]);

  if (!ready) return (
    <div className="app-loading">
      <img src="assets/earl-neal-logo.jpeg" alt="EN" />
      <span>Loading your data…</span>
    </div>
  );

  return (
    <DATA_CTX.Provider value={{
      uid, providerToken, refreshProviderToken,
      profile, setProfile,
      showDay, setShowDay,
      tweaks, setTweak,
      closed, setClosed,
      showDates, addShowDate, removeShowDate,
      notes, setNotes,
      journalPersonal, updatePersonalJournal,
      journalShow, updateShowJournal,
      getTasksForKind, toggleTask, addTask, removeTask,
      oneoffTasks, toggleOneoff, addOneoff, removeOneoff,
    }}>
      {children}
    </DATA_CTX.Provider>
  );
}

Object.assign(window, { useData, DataProvider, DATA_CTX, DEFAULT_PROFILE, TWEAK_DEFAULTS });
