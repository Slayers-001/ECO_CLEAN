/**
 * Multiplayer game rooms for EcoClean 3D.
 * Standalone version (no workspace dependencies).
 */

import type { WebSocket } from "ws";

const log = (...args: unknown[]) => console.log("[rooms]", ...args);

export type Level = "park" | "beach" | "city" | "nightcity" | "arctic" | "jungle";
export type TrashType = "plastic" | "metal" | "organic" | "paper";
export type Difficulty = "easy" | "normal" | "hard";
export type PowerUpKind = "magnet" | "speed" | "bonus";
export type GameMode = "speedrun" | "percent100" | "powerup";

export const WORLD_HALF = 28;
export const COLLECT_RADIUS_SQ = 4.5;
export const POSITION_BROADCAST_HZ = 20;
export const END_HOLD_SEC = 8;
export const BASE_TRASH_POINTS = 10;
export const COMBO_WINDOW_MS = 4000;
export const COMBO_MAX = 5;
export const EMOTE_COOLDOWN_MS = 1500;
export const POWERUP_LIFETIME_SEC = 25;
export const POWERUP_EFFECT_SEC = 8;
export const POWERUP_BONUS_POINTS = 50;
export const POWERUP_PICKUP_RADIUS_SQ = 4;

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { roundDuration: number; trashCount: number; winThreshold: number; label: string }
> = {
  easy:   { roundDuration: 180, trashCount: 24, winThreshold: 0.6, label: "Easy" },
  normal: { roundDuration: 120, trashCount: 32, winThreshold: 0.8, label: "Normal" },
  hard:   { roundDuration: 90,  trashCount: 44, winThreshold: 0.9, label: "Hard" },
};

export const MODE_CONFIG: Record<GameMode, {
  winThresholdOverride: number | null;
  roundDurationScale: number;
  trashCountScale: number;
  powerUpSpawnIntervalSec: number;
  maxActivePowerUps: number;
  label: string;
}> = {
  speedrun:   { winThresholdOverride: null, roundDurationScale: 0.7, trashCountScale: 1.3, powerUpSpawnIntervalSec: 22, maxActivePowerUps: 3, label: "Speedrun" },
  percent100: { winThresholdOverride: 1.0,  roundDurationScale: 2.0, trashCountScale: 0.8, powerUpSpawnIntervalSec: 18, maxActivePowerUps: 4, label: "100% Clean" },
  powerup:    { winThresholdOverride: null, roundDurationScale: 1.0, trashCountScale: 1.0, powerUpSpawnIntervalSec: 6,  maxActivePowerUps: 8, label: "Power-Up Party" },
};

export const VALID_LEVELS: Level[] = ["park", "beach", "city", "nightcity", "arctic", "jungle"];
export const VALID_DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];
export const VALID_GAME_MODES: GameMode[] = ["speedrun", "percent100", "powerup"];

export type AdminRole = "owner" | "powerup";

export const ADMIN_PASSWORD_ROLES: Record<string, AdminRole> = {
  Slayers: "powerup",
  PVP_PROPLE: "owner",
};

export function publicCode(level: Level, mode: GameMode): string {
  const lv: Record<Level, string> = { park: "PK", beach: "BC", city: "CT", nightcity: "NK", arctic: "AC", jungle: "JG" };
  const md: Record<GameMode, string> = { speedrun: "SR", percent100: "PC", powerup: "PU" };
  return `${lv[level]}-${md[mode]}`;
}

const RESERVED = new Set<string>(VALID_LEVELS.flatMap(l => VALID_GAME_MODES.map(m => publicCode(l, m))));

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export type EmoteKind = "wave" | "thumbsup" | "recycle" | "smile" | "cheer";
const VALID_EMOTES: EmoteKind[] = ["wave", "thumbsup", "recycle", "smile", "cheer"];

export type ClientToServer =
  | { type: "join"; level: Level; name: string; color: string }
  | { type: "move"; x: number; z: number; rot: number }
  | { type: "collect"; trashId: string }
  | { type: "collectPowerUp"; powerUpId: string }
  | { type: "emote"; kind: EmoteKind }
  | { type: "ping"; t: number }
  | { type: "admin.endRound"; password: string; result: "won" | "lost" }
  | { type: "admin.spawnTrash"; password: string; count: number }
  | { type: "admin.spawnPowerUp"; password: string; kind: PowerUpKind }
  | { type: "admin.kick"; password: string; playerId: string }
  | { type: "admin.setTimer"; password: string; seconds: number }
  | { type: "admin.identify"; password: string };

export type ServerToClient =
  | { type: "init"; selfId: string; level: Level; difficulty: Difficulty; gameMode: GameMode; code: string; isPublic: boolean; roundId: number; timeLeft: number; roundDuration: number; winThreshold: number; status: "playing" | "ended"; players: SerializedPlayer[]; trash: SerializedTrash[]; powerUps: SerializedPowerUp[]; mvpId: string | null; }
  | { type: "playerJoined"; player: SerializedPlayer }
  | { type: "playerLeft"; id: string }
  | { type: "positions"; players: { id: string; x: number; z: number; rot: number }[] }
  | { type: "trashCollected"; trashId: string; trashType: TrashType; byId: string; byName: string; score: number; pointsGained: number; combo: number; comboExpiresInMs: number; totalCollected: number; }
  | { type: "powerUpSpawned"; powerUp: SerializedPowerUp }
  | { type: "powerUpCollected"; powerUpId: string; kind: PowerUpKind; byId: string; byName: string; score: number; effectMs: number; bonusPoints: number; }
  | { type: "powerUpExpired"; powerUpId: string }
  | { type: "roundEnd"; result: "won" | "lost"; cleanedPct: number; scores: { id: string; name: string; color: string; score: number }[]; mvpId: string | null; restartIn: number; }
  | { type: "roundStart"; roundId: number; trash: SerializedTrash[]; powerUps: SerializedPowerUp[]; timeLeft: number; roundDuration: number; mvpId: string | null; gameMode: GameMode; }
  | { type: "emote"; playerId: string; kind: EmoteKind }
  | { type: "kicked"; reason: string }
  | { type: "adminAck"; ok: boolean; message: string }
  | { type: "pong"; t: number }
  | { type: "error"; message: string };

interface Player { id: string; name: string; color: string; x: number; z: number; rot: number; score: number; combo: number; lastCollectAt: number; lastEmoteAt: number; socket: WebSocket; alive: boolean; }
interface TrashItem { id: string; type: TrashType; x: number; z: number; collected: boolean; }
interface PowerUp { id: string; kind: PowerUpKind; x: number; z: number; expiresAt: number; collected: boolean; }
interface SerializedPlayer { id: string; name: string; color: string; x: number; z: number; rot: number; score: number; }
interface SerializedTrash { id: string; type: TrashType; x: number; z: number; }
interface SerializedPowerUp { id: string; kind: PowerUpKind; x: number; z: number; }

const PLAYER_COLORS = ["#ff7043","#42a5f5","#ab47bc","#ffca28","#26a69a","#ec407a","#7e57c2","#5c6bc0","#66bb6a","#8d6e63"];

function pickTrashType(level: Level): TrashType {
  const r = Math.random();
  if (level === "beach")    { if (r<0.55) return "plastic"; if (r<0.75) return "metal"; if (r<0.9) return "paper"; return "organic"; }
  if (level === "city" || level === "nightcity") { if (r<0.4) return "plastic"; if (r<0.65) return "paper"; if (r<0.85) return "metal"; return "organic"; }
  if (level === "arctic")   { if (r<0.5) return "plastic"; if (r<0.75) return "metal"; if (r<0.9) return "paper"; return "organic"; }
  if (level === "jungle")   { if (r<0.5) return "organic"; if (r<0.75) return "plastic"; if (r<0.9) return "paper"; return "metal"; }
  if (r<0.4) return "plastic"; if (r<0.6) return "organic"; if (r<0.8) return "paper"; return "metal";
}

function randomTrashPos(): { x: number; z: number } {
  for (let a = 0; a < 10; a++) {
    const x = (Math.random() * 2 - 1) * WORLD_HALF;
    const z = (Math.random() * 2 - 1) * WORLD_HALF;
    if (Math.abs(x) > 2 || Math.abs(z) > 2) return { x, z };
  }
  return { x: WORLD_HALF * Math.random(), z: WORLD_HALF * Math.random() };
}

function generateTrash(level: Level, count: number): TrashItem[] {
  const items: TrashItem[] = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = randomTrashPos();
    items.push({ id: `t-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2,6)}`, type: pickTrashType(level), x, z, collected: false });
  }
  return items;
}

const POWERUP_KINDS: PowerUpKind[] = ["magnet", "speed", "bonus"];
function pickPowerUpKind(): PowerUpKind { return POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)]; }
let nextPowerUpSeq = 0;
function makePowerUp(kind?: PowerUpKind, lifetimeSec = POWERUP_LIFETIME_SEC): PowerUp {
  const { x, z } = randomTrashPos();
  return { id: `pu-${Date.now().toString(36)}-${nextPowerUpSeq++}`, kind: kind ?? pickPowerUpKind(), x, z, expiresAt: Date.now() + lifetimeSec * 1000, collected: false };
}

function serializePlayer(p: Player): SerializedPlayer { return { id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, rot: p.rot, score: p.score }; }
function serializeTrash(t: TrashItem): SerializedTrash { return { id: t.id, type: t.type, x: t.x, z: t.z }; }
function serializePowerUp(p: PowerUp): SerializedPowerUp { return { id: p.id, kind: p.kind, x: p.x, z: p.z }; }

function send(socket: WebSocket, msg: ServerToClient) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
}

class Room {
  level: Level; difficulty: Difficulty; gameMode: GameMode; code: string; isPublic: boolean;
  players = new Map<string, Player>();
  trash: TrashItem[] = []; powerUps: PowerUp[] = [];
  status: "playing" | "ended" = "playing"; result: "won" | "lost" | null = null;
  timeLeft: number; roundDuration: number; trashCount: number; winThreshold: number;
  powerUpSpawnIntervalSec: number; maxActivePowerUps: number;
  roundId = 1; endHold = 0; usedColors = new Set<string>(); mvpId: string | null = null;
  nextPowerUpAt: number;

  constructor(level: Level, code: string, isPublic: boolean, difficulty: Difficulty, gameMode: GameMode = "speedrun") {
    this.level = level; this.code = code; this.isPublic = isPublic;
    this.difficulty = difficulty; this.gameMode = gameMode;
    const dc = DIFFICULTY_CONFIG[difficulty]; const mc = MODE_CONFIG[gameMode];
    this.roundDuration = Math.round(dc.roundDuration * mc.roundDurationScale);
    this.trashCount = Math.max(8, Math.round(dc.trashCount * mc.trashCountScale));
    this.winThreshold = mc.winThresholdOverride ?? dc.winThreshold;
    this.powerUpSpawnIntervalSec = mc.powerUpSpawnIntervalSec;
    this.maxActivePowerUps = mc.maxActivePowerUps;
    this.timeLeft = this.roundDuration;
    this.trash = generateTrash(level, this.trashCount);
    this.nextPowerUpAt = Date.now() + 8000;
  }

  pickColor(): string {
    for (const c of PLAYER_COLORS) if (!this.usedColors.has(c)) { this.usedColors.add(c); return c; }
    return `hsl(${Math.floor(Math.random() * 360)}, 65%, 55%)`;
  }
  freeColor(c: string) { this.usedColors.delete(c); }

  broadcast(msg: ServerToClient, exceptId?: string) {
    for (const p of this.players.values()) { if (p.id === exceptId) continue; send(p.socket, msg); }
  }

  addPlayer(player: Player) {
    this.players.set(player.id, player);
    send(player.socket, {
      type: "init", selfId: player.id, level: this.level, difficulty: this.difficulty, gameMode: this.gameMode,
      code: this.code, isPublic: this.isPublic, roundId: this.roundId,
      timeLeft: Math.ceil(this.timeLeft), roundDuration: this.roundDuration,
      winThreshold: this.winThreshold, status: this.status,
      players: Array.from(this.players.values()).map(serializePlayer),
      trash: this.trash.filter(t => !t.collected).map(serializeTrash),
      powerUps: this.powerUps.filter(p => !p.collected).map(serializePowerUp),
      mvpId: this.mvpId,
    });
    this.broadcast({ type: "playerJoined", player: serializePlayer(player) }, player.id);
    log(`+${player.id} joined ${this.code} (${this.players.size} players)`);
  }

  removePlayer(id: string) {
    const p = this.players.get(id); if (!p) return;
    this.players.delete(id); this.freeColor(p.color);
    this.broadcast({ type: "playerLeft", id });
    log(`-${id} left ${this.code} (${this.players.size} players)`);
  }

  handleMove(id: string, x: number, z: number, rot: number) {
    const p = this.players.get(id); if (!p) return;
    p.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, x));
    p.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, z));
    p.rot = rot;
  }

  handleCollect(id: string, trashId: string) {
    if (this.status !== "playing") return;
    const p = this.players.get(id); if (!p) return;
    const item = this.trash.find(t => t.id === trashId);
    if (!item || item.collected) return;
    const dx = item.x - p.x; const dz = item.z - p.z;
    if (dx * dx + dz * dz > COLLECT_RADIUS_SQ * 4) return;
    item.collected = true;
    const now = Date.now();
    p.combo = (now - p.lastCollectAt <= COMBO_WINDOW_MS) ? Math.min(COMBO_MAX, p.combo + 1) : 1;
    p.lastCollectAt = now;
    const pointsGained = BASE_TRASH_POINTS * p.combo;
    p.score += pointsGained;
    const totalCollected = this.trash.filter(t => t.collected).length;
    this.broadcast({ type: "trashCollected", trashId, trashType: item.type, byId: id, byName: p.name, score: p.score, pointsGained, combo: p.combo, comboExpiresInMs: COMBO_WINDOW_MS, totalCollected });
    if (totalCollected / this.trash.length >= this.winThreshold) this.endRound("won");
  }

  handleCollectPowerUp(id: string, powerUpId: string) {
    if (this.status !== "playing") return;
    const p = this.players.get(id); if (!p) return;
    const pu = this.powerUps.find(x => x.id === powerUpId);
    if (!pu || pu.collected) return;
    const dx = pu.x - p.x; const dz = pu.z - p.z;
    if (dx * dx + dz * dz > POWERUP_PICKUP_RADIUS_SQ * 4) return;
    pu.collected = true;
    let bonusPoints = 0;
    if (pu.kind === "bonus") { bonusPoints = POWERUP_BONUS_POINTS; p.score += bonusPoints; }
    this.broadcast({ type: "powerUpCollected", powerUpId, kind: pu.kind, byId: id, byName: p.name, score: p.score, effectMs: pu.kind === "bonus" ? 0 : POWERUP_EFFECT_SEC * 1000, bonusPoints });
  }

  handleEmote(id: string, kind: EmoteKind) {
    const p = this.players.get(id); if (!p) return;
    if (!VALID_EMOTES.includes(kind)) return;
    const now = Date.now();
    if (now - p.lastEmoteAt < EMOTE_COOLDOWN_MS) return;
    p.lastEmoteAt = now;
    this.broadcast({ type: "emote", playerId: id, kind });
  }

  endRound(result: "won" | "lost") {
    if (this.status === "ended") return;
    this.status = "ended"; this.result = result; this.endHold = END_HOLD_SEC;
    const cleaned = this.trash.filter(t => t.collected).length;
    const cleanedPct = Math.round((cleaned / this.trash.length) * 100);
    const scores = Array.from(this.players.values())
      .map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score }))
      .sort((a, b) => b.score - a.score);
    this.mvpId = scores[0] && scores[0].score > 0 ? scores[0].id : null;
    this.broadcast({ type: "roundEnd", result, cleanedPct, scores, mvpId: this.mvpId, restartIn: END_HOLD_SEC });
    log(`Round end ${this.code}: ${result} (${cleanedPct}%)`);
  }

  startNewRound() {
    this.roundId += 1; this.status = "playing"; this.result = null;
    this.timeLeft = this.roundDuration;
    this.trash = generateTrash(this.level, this.trashCount);
    this.powerUps = []; this.nextPowerUpAt = Date.now() + 8000;
    for (const p of this.players.values()) { p.score = 0; p.combo = 0; p.lastCollectAt = 0; }
    this.broadcast({ type: "roundStart", roundId: this.roundId, trash: this.trash.map(serializeTrash), powerUps: [], timeLeft: this.timeLeft, roundDuration: this.roundDuration, mvpId: this.mvpId, gameMode: this.gameMode });
  }

  tickPowerUps() {
    if (this.status !== "playing") return;
    const now = Date.now();
    for (const pu of this.powerUps) {
      if (!pu.collected && now > pu.expiresAt) { pu.collected = true; this.broadcast({ type: "powerUpExpired", powerUpId: pu.id }); }
    }
    this.powerUps = this.powerUps.filter(pu => !pu.collected);
    if (this.players.size > 0 && now >= this.nextPowerUpAt && this.powerUps.length < this.maxActivePowerUps) {
      const pu = makePowerUp();
      this.powerUps.push(pu);
      this.broadcast({ type: "powerUpSpawned", powerUp: serializePowerUp(pu) });
      this.nextPowerUpAt = now + this.powerUpSpawnIntervalSec * 1000;
    }
  }

  tick(dt: number) {
    if (this.status === "playing") {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endRound("lost"); }
      this.tickPowerUps();
    } else {
      this.endHold -= dt;
      if (this.endHold <= 0) this.startNewRound();
    }
  }

  adminEndRound(result: "won" | "lost") { if (this.status !== "playing") return; this.endRound(result); }

  adminSpawnTrash(count: number) {
    const safeCount = Math.max(1, Math.min(50, Math.floor(count)));
    const newItems = generateTrash(this.level, safeCount);
    this.trash.push(...newItems);
    this.trashCount = this.trash.length;
    for (const player of this.players.values()) {
      send(player.socket, {
        type: "init", selfId: player.id, level: this.level, difficulty: this.difficulty, gameMode: this.gameMode,
        code: this.code, isPublic: this.isPublic, roundId: this.roundId,
        timeLeft: Math.ceil(this.timeLeft), roundDuration: this.roundDuration,
        winThreshold: this.winThreshold, status: this.status,
        players: Array.from(this.players.values()).map(serializePlayer),
        trash: this.trash.filter(t => !t.collected).map(serializeTrash),
        powerUps: this.powerUps.filter(p => !p.collected).map(serializePowerUp),
        mvpId: this.mvpId,
      });
    }
  }

  adminSpawnPowerUp(kind: PowerUpKind) {
    if (this.status !== "playing") return;
    const pu = makePowerUp(kind);
    this.powerUps.push(pu);
    this.broadcast({ type: "powerUpSpawned", powerUp: serializePowerUp(pu) });
  }

  adminKick(playerId: string): boolean {
    const p = this.players.get(playerId); if (!p) return false;
    send(p.socket, { type: "kicked", reason: "Removed by an owner." });
    try { p.socket.close(); } catch { /* ignore */ }
    return true;
  }

  adminSetTimer(seconds: number) {
    if (this.status !== "playing") return;
    this.timeLeft = Math.max(5, Math.min(600, Math.floor(seconds)));
  }

  broadcastPositions() {
    if (this.players.size === 0) return;
    const players = Array.from(this.players.values()).map(p => ({ id: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), rot: +p.rot.toFixed(2) }));
    this.broadcast({ type: "positions", players });
  }
}

class RoomManager {
  rooms = new Map<string, Room>();
  positionTimer: NodeJS.Timeout | null = null;
  tickTimer: NodeJS.Timeout | null = null;
  lastTick = Date.now();

  ensurePublic(level: Level, gameMode: GameMode): Room {
    const code = publicCode(level, gameMode);
    let room = this.rooms.get(code);
    if (!room) { room = new Room(level, code, true, "normal", gameMode); this.rooms.set(code, room); log(`Created public room ${code}`); }
    return room;
  }
  joinByCode(code: string): Room | null { return this.rooms.get(code.toUpperCase()) ?? null; }
  createPrivate(level: Level, difficulty: Difficulty, gameMode: GameMode): Room {
    let code: string;
    do { code = generateCode(); } while (this.rooms.has(code) || RESERVED.has(code));
    const room = new Room(level, code, false, difficulty, gameMode);
    this.rooms.set(code, room);
    log(`Created private room ${code}`);
    return room;
  }
  disposeIfEmpty(room: Room): void {
    if (room.isPublic) return;
    if (room.players.size > 0) return;
    this.rooms.delete(room.code);
    log(`Destroyed empty room ${room.code}`);
  }
  start() {
    if (this.tickTimer) return;
    this.lastTick = Date.now();
    this.tickTimer = setInterval(() => {
      const now = Date.now(); const dt = (now - this.lastTick) / 1000; this.lastTick = now;
      for (const room of this.rooms.values()) room.tick(dt);
    }, 1000);
    this.positionTimer = setInterval(() => {
      for (const room of this.rooms.values()) room.broadcastPositions();
    }, Math.round(1000 / POSITION_BROADCAST_HZ));
  }
}

export const roomManager = new RoomManager();
let nextPlayerId = 1;
export function makePlayerId(): string { return `p${nextPlayerId++}`; }
