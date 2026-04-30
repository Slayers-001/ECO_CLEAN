import { useEffect, useMemo, useRef, useState } from "react";
import {
  DIFFICULTY_LABELS,
  EMOTES,
  GAME_MODE_DESCRIPTIONS,
  GAME_MODE_LABELS,
  LEVEL_LABELS,
  POWERUP_EMOJIS,
  POWERUP_LABELS,
  startGame,
  type AdminCommand,
  type Difficulty,
  type EmoteKind,
  type GameHandle,
  type GameMode,
  type GameState,
  type Level,
  type MiniMapData,
  type PowerUpKind,
} from "@/game";

const NAME_KEY = "ecoclean.playerName";
const SETTINGS_KEY = "ecoclean.settings";

const TRASH_LABELS: Record<string, string> = {
  plastic: "a plastic bottle",
  metal: "a soda can",
  paper: "some paper",
  organic: "some organic waste",
};

const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: "180s round · 24 trash · 60% to win",
  normal: "120s round · 32 trash · 80% to win",
  hard: "90s round · 44 trash · 90% to win",
};

const MODE_COLORS: Record<GameMode, string> = {
  speedrun: "bg-yellow-500",
  percent100: "bg-emerald-600",
  powerup: "bg-purple-600",
};

const POWERUP_KINDS: PowerUpKind[] = ["magnet", "speed", "bonus"];

const ALL_LEVELS: Level[] = ["park", "beach", "city", "nightcity", "arctic", "jungle"];

const DEFAULT_STATE: GameState = {
  status: "menu",
  level: "park",
  gameMode: "speedrun",
  difficulty: "normal",
  roundDuration: 120,
  selfId: null, selfName: "", selfScore: 0, timeLeft: 0,
  totalTrash: 0, collected: 0, players: [], fact: null, lastResult: null,
  soundOn: true, musicVolume: 0.5, sfxVolume: 0.7, mouseSensitivity: 1.0,
  pickupNotice: null, powerUpNotice: null, combo: null, mvpId: null, floatingPoints: [],
  roomCode: null, isPublicRoom: false, errorMessage: null, sprintStamina: 1, isSprinting: false,
  magnetMs: 0, speedMs: 0,
  miniMap: { worldHalf: 28, selfX: 0, selfZ: 0, others: [], trash: [], powerUps: [] },
  isOwner: false, ownerStatus: null, godMode: false,
  stats: { trashCleaned: 0, powerUpsCollected: 0, bestCombo: 0, pointsEarned: 0 },
  isPaused: false,
};

interface PersistedSettings { musicVolume: number; sfxVolume: number; mouseSensitivity: number; }
function loadSettings(): PersistedSettings | null {
  if (typeof window === "undefined") return null;
  try { const raw = window.localStorage.getItem(SETTINGS_KEY); if (!raw) return null; return JSON.parse(raw) as PersistedSettings; } catch { return null; }
}
function saveSettings(s: PersistedSettings) {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Enhanced Mini-map with legend */
function MiniMap({ data, godMode }: { data: MiniMapData; godMode: boolean }) {
  const SIZE = 200; const HALF = SIZE / 2; const scale = HALF / data.worldHalf;
  const projX = (x: number) => HALF + (x - data.selfX) * scale;
  const projZ = (z: number) => HALF + (z - data.selfZ) * scale;
  return (
    <div>
      <div className="bg-black/80 backdrop-blur rounded-xl shadow-xl border border-white/20 overflow-hidden" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="block">
          {/* Compass cardinal marks */}
          <text x={HALF} y={10} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">N</text>
          <text x={HALF} y={SIZE - 3} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">S</text>
          <text x={6} y={HALF + 3} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">W</text>
          <text x={SIZE - 6} y={HALF + 3} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">E</text>
          {/* World border */}
          <rect x={projX(-data.worldHalf)} y={projZ(-data.worldHalf)} width={2 * data.worldHalf * scale} height={2 * data.worldHalf * scale} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
          {/* Grid lines */}
          {[-14, 0, 14].map(v => (
            <g key={v}>
              <line x1={projX(v)} y1={projZ(-data.worldHalf)} x2={projX(v)} y2={projZ(data.worldHalf)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
              <line x1={projX(-data.worldHalf)} y1={projZ(v)} x2={projX(data.worldHalf)} y2={projZ(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
            </g>
          ))}
          {/* Trash blips — yellow dots with a cross */}
          {data.trash.map((t, i) => (
            <g key={`t${i}`}>
              <circle cx={projX(t.x)} cy={projZ(t.z)} r={2.5} fill="#fbbf24" opacity={0.9} />
            </g>
          ))}
          {/* Power-up blips */}
          {data.powerUps.map((p, i) => (
            <circle key={`p${i}`} cx={projX(p.x)} cy={projZ(p.z)} r={4} fill={p.kind === "magnet" ? "#ef4444" : p.kind === "speed" ? "#facc15" : "#c084fc"} stroke="white" strokeWidth={1} opacity={0.95} />
          ))}
          {/* Other players */}
          {data.others.map(o => (
            <circle key={o.id} cx={projX(o.x)} cy={projZ(o.z)} r={4} fill={o.color} stroke="white" strokeWidth={1.5} />
          ))}
          {/* Self — pulsing green dot */}
          <circle cx={HALF} cy={HALF} r={5.5} fill={godMode ? "#a78bfa" : "#34d399"} stroke="white" strokeWidth={2} />
          <circle cx={HALF} cy={HALF} r={2} fill="white" />
        </svg>
      </div>
      {/* Legend */}
      <div className="mt-1 flex gap-2 justify-center text-[9px] text-white/70 font-semibold">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />Trash</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />You</span>
        {data.others.length > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" />Team</span>}
      </div>
    </div>
  );
}

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<GameHandle | null>(null);

  const [name, setName] = useState<string>(() => {
    if (typeof window !== "undefined") return window.localStorage.getItem(NAME_KEY) ?? "";
    return "";
  });
  const initialJoinCode = useMemo(() => {
    if (typeof window === "undefined") return "";
    const c = new URL(window.location.href).searchParams.get("code");
    return (c ?? "").toUpperCase().slice(0, 8);
  }, []);
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [showPrivate, setShowPrivate] = useState(false);
  const [privateDifficulty, setPrivateDifficulty] = useState<Difficulty>("normal");
  const [copied, setCopied] = useState(false);

  // Lobby flow: mode → map → play
  const [lobbyMode, setLobbyMode] = useState<GameMode | null>(null);
  const [lobbyStep, setLobbyStep] = useState<"mode" | "map" | null>(null);
  const [privateMode, setPrivateMode] = useState<GameMode>("speedrun");

  // UI panels
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showOwnerLogin, setShowOwnerLogin] = useState(false);
  const [ownerPwInput, setOwnerPwInput] = useState("");
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);
  const [adminTimerInput, setAdminTimerInput] = useState("60");

  const [state, setState] = useState<GameState>(DEFAULT_STATE);

  useEffect(() => {
    if (!mountRef.current) return;
    const handle = startGame(mountRef.current, setState);
    gameRef.current = handle;
    const saved = loadSettings();
    if (saved) {
      handle.setMusicVolume(saved.musicVolume);
      handle.setSfxVolume(saved.sfxVolume);
      handle.setMouseSensitivity(saved.mouseSensitivity);
    }
    return () => handle.dispose();
  }, []);

  useEffect(() => {
    saveSettings({ musicVolume: state.musicVolume, sfxVolume: state.sfxVolume, mouseSensitivity: state.mouseSensitivity });
  }, [state.musicVolume, state.sfxVolume, state.mouseSensitivity]);

  // ESC key — pause/unpause (only when playing)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (state.status !== "playing") return;
      if (showSettings || showOwnerPanel || showOwnerLogin || showStats) {
        setShowSettings(false); setShowOwnerPanel(false); setShowOwnerLogin(false); setShowStats(false);
        return;
      }
      gameRef.current?.setPaused(!state.isPaused);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [state.status, state.isPaused, showSettings, showOwnerPanel, showOwnerLogin, showStats]);

  // P key — admin panel
  useEffect(() => {
    const handleAdminKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (state.status !== "playing" && state.status !== "waiting") return;
      if (state.isPaused) return;
      if (state.isOwner) setShowOwnerPanel(true); else setShowOwnerLogin(true);
    };
    window.addEventListener("keydown", handleAdminKey);
    return () => window.removeEventListener("keydown", handleAdminKey);
  }, [state.status, state.isOwner, state.isPaused]);

  const finalName = () => (name.trim() || "Player").slice(0, 18);
  const persistName = (n: string) => window.localStorage.setItem(NAME_KEY, n);

  const handleJoinPublic = (level: Level) => {
    const n = finalName(); persistName(n);
    gameRef.current?.start({ kind: "public", level, name: n, gameMode: lobbyMode ?? "speedrun" });
    setLobbyStep(null); setLobbyMode(null);
  };
  const handleCreatePrivate = (level: Level) => {
    const n = finalName(); persistName(n);
    gameRef.current?.start({ kind: "private", level, name: n, difficulty: privateDifficulty, gameMode: privateMode });
  };
  const handleJoinCode = () => {
    const code = joinCode.trim().toUpperCase(); if (!code) return;
    const n = finalName(); persistName(n);
    gameRef.current?.start({ kind: "join", code, name: n });
  };

  const handleCopyCode = async () => {
    if (!state.roomCode) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?code=${state.roomCode}`;
    try { await navigator.clipboard.writeText(shareUrl); } catch { await navigator.clipboard.writeText(state.roomCode).catch(() => undefined); }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const handleSubmitOwner = () => {
    const pw = ownerPwInput.trim(); if (!pw) return;
    gameRef.current?.submitOwnerPassword(pw); setOwnerPwInput("");
  };
  const sendAdmin = (cmd: AdminCommand) => gameRef.current?.sendAdmin(cmd);

  const cleanedPct = state.totalTrash > 0 ? Math.round((state.collected / state.totalTrash) * 100) : 0;
  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = state.timeLeft % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const comboPct = state.combo
    ? Math.max(0, Math.min(1, (state.combo.expiresAt - performance.now()) / state.combo.windowMs))
    : 0;
  const inGame = state.status === "playing" || state.status === "waiting";

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Persistent author credit */}
      <div className="pointer-events-none absolute bottom-1 right-2 z-[60] text-[10px] text-white/70 font-semibold tracking-wide drop-shadow">
        EcoClean 3D · by Utkarsh Pandey & Nishant Amrit
      </div>

      {/* Top HUD */}
      {inGame && (
        <div className="pointer-events-none absolute top-0 left-0 right-0 p-4 flex flex-col gap-3 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="bg-white/88 backdrop-blur rounded-xl shadow-lg px-4 py-3 flex items-center gap-4 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Your Score</div>
                <div className="text-2xl font-bold text-emerald-900 tabular-nums">{state.selfScore}</div>
              </div>
              <div className="w-px h-10 bg-emerald-200" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Time</div>
                <div className={`text-2xl font-bold tabular-nums ${state.timeLeft <= 15 && state.status === "playing" ? "text-red-600 animate-pulse" : "text-emerald-900"}`}>{timeStr}</div>
              </div>
              <div className="w-px h-10 bg-emerald-200" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Map</div>
                <div className="text-base font-bold text-emerald-900 capitalize">{LEVEL_LABELS[state.level]}</div>
              </div>
              <div className="w-px h-10 bg-emerald-200" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Mode</div>
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${MODE_COLORS[state.gameMode]}`}>
                  {GAME_MODE_LABELS[state.gameMode]}
                </div>
              </div>
              <div className="w-px h-10 bg-emerald-200" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Players</div>
                <div className="text-lg font-bold text-emerald-900 tabular-nums">{state.players.length}</div>
              </div>
              {state.roomCode && (
                <>
                  <div className="w-px h-10 bg-emerald-200" />
                  <button onClick={handleCopyCode} className="pointer-events-auto text-left group hover:bg-emerald-50 rounded px-2 py-1 -mx-2 -my-1 transition" title="Copy share link">
                    <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold flex items-center gap-1">
                      {state.isPublicRoom ? "Public Room" : "Room Code"}
                      <span className="text-emerald-500 group-hover:text-emerald-700">{copied ? "✓ copied" : "📋"}</span>
                    </div>
                    <div className="text-lg font-bold text-emerald-900 tracking-widest tabular-nums">{state.roomCode}</div>
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 pointer-events-auto">
              <div className="flex gap-2 flex-wrap justify-end">
                <button onClick={() => gameRef.current?.toggleSound()} className="bg-white/85 backdrop-blur rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 shadow hover:bg-white">{state.soundOn ? "🔊" : "🔈"}</button>
                <button onClick={() => setShowSettings(true)} className="bg-white/85 backdrop-blur rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 shadow hover:bg-white" title="Settings">⚙️</button>
                <button onClick={() => setShowStats(true)} className="bg-white/85 backdrop-blur rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 shadow hover:bg-white" title="Stats">📊</button>
                {state.isOwner ? (
                  <button onClick={() => setShowOwnerPanel(true)} className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-3 py-2 text-sm font-semibold shadow" title="Owner panel">👑 Owner</button>
                ) : (
                  <button onClick={() => setShowOwnerLogin(true)} className="bg-white/85 backdrop-blur rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 shadow hover:bg-white" title="Owner login">🔐</button>
                )}
                <button onClick={() => gameRef.current?.setPaused(!state.isPaused)} className="bg-white/85 backdrop-blur rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 shadow hover:bg-white" title="Pause (ESC)">{state.isPaused ? "▶" : "⏸"}</button>
                <button onClick={() => gameRef.current?.backToMenu()} className="bg-white/85 backdrop-blur rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 shadow hover:bg-white">← Leave</button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white/85 backdrop-blur rounded-xl shadow-lg p-3 max-w-3xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
                {state.gameMode === "percent100" ? "♻️ Must collect ALL trash!" : "Environment Cleaned (team)"}
              </span>
              <span className="text-sm font-bold text-emerald-900 tabular-nums">
                {state.collected}/{state.collected + (state.totalTrash - state.collected)} ({cleanedPct}%)
              </span>
            </div>
            <div className="relative h-3 bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300" style={{ width: `${cleanedPct}%` }} />
              {state.gameMode !== "speedrun" && (
                <div className="absolute top-0 h-full w-0.5 bg-amber-500"
                  style={{ left: state.gameMode === "percent100" ? "100%" : state.difficulty === "easy" ? "60%" : state.difficulty === "hard" ? "90%" : "80%" }}
                  title="Win threshold" />
              )}
              {state.gameMode === "speedrun" && (
                <div className="absolute top-0 h-full w-0.5 bg-amber-500"
                  style={{ left: state.difficulty === "easy" ? "60%" : state.difficulty === "hard" ? "90%" : "80%" }}
                  title="Win threshold" />
              )}
            </div>
          </div>

          {/* Active power-up timers */}
          {(state.magnetMs > 0 || state.speedMs > 0 || state.godMode) && (
            <div className="flex gap-2">
              {state.magnetMs > 0 && <div className="bg-red-600/90 text-white rounded-lg px-3 py-1.5 text-sm font-semibold shadow flex items-center gap-2">🧲 Magnet · {(state.magnetMs / 1000).toFixed(1)}s</div>}
              {state.speedMs > 0 && <div className="bg-yellow-500/90 text-yellow-950 rounded-lg px-3 py-1.5 text-sm font-semibold shadow flex items-center gap-2">⚡ Speed · {(state.speedMs / 1000).toFixed(1)}s</div>}
              {state.godMode && <div className="bg-purple-600/90 text-white rounded-lg px-3 py-1.5 text-sm font-semibold shadow flex items-center gap-2">✨ God Mode</div>}
            </div>
          )}
        </div>
      )}

      {/* Mini-map — bottom-right, always visible in-game */}
      {inGame && (
        <div className="absolute bottom-24 right-4 z-10 pointer-events-none">
          <MiniMap data={state.miniMap} godMode={state.godMode} />
        </div>
      )}

      {/* Sprint stamina bar */}
      {state.status === "playing" && (
        <div className="absolute bottom-28 left-4 z-10 pointer-events-none w-44">
          <div className="bg-white/85 backdrop-blur rounded-lg p-2 shadow">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1">
              <span>Sprint (Shift)</span><span>{Math.round(state.sprintStamina * 100)}%</span>
            </div>
            <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <div className={`h-full transition-[width] duration-100 ${state.isSprinting ? "bg-amber-500" : "bg-gradient-to-r from-emerald-400 to-emerald-600"}`} style={{ width: `${state.sprintStamina * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Scoreboard */}
      {inGame && state.players.length > 0 && (
        <div className="absolute top-4 right-56 mt-44 z-10 pointer-events-none">
          <div className="bg-white/85 backdrop-blur rounded-xl shadow-lg p-3 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-2">Leaderboard</div>
            <div className="space-y-1">
              {state.players.slice(0, 8).map((p, idx) => (
                <div key={p.id} className={`flex items-center gap-2 text-sm ${p.id === state.selfId ? "font-bold" : ""}`}>
                  <span className="w-4 text-right text-xs text-gray-500 tabular-nums">{idx + 1}.</span>
                  <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 truncate text-emerald-900 flex items-center gap-1">
                    {state.mvpId === p.id && <span title="MVP">👑</span>}
                    {p.name}{p.id === state.selfId && <span className="text-emerald-600 ml-1 text-xs">(you)</span>}
                  </span>
                  <span className="tabular-nums text-emerald-900">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Educational fact */}
      {state.status === "playing" && state.fact && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 max-w-md w-[90%] pointer-events-none">
          <div className="bg-emerald-900/95 text-white rounded-xl shadow-2xl p-4 border-l-4 border-amber-400 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-xs uppercase tracking-wide text-amber-300 font-semibold mb-1">Did you know?</div>
            <div className="text-sm leading-relaxed">{state.fact}</div>
          </div>
        </div>
      )}

      {/* Pickup/powerup notices */}
      {state.status === "playing" && state.pickupNotice && (
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-blue-900/90 text-white rounded-lg shadow-lg px-3 py-2 text-sm animate-in fade-in slide-in-from-bottom-2">
            <span className="font-semibold">{state.pickupNotice.byName}</span>{" picked up "}{TRASH_LABELS[state.pickupNotice.trashType] ?? "trash"}
          </div>
        </div>
      )}
      {state.status === "playing" && state.powerUpNotice && (
        <div className="absolute bottom-56 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-amber-700/90 text-white rounded-lg shadow-lg px-3 py-2 text-sm animate-in fade-in slide-in-from-bottom-2">
            <span className="font-semibold">{state.powerUpNotice.byName}</span>{" grabbed "}
            <span>{POWERUP_EMOJIS[state.powerUpNotice.kind]}</span>{" "}{POWERUP_LABELS[state.powerUpNotice.kind]}
            {state.powerUpNotice.bonus > 0 ? ` (+${state.powerUpNotice.bonus})` : ""}
          </div>
        </div>
      )}

      {/* Combo + floating points */}
      {state.status === "playing" && (state.combo || state.floatingPoints.length > 0) && (
        <div className="absolute bottom-24 right-56 z-20 pointer-events-none flex flex-col items-end gap-2">
          {state.combo && state.combo.combo > 1 && (
            <div className="bg-amber-500/95 text-white rounded-xl shadow-lg px-4 py-2 min-w-[150px]">
              <div className="text-xs uppercase tracking-wide text-amber-100 font-semibold">Combo</div>
              <div className="text-2xl font-bold tabular-nums leading-none">{state.combo.combo}× streak</div>
              <div className="mt-1 h-1.5 bg-amber-900/40 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-[width] duration-100" style={{ width: `${comboPct * 100}%` }} />
              </div>
            </div>
          )}
          <div className="flex flex-col items-end gap-1">
            {state.floatingPoints.slice(-4).map(fp => (
              <div key={fp.id} className={`px-3 py-1 rounded-full font-bold text-sm shadow-lg animate-in slide-in-from-bottom-2 fade-in ${fp.isCombo ? "bg-amber-400 text-amber-950" : "bg-emerald-600 text-white"}`}>
                {fp.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emote bar */}
      {inGame && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
          <div className="bg-white/85 backdrop-blur rounded-xl shadow px-2 py-1.5 flex items-center gap-1">
            {EMOTES.map(e => (
              <button key={e.kind} onClick={() => gameRef.current?.sendEmote(e.kind as EmoteKind)}
                className="flex flex-col items-center justify-center w-10 h-10 rounded-lg hover:bg-emerald-100 transition"
                title={`${e.kind} (press ${e.key})`}>
                <span className="text-xl leading-none">{e.emoji}</span>
                <span className="text-[9px] text-emerald-700 font-semibold leading-none mt-0.5">{e.key}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls helper */}
      {state.status === "playing" && !state.isPaused && (
        <div className="absolute bottom-20 left-4 z-10 pointer-events-none">
          <div className="bg-black/65 backdrop-blur rounded-lg shadow px-3 py-2 text-xs text-white/90">
            <div className="font-semibold mb-1 text-white">Controls</div>
            <div>WASD / Arrows — Move</div>
            <div>Shift — Sprint</div>
            <div>Mouse — Look around</div>
            <div>Walk over trash / power-ups</div>
            <div>1–5 — Emote</div>
            <div>P — Admin panel</div>
            <div>ESC — Pause</div>
          </div>
        </div>
      )}

      {/* ── PAUSE MENU ────────────────────────────── */}
      {state.isPaused && state.status === "playing" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-3">⏸</div>
            <h2 className="text-2xl font-bold text-emerald-900 mb-1">Game Paused</h2>
            <p className="text-sm text-gray-600 mb-1">Other players keep playing. Your progress is saved.</p>
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${MODE_COLORS[state.gameMode]}`}>{GAME_MODE_LABELS[state.gameMode]}</span>
              <span className="text-xs text-gray-500">{LEVEL_LABELS[state.level]}</span>
            </div>
            <div className="space-y-2">
              <button onClick={() => gameRef.current?.setPaused(false)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition">
                ▶ Resume
              </button>
              <button onClick={() => { gameRef.current?.setPaused(false); setShowSettings(true); }} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg shadow transition">
                ⚙️ Settings
              </button>
              <button onClick={() => { gameRef.current?.setPaused(false); setShowStats(true); }} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg shadow transition">
                📊 Stats
              </button>
              <button onClick={() => { gameRef.current?.setPaused(false); gameRef.current?.backToMenu(); }} className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg shadow transition">
                ← Leave Game
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-4">Press ESC to resume</p>
          </div>
        </div>
      )}

      {/* Round-end overlay */}
      {state.status === "waiting" && state.lastResult && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-[90%] text-center">
            <div className="text-5xl mb-2">{state.lastResult.result === "won" ? "🎉" : "⏰"}</div>
            <h2 className={`text-2xl font-bold mb-1 ${state.lastResult.result === "won" ? "text-emerald-700" : "text-red-600"}`}>
              {state.lastResult.result === "won" ? "Environment Cleaned!" : "Time's Up!"}
            </h2>
            <p className="text-gray-700 text-sm mb-4">The team cleaned <strong>{state.lastResult.cleanedPct}%</strong> of the area.</p>
            <div className="text-left bg-emerald-50 rounded-lg p-3 mb-4">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-2">Final standings</div>
              {state.lastResult.scores.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 text-sm py-0.5">
                  <span className="w-5 text-right text-xs text-gray-500 tabular-nums">{i + 1}.</span>
                  <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 truncate text-emerald-900 flex items-center gap-1">
                    {i === 0 && state.lastResult!.scores.length > 1 && <span title="MVP">👑</span>}
                    {s.name}
                  </span>
                  <span className="tabular-nums font-semibold text-emerald-900">{s.score}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-emerald-700">Next round starting soon… hang tight!</p>
            <p className="text-[10px] text-emerald-600 mt-3 italic">EcoClean 3D — Created by Utkarsh Pandey and Nishant Amrit</p>
          </div>
        </div>
      )}

      {/* Settings overlay */}
      {showSettings && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-[90%]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-emerald-900">⚙️ Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-emerald-700 text-2xl leading-none px-2 hover:bg-emerald-50 rounded">×</button>
            </div>
            <div className="space-y-4">
              {[
                { label: "🎵 Music", value: state.musicVolume, fn: (v: number) => gameRef.current?.setMusicVolume(v), max: 1 },
                { label: "🔊 Sound effects", value: state.sfxVolume, fn: (v: number) => gameRef.current?.setSfxVolume(v), max: 1 },
              ].map(s => (
                <label key={s.label} className="block">
                  <div className="flex justify-between text-sm font-semibold text-emerald-900 mb-1">
                    <span>{s.label}</span><span className="tabular-nums">{Math.round(s.value * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={s.max} step={0.05} value={s.value} onChange={e => s.fn(parseFloat(e.target.value))} className="w-full" />
                </label>
              ))}
              <label className="block">
                <div className="flex justify-between text-sm font-semibold text-emerald-900 mb-1">
                  <span>🖱️ Mouse sensitivity</span><span className="tabular-nums">{state.mouseSensitivity.toFixed(2)}×</span>
                </div>
                <input type="range" min={0.25} max={2.5} step={0.05} value={state.mouseSensitivity} onChange={e => gameRef.current?.setMouseSensitivity(parseFloat(e.target.value))} className="w-full" />
              </label>
              <button onClick={() => gameRef.current?.toggleSound()} className={`w-full py-2 rounded-lg font-semibold text-white shadow ${state.soundOn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-500 hover:bg-gray-600"}`}>
                {state.soundOn ? "🔊 Sound is On" : "🔈 Sound is Off"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats overlay */}
      {showStats && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowStats(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-[90%]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-emerald-900">📊 Stats</h2>
              <button onClick={() => setShowStats(false)} className="text-emerald-700 text-2xl leading-none px-2 hover:bg-emerald-50 rounded">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-emerald-50 rounded-lg p-3"><div className="text-2xl font-bold text-emerald-900">{state.stats.trashCleaned}</div><div className="text-xs text-emerald-700 uppercase tracking-wide">Trash cleaned</div></div>
              <div className="bg-amber-50 rounded-lg p-3"><div className="text-2xl font-bold text-amber-900">{state.stats.powerUpsCollected}</div><div className="text-xs text-amber-700 uppercase tracking-wide">Power-ups</div></div>
              <div className="bg-rose-50 rounded-lg p-3"><div className="text-2xl font-bold text-rose-900">{state.stats.bestCombo}×</div><div className="text-xs text-rose-700 uppercase tracking-wide">Best combo</div></div>
              <div className="bg-sky-50 rounded-lg p-3"><div className="text-2xl font-bold text-sky-900">{state.stats.pointsEarned}</div><div className="text-xs text-sky-700 uppercase tracking-wide">Points</div></div>
            </div>
          </div>
        </div>
      )}

      {/* Owner login */}
      {showOwnerLogin && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowOwnerLogin(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-[90%]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-purple-900">🔐 Owner Sign-in</h2>
              <button onClick={() => setShowOwnerLogin(false)} className="text-purple-700 text-2xl leading-none px-2 hover:bg-purple-50 rounded">×</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Passwords: <b>Slayers</b> (power-ups only) or <b>PVP_PROPLE</b> (full owner controls).</p>
            <input type="password" value={ownerPwInput} onChange={e => setOwnerPwInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { handleSubmitOwner(); setShowOwnerLogin(false); } }}
              placeholder="Owner password" autoFocus
              className="w-full border-2 border-purple-200 focus:border-purple-500 focus:outline-none rounded-lg px-3 py-2 text-purple-900 mb-3" />
            {state.ownerStatus && !state.ownerStatus.ok && (
              <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{state.ownerStatus.message}</div>
            )}
            <button onClick={() => { handleSubmitOwner(); setShowOwnerLogin(false); }} disabled={!ownerPwInput.trim()}
              className="w-full py-2 rounded-lg font-semibold text-white shadow bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300">
              Unlock Owner Mode
            </button>
          </div>
        </div>
      )}

      {/* Owner panel */}
      {showOwnerPanel && state.isOwner && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowOwnerPanel(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-[92%] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-purple-900">👑 Owner Panel</h2>
              <button onClick={() => setShowOwnerPanel(false)} className="text-purple-700 text-2xl leading-none px-2 hover:bg-purple-50 rounded">×</button>
            </div>
            {state.ownerStatus?.ok && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{state.ownerStatus.message}</div>}
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-purple-700 font-semibold mb-2">Round</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => sendAdmin({ kind: "endRound", result: "won" })} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded shadow">End round (Win)</button>
                <button onClick={() => sendAdmin({ kind: "endRound", result: "lost" })} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 rounded shadow">End round (Lose)</button>
                <button onClick={() => sendAdmin({ kind: "startRound" })} className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded shadow">Start new round</button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="number" min={5} max={600} value={adminTimerInput} onChange={e => setAdminTimerInput(e.target.value)}
                  className="border-2 border-purple-200 focus:border-purple-500 focus:outline-none rounded px-2 py-1 w-24 text-purple-900" />
                <button onClick={() => sendAdmin({ kind: "setTimer", seconds: parseInt(adminTimerInput, 10) || 60 })}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-1.5 rounded shadow">Set timer (sec)</button>
              </div>
            </div>
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-purple-700 font-semibold mb-2">Spawn</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={() => sendAdmin({ kind: "spawnTrash", count: 10 })} className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2 rounded shadow">+10 trash</button>
                <button onClick={() => sendAdmin({ kind: "spawnTrash", count: 20 })} className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2 rounded shadow">+20 trash</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {POWERUP_KINDS.map(k => (
                  <button key={k} onClick={() => sendAdmin({ kind: "spawnPowerUp", powerUp: k })} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold py-2 rounded shadow">
                    {POWERUP_EMOJIS[k]} {POWERUP_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>
            {state.players.filter(p => p.id !== state.selfId).length > 0 && (
              <div className="mb-4">
                <div className="text-xs uppercase tracking-wide text-purple-700 font-semibold mb-2">Players</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {state.players.filter(p => p.id !== state.selfId).map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-sm bg-purple-50 rounded px-2 py-1">
                      <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="flex-1 truncate text-purple-900">{p.name}</span>
                      <button onClick={() => sendAdmin({ kind: "kick", playerId: p.id })} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-2 py-1 rounded">Kick</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-purple-700 font-semibold mb-2">Local</div>
              <button onClick={() => gameRef.current?.setGodMode(!state.godMode)} className={`w-full py-2 rounded font-semibold text-white shadow ${state.godMode ? "bg-purple-700 hover:bg-purple-800" : "bg-gray-500 hover:bg-gray-600"}`}>
                {state.godMode ? "✨ God Mode: ON" : "God Mode: OFF"}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 text-center">Owner commands are gated by password on the server.</p>
          </div>
        </div>
      )}

      {/* Connecting */}
      {state.status === "connecting" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-sky-400/40 to-emerald-700/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-[90%] text-center">
            <div className="text-4xl mb-3 animate-spin">🌍</div>
            <h2 className="text-xl font-bold text-emerald-900 mb-1">Connecting…</h2>
            <p className="text-sm text-gray-600">Joining the {LEVEL_LABELS[state.level]} cleanup crew.</p>
          </div>
        </div>
      )}

      {/* Disconnected */}
      {state.status === "disconnected" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-[90%] text-center">
            <div className="text-5xl mb-3">📡</div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Disconnected</h2>
            <p className="text-gray-700 mb-4">Lost connection to the server. Check your internet and try again.</p>
            <button onClick={() => gameRef.current?.backToMenu()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg shadow transition">Back to Menu</button>
          </div>
        </div>
      )}

      {/* ── MAIN MENU ─────────────────────────────── */}
      {state.status === "menu" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-sky-400/40 to-emerald-700/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center my-auto">
            <div className="text-5xl mb-2">🌍</div>
            <h1 className="text-3xl font-bold text-emerald-900 mb-1">EcoClean 3D</h1>
            <p className="text-emerald-800 mb-1">Multiplayer cleanup. One world. One team.</p>
            <p className="text-sm text-emerald-700 mb-4">Pick a game mode, choose your map, and clean up together!</p>

            {state.errorMessage && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 text-left">⚠️ {state.errorMessage}</div>
            )}

            {/* Player name */}
            <div className="mb-4 text-left">
              <label htmlFor="player-name" className="block text-xs uppercase tracking-wide text-emerald-700 font-semibold mb-1">Your name</label>
              <input id="player-name" type="text" value={name} onChange={e => setName(e.target.value)} maxLength={18} placeholder="Enter your name"
                className="w-full border-2 border-emerald-200 focus:border-emerald-500 focus:outline-none rounded-lg px-3 py-2 text-emerald-900" />
            </div>

            {/* ── LOBBY FLOW: mode → map ── */}
            {lobbyStep === null && (
              <>
                {/* Quick join public */}
                <div className="text-left mb-4">
                  <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold mb-2">Join a public room</div>
                  <button onClick={() => setLobbyStep("mode")}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg shadow transition flex items-center justify-center gap-2">
                    <span>🎮 Select Game Mode + Map</span>
                    <span className="text-emerald-200 text-sm">→</span>
                  </button>
                </div>

                {/* Join with code */}
                <div className="text-left mb-4 bg-sky-50 rounded-lg p-3">
                  <div className="text-xs uppercase tracking-wide text-sky-800 font-semibold mb-2">Join with a room code</div>
                  <div className="flex gap-2">
                    <input type="text" value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 10))}
                      onKeyDown={e => { if (e.key === "Enter") handleJoinCode(); }}
                      placeholder="ROOM-CODE" className="flex-1 border-2 border-sky-200 focus:border-sky-500 focus:outline-none rounded-lg px-3 py-2 text-sky-900 font-bold tracking-widest tabular-nums uppercase" />
                    <button onClick={handleJoinCode} disabled={!joinCode.trim()}
                      className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white font-semibold px-4 rounded-lg shadow transition">Join</button>
                  </div>
                </div>

                {/* Private room */}
                <div className="text-left mb-4 bg-amber-50 rounded-lg p-3">
                  <button onClick={() => setShowPrivate(v => !v)} className="w-full flex items-center justify-between text-xs uppercase tracking-wide text-amber-800 font-semibold">
                    <span>🔒 Create a private room</span>
                    <span className="text-base">{showPrivate ? "−" : "+"}</span>
                  </button>
                  {showPrivate && (
                    <>
                      <p className="text-xs text-amber-800 mt-2 mb-2">A new code will be generated. Share it with friends to join the same room.</p>

                      <div className="text-[10px] uppercase tracking-wide text-amber-800 font-semibold mb-1 mt-2">Game Mode</div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {(["speedrun", "percent100", "powerup"] as const).map(m => (
                          <button key={m} onClick={() => setPrivateMode(m)}
                            className={`text-xs font-bold py-2 px-1 rounded-lg shadow transition ${privateMode === m ? `${MODE_COLORS[m]} text-white` : "bg-white text-gray-700 hover:bg-gray-100"}`}>
                            {GAME_MODE_LABELS[m]}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-amber-700 mb-2 italic">{GAME_MODE_DESCRIPTIONS[privateMode]}</p>

                      <div className="text-[10px] uppercase tracking-wide text-amber-800 font-semibold mb-1">Difficulty</div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {(["easy", "normal", "hard"] as const).map(d => (
                          <button key={d} onClick={() => setPrivateDifficulty(d)}
                            className={`text-sm font-semibold py-2 rounded shadow transition ${privateDifficulty === d ? "bg-amber-600 text-white" : "bg-white text-amber-900 hover:bg-amber-100"}`}>
                            {DIFFICULTY_LABELS[d]}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-amber-700 mb-2 italic">{DIFFICULTY_BLURBS[privateDifficulty]}</p>

                      <div className="text-[10px] uppercase tracking-wide text-amber-800 font-semibold mb-1">Choose Map</div>
                      <div className="grid grid-cols-3 gap-2">
                        {ALL_LEVELS.map(lvl => (
                          <button key={lvl} onClick={() => handleCreatePrivate(lvl)}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-2 rounded-lg shadow transition">
                            {LEVEL_LABELS[lvl]}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Tips */}
                <div className="text-xs text-emerald-700 space-y-1 text-left bg-emerald-50 rounded-lg p-3 mb-3">
                  <div>♻️ <strong>+10 pts</strong> per trash · combo multiplier for fast pickups</div>
                  <div>🧲⚡⭐ <strong>Power-ups</strong> spawn mid-round — grab them fast</div>
                  <div>🏃 <strong>Shift</strong> to sprint · 1–5 to emote · ESC to pause</div>
                  <div>👑 Top scorer wears the <strong>MVP crown</strong></div>
                </div>

                <div className="mt-1 flex gap-2 justify-center">
                  <button onClick={() => setShowSettings(true)} className="text-xs text-emerald-700 hover:text-emerald-900 underline">⚙️ Settings</button>
                  <span className="text-emerald-300">·</span>
                  <button onClick={() => setShowOwnerLogin(true)} className="text-xs text-purple-700 hover:text-purple-900 underline">🔐 Owner sign-in</button>
                </div>
                <p className="text-[11px] text-emerald-600 mt-4 italic">Created by Utkarsh Pandey and Nishant Amrit</p>
              </>
            )}

            {/* Step 1: Pick game mode */}
            {lobbyStep === "mode" && (
              <div className="text-left animate-in fade-in">
                <button onClick={() => setLobbyStep(null)} className="text-xs text-emerald-600 hover:text-emerald-800 mb-3 flex items-center gap-1">← Back</button>
                <h2 className="text-lg font-bold text-emerald-900 mb-4 text-center">Choose Game Mode</h2>
                <div className="space-y-3">
                  {(["speedrun", "percent100", "powerup"] as const).map(m => (
                    <button key={m} onClick={() => { setLobbyMode(m); setLobbyStep("map"); }}
                      className={`w-full rounded-xl p-4 text-left shadow-md border-2 transition hover:scale-[1.01] ${lobbyMode === m ? "border-emerald-500 bg-emerald-50" : "border-gray-100 bg-white hover:border-emerald-300"}`}>
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${MODE_COLORS[m]}`}>{GAME_MODE_LABELS[m]}</span>
                      </div>
                      <p className="text-sm text-gray-600 leading-snug">{GAME_MODE_DESCRIPTIONS[m]}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Pick map */}
            {lobbyStep === "map" && lobbyMode && (
              <div className="text-left animate-in fade-in">
                <button onClick={() => setLobbyStep("mode")} className="text-xs text-emerald-600 hover:text-emerald-800 mb-3 flex items-center gap-1">← Back</button>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-emerald-900">Choose Map</h2>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${MODE_COLORS[lobbyMode]}`}>{GAME_MODE_LABELS[lobbyMode]}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {ALL_LEVELS.map(lvl => {
                    const desc: Record<Level, string> = {
                      park: "Lush green park with trees & flowers",
                      beach: "Sandy shore with palm trees & ocean",
                      city: "Busy urban streets & tall buildings",
                      nightcity: "Neon-lit cyberpunk city at night",
                      arctic: "Frozen tundra with ice & blizzards",
                      jungle: "Dense tropical rainforest with mist",
                    };
                    return (
                      <button key={lvl} onClick={() => handleJoinPublic(lvl)}
                        className="rounded-xl p-3 text-left shadow border-2 border-gray-100 hover:border-emerald-400 bg-white hover:bg-emerald-50 transition hover:scale-[1.01]">
                        <div className="text-xl mb-0.5">{LEVEL_LABELS[lvl].split(" ")[0]}</div>
                        <div className="text-sm font-bold text-emerald-900">{LEVEL_LABELS[lvl].slice(LEVEL_LABELS[lvl].indexOf(" ") + 1)}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{desc[lvl]}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unsupported */}
      {state.status === "unsupported" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-sky-400/40 to-emerald-700/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-[90%] text-center">
            <div className="text-5xl mb-3">🌐</div>
            <h2 className="text-2xl font-bold text-emerald-900 mb-2">WebGL not available</h2>
            <p className="text-gray-700">This 3D game needs a WebGL-capable browser. Try Chrome, Firefox, Edge, or Safari.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
