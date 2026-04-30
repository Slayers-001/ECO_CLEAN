/**
 * EcoClean 3D — Multiplayer Three.js client v2
 * New: 6 maps, 3 game modes, ESC pause menu, per-mode HUD, ambient FX.
 */

import * as THREE from "three";

export type Level = "park" | "beach" | "city" | "nightcity" | "arctic" | "jungle";
export type GameMode = "speedrun" | "percent100" | "powerup";
export type Difficulty = "easy" | "normal" | "hard";
export type GameStatus =
  | "menu" | "connecting" | "playing" | "waiting" | "disconnected" | "unsupported";
export type TrashType = "plastic" | "metal" | "organic" | "paper";
export type EmoteKind = "wave" | "thumbsup" | "recycle" | "smile" | "cheer";
export type PowerUpKind = "magnet" | "speed" | "bonus";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };
export const GAME_MODE_LABELS: Record<GameMode, string> = {
  speedrun: "⚡ Speedrun",
  percent100: "♻️ 100% Clean",
  powerup: "⭐ Power-Up Party",
};
export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  speedrun: "Race the clock — collect as much trash as possible before time runs out!",
  percent100: "Team goal: collect EVERY piece of trash on the map. More time, total clean!",
  powerup: "Power-ups spawn every few seconds — grab them all and blitz the trash!",
};
export const LEVEL_LABELS: Record<Level, string> = {
  park: "🌳 Park",
  beach: "🏖️ Beach",
  city: "🏙️ City",
  nightcity: "🌃 Night City",
  arctic: "❄️ Arctic",
  jungle: "🌿 Jungle",
};
export const POWERUP_LABELS: Record<PowerUpKind, string> = { magnet: "Magnet", speed: "Speed Boost", bonus: "Bonus +50" };
export const POWERUP_EMOJIS: Record<PowerUpKind, string> = { magnet: "🧲", speed: "⚡", bonus: "⭐" };

export type AdminCommand =
  | { kind: "endRound"; result: "won" | "lost" }
  | { kind: "spawnTrash"; count: number }
  | { kind: "spawnPowerUp"; powerUp: PowerUpKind }
  | { kind: "kick"; playerId: string }
  | { kind: "setTimer"; seconds: number };

export interface MiniMapData {
  worldHalf: number; selfX: number; selfZ: number;
  others: { id: string; x: number; z: number; color: string }[];
  trash: { x: number; z: number }[];
  powerUps: { x: number; z: number; kind: PowerUpKind }[];
}

export interface SessionStats {
  trashCleaned: number; powerUpsCollected: number; bestCombo: number; pointsEarned: number;
}

export const EMOTES: { kind: EmoteKind; emoji: string; key: string }[] = [
  { kind: "wave", emoji: "👋", key: "1" },
  { kind: "thumbsup", emoji: "👍", key: "2" },
  { kind: "recycle", emoji: "♻️", key: "3" },
  { kind: "smile", emoji: "😊", key: "4" },
  { kind: "cheer", emoji: "🎉", key: "5" },
];

export interface PlayerInfo { id: string; name: string; color: string; score: number; }

export interface RoundResult {
  result: "won" | "lost"; cleanedPct: number; scores: PlayerInfo[];
  restartIn: number; mvpId: string | null;
}

export interface ComboState { combo: number; expiresAt: number; windowMs: number; }
export interface FloatingPoint { id: number; text: string; isCombo: boolean; }

export interface GameState {
  status: GameStatus;
  level: Level;
  gameMode: GameMode;
  difficulty: Difficulty;
  roundDuration: number;
  selfId: string | null; selfName: string; selfScore: number;
  timeLeft: number; totalTrash: number; collected: number;
  players: PlayerInfo[]; fact: string | null; lastResult: RoundResult | null;
  soundOn: boolean; musicVolume: number; sfxVolume: number; mouseSensitivity: number;
  pickupNotice: { byName: string; trashType: TrashType } | null;
  powerUpNotice: { byName: string; kind: PowerUpKind; bonus: number } | null;
  combo: ComboState | null; mvpId: string | null; floatingPoints: FloatingPoint[];
  roomCode: string | null; isPublicRoom: boolean; errorMessage: string | null;
  sprintStamina: number; isSprinting: boolean; magnetMs: number; speedMs: number;
  miniMap: MiniMapData;
  isOwner: boolean; ownerStatus: { ok: boolean; message: string } | null; godMode: boolean;
  stats: SessionStats;
  isPaused: boolean;
}

export type StartOpts =
  | { kind: "public"; level: Level; name: string; gameMode: GameMode }
  | { kind: "private"; level: Level; name: string; difficulty: Difficulty; gameMode: GameMode }
  | { kind: "join"; code: string; name: string };

export interface GameHandle {
  start: (opts: StartOpts) => void;
  backToMenu: () => void;
  toggleSound: () => void;
  sendEmote: (kind: EmoteKind) => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMouseSensitivity: (v: number) => void;
  submitOwnerPassword: (password: string) => void;
  sendAdmin: (cmd: AdminCommand) => void;
  setGodMode: (on: boolean) => void;
  setPaused: (p: boolean) => void;
  dispose: () => void;
}

// ---- Eco facts per trash type ----
const FACTS: Record<TrashType, string[]> = {
  plastic: [
    "Plastic bottles take over 450 years to decompose in landfills.",
    "Around 8 million tonnes of plastic enter the oceans every year.",
    "Recycling one plastic bottle saves enough energy to power a lightbulb for 3 hours.",
  ],
  metal: [
    "Aluminum cans can be recycled infinitely without losing quality.",
    "Recycling one aluminum can saves enough energy to run a TV for 3 hours.",
    "It takes 95% less energy to recycle aluminum than to make it from raw ore.",
  ],
  organic: [
    "Organic waste in landfills produces methane — a gas 25× more potent than CO₂.",
    "Composting food scraps reduces landfill waste by up to 30%.",
  ],
  paper: [
    "Recycling one tonne of paper saves 17 trees and 26,000 liters of water.",
    "Paper can be recycled up to 7 times before the fibers become too short.",
  ],
};

const TRASH_PARTICLE_COLORS: Record<TrashType, number> = {
  plastic: 0x88ccee, metal: 0xff6666, paper: 0xf5f5dc, organic: 0x66cc66,
};

const PLAYER_SPEED = 8;
const SPRINT_MULTIPLIER = 1.4;
const SPEED_POWERUP_MULTIPLIER = 1.7;
const STAMINA_DRAIN_PER_SEC = 0.5;
const STAMINA_REGEN_PER_SEC = 0.35;
const COLLECT_RADIUS = 1.4;
const PLAYER_RADIUS = 0.6;
const POWERUP_PICKUP_RADIUS = 1.6;
const MAGNET_RADIUS = 6;
const MAGNET_PULL_PER_SEC = 8;
const WORLD_HALF = 28;
const MOVE_SEND_HZ = 12;
const FOOTSTEP_INTERVAL = 0.38;

interface RemotePlayer {
  info: PlayerInfo; mesh: THREE.Group; targetX: number; targetZ: number; targetRot: number; nameSprite: THREE.Sprite;
}
interface TrashObject { id: string; type: TrashType; mesh: THREE.Group; pendingCollect: boolean; bobPhase: number; }
interface PowerUpObject { id: string; kind: PowerUpKind; mesh: THREE.Group; pendingCollect: boolean; bobPhase: number; light: THREE.PointLight; }
type SerializedPowerUp = { id: string; kind: PowerUpKind; x: number; z: number; expiresAt: number };
type Particle = { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number };
type AmbientParticle = { mesh: THREE.Mesh; vx: number; vy: number; vz: number; rotSpeed: number; life: number; maxLife: number };
type EmoteSpriteEntry = { sprite: THREE.Sprite; target: THREE.Object3D; life: number; maxLife: number };
type Collider = { x: number; z: number; r: number };

type ServerToClient =
  | {
      type: "init"; selfId: string; level: Level; difficulty: Difficulty; gameMode: GameMode;
      code: string; isPublic: boolean; roundId: number; timeLeft: number; roundDuration: number;
      winThreshold: number; status: "playing" | "ended";
      players: { id: string; name: string; color: string; x: number; z: number; rot: number; score: number }[];
      trash: { id: string; type: TrashType; x: number; z: number }[];
      powerUps: SerializedPowerUp[]; mvpId: string | null;
    }
  | { type: "playerJoined"; player: { id: string; name: string; color: string; x: number; z: number; rot: number; score: number } }
  | { type: "playerLeft"; id: string }
  | { type: "positions"; players: { id: string; x: number; z: number; rot: number }[] }
  | {
      type: "trashCollected"; trashId: string; trashType: TrashType; byId: string; byName: string;
      score: number; pointsGained: number; combo: number; comboExpiresInMs: number; totalCollected: number;
    }
  | {
      type: "roundEnd"; result: "won" | "lost"; cleanedPct: number;
      scores: { id: string; name: string; color: string; score: number }[];
      mvpId: string | null; restartIn: number;
    }
  | {
      type: "roundStart"; roundId: number; trash: { id: string; type: TrashType; x: number; z: number }[];
      powerUps: SerializedPowerUp[]; timeLeft: number; roundDuration: number; mvpId: string | null; gameMode?: GameMode;
    }
  | { type: "powerUpSpawned"; powerUp: SerializedPowerUp }
  | {
      type: "powerUpCollected"; powerUpId: string; kind: PowerUpKind; byId: string; byName: string;
      score: number; effectMs: number; bonusPoints: number;
    }
  | { type: "powerUpExpired"; powerUpId: string }
  | { type: "emote"; playerId: string; kind: EmoteKind }
  | { type: "kicked"; reason: string }
  | { type: "adminAck"; ok: boolean; message: string }
  | { type: "error"; message: string };

export function startGame(mount: HTMLElement, onState: (state: GameState) => void): GameHandle {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    console.warn("WebGL not available.", err);
    onState({ status: "unsupported", level: "park", gameMode: "speedrun", difficulty: "normal", roundDuration: 120,
      selfId: null, selfName: "", selfScore: 0, timeLeft: 0, totalTrash: 0, collected: 0, players: [],
      fact: null, lastResult: null, soundOn: true, musicVolume: 0.5, sfxVolume: 0.7, mouseSensitivity: 1.0,
      pickupNotice: null, powerUpNotice: null, combo: null, mvpId: null, floatingPoints: [],
      roomCode: null, isPublicRoom: false, errorMessage: null, sprintStamina: 1, isSprinting: false,
      magnetMs: 0, speedMs: 0, miniMap: { worldHalf: WORLD_HALF, selfX: 0, selfZ: 0, others: [], trash: [], powerUps: [] },
      isOwner: false, ownerStatus: null, godMode: false, stats: { trashCleaned: 0, powerUpsCollected: 0, bestCombo: 0, pointsEarned: 0 },
      isPaused: false,
    });
    return {
      start: () => undefined, backToMenu: () => undefined, toggleSound: () => undefined,
      sendEmote: () => undefined, setMusicVolume: () => undefined, setSfxVolume: () => undefined,
      setMouseSensitivity: () => undefined, submitOwnerPassword: () => undefined,
      sendAdmin: () => undefined, setGodMode: () => undefined, setPaused: () => undefined, dispose: () => undefined,
    };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 30, 90);
  const camera = new THREE.PerspectiveCamera(65, mount.clientWidth / mount.clientHeight, 0.1, 200);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(20, 30, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
  scene.add(sun);
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x44aa44, 0.35);
  scene.add(hemiLight);

  // ---- Mutable state ----
  let level: Level = "park";
  let gameMode: GameMode = "speedrun";
  let difficulty: Difficulty = "normal";
  let roundDuration = 120;
  let status: GameStatus = "menu";
  let selfId: string | null = null;
  let selfName = "";
  let selfScore = 0;
  let timeLeft = 0;
  let totalTrash = 0;
  let collected = 0;
  let players: PlayerInfo[] = [];
  let fact: string | null = null;
  let factTimer = 0;
  let lastResult: RoundResult | null = null;
  let soundOn = true;
  let musicVolume = 0.5;
  let sfxVolume = 0.7;
  let mouseSensitivity = 1.0;
  let pickupNotice: { byName: string; trashType: TrashType } | null = null;
  let pickupNoticeTimer = 0;
  let powerUpNotice: { byName: string; kind: PowerUpKind; bonus: number } | null = null;
  let powerUpNoticeTimer = 0;
  let combo: ComboState | null = null;
  let mvpId: string | null = null;
  let floatingPoints: FloatingPoint[] = [];
  let nextFpId = 1;
  let roomCode: string | null = null;
  let isPublicRoom = false;
  let errorMessage: string | null = null;
  let sprintStamina = 1.0;
  let isSprinting = false;
  let magnetMs = 0;
  let speedMs = 0;
  let isOwner = false;
  let ownerPassword: string | null = null;
  let ownerStatus: { ok: boolean; message: string } | null = null;
  let godMode = false;
  let isPaused = false;
  const stats: SessionStats = { trashCleaned: 0, powerUpsCollected: 0, bestCombo: 0, pointsEarned: 0 };

  let shakeIntensity = 0; let shakeTimer = 0;
  const cameraShakeOffset = new THREE.Vector3();
  let footstepTimer = 0; let lastTimerWarning = -1;
  let lastEmitTime = -1;

  const ambientParticles: AmbientParticle[] = [];
  let ambientSpawnTimer = 0;
  const AMBIENT_MAX = 35; const AMBIENT_SPAWN_INTERVAL = 0.18;
  const treeLeafMeshes: THREE.Mesh[] = [];
  const trashGlowRings: THREE.Mesh[] = [];
  let colliders: Collider[] = [];
  const particles: Particle[] = [];
  const emoteSprites: EmoteSpriteEntry[] = [];
  let mvpCrown: { sprite: THREE.Sprite; targetId: string } | null = null;

  const trashItems = new Map<string, TrashObject>();
  const remotePlayers = new Map<string, RemotePlayer>();
  const sceneryGroup = new THREE.Group(); scene.add(sceneryGroup);
  const playersGroup = new THREE.Group(); scene.add(playersGroup);
  const trashGroup = new THREE.Group(); scene.add(trashGroup);
  const ambientGroup = new THREE.Group(); scene.add(ambientGroup);
  const powerUpItems = new Map<string, PowerUpObject>();
  const powerUpGroup = new THREE.Group(); scene.add(powerUpGroup);
  const player = createCharacter(0x2e7d32, true); scene.add(player);

  // ---- Audio ----
  let audioCtx: AudioContext | null = null;
  let musicGain: GainNode | null = null;
  let musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  function ensureAudio() {
    if (audioCtx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return; audioCtx = new Ctx();
  }
  function sfxScale(peak: number) { return Math.max(0.0001, peak * sfxVolume); }

  function playCollectSound() {
    if (!soundOn) return; ensureAudio(); if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = "triangle"; osc.frequency.setValueAtTime(660, t0); osc.frequency.exponentialRampToValueAtTime(990, t0 + 0.12);
    gain.gain.setValueAtTime(0.0001, t0); gain.gain.exponentialRampToValueAtTime(sfxScale(0.25), t0 + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.connect(gain).connect(audioCtx.destination); osc.start(t0); osc.stop(t0 + 0.3);
  }
  function playRemoteCollectSound() {
    if (!soundOn) return; ensureAudio(); if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = "sine"; osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, t0); gain.gain.exponentialRampToValueAtTime(sfxScale(0.06), t0 + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain).connect(audioCtx.destination); osc.start(t0); osc.stop(t0 + 0.2);
  }
  function playPowerUpSound(kind: PowerUpKind) {
    if (!soundOn) return; ensureAudio(); if (!audioCtx) return;
    const notes = kind === "magnet" ? [523,659,784] : kind === "speed" ? [880,988,1175] : [659,988,1319];
    notes.forEach((freq, i) => {
      const t0 = audioCtx!.currentTime + i * 0.07;
      const osc = audioCtx!.createOscillator(); const g = audioCtx!.createGain();
      osc.type = "triangle"; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(sfxScale(0.18), t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      osc.connect(g).connect(audioCtx!.destination); osc.start(t0); osc.stop(t0 + 0.25);
    });
  }
  function playEndSound(win: boolean) {
    if (!soundOn) return; ensureAudio(); if (!audioCtx) return;
    const notes = win ? [523,659,784,1047] : [330,262,196];
    notes.forEach((freq, i) => {
      const t0 = audioCtx!.currentTime + i * 0.18;
      const osc = audioCtx!.createOscillator(); const g = audioCtx!.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(sfxScale(0.3), t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      osc.connect(g).connect(audioCtx!.destination); osc.start(t0); osc.stop(t0 + 0.45);
    });
  }
  function playFootstep() {
    if (!soundOn) return; ensureAudio(); if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(120, t0); osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.08);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(sfxScale(0.06), t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(g).connect(audioCtx.destination); osc.start(t0); osc.stop(t0 + 0.15);
  }
  function playTimerTick() {
    if (!soundOn) return; ensureAudio(); if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
    osc.type = "square"; osc.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(sfxScale(0.07), t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    osc.connect(g).connect(audioCtx.destination); osc.start(t0); osc.stop(t0 + 0.07);
  }
  function playComboFanfare(comboCount: number) {
    if (!soundOn || comboCount < 3) return; ensureAudio(); if (!audioCtx) return;
    const base = 440 + (comboCount - 3) * 55;
    [base, base * 1.25, base * 1.5].forEach((freq, i) => {
      const t0 = audioCtx!.currentTime + i * 0.055;
      const osc = audioCtx!.createOscillator(); const g = audioCtx!.createGain();
      osc.type = "triangle"; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(sfxScale(0.12), t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
      osc.connect(g).connect(audioCtx!.destination); osc.start(t0); osc.stop(t0 + 0.18);
    });
  }
  function startMusic() {
    if (!soundOn) return; ensureAudio(); if (!audioCtx || musicGain) return;
    musicGain = audioCtx.createGain(); musicGain.gain.value = 0.08 * musicVolume; musicGain.connect(audioCtx.destination);
    const parkNotes = [196,220,247,220]; const beachNotes = [220,247,294,247];
    const cityNotes = [165,185,196,185]; const nightNotes = [110,138,155,138];
    const arcticNotes = [174,207,220,207]; const jungleNotes = [146,165,196,165];
    const noteMap: Record<Level, number[]> = { park: parkNotes, beach: beachNotes, city: cityNotes, nightcity: nightNotes, arctic: arcticNotes, jungle: jungleNotes };
    const baseNotes = noteMap[level];
    const nd = level === "nightcity" ? 0.6 : level === "city" ? 0.75 : 0.9;
    const startLoop = (notes: number[], type: OscillatorType, vol: number) => {
      const osc = audioCtx!.createOscillator(); const g = audioCtx!.createGain();
      osc.type = type; g.gain.value = vol; osc.connect(g).connect(musicGain!);
      const t0 = audioCtx!.currentTime + 0.05;
      notes.forEach((n, i) => { for (let c = 0; c < 200; c++) osc.frequency.setValueAtTime(n, t0 + c * notes.length * nd + i * nd); });
      osc.start(t0); musicNodes.push({ osc, gain: g });
    };
    startLoop(baseNotes, "sine", 1.0);
    startLoop(baseNotes.map(n => n * 2), "triangle", 0.45);
    if (level === "nightcity") startLoop(baseNotes.map(n => n * 0.5), "sawtooth", 0.3);
    if (level === "jungle") startLoop(baseNotes.map(n => n * 1.5), "triangle", 0.25);
  }
  function stopMusic() {
    musicNodes.forEach(({ osc }) => { try { osc.stop(); } catch { /* ignore */ } });
    musicNodes = [];
    if (musicGain) { musicGain.disconnect(); musicGain = null; }
  }

  // ---- Input ----
  const keys = new Set<string>();
  let yaw = 0; let pitch = -0.35; let pointerLocked = false;
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.key.toLowerCase());
    if (status === "playing" || status === "waiting") {
      const emote = EMOTES.find(em => em.key === e.key);
      if (emote) sendEmote(emote.kind);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); };
  const onMouseMove = (e: MouseEvent) => {
    if (!pointerLocked || isPaused) return;
    yaw -= e.movementX * 0.0025 * mouseSensitivity;
    pitch -= e.movementY * 0.0015 * mouseSensitivity;
    pitch = Math.max(-1.2, Math.min(0.4, pitch));
  };
  const onCanvasClick = () => { if (status === "playing" && !pointerLocked && !isPaused) renderer.domElement.requestPointerLock?.(); };
  const onPointerLockChange = () => { pointerLocked = document.pointerLockElement === renderer.domElement; };
  window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove); document.addEventListener("pointerlockchange", onPointerLockChange);
  renderer.domElement.addEventListener("click", onCanvasClick);
  const onResize = () => {
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  // ---- Mini-map ----
  function buildMiniMap(): MiniMapData {
    const others: { id: string; x: number; z: number; color: string }[] = [];
    for (const rp of remotePlayers.values()) others.push({ id: rp.info.id, x: rp.mesh.position.x, z: rp.mesh.position.z, color: rp.info.color });
    const trash: { x: number; z: number }[] = [];
    for (const t of trashItems.values()) if (!t.pendingCollect) trash.push({ x: t.mesh.position.x, z: t.mesh.position.z });
    const powerUps: { x: number; z: number; kind: PowerUpKind }[] = [];
    for (const pu of powerUpItems.values()) if (!pu.pendingCollect) powerUps.push({ x: pu.mesh.position.x, z: pu.mesh.position.z, kind: pu.kind });
    return { worldHalf: WORLD_HALF, selfX: player.position.x, selfZ: player.position.z, others, trash, powerUps };
  }

  function emitState() {
    onState({
      status, level, gameMode, difficulty, roundDuration, selfId, selfName, selfScore,
      timeLeft: Math.max(0, Math.ceil(timeLeft)), totalTrash, collected,
      players: [...players].sort((a,b) => b.score - a.score), fact, lastResult,
      soundOn, musicVolume, sfxVolume, mouseSensitivity, pickupNotice, powerUpNotice,
      combo, mvpId, floatingPoints, roomCode, isPublicRoom, errorMessage,
      sprintStamina, isSprinting, magnetMs, speedMs, miniMap: buildMiniMap(),
      isOwner, ownerStatus, godMode, stats: { ...stats }, isPaused,
    });
  }

  // ---- Scenery ----
  function clearScenery() {
    while (sceneryGroup.children.length > 0) { const c = sceneryGroup.children[0]; sceneryGroup.remove(c); disposeObject(c); }
    colliders = []; treeLeafMeshes.length = 0; trashGlowRings.length = 0; clearAmbientParticles();
  }

  function setLevelAtmosphere(lvl: Level) {
    if (lvl === "beach") {
      scene.background = new THREE.Color(0x5bc8f5); scene.fog = new THREE.Fog(0x5bc8f5, 35, 100);
      hemiLight.color.set(0x5bc8f5); hemiLight.groundColor.set(0xd4a84b);
      sun.color.set(0xfff5e0); sun.intensity = 1.3;
    } else if (lvl === "city") {
      scene.background = new THREE.Color(0x6e8ba8); scene.fog = new THREE.Fog(0x6e8ba8, 20, 75);
      hemiLight.color.set(0x6e8ba8); hemiLight.groundColor.set(0x555555);
      sun.color.set(0xffd0a0); sun.intensity = 0.9;
    } else if (lvl === "nightcity") {
      scene.background = new THREE.Color(0x050012); scene.fog = new THREE.Fog(0x050012, 12, 55);
      hemiLight.color.set(0x1a004a); hemiLight.groundColor.set(0x000022);
      sun.color.set(0x0000ff); sun.intensity = 0.05;
    } else if (lvl === "arctic") {
      scene.background = new THREE.Color(0xbee4f5); scene.fog = new THREE.Fog(0xbee4f5, 20, 65);
      hemiLight.color.set(0xbee4f5); hemiLight.groundColor.set(0xe8f4f8);
      sun.color.set(0xfff8e1); sun.intensity = 0.7;
    } else if (lvl === "jungle") {
      scene.background = new THREE.Color(0x0d2a05); scene.fog = new THREE.Fog(0x0d2a05, 10, 42);
      hemiLight.color.set(0x1a4a0a); hemiLight.groundColor.set(0x0a2205);
      sun.color.set(0x88dd44); sun.intensity = 0.5;
    } else {
      scene.background = new THREE.Color(0x87ceeb); scene.fog = new THREE.Fog(0x87ceeb, 30, 90);
      hemiLight.color.set(0x87ceeb); hemiLight.groundColor.set(0x44aa44);
      sun.color.set(0xffffff); sun.intensity = 1.1;
    }
  }

  function buildLevel(lvl: Level) {
    clearScenery(); setLevelAtmosphere(lvl);
    const rand = mulberry32(hashString(lvl));
    const groundColor = lvl === "beach" ? 0xf2d8a0 : lvl === "city" ? 0x6b6f72 : lvl === "nightcity" ? 0x111118 : lvl === "arctic" ? 0xe8f4f8 : lvl === "jungle" ? 0x2d4a1e : 0x6cba5b;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sceneryGroup.add(ground);

    if (lvl === "beach") {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ color: 0x2a8fbf, roughness: 0.4, metalness: 0.1 }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.05, -45); sceneryGroup.add(sea);
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(120, 2.5), new THREE.MeshStandardMaterial({ color: 0xeef9ff, roughness: 1, transparent: true, opacity: 0.85 }));
      foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.06, -15.5); sceneryGroup.add(foam);
    }

    if (lvl === "park" || lvl === "city") {
      const roadMat = new THREE.MeshStandardMaterial({ color: lvl === "city" ? 0x2b2b2b : 0x9a8a6c, roughness: 1 });
      const rH = new THREE.Mesh(new THREE.PlaneGeometry(120, 6), roadMat); rH.rotation.x = -Math.PI / 2; rH.position.y = 0.02; sceneryGroup.add(rH);
      const rV = new THREE.Mesh(new THREE.PlaneGeometry(6, 120), roadMat); rV.rotation.x = -Math.PI / 2; rV.position.y = 0.02; sceneryGroup.add(rV);
      if (lvl === "city") {
        const mkM = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 1 });
        for (let i = -24; i <= 24; i += 8) {
          const mk = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.3), mkM); mk.rotation.x = -Math.PI / 2; mk.position.set(i, 0.03, 0); sceneryGroup.add(mk);
          const mv = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2.5), mkM); mv.rotation.x = -Math.PI / 2; mv.position.set(0, 0.03, i); sceneryGroup.add(mv);
        }
      }
    }

    if (lvl === "nightcity") {
      // Dark roads with neon glow strips
      const rd = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 1 });
      const rH = new THREE.Mesh(new THREE.PlaneGeometry(120, 7), rd); rH.rotation.x = -Math.PI / 2; rH.position.y = 0.02; sceneryGroup.add(rH);
      const rV = new THREE.Mesh(new THREE.PlaneGeometry(7, 120), rd); rV.rotation.x = -Math.PI / 2; rV.position.y = 0.02; sceneryGroup.add(rV);
      // Neon ground strips
      const neonColors = [0xff00ff, 0x00ffff, 0xff6600];
      for (let i = -20; i <= 20; i += 10) {
        const col = neonColors[Math.abs(i / 10) % 3];
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(120, 0.25), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.5 }));
        strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.04, i); sceneryGroup.add(strip);
      }
      // Neon buildings
      const bCount = 18;
      for (let i = 0; i < bCount; i++) {
        const nb = createNeonBuilding(rand); placeRand(nb.mesh, 5, rand, nb.radius); sceneryGroup.add(nb.mesh);
      }
      // Neon point lights
      const nlColors = [0xff00ff, 0x00ffff, 0xff6600, 0x00ff88, 0xffff00];
      for (let i = 0; i < 16; i++) {
        const col = nlColors[i % nlColors.length];
        const lx = (rand() * 2 - 1) * 22; const lz = (rand() * 2 - 1) * 22;
        const pl = new THREE.PointLight(col, 1.5, 12); pl.position.set(lx, 3, lz); sceneryGroup.add(pl);
      }
    }

    if (lvl === "arctic") {
      // Ice sheets
      for (let i = 0; i < 12; i++) {
        const ix = (rand() * 2 - 1) * WORLD_HALF; const iz = (rand() * 2 - 1) * WORLD_HALF;
        const iw = 3 + rand() * 6; const id = 2 + rand() * 4;
        const ice = new THREE.Mesh(new THREE.BoxGeometry(iw, 0.12, id), new THREE.MeshStandardMaterial({ color: 0xb0e4f8, roughness: 0.2, metalness: 0.15, transparent: true, opacity: 0.85 }));
        ice.position.set(ix, 0.06, iz); ice.rotation.y = rand() * Math.PI; sceneryGroup.add(ice);
      }
      // Bare trees (frozen)
      for (let i = 0; i < 14; i++) {
        const bt = createBareTree(rand); placeRand(bt, 3, rand, 0.4); sceneryGroup.add(bt);
      }
      // Icy rocks
      for (let i = 0; i < 10; i++) {
        const rx = (rand() * 2 - 1) * WORLD_HALF; const rz = (rand() * 2 - 1) * WORLD_HALF;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rand() * 0.8, 0), new THREE.MeshStandardMaterial({ color: 0xc8e8f8, roughness: 0.3, metalness: 0.2 }));
        rock.position.set(rx, 0.25, rz); rock.rotation.y = rand() * Math.PI; rock.castShadow = true; sceneryGroup.add(rock);
      }
    }

    if (lvl === "jungle") {
      // Massive trees
      for (let i = 0; i < 28; i++) {
        const jt = createJungleTree(rand); placeRand(jt, 2, rand, 0.7); sceneryGroup.add(jt);
      }
      // Ground ferns
      for (let i = 0; i < 24; i++) {
        const fx = (rand() * 2 - 1) * WORLD_HALF; const fz = (rand() * 2 - 1) * WORLD_HALF;
        const fern = createFern(); fern.position.set(fx, 0, fz); fern.rotation.y = rand() * Math.PI * 2; sceneryGroup.add(fern);
      }
      // Mossy rocks
      for (let i = 0; i < 8; i++) {
        const rx = (rand() * 2 - 1) * WORLD_HALF; const rz = (rand() * 2 - 1) * WORLD_HALF;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + rand() * 1.0, 1), new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.95 }));
        rock.position.set(rx, 0.3, rz); rock.rotation.y = rand() * Math.PI; rock.castShadow = true; sceneryGroup.add(rock);
        colliders.push({ x: rx, z: rz, r: 1.0 });
      }
      // Hanging vines
      for (let i = 0; i < 10; i++) {
        const vx = (rand() * 2 - 1) * WORLD_HALF; const vz = (rand() * 2 - 1) * WORLD_HALF;
        const vLen = 1.5 + rand() * 2;
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, vLen, 6), new THREE.MeshStandardMaterial({ color: 0x2d5a20 }));
        vine.position.set(vx, vLen / 2 + 3, vz); vine.castShadow = true; sceneryGroup.add(vine);
      }
    }

    // Shared items for standard levels
    if (lvl === "park") {
      const treeCount = 24;
      for (let i = 0; i < treeCount; i++) { const t = createTree(); placeRand(t, 4, rand, 0.55); sceneryGroup.add(t); }
      for (let i = 0; i < 3; i++) { const c = createCabin(); placeRand(c, 6, rand, 1.4); sceneryGroup.add(c); }
      for (let i = 0; i < 6; i++) { const b = createBench(rand); placeRand(b, 3, rand, 1.0); sceneryGroup.add(b); }
      // Flowers
      for (let i = 0; i < 20; i++) {
        const fx = (rand() * 2 - 1) * WORLD_HALF; const fz = (rand() * 2 - 1) * WORLD_HALF;
        const cols = [0xff6b6b, 0xffd700, 0xff69b4, 0x9b59b6];
        const fg = new THREE.Group();
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: cols[Math.floor(rand() * cols.length)] })); petal.position.y = 0.18;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0x2d8a2d })); stem.position.y = 0.08;
        fg.add(petal, stem); fg.position.set(fx, 0, fz); sceneryGroup.add(fg);
      }
    }

    if (lvl === "beach") {
      for (let i = 0; i < 10; i++) { const t = createPalmTree(); placeRand(t, 4, rand, 0.45); sceneryGroup.add(t); }
    }

    if (lvl === "city") {
      for (let i = 0; i < 12; i++) { const b = createBuilding(rand); placeRand(b.mesh, 6, rand, b.radius); sceneryGroup.add(b.mesh); }
      for (let i = 0; i < 6; i++) { const b = createBench(rand); placeRand(b, 3, rand, 1.0); sceneryGroup.add(b); }
      const lampPos: [number, number][] = [[-12,-12],[12,-12],[-12,12],[12,12],[-20,0],[20,0],[0,-20],[0,20]];
      for (const [lx, lz] of lampPos) {
        const lamp = createStreetLamp(0xfff0aa); lamp.position.set(lx, 0, lz); sceneryGroup.add(lamp);
        const pt = new THREE.PointLight(0xfff0aa, 0.6, 14); pt.position.set(lx, 4.5, lz); sceneryGroup.add(pt);
      }
    }
  }

  // ---- Math helpers ----
  function mulberry32(seed: number) {
    let t = seed >>> 0;
    return () => { t = (t + 0x6d2b79f5) >>> 0; let r = t; r = Math.imul(r ^ (r >>> 15), r | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
  function hashString(s: string) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function placeRand(obj: THREE.Object3D, minR: number, rng: () => number, colR?: number) {
    for (let a = 0; a < 30; a++) {
      const x = (rng() * 2 - 1) * WORLD_HALF; const z = (rng() * 2 - 1) * WORLD_HALF;
      if (Math.abs(x) < minR && Math.abs(z) < minR) continue;
      obj.position.set(x, obj.position.y, z);
      if (colR !== undefined) colliders.push({ x, z, r: colR });
      return;
    }
  }

  // ---- 3D Models ----
  function createCharacter(colorHex: number, isLocal: boolean): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.2, 16), new THREE.MeshStandardMaterial({ color: colorHex })); body.position.y = 0.6; body.castShadow = true; g.add(body);
    const aM = new THREE.MeshStandardMaterial({ color: colorHex });
    const aG = new THREE.CylinderGeometry(0.1, 0.1, 0.65, 8);
    const aL = new THREE.Mesh(aG, aM); aL.position.set(-0.55, 0.65, 0); aL.rotation.z = 0.45; aL.castShadow = true; g.add(aL);
    const aR = new THREE.Mesh(aG, aM); aR.position.set(0.55, 0.65, 0); aR.rotation.z = -0.45; aR.castShadow = true; g.add(aR);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf3c79b })); head.position.y = 1.45; head.castShadow = true; g.add(head);
    const hatCol = isLocal ? 0x1b5e20 : darken(colorHex, 0.5);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.35, 16), new THREE.MeshStandardMaterial({ color: hatCol })); hat.position.y = 1.85; hat.castShadow = true; g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.07, 16), new THREE.MeshStandardMaterial({ color: darken(hatCol, 0.8) })); brim.position.y = 1.66; brim.castShadow = true; g.add(brim);
    return g;
  }
  function darken(hex: number, f: number): number {
    return (((hex >> 16 & 0xff) * f << 16) | ((hex >> 8 & 0xff) * f << 8) | ((hex & 0xff) * f)) >>> 0;
  }

  function createTree(): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x6b4423 })); trunk.position.y = 0.8; trunk.castShadow = true; g.add(trunk);
    const lM = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.9 - i * 0.15, 12, 12), lM); l.position.y = 1.6 + i * 0.7; l.castShadow = true; g.add(l); treeLeafMeshes.push(l); }
    colliders.push({ x: 0, z: 0, r: 0.55 }); return g;
  }
  function createPalmTree(): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x8b6f3a })); trunk.position.y = 1.6; trunk.castShadow = true; g.add(trunk);
    const lM = new THREE.MeshStandardMaterial({ color: 0x3a8a3a, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), lM);
      const ang = (i / 6) * Math.PI * 2; leaf.position.set(Math.cos(ang) * 0.7, 3.2, Math.sin(ang) * 0.7);
      leaf.rotation.y = -ang; leaf.rotation.z = -0.4; leaf.castShadow = true; g.add(leaf); treeLeafMeshes.push(leaf);
    }
    return g;
  }
  function createBareTree(rng: () => number): THREE.Group {
    const g = new THREE.Group(); const h = 2 + rng() * 2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h, 7), new THREE.MeshStandardMaterial({ color: 0xc8d8e8, roughness: 0.8 })); trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const bl = 0.6 + rng() * 0.8; const ba = (i / 4) * Math.PI * 2; const by = h * (0.5 + rng() * 0.4);
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, bl, 5), new THREE.MeshStandardMaterial({ color: 0xd0e0f0, roughness: 0.8 }));
      branch.position.set(Math.cos(ba) * bl * 0.4, by, Math.sin(ba) * bl * 0.4);
      branch.rotation.z = Math.PI * 0.35 * Math.sign(Math.cos(ba)); branch.rotation.x = Math.PI * 0.1;
      branch.castShadow = true; g.add(branch);
    }
    return g;
  }
  function createJungleTree(rng: () => number): THREE.Group {
    const g = new THREE.Group(); const h = 4 + rng() * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, h, 10), new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.95 })); trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
    const greens = [0x1a5c1a, 0x236b23, 0x2d7a2d, 0x1e6e1e];
    for (let i = 0; i < 3; i++) {
      const cr = 1.2 + i * 0.3 + rng() * 0.8;
      const l = new THREE.Mesh(new THREE.SphereGeometry(cr, 12, 12), new THREE.MeshStandardMaterial({ color: greens[i % greens.length], roughness: 0.95 }));
      l.position.y = h - i * 0.4; l.castShadow = true; g.add(l); treeLeafMeshes.push(l);
    }
    colliders.push({ x: 0, z: 0, r: 0.6 }); return g;
  }
  function createFern(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a6a18, roughness: 0.95, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.2), mat);
      const a = (i / 5) * Math.PI * 2; leaf.position.set(Math.cos(a) * 0.3, 0.25, Math.sin(a) * 0.3);
      leaf.rotation.y = -a; leaf.rotation.z = 0.4; g.add(leaf);
    }
    return g;
  }
  function createBuilding(rng: () => number): { mesh: THREE.Group; radius: number } {
    const g = new THREE.Group(); const w = 2.5 + rng() * 2; const d = 2.5 + rng() * 2; const h = 4 + rng() * 8;
    const cols = [0xb0bec5, 0x90a4ae, 0xa9968e, 0x8d6e63, 0x90caf9];
    const mat = new THREE.MeshStandardMaterial({ color: cols[Math.floor(rng() * cols.length)], roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); body.position.y = h / 2; body.castShadow = true; g.add(body);
    const wM = new THREE.MeshStandardMaterial({ color: 0xfff7ad, emissive: 0x554400, emissiveIntensity: 0.3 });
    const rows = Math.floor(h / 1.2); const wc = Math.floor(w / 0.8);
    for (let r = 0; r < rows; r++) for (let c = 0; c < wc; c++) if (rng() < 0.6) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), wM); win.position.set(-w / 2 + 0.4 + c * (w / wc), 0.7 + r * 1.2, d / 2 + 0.01); g.add(win);
    }
    colliders.push({ x: 0, z: 0, r: Math.max(w, d) * 0.5 + 0.2 }); return { mesh: g, radius: Math.max(w, d) * 0.5 + 0.2 };
  }
  function createNeonBuilding(rng: () => number): { mesh: THREE.Group; radius: number } {
    const g = new THREE.Group(); const w = 2 + rng() * 3; const d = 2 + rng() * 3; const h = 5 + rng() * 12;
    const bColors = [0x111122, 0x0a0a1a, 0x120a1e, 0x0e0e18];
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: bColors[Math.floor(rng() * bColors.length)], roughness: 0.6, metalness: 0.4 }));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    const neonCols = [0xff00ff, 0x00ffff, 0xff6600, 0x00ff88, 0xffff00];
    // Neon window strips
    const rows = Math.floor(h / 1.5); const wc = Math.floor(w / 0.9);
    for (let r = 0; r < rows; r++) for (let c = 0; c < wc; c++) if (rng() < 0.55) {
      const nc = neonCols[Math.floor(rng() * neonCols.length)];
      const wm = new THREE.MeshStandardMaterial({ color: nc, emissive: nc, emissiveIntensity: 2.5 });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.45), wm); win.position.set(-w / 2 + 0.4 + c * (w / wc), 0.8 + r * 1.5, d / 2 + 0.01); g.add(win);
    }
    // Neon sign bar
    const signCol = neonCols[Math.floor(rng() * neonCols.length)];
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: signCol, emissive: signCol, emissiveIntensity: 3 }));
    sign.position.set(0, h * 0.85, d / 2 + 0.03); g.add(sign);
    colliders.push({ x: 0, z: 0, r: Math.max(w, d) * 0.5 + 0.2 }); return { mesh: g, radius: Math.max(w, d) * 0.5 + 0.2 };
  }
  function createCabin(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.6, 2.5), new THREE.MeshStandardMaterial({ color: 0xa9744f })); body.position.y = 0.8; body.castShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.0, 4), new THREE.MeshStandardMaterial({ color: 0x7a3b2e })); roof.position.y = 2.3; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    colliders.push({ x: 0, z: 0, r: 1.5 }); return g;
  }
  function createBench(rng: () => number): THREE.Group {
    const g = new THREE.Group(); const sM = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), sM); seat.position.y = 0.5; seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.1), sM); back.position.set(0, 0.85, -0.2); back.castShadow = true; g.add(back);
    for (const x of [-0.7, 0.7]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x444444 })); leg.position.set(x, 0.25, 0); leg.castShadow = true; g.add(leg); }
    g.rotation.y = rng() * Math.PI * 2; return g;
  }
  function createStreetLamp(bulbColor: number): THREE.Group {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 })); pole.position.y = 2.25; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x555555 })); arm.position.set(0.6, 4.5, 0); g.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshStandardMaterial({ color: bulbColor, emissive: bulbColor, emissiveIntensity: 1.0 })); bulb.position.set(1.2, 4.4, 0); g.add(bulb);
    return g;
  }

  // ---- Trash meshes ----
  function createTrash(type: TrashType): THREE.Group {
    const g = new THREE.Group();
    if (type === "plastic") {
      const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.55, 12), new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.7, roughness: 0.1 })); bot.position.y = 0.28; bot.castShadow = true; g.add(bot);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x1976d2 })); cap.position.y = 0.6; g.add(cap);
    } else if (type === "metal") {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0xb22222, metalness: 0.7, roughness: 0.3 })); can.position.y = 0.21; can.castShadow = true; g.add(can);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9 })); top.position.y = 0.42; g.add(top);
    } else if (type === "paper") {
      const wad = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xfafaf0, roughness: 0.9 })); wad.position.y = 0.22; wad.castShadow = true; g.add(wad);
    } else {
      const peel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf2c200 })); peel.rotation.x = Math.PI / 2; peel.position.y = 0.1; peel.castShadow = true; g.add(peel);
    }
    const gCol = type === "plastic" ? 0x44aaff : type === "metal" ? 0xff4444 : type === "paper" ? 0xeeeecc : 0x66cc66;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.45, 20), new THREE.MeshBasicMaterial({ color: gCol, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring); trashGlowRings.push(ring as THREE.Mesh);
    return g;
  }

  // ---- Power-up meshes ----
  function createPowerUpMesh(kind: PowerUpKind): THREE.Group {
    const g = new THREE.Group();
    if (kind === "magnet") {
      const mR = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.4, metalness: 0.6 });
      const mS = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.3, metalness: 0.9 });
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 16), mR));
      const rg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 16), mR); rg.position.x = 0.64; g.add(rg);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.18, 12, 24, Math.PI), mR); arc.rotation.z = Math.PI; arc.position.set(0.32, 0.4, 0); g.add(arc);
      const tL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 16), mS); tL.position.y = -0.49; g.add(tL);
      const tR = tL.clone(); tR.position.set(0.64, -0.49, 0); g.add(tR);
    } else if (kind === "speed") {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0x665500, emissiveIntensity: 1.2, roughness: 0.3 });
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.18), mat); t.position.set(-0.1, 0.55, 0); t.rotation.z = -0.4; g.add(t);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.18), mat); b.position.set(0.12, 0.0, 0); b.rotation.z = -0.4; g.add(b);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0x886600, emissiveIntensity: 1.0, metalness: 0.7 });
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat); star.position.y = 0.55; g.add(star);
    }
    const rCol = kind === "magnet" ? 0xff5252 : kind === "speed" ? 0xfff176 : 0xffd54f;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 24), new THREE.MeshBasicMaterial({ color: rCol, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring); g.castShadow = true; return g;
  }

  // ---- Name sprites ----
  function makeNameSprite(name: string, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d")!; ctx.font = "bold 32px Inter, sans-serif";
    const w = Math.ceil(ctx.measureText(name).width) + 24; const h = 44; const x = (canvas.width - w) / 2; const y = 8;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.moveTo(x + 12, y); ctx.lineTo(x + w - 12, y); ctx.quadraticCurveTo(x + w, y, x + w, y + 12);
    ctx.lineTo(x + w, y + h - 12); ctx.quadraticCurveTo(x + w, y + h, x + w - 12, y + h); ctx.lineTo(x + 12, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - 12); ctx.lineTo(x, y + 12); ctx.quadraticCurveTo(x, y, x + 12, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(x, y, 4, h);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(name, x + 12, y + h / 2);
    const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true })); sprite.scale.set(2.5, 0.6, 1); return sprite;
  }

  function makeEmojiSprite(emoji: string, sizePx = 96): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d")!; ctx.font = `${sizePx}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(emoji, 64, 70);
    const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  }

  function disposeObject(obj: THREE.Object3D) {
    obj.traverse(child => {
      const m = child as THREE.Mesh; if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else if (mat) mat.dispose();
    });
    if (obj.parent) obj.parent.remove(obj);
  }

  function spawnEmoteAbove(target: THREE.Object3D, kind: EmoteKind) {
    const def = EMOTES.find(e => e.kind === kind); if (!def) return;
    const sprite = makeEmojiSprite(def.emoji, 96); sprite.scale.set(1.1, 1.1, 1); sprite.position.set(0, 3.0, 0); target.add(sprite);
    emoteSprites.push({ sprite, target, life: 0, maxLife: 2.4 });
  }
  function setMvpCrown(newId: string | null) {
    if (mvpCrown && mvpCrown.targetId === newId) return;
    if (mvpCrown) { const old = findPlayerMesh(mvpCrown.targetId); if (old) old.remove(mvpCrown.sprite); mvpCrown.sprite.material.map?.dispose(); mvpCrown.sprite.material.dispose(); mvpCrown = null; }
    if (!newId) return;
    const target = findPlayerMesh(newId); if (!target) return;
    const sprite = makeEmojiSprite("👑", 80); sprite.scale.set(0.9, 0.9, 1); sprite.position.set(0, 2.85, 0); target.add(sprite); mvpCrown = { sprite, targetId: newId };
  }
  function findPlayerMesh(id: string): THREE.Object3D | null { if (id === selfId) return player; return remotePlayers.get(id)?.mesh ?? null; }

  function spawnCollectParticles(x: number, z: number, trashType: TrashType | null, isCombo: boolean) {
    const color = trashType ? TRASH_PARTICLE_COLORS[trashType] : 0xffd54f;
    const count = isCombo ? 28 : 18; const spd = isCombo ? 1.6 : 1.0;
    for (let i = 0; i < count; i++) {
      const size = 0.055 + Math.random() * 0.085;
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 6), new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.set(x, 0.5, z);
      const a = Math.random() * Math.PI * 2; const s = (1.5 + Math.random() * 2.5) * spd;
      particles.push({ mesh: m, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 2.5 + Math.random() * 2.5, life: 0, maxLife: isCombo ? 0.9 : 0.7 }); scene.add(m);
    }
    if (isCombo) { shakeIntensity = Math.min(0.25, 0.05 + (combo?.combo ?? 1) * 0.03); shakeTimer = 0.25; }
  }

  function pushFloatingPoint(text: string, isCombo: boolean) {
    const id = nextFpId++; floatingPoints = [...floatingPoints, { id, text, isCombo }];
    setTimeout(() => { floatingPoints = floatingPoints.filter(fp => fp.id !== id); emitState(); }, 1100);
  }

  function spawnAmbientParticle() {
    if (ambientParticles.length >= AMBIENT_MAX) return;
    const side = Math.floor(Math.random() * 4); let sx = (Math.random() * 2 - 1) * WORLD_HALF; let sz = (Math.random() * 2 - 1) * WORLD_HALF;
    if (side === 0) sx = -WORLD_HALF; if (side === 1) sx = WORLD_HALF; if (side === 2) sz = -WORLD_HALF; if (side === 3) sz = WORLD_HALF;
    let color: number; let size: number; let startY: number; let vy: number;
    if (level === "park") { const lc = [0x4caf50, 0x8bc34a, 0xffeb3b, 0xff9800]; color = lc[Math.floor(Math.random() * lc.length)]; size = 0.06 + Math.random() * 0.08; startY = 4 + Math.random() * 6; vy = -(0.8 + Math.random() * 1.0); }
    else if (level === "beach") { color = Math.random() < 0.5 ? 0xeef9ff : 0xf5deb3; size = 0.04 + Math.random() * 0.06; startY = 0.5 + Math.random() * 1.5; vy = Math.random() * 0.3 - 0.1; }
    else if (level === "nightcity") { const nc = [0xff00ff, 0x00ffff, 0xff6600]; color = nc[Math.floor(Math.random() * nc.length)]; size = 0.04 + Math.random() * 0.05; startY = 10 + Math.random() * 10; vy = -(1.5 + Math.random() * 2); }
    else if (level === "arctic") { color = 0xffffff; size = 0.03 + Math.random() * 0.05; startY = 5 + Math.random() * 8; vy = -(0.6 + Math.random() * 1.0); }
    else if (level === "jungle") { const jc = [0x88ee44, 0xaaff66, 0xffee88]; color = jc[Math.floor(Math.random() * jc.length)]; size = 0.03 + Math.random() * 0.04; startY = 2 + Math.random() * 4; vy = -(0.15 + Math.random() * 0.3); }
    else { color = Math.random() < 0.6 ? 0xcccccc : 0xfafafa; size = 0.04 + Math.random() * 0.06; startY = 0.3 + Math.random() * 3; vy = -(0.3 + Math.random() * 0.6); }
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 5, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })); m.position.set(sx, startY, sz); ambientGroup.add(m);
    const s2 = 0.5 + Math.random() * 1.5; const ang = Math.random() * Math.PI * 2;
    ambientParticles.push({ mesh: m, vx: Math.cos(ang) * s2 * 0.4, vy, vz: Math.sin(ang) * s2 * 0.4, rotSpeed: (Math.random() - 0.5) * 3, life: 0, maxLife: 4 + Math.random() * 4 });
  }

  function clearAmbientParticles() {
    for (const p of ambientParticles) { ambientGroup.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); }
    ambientParticles.length = 0;
  }

  // ---- Spawn / remove objects ----
  function spawnPowerUp(id: string, kind: PowerUpKind, x: number, z: number) {
    if (powerUpItems.has(id)) return;
    const mesh = createPowerUpMesh(kind); mesh.position.set(x, 0, z); powerUpGroup.add(mesh);
    const lColor = kind === "magnet" ? 0xff4040 : kind === "speed" ? 0xffee00 : 0xffcc00;
    const light = new THREE.PointLight(lColor, 0.9, 6); light.position.set(x, 0.8, z); scene.add(light);
    powerUpItems.set(id, { id, kind, mesh, pendingCollect: false, bobPhase: Math.random() * Math.PI * 2, light });
  }
  function removePowerUp(id: string) { const pu = powerUpItems.get(id); if (!pu) return; powerUpGroup.remove(pu.mesh); disposeObject(pu.mesh); scene.remove(pu.light); powerUpItems.delete(id); }
  function clearPowerUps() { for (const id of [...powerUpItems.keys()]) removePowerUp(id); }
  function clearTrash() { for (const t of trashItems.values()) disposeObject(t.mesh); trashItems.clear(); trashGlowRings.length = 0; }
  function spawnTrash(id: string, type: TrashType, x: number, z: number) {
    if (trashItems.has(id)) return;
    const mesh = createTrash(type); mesh.position.set(x, 0, z); trashGroup.add(mesh);
    trashItems.set(id, { id, type, mesh, pendingCollect: false, bobPhase: Math.random() * Math.PI * 2 });
  }
  function removeTrash(id: string) { const t = trashItems.get(id); if (!t) return; disposeObject(t.mesh); trashItems.delete(id); }
  function clearRemotePlayers() { for (const rp of remotePlayers.values()) disposeObject(rp.mesh); remotePlayers.clear(); }
  function spawnRemotePlayer(info: PlayerInfo, x: number, z: number, rot: number) {
    if (info.id === selfId || remotePlayers.has(info.id)) return;
    const colorNum = parseInt(info.color.replace("#", ""), 16) || 0xffffff;
    const mesh = createCharacter(colorNum, false); mesh.position.set(x, 0, z); mesh.rotation.y = rot;
    const sprite = makeNameSprite(info.name, info.color); sprite.position.set(0, 2.4, 0); mesh.add(sprite); playersGroup.add(mesh);
    remotePlayers.set(info.id, { info, mesh, targetX: x, targetZ: z, targetRot: rot, nameSprite: sprite });
  }
  function removeRemotePlayer(id: string) { const rp = remotePlayers.get(id); if (!rp) return; disposeObject(rp.mesh); remotePlayers.delete(id); }
  function updatePlayersList(list: { id: string; name: string; color: string; score: number }[]) {
    players = list.map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score }));
    const me = players.find(p => p.id === selfId); if (me) selfScore = me.score;
  }

  // ---- Networking ----
  let socket: WebSocket | null = null; let lastMoveSent = 0;

  function connect(opts: StartOpts) {
    closeSocket(); selfName = opts.name || "Player";
    if (opts.kind !== "join") { level = opts.level; gameMode = (opts as { gameMode?: GameMode }).gameMode ?? "speedrun"; }
    status = "connecting"; errorMessage = null; emitState();
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams(); params.set("name", selfName);
    if (opts.kind === "public") { params.set("level", opts.level); params.set("mode", opts.gameMode); }
    else if (opts.kind === "private") { params.set("code", "NEW"); params.set("level", opts.level); params.set("difficulty", opts.difficulty); params.set("mode", opts.gameMode); }
    else params.set("code", opts.code);
    const url = `${proto}//${window.location.host}/api/ws?${params.toString()}`;
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch (err) { console.error("WS error", err); status = "disconnected"; emitState(); return; }
    socket = ws;
    ws.onmessage = (ev) => { let msg: ServerToClient; try { msg = JSON.parse(ev.data); } catch { return; } handleServerMessage(msg); };
    ws.onclose = () => { if (socket === ws) socket = null; if (status === "playing" || status === "connecting" || status === "waiting") { status = "disconnected"; stopMusic(); emitState(); } };
    ws.onerror = (e) => { console.warn("WS error", e); };
  }
  function closeSocket() { if (socket) { socket.onclose = null; socket.onmessage = null; socket.onerror = null; try { socket.close(); } catch { /* ignore */ } socket = null; } }
  function send(msg: object) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg)); }

  function handleServerMessage(msg: ServerToClient) {
    switch (msg.type) {
      case "init": {
        selfId = msg.selfId; level = msg.level; difficulty = msg.difficulty;
        gameMode = msg.gameMode ?? gameMode; roundDuration = msg.roundDuration;
        roomCode = msg.code; isPublicRoom = msg.isPublic; timeLeft = msg.timeLeft; errorMessage = null;
        clearTrash(); clearRemotePlayers(); clearPowerUps();
        for (const t of msg.trash) spawnTrash(t.id, t.type, t.x, t.z);
        for (const pu of (msg.powerUps ?? [])) spawnPowerUp(pu.id, pu.kind, pu.x, pu.z);
        totalTrash = msg.trash.length; collected = 0;
        updatePlayersList(msg.players.map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score })));
        const me = msg.players.find(p => p.id === selfId);
        if (me) { player.position.set(me.x, 0, me.z); player.rotation.y = me.rot; }
        for (const p of msg.players) { if (p.id === selfId) continue; spawnRemotePlayer({ id: p.id, name: p.name, color: p.color, score: p.score }, p.x, p.z, p.rot); }
        buildLevel(level); status = msg.status === "playing" ? "playing" : "waiting";
        lastResult = null; combo = null; mvpId = msg.mvpId; setMvpCrown(mvpId); startMusic(); emitState(); break;
      }
      case "playerJoined": {
        const p = msg.player;
        if (!players.find(x => x.id === p.id)) players = [...players, { id: p.id, name: p.name, color: p.color, score: p.score }];
        spawnRemotePlayer({ id: p.id, name: p.name, color: p.color, score: p.score }, p.x, p.z, p.rot);
        if (mvpId === p.id) setMvpCrown(mvpId); emitState(); break;
      }
      case "playerLeft": { players = players.filter(p => p.id !== msg.id); removeRemotePlayer(msg.id); if (mvpCrown && mvpCrown.targetId === msg.id) setMvpCrown(null); emitState(); break; }
      case "positions": { for (const p of msg.players) { if (p.id === selfId) continue; const rp = remotePlayers.get(p.id); if (rp) { rp.targetX = p.x; rp.targetZ = p.z; rp.targetRot = p.rot; } } break; }
      case "trashCollected": {
        const t = trashItems.get(msg.trashId); const tType = t?.type ?? null; const tx = t?.mesh.position.x; const tz = t?.mesh.position.z;
        if (t) removeTrash(msg.trashId); collected = msg.totalCollected;
        players = players.map(p => p.id === msg.byId ? { ...p, score: msg.score } : p);
        if (msg.byId === selfId) {
          selfScore = msg.score; playCollectSound(); stats.trashCleaned += 1; stats.pointsEarned = msg.score;
          if (msg.combo > stats.bestCombo) stats.bestCombo = msg.combo;
          combo = { combo: msg.combo, expiresAt: performance.now() + msg.comboExpiresInMs, windowMs: msg.comboExpiresInMs };
          const isComboCollect = msg.combo > 1;
          pushFloatingPoint(isComboCollect ? `+${msg.pointsGained}  ${msg.combo}×` : `+${msg.pointsGained}`, isComboCollect);
          if (tx !== undefined && tz !== undefined) spawnCollectParticles(tx, tz, tType, isComboCollect);
          if (msg.combo >= 3) playComboFanfare(msg.combo);
          if (tType) { const list = FACTS[tType]; fact = list[Math.floor(Math.random() * list.length)]; factTimer = 4.5; }
        } else {
          playRemoteCollectSound();
          if (tx !== undefined && tz !== undefined) spawnCollectParticles(tx, tz, tType, false);
          if (tType) { pickupNotice = { byName: msg.byName, trashType: tType }; pickupNoticeTimer = 2.5; }
        }
        emitState(); break;
      }
      case "roundEnd": {
        status = "waiting";
        lastResult = { result: msg.result, cleanedPct: msg.cleanedPct, scores: msg.scores.map(s => ({ id: s.id, name: s.name, color: s.color, score: s.score })), restartIn: msg.restartIn, mvpId: msg.mvpId };
        mvpId = msg.mvpId; setMvpCrown(mvpId); combo = null; playEndSound(msg.result === "won"); emitState(); break;
      }
      case "roundStart": {
        clearTrash(); clearPowerUps();
        for (const t of msg.trash) spawnTrash(t.id, t.type, t.x, t.z);
        for (const pu of (msg.powerUps ?? [])) spawnPowerUp(pu.id, pu.kind, pu.x, pu.z);
        totalTrash = msg.trash.length; collected = 0; timeLeft = msg.timeLeft; roundDuration = msg.roundDuration;
        if (msg.gameMode) gameMode = msg.gameMode;
        players = players.map(p => ({ ...p, score: 0 })); selfScore = 0; status = "playing"; lastResult = null; combo = null;
        magnetMs = 0; speedMs = 0; sprintStamina = 1.0; lastTimerWarning = -1; mvpId = msg.mvpId; setMvpCrown(mvpId); emitState(); break;
      }
      case "powerUpSpawned": { const pu = msg.powerUp; spawnPowerUp(pu.id, pu.kind, pu.x, pu.z); emitState(); break; }
      case "powerUpCollected": {
        removePowerUp(msg.powerUpId);
        if (msg.byId === selfId) {
          if (msg.kind === "magnet") magnetMs = msg.effectMs; else if (msg.kind === "speed") speedMs = msg.effectMs;
          else if (msg.kind === "bonus") { selfScore = msg.score; stats.pointsEarned = msg.score; pushFloatingPoint(`+${msg.bonusPoints} bonus`, true); }
          stats.powerUpsCollected += 1; players = players.map(p => p.id === msg.byId ? { ...p, score: msg.score } : p); playPowerUpSound(msg.kind);
        } else { players = players.map(p => p.id === msg.byId ? { ...p, score: msg.score } : p); powerUpNotice = { byName: msg.byName, kind: msg.kind, bonus: msg.bonusPoints }; powerUpNoticeTimer = 2.5; }
        emitState(); break;
      }
      case "powerUpExpired": { removePowerUp(msg.powerUpId); emitState(); break; }
      case "emote": { const target = findPlayerMesh(msg.playerId); if (target) spawnEmoteAbove(target, msg.kind); break; }
      case "kicked": { errorMessage = msg.reason || "Kicked from room."; status = "menu"; emitState(); break; }
      case "adminAck": { ownerStatus = { ok: msg.ok, message: msg.message }; if (msg.ok) isOwner = true; else { ownerPassword = null; isOwner = false; } emitState(); break; }
      case "error": { errorMessage = msg.message; status = "menu"; emitState(); break; }
    }
  }

  function start(opts: StartOpts) { connect(opts); }
  function sendEmote(kind: EmoteKind) { send({ type: "emote", kind }); }
  function setMusicVolume(v: number) { musicVolume = Math.max(0, Math.min(1, v)); if (musicGain && audioCtx) musicGain.gain.setTargetAtTime(0.08 * musicVolume, audioCtx.currentTime, 0.05); emitState(); }
  function setSfxVolume(v: number) { sfxVolume = Math.max(0, Math.min(1, v)); emitState(); }
  function setMouseSensitivity(v: number) { mouseSensitivity = Math.max(0.25, Math.min(2.5, v)); emitState(); }
  function submitOwnerPassword(password: string) { ownerPassword = password; send({ type: "admin.identify", password }); }
  function sendAdmin(cmd: AdminCommand) {
    if (!isOwner || !ownerPassword) return;
    switch (cmd.kind) {
      case "endRound": send({ type: "admin.endRound", password: ownerPassword, result: cmd.result }); break;
      case "spawnTrash": send({ type: "admin.spawnTrash", password: ownerPassword, count: cmd.count }); break;
      case "spawnPowerUp": send({ type: "admin.spawnPowerUp", password: ownerPassword, kind: cmd.powerUp }); break;
      case "kick": send({ type: "admin.kick", password: ownerPassword, playerId: cmd.playerId }); break;
      case "setTimer": send({ type: "admin.setTimer", password: ownerPassword, seconds: cmd.seconds }); break;
    }
  }
  function setGodMode(on: boolean) { godMode = on; emitState(); }
  function setPaused(p: boolean) {
    isPaused = p;
    if (isPaused && pointerLocked) document.exitPointerLock?.();
    emitState();
  }

  function backToMenu() {
    closeSocket(); status = "menu"; selfId = null; selfScore = 0; timeLeft = 0; totalTrash = 0; collected = 0;
    players = []; fact = null; lastResult = null; pickupNotice = null; powerUpNotice = null; combo = null; mvpId = null;
    floatingPoints = []; roomCode = null; isPublicRoom = false; errorMessage = null; sprintStamina = 1.0;
    isSprinting = false; magnetMs = 0; speedMs = 0; isOwner = false; ownerPassword = null; ownerStatus = null;
    godMode = false; isPaused = false; lastTimerWarning = -1; shakeIntensity = 0; shakeTimer = 0; cameraShakeOffset.set(0,0,0);
    setMvpCrown(null); clearParticles(); clearEmoteSprites(); clearAmbientParticles();
    clearTrash(); clearPowerUps(); clearRemotePlayers(); clearScenery();
    pointerLocked = false; document.exitPointerLock?.(); stopMusic(); emitState();
  }
  function clearParticles() { for (const p of particles) { scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); } particles.length = 0; }
  function clearEmoteSprites() { for (const e of emoteSprites) { e.target.remove(e.sprite); e.sprite.material.map?.dispose(); e.sprite.material.dispose(); } emoteSprites.length = 0; }
  function toggleSound() { soundOn = !soundOn; if (!soundOn) stopMusic(); else if (status === "playing" || status === "waiting") startMusic(); emitState(); }

  // ---- Main loop ----
  const clock = new THREE.Clock(); let rafId = 0;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta()); const t = clock.elapsedTime;

    if ((status === "playing" || status === "waiting") && !isPaused) {
      if (status === "playing") {
        updateLocalMovement(dt); attemptCollect(); attemptCollectPowerUps();
        if (magnetMs > 0) applyMagnetPull(dt);
        timeLeft = Math.max(0, timeLeft - dt);
        if (magnetMs > 0) magnetMs = Math.max(0, magnetMs - dt * 1000);
        if (speedMs > 0) speedMs = Math.max(0, speedMs - dt * 1000);
        const tFloor = Math.floor(timeLeft);
        if (tFloor <= 10 && tFloor > 0 && tFloor !== lastTimerWarning) { lastTimerWarning = tFloor; playTimerTick(); }
      }

      for (const rp of remotePlayers.values()) {
        rp.mesh.position.x += (rp.targetX - rp.mesh.position.x) * Math.min(1, dt * 12);
        rp.mesh.position.z += (rp.targetZ - rp.mesh.position.z) * Math.min(1, dt * 12);
        let dr = rp.targetRot - rp.mesh.rotation.y;
        while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
        rp.mesh.rotation.y += dr * Math.min(1, dt * 10);
      }

      for (const item of trashItems.values()) {
        item.mesh.rotation.y += dt * 0.6; item.bobPhase += dt * 1.8;
        item.mesh.position.y = Math.sin(item.bobPhase) * 0.06 + 0.06;
      }
      for (const pu of powerUpItems.values()) {
        pu.bobPhase += dt * 2.5; const newY = Math.sin(pu.bobPhase) * 0.18 + 0.4;
        pu.mesh.position.y = newY; pu.mesh.rotation.y += dt * 1.6;
        pu.light.position.y = newY + 0.4; pu.light.intensity = 0.7 + Math.sin(pu.bobPhase * 2) * 0.25;
      }

      const swayAmp = level === "beach" ? 0.06 : level === "nightcity" ? 0.0 : 0.025;
      for (let i = 0; i < treeLeafMeshes.length; i++) {
        treeLeafMeshes[i].rotation.z = Math.sin(t * 0.8 + i * 0.7) * swayAmp;
        treeLeafMeshes[i].rotation.x = Math.sin(t * 0.6 + i * 1.2) * swayAmp * 0.5;
      }

      const glowPulse = 0.4 + Math.sin(t * 3.5) * 0.15;
      for (const r of trashGlowRings) (r.material as THREE.MeshBasicMaterial).opacity = glowPulse;

      if (status === "playing") {
        ambientSpawnTimer += dt;
        if (ambientSpawnTimer >= AMBIENT_SPAWN_INTERVAL) { ambientSpawnTimer = 0; spawnAmbientParticle(); }
      }
      for (let i = ambientParticles.length - 1; i >= 0; i--) {
        const ap = ambientParticles[i]; ap.life += dt;
        ap.mesh.position.x += ap.vx * dt; ap.mesh.position.y += ap.vy * dt; ap.mesh.position.z += ap.vz * dt; ap.mesh.rotation.z += ap.rotSpeed * dt;
        const k = ap.life / ap.maxLife; const fade = k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1;
        (ap.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * fade;
        if (ap.life >= ap.maxLife || ap.mesh.position.y < -1) { ambientGroup.remove(ap.mesh); ap.mesh.geometry.dispose(); (ap.mesh.material as THREE.Material).dispose(); ambientParticles.splice(i, 1); }
      }

      const now = performance.now();
      if (status === "playing" && socket?.readyState === WebSocket.OPEN && now - lastMoveSent > 1000 / MOVE_SEND_HZ) {
        lastMoveSent = now; send({ type: "move", x: +player.position.x.toFixed(2), z: +player.position.z.toFixed(2), rot: +player.rotation.y.toFixed(2) });
      }

      if (factTimer > 0) { factTimer -= dt; if (factTimer <= 0) { fact = null; emitState(); } }
      if (pickupNoticeTimer > 0) { pickupNoticeTimer -= dt; if (pickupNoticeTimer <= 0) { pickupNotice = null; emitState(); } }
      if (powerUpNoticeTimer > 0) { powerUpNoticeTimer -= dt; if (powerUpNoticeTimer <= 0) { powerUpNotice = null; emitState(); } }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.life += dt; const k = p.life / p.maxLife; p.vy -= 8 * dt;
        p.mesh.position.x += p.vx * dt; p.mesh.position.z += p.vz * dt; p.mesh.position.y += p.vy * dt;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
        if (p.life >= p.maxLife) { scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); particles.splice(i, 1); }
      }
      for (let i = emoteSprites.length - 1; i >= 0; i--) {
        const e = emoteSprites[i]; e.life += dt; const k = e.life / e.maxLife;
        e.sprite.position.y = 3.0 + k * 0.6; e.sprite.material.opacity = Math.max(0, 1 - k);
        if (e.life >= e.maxLife) { e.target.remove(e.sprite); e.sprite.material.map?.dispose(); e.sprite.material.dispose(); emoteSprites.splice(i, 1); }
      }

      if (combo && performance.now() > combo.expiresAt) { combo = null; emitState(); }

      if (shakeTimer > 0) {
        shakeTimer -= dt;
        if (shakeTimer <= 0) { shakeTimer = 0; shakeIntensity = 0; cameraShakeOffset.set(0, 0, 0); }
        else cameraShakeOffset.set((Math.random() - 0.5) * shakeIntensity, (Math.random() - 0.5) * shakeIntensity * 0.5, 0);
      }

      const tNow = Math.ceil(timeLeft); if (tNow !== lastEmitTime) { lastEmitTime = tNow; emitState(); }
    }

    const offset = new THREE.Vector3(0, 0, 1); offset.applyEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")); offset.multiplyScalar(8);
    const targetPos = player.position.clone().add(offset); targetPos.y = player.position.y + 4 + (-pitch) * 3;
    camera.position.lerp(targetPos, 0.15); camera.position.add(cameraShakeOffset);
    camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    renderer.render(scene, camera); void t;
  }

  function updateLocalMovement(dt: number) {
    if (isPaused) return;
    let mx = 0; let mz = 0;
    if (keys.has("w") || keys.has("arrowup")) mz -= 1; if (keys.has("s") || keys.has("arrowdown")) mz += 1;
    if (keys.has("a") || keys.has("arrowleft")) mx -= 1; if (keys.has("d") || keys.has("arrowright")) mx += 1;
    const len = Math.hypot(mx, mz); const moving = len > 0;
    const wantsSprint = keys.has("shift") && sprintStamina > 0.05;
    isSprinting = moving && wantsSprint;
    if (isSprinting) sprintStamina = Math.max(0, sprintStamina - STAMINA_DRAIN_PER_SEC * dt);
    else sprintStamina = Math.min(1, sprintStamina + STAMINA_REGEN_PER_SEC * dt);
    if (!moving) { footstepTimer = 0; return; }
    mx /= len; mz /= len;
    // Use world-axis movement so controls are always consistent:
    // W=forward(-Z), S=back(+Z), A=left(-X), D=right(+X).
    const dx = mx;
    const dz = mz;
    player.rotation.y = Math.atan2(dx, dz);
    let speed = PLAYER_SPEED; if (isSprinting) speed *= SPRINT_MULTIPLIER; if (speedMs > 0) speed *= SPEED_POWERUP_MULTIPLIER;
    const desiredX = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, player.position.x + dx * speed * dt));
    const desiredZ = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, player.position.z + dz * speed * dt));
    if (canStandAt(desiredX, player.position.z)) player.position.x = desiredX;
    if (canStandAt(player.position.x, desiredZ)) player.position.z = desiredZ;
    const stepInterval = isSprinting ? FOOTSTEP_INTERVAL * 0.65 : FOOTSTEP_INTERVAL;
    footstepTimer += dt; if (footstepTimer >= stepInterval) { footstepTimer = 0; playFootstep(); }
  }

  function canStandAt(x: number, z: number): boolean {
    if (godMode) return true;
    for (const c of colliders) { const dx = x - c.x; const dz = z - c.z; if (dx * dx + dz * dz < (c.r + PLAYER_RADIUS) ** 2) return false; }
    return true;
  }
  function attemptCollect() {
    for (const item of trashItems.values()) {
      if (item.pendingCollect) continue;
      const dx = item.mesh.position.x - player.position.x; const dz = item.mesh.position.z - player.position.z;
      if (dx * dx + dz * dz < (COLLECT_RADIUS + PLAYER_RADIUS) ** 2) { item.pendingCollect = true; send({ type: "collect", trashId: item.id }); }
    }
  }
  function attemptCollectPowerUps() {
    for (const pu of powerUpItems.values()) {
      if (pu.pendingCollect) continue;
      const dx = pu.mesh.position.x - player.position.x; const dz = pu.mesh.position.z - player.position.z;
      if (dx * dx + dz * dz < (POWERUP_PICKUP_RADIUS + PLAYER_RADIUS) ** 2) { pu.pendingCollect = true; send({ type: "collectPowerUp", powerUpId: pu.id }); }
    }
  }
  function applyMagnetPull(dt: number) {
    const px = player.position.x; const pz = player.position.z; const r2 = MAGNET_RADIUS * MAGNET_RADIUS;
    for (const item of trashItems.values()) {
      if (item.pendingCollect) continue;
      const dx = px - item.mesh.position.x; const dz = pz - item.mesh.position.z; const d2 = dx * dx + dz * dz;
      if (d2 > r2 || d2 < 0.0001) continue;
      const d = Math.sqrt(d2); const step = Math.min(d, MAGNET_PULL_PER_SEC * dt);
      item.mesh.position.x += (dx / d) * step; item.mesh.position.z += (dz / d) * step;
    }
  }

  emitState(); animate();

  function dispose() {
    cancelAnimationFrame(rafId); closeSocket(); stopMusic(); audioCtx?.close().catch(() => undefined);
    window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousemove", onMouseMove); document.removeEventListener("pointerlockchange", onPointerLockChange);
    window.removeEventListener("resize", onResize); renderer.domElement.removeEventListener("click", onCanvasClick);
    setMvpCrown(null); clearParticles(); clearEmoteSprites(); clearAmbientParticles();
    clearScenery(); clearRemotePlayers(); clearTrash(); clearPowerUps(); disposeObject(player);
    renderer.dispose(); if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
  }

  return { start, backToMenu, toggleSound, sendEmote, setMusicVolume, setSfxVolume, setMouseSensitivity, submitOwnerPassword, sendAdmin, setGodMode, setPaused, dispose };
}
