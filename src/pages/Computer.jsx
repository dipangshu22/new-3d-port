import React, { useEffect, useRef, useState } from "react";
import "./computer.css";

/* ============================================================
   SIMPLE BEEP PLAYER
============================================================ */
function playBeep(ctx, freq = 660, dur = 120) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);

  o.connect(g);
  g.connect(ctx.destination);

  o.start();
  o.stop(ctx.currentTime + dur / 1000);
}

/* ============================================================
   BOOT SCREEN
============================================================ */
function BootScreen({ onFinished }) {
  const [lines, setLines] = useState([]);
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  const biosLines = [
    "AMI BIOS v2.14",
    "CPU: Intel(R) Core(TM) i7-9750H @ 2.60GHz",
    "RAM: 16384MB OK",
    "SATA: 1 devices detected",
    "POST: All systems nominal",
  ];

  useEffect(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = AC ? new AC() : null;

    let i = 0;
    const id = setInterval(() => {
      if (i < biosLines.length) {
        setLines((prev) => [...prev, biosLines[i]]);
        if (ctx) playBeep(ctx, 600 + i * 120, 120);
        i++;
      } else {
        clearInterval(id);
        setTimeout(() => setPhase(1), 500);
      }
    }, 550);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;

    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = AC ? new AC() : null;

    let p = 0;
    const id = setInterval(() => {
      p += Math.floor(Math.random() * 10) + 5;

      if (p >= 100) {
        p = 100;
        setProgress(100);
        clearInterval(id);

        if (ctx) playBeep(ctx, 1000, 200);

        setTimeout(() => {
          setPhase(2);
          setTimeout(() => onFinished(), 900);
        }, 500);
      } else {
        setProgress(p);
        if (ctx) playBeep(ctx, 820, 60);
      }
    }, 140);

    return () => clearInterval(id);
  }, [phase, onFinished]);

  return (
    <div className="boot-screen">
      <div className="boot-card">
        <div className="boot-lines">
          {lines.map((line, i) => (
            <div key={i} className="boot-line">
              <span className="boot-tag">[POST]</span> {line}
            </div>
          ))}
        </div>

        {phase >= 1 && (
          <>
            <div className="boot-progress">
              <div className="boot-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="boot-status">Loading OS modules… {progress}%</div>
          </>
        )}

        {phase === 2 && (
          <div className="boot-ready">
            {"> Welcome — launching desktop..."}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DRAGGABLE HOOK (JSX-SAFE)
============================================================ */
function useDraggable(ref, onFocus) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const bar = el.querySelector(".window-title-bar");
    if (!bar) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const move = (e) => {
      if (!dragging) return;
      el.style.left = e.clientX - offsetX + "px";
      el.style.top = e.clientY - offsetY + "px";
    };

    const up = () => {
      dragging = false;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };

    const down = (e) => {
      if (e.button !== 0) return;

      dragging = true;
      onFocus?.();

      const r = el.getBoundingClientRect();
      offsetX = e.clientX - r.left;
      offsetY = e.clientY - r.top;

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    };

    bar.addEventListener("pointerdown", down);

    return () => {
      bar.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
  }, [ref, onFocus]);
}

/* ============================================================
   TERMINAL COMMAND ENGINE
============================================================ */
function runCmd(raw, state) {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0];
  const arg = parts.slice(1).join(" ");

  const log = (msg) => state.logs.push(msg);

  switch (cmd) {
    case "help":
      log("Commands: help, ls, open <file>, rm <file>, restore <file>, emptybin, echo <msg>, date, clear");
      break;

    case "ls":
      if (state.files.length === 0) log("(no files)");
      state.files.forEach((f) => log("- " + f.name));
      break;

    case "open":
      if (!arg) log("open: missing target");
      else log(`Opening ${arg} (simulated)`);
      break;

    case "rm":
      if (!arg) log("rm: missing file");
      else {
        const f = state.files.find((x) => x.name === arg);
        if (!f) log("rm: no such file");
        else {
          state.files = state.files.filter((x) => x.name !== arg);
          state.recycle.unshift({ ...f, deletedAt: Date.now() });
          log(`Deleted ${arg}`);
        }
      }
      break;

    case "restore":
      if (!arg) log("restore: missing file");
      else {
        const item = state.recycle.find((x) => x.name === arg);
        if (!item) log("restore: not in recycle");
        else {
          state.recycle = state.recycle.filter((x) => x.name !== arg);
          state.files.unshift(item);
          log(`Restored ${arg}`);
        }
      }
      break;

    case "emptybin":
      state.recycle = [];
      log("Recycle bin emptied");
      break;

    case "echo":
      log(arg);
      break;

    case "date":
      log(new Date().toString());
      break;

    case "clear":
      state.logs = [];
      break;

    default:
      log(`Unknown command: ${cmd}`);
  }

  return state;
}

/* ============================================================
   MAIN OS DESKTOP
============================================================ */
export default function Computer() {
  const [booted, setBooted] = useState(false);
  const [desktop, setDesktop] = useState(false);

  const onBootFinished = () => {
    setBooted(true);
    setTimeout(() => setDesktop(true), 300);
  };

  /* window layering */
  const [z, setZ] = useState(100);
  const bringFront = (ref) =>
    setZ((prev) => {
      const next = prev + 1;
      if (ref.current) ref.current.style.zIndex = next;
      return next;
    });

  /* window states */
  const [open, setOpen] = useState([]);
  const [min, setMin] = useState([]);

  const refs = {
    explorer: useRef(null),
    recycle: useRef(null),
    terminal: useRef(null),
  };

  const openWin = (name) => {
    if (!open.includes(name)) setOpen((p) => [...p, name]);
    setMin((m) => m.filter((x) => x !== name));
    bringFront(refs[name]);
  };
  const closeWin = (name) => {
    setOpen((p) => p.filter((x) => x !== name));
    setMin((m) => m.filter((x) => x !== name));
  };
  const minimize = (name) => setMin((p) => [...p, name]);

  const restore = (name) => {
    setMin((p) => p.filter((x) => x !== name));
    bringFront(refs[name]);
  };

  /* fake FS */
  const [files, setFiles] = useState([
    { id: 1, name: "project1.zip", size: "4.2MB" },
    { id: 2, name: "design.sketch", size: "2.6MB" },
    { id: 3, name: "notes.txt", size: "8KB" },
  ]);

  const [recycle, setRecycle] = useState([]);

  /* terminal */
  const [logs, setLogs] = useState(["> FakeOS terminal ready — type 'help'"]);
  const [input, setInput] = useState("");

  const runTerminal = () => {
    const raw = input.trim();
    if (!raw) return;
    setInput("");

    let st = {
      logs: [...logs],
      files: [...files],
      recycle: [...recycle],
    };

    st = runCmd(raw, st);

    setFiles(st.files);
    setRecycle(st.recycle);
    setLogs(st.logs);
  };

  /* dragging */
  useDraggable(refs.explorer, () => bringFront(refs.explorer));
  useDraggable(refs.recycle, () => bringFront(refs.recycle));
  useDraggable(refs.terminal, () => bringFront(refs.terminal));

  return (
    <div className="desktop">
      {!desktop && !booted && <BootScreen onFinished={onBootFinished} />}
      {!desktop && booted && <div className="boot-fade" onAnimationEnd={() => setDesktop(true)} />}

      {desktop && (
        <>
          {/* Desktop icons */}
          <div className="desktop-icons">
            <div className="icon" onDoubleClick={() => openWin("explorer")}>
              <img src="/icons/folder.png" />
              <span>File Explorer</span>
            </div>
            <div className="icon" onDoubleClick={() => openWin("terminal")}>
              <img src="/icons/terminal.png" />
              <span>Terminal</span>
            </div>
            <div className="icon" onDoubleClick={() => openWin("recycle")}>
              <img src="/icons/recycle.png" />
              <span>Recycle Bin</span>
            </div>
          </div>

          {/* Taskbar */}
          <div className="taskbar">
            <div className="start-left">
              <button onClick={() => openWin("explorer")}>⊞</button>
            </div>

            <div className="task-center">
              {open.map((w) => (
                <button
                  key={w}
                  className={`task-item ${min.includes(w) ? "min" : ""}`}
                  onClick={() => (min.includes(w) ? restore(w) : bringFront(refs[w]))}
                >
                  {w}
                </button>
              ))}
            </div>

            <div className="task-right">{new Date().toLocaleTimeString()}</div>
          </div>

          {/* Explorer */}
          {open.includes("explorer") && !min.includes("explorer") && (
            <div
              className="window"
              style={{ left: "240px", top: "160px" }}
              ref={refs.explorer}
              onMouseDown={() => bringFront(refs.explorer)}
            >
              <div className="window-title-bar">
                <span>File Explorer</span>
                <div>
                  <button onClick={() => minimize("explorer")}>_</button>
                  <button onClick={() => closeWin("explorer")}>×</button>
                </div>
              </div>
              <div className="window-body">
                <h3>My Files</h3>
                {files.map((f) => (
                  <div key={f.id} className="file-row">
                    <div className="file-meta">
                      <img src="/icons/file.png" />
                      <div>
                        <div>{f.name}</div>
                        <div className="muted">{f.size}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFiles((p) => p.filter((x) => x.id !== f.id));
                        setRecycle((p) => [{ ...f, deletedAt: Date.now() }, ...p]);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recycle */}
          {open.includes("recycle") && !min.includes("recycle") && (
            <div
              className="window"
              style={{ left: "300px", top: "200px" }}
              ref={refs.recycle}
              onMouseDown={() => bringFront(refs.recycle)}
            >
              <div className="window-title-bar">
                <span>Recycle Bin</span>
                <div>
                  <button onClick={() => minimize("recycle")}>_</button>
                  <button onClick={() => closeWin("recycle")}>×</button>
                </div>
              </div>

              <div className="window-body">
                <h3>Recycle Bin</h3>
                {recycle.length === 0 && <div className="muted">Recycle bin is empty</div>}

                {recycle.map((r) => (
                  <div key={r.id} className="file-row">
                    <div className="file-meta">
                      <img src="/icons/file.png" />
                      <div>
                        <div>{r.name}</div>
                        <div className="muted">
                          Deleted: {new Date(r.deletedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <button onClick={() => {
                      setRecycle((p) => p.filter((x) => x.id !== r.id));
                      setFiles((p) => [r, ...p]);
                    }}>Restore</button>

                    <button onClick={() => setRecycle((p) => p.filter((x) => x.id !== r.id))}>
                      Delete Permanently
                    </button>
                  </div>
                ))}

                {recycle.length > 0 && (
                  <button className="recycle-controls" onClick={() => setRecycle([])}>
                    Empty Recycle Bin
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Terminal */}
          {open.includes("terminal") && !min.includes("terminal") && (
            <div
              className="window"
              style={{ left: "360px", top: "240px" }}
              ref={refs.terminal}
              onMouseDown={() => bringFront(refs.terminal)}
            >
              <div className="window-title-bar">
                <span>Terminal</span>
                <div>
                  <button onClick={() => minimize("terminal")}>_</button>
                  <button onClick={() => closeWin("terminal")}>×</button>
                </div>
              </div>

              <div className="window-body terminal-body">
                <div className="terminal-output">
                  {logs.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>

                <div className="terminal-input-row">
                  <span className="prompt">user@fakeos:~$</span>
                  <input
                    className="terminal-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runTerminal()}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
