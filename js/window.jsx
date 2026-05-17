// Draggable, resizable, minimizable window component for Earl OS.
// Each window persists its position, size, minimized state in localStorage by id.

const LS = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("earl-os:" + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("earl-os:" + key, JSON.stringify(value)); } catch (e) {}
  },
};

// Shared z-index counter so the most recently focused window comes to front.
const WindowFocusContext = React.createContext({ focus: () => 10, active: null });

function WindowManager({ children }) {
  const [maxZ, setMaxZ] = React.useState(10);
  const [active, setActive] = React.useState(null);
  const focus = React.useCallback((id) => {
    setMaxZ((z) => {
      const next = z + 1;
      return next;
    });
    setActive(id);
    return maxZ + 1;
  }, [maxZ]);
  return (
    <WindowFocusContext.Provider value={{ focus, active, maxZ }}>
      {children}
    </WindowFocusContext.Provider>
  );
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function Window({
  id, title, accent, icon, hint, defaultPos, defaultSize,
  minSize = { w: 260, h: 180 }, children, headerRight,
  hidden = false, onClose,
}) {
  const ctx = React.useContext(WindowFocusContext);
  const [pos, setPos] = React.useState(() => LS.get("win:" + id + ":pos", defaultPos));
  const [size, setSize] = React.useState(() => LS.get("win:" + id + ":size", defaultSize));
  const [minimized, setMinimized] = React.useState(() => LS.get("win:" + id + ":min", false));
  const [maximized, setMaximized] = React.useState(() => LS.get("win:" + id + ":max", false));
  const [z, setZ] = React.useState(() => LS.get("win:" + id + ":z", 10));
  const [preMax, setPreMax] = React.useState(null);

  React.useEffect(() => { LS.set("win:" + id + ":pos", pos); }, [id, pos]);
  React.useEffect(() => { LS.set("win:" + id + ":size", size); }, [id, size]);
  React.useEffect(() => { LS.set("win:" + id + ":min", minimized); }, [id, minimized]);
  React.useEffect(() => { LS.set("win:" + id + ":max", maximized); }, [id, maximized]);
  React.useEffect(() => { LS.set("win:" + id + ":z", z); }, [id, z]);

  const bringToFront = () => {
    const newZ = ctx.focus(id);
    setZ(newZ);
  };

  // ── Dragging ───────────────────────────────────────────────────────────
  const dragStart = (e) => {
    if (maximized) return;
    if (e.target.closest(".win-btn")) return;
    bringToFront();
    const startX = e.clientX, startY = e.clientY;
    const startPos = { ...pos };
    const onMove = (ev) => {
      const nx = startPos.x + (ev.clientX - startX);
      const ny = startPos.y + (ev.clientY - startY);
      setPos({
        x: clamp(nx, -size.w + 80, window.innerWidth - 80),
        y: clamp(ny, 40, window.innerHeight - 40),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
  };

  // ── Resizing ───────────────────────────────────────────────────────────
  const resizeStart = (edge) => (e) => {
    if (maximized) return;
    bringToFront();
    const startX = e.clientX, startY = e.clientY;
    const startSize = { ...size };
    const startPos = { ...pos };
    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      let nw = startSize.w, nh = startSize.h, nx = startPos.x, ny = startPos.y;
      if (edge.includes("e")) nw = Math.max(minSize.w, startSize.w + dx);
      if (edge.includes("s")) nh = Math.max(minSize.h, startSize.h + dy);
      if (edge.includes("w")) {
        nw = Math.max(minSize.w, startSize.w - dx);
        nx = startPos.x + (startSize.w - nw);
      }
      if (edge.includes("n")) {
        nh = Math.max(minSize.h, startSize.h - dy);
        ny = startPos.y + (startSize.h - nh);
      }
      setSize({ w: nw, h: nh });
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
    e.stopPropagation();
  };

  const toggleMax = () => {
    if (maximized) {
      setMaximized(false);
      if (preMax) { setPos(preMax.pos); setSize(preMax.size); }
    } else {
      setPreMax({ pos, size });
      setPos({ x: 8, y: 48 });
      setSize({ w: window.innerWidth - 16, h: window.innerHeight - 56 });
      setMaximized(true);
    }
    bringToFront();
  };

  if (hidden) return null;

  const isActive = ctx.active === id;
  const effPos = pos;
  const effSize = minimized ? { w: size.w, h: 36 } : size;

  return (
    <div
      className={"win" + (isActive ? " win-active" : "") + (minimized ? " win-min" : "")}
      style={{
        left: effPos.x, top: effPos.y,
        width: effSize.w, height: effSize.h,
        zIndex: z,
        "--win-accent": accent || "var(--blue)",
      }}
      onMouseDown={bringToFront}
    >
      <div className="win-hd" onMouseDown={dragStart} onDoubleClick={toggleMax}>
        <div className="win-hd-l">
          <span className="win-dot" />
          {icon && <span className="win-icon">{icon}</span>}
          <span className="win-title">{title}</span>
          {hint && <span className="win-hint">{hint}</span>}
        </div>
        <div className="win-hd-r">
          {headerRight}
          <button className="win-btn" title="Minimize" onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}>
            {minimized ? "▢" : "—"}
          </button>
          <button className="win-btn" title="Maximize" onClick={(e) => { e.stopPropagation(); toggleMax(); }}>
            {maximized ? "❐" : "▢"}
          </button>
          {onClose && (
            <button className="win-btn win-btn-close" title="Close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
              ×
            </button>
          )}
        </div>
      </div>
      {!minimized && (
        <div className="win-body">
          {children}
        </div>
      )}
      {/* Resize handles */}
      {!minimized && !maximized && (
        <React.Fragment>
          <div className="win-rs win-rs-e" onMouseDown={resizeStart("e")} />
          <div className="win-rs win-rs-s" onMouseDown={resizeStart("s")} />
          <div className="win-rs win-rs-w" onMouseDown={resizeStart("w")} />
          <div className="win-rs win-rs-n" onMouseDown={resizeStart("n")} />
          <div className="win-rs win-rs-se" onMouseDown={resizeStart("se")} />
          <div className="win-rs win-rs-sw" onMouseDown={resizeStart("sw")} />
          <div className="win-rs win-rs-ne" onMouseDown={resizeStart("ne")} />
          <div className="win-rs win-rs-nw" onMouseDown={resizeStart("nw")} />
        </React.Fragment>
      )}
    </div>
  );
}

// Persisted state hook
function usePersisted(key, initial) {
  const [v, setV] = React.useState(() => LS.get(key, typeof initial === "function" ? initial() : initial));
  React.useEffect(() => { LS.set(key, v); }, [key, v]);
  return [v, setV];
}

// Tiny ID generator so template tasks have stable identifiers across state instances.
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Template + dated-state task model.
// `templateKey` stores the repeating checklist (the master template).
// `stateKey` stores which task IDs are checked for that specific instance.
// Combined, this lets a single template "carry over" to many days,
// while each day has its own check-off state.
function useTemplatedTasks(templateKey, stateKey, seedTexts) {
  const [template, setTemplate] = usePersisted(templateKey, () =>
    seedTexts.map(text => ({ id: genId(), text }))
  );
  const [state, setState] = usePersisted(stateKey, {});

  const tasks = template.map(t => ({ ...t, done: !!state[t.id] }));
  const toggle = (id) => setState({ ...state, [id]: !state[id] });
  const removeTask = (id) => {
    setTemplate(template.filter(t => t.id !== id));
    if (state[id]) { const { [id]: _, ...rest } = state; setState(rest); }
  };
  const addTask = (text) => setTemplate([...template, { id: genId(), text }]);

  return { tasks, toggle, removeTask, addTask };
}

Object.assign(window, { Window, WindowManager, WindowFocusContext, usePersisted, LS, useTemplatedTasks, genId });
