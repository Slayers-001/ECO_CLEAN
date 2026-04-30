/**
 * WebSocket handler that wires raw `ws` connections to the room manager.
 */

import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "http";
import {
  makePlayerId, OWNER_PASSWORD, roomManager,
  VALID_DIFFICULTIES, VALID_LEVELS, VALID_GAME_MODES,
  type ClientToServer, type Difficulty, type EmoteKind, type GameMode, type Level, type PowerUpKind,
} from "./rooms.js";

const VALID_EMOTES: EmoteKind[] = ["wave", "thumbsup", "recycle", "smile", "cheer"];
function isEmote(x: string): x is EmoteKind { return (VALID_EMOTES as string[]).includes(x); }
function isLevel(x: string): x is Level { return (VALID_LEVELS as string[]).includes(x); }
function isDifficulty(x: string): x is Difficulty { return (VALID_DIFFICULTIES as string[]).includes(x); }
function isGameMode(x: string): x is GameMode { return (VALID_GAME_MODES as string[]).includes(x); }

const VALID_POWERUPS: PowerUpKind[] = ["magnet", "speed", "bonus"];
function isPowerUpKind(x: string): x is PowerUpKind { return (VALID_POWERUPS as string[]).includes(x); }

export function attachMultiplayer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  roomManager.start();

  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const url = request.url ?? "";
    if (!url.startsWith("/api/ws")) { socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (ws) => { wss.emit("connection", ws, request); });
  });

  wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const levelParam = url.searchParams.get("level") ?? "park";
    const nameParam = (url.searchParams.get("name") ?? "Player").slice(0, 20);
    const codeParam = url.searchParams.get("code");
    const diffParam = url.searchParams.get("difficulty") ?? "normal";
    const modeParam = url.searchParams.get("mode") ?? "speedrun";
    const level: Level = isLevel(levelParam) ? levelParam : "park";
    const difficulty: Difficulty = isDifficulty(diffParam) ? diffParam : "normal";
    const gameMode: GameMode = isGameMode(modeParam) ? modeParam : "speedrun";

    let room;
    if (codeParam) {
      const upper = codeParam.toUpperCase();
      if (upper === "NEW") {
        room = roomManager.createPrivate(level, difficulty, gameMode);
      } else {
        const existing = roomManager.joinByCode(upper);
        if (!existing) {
          ws.send(JSON.stringify({ type: "error", message: `No room with code "${upper}". Check the code and try again.` }));
          ws.close(); return;
        }
        room = existing;
      }
    } else {
      room = roomManager.ensurePublic(level, gameMode);
    }

    const playerId = makePlayerId();
    const color = room.pickColor();
    const player = {
      id: playerId, name: nameParam || "Player", color,
      x: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 4, rot: 0,
      score: 0, combo: 0, lastCollectAt: 0, lastEmoteAt: 0,
      socket: ws, alive: true,
    };
    room.addPlayer(player);

    ws.on("message", (raw) => {
      let msg: ClientToServer;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      switch (msg.type) {
        case "move":
          if (typeof msg.x === "number" && typeof msg.z === "number" && typeof msg.rot === "number"
            && Number.isFinite(msg.x) && Number.isFinite(msg.z) && Number.isFinite(msg.rot)) {
            room.handleMove(playerId, msg.x, msg.z, msg.rot);
          }
          break;
        case "collect":
          if (typeof msg.trashId === "string") room.handleCollect(playerId, msg.trashId);
          break;
        case "collectPowerUp":
          if (typeof msg.powerUpId === "string") room.handleCollectPowerUp(playerId, msg.powerUpId);
          break;
        case "emote":
          if (typeof msg.kind === "string" && isEmote(msg.kind)) room.handleEmote(playerId, msg.kind);
          break;
        case "ping":
          ws.send(JSON.stringify({ type: "pong", t: msg.t }));
          break;
        case "join": break;
        case "admin.identify":
          ws.send(JSON.stringify(msg.password === OWNER_PASSWORD
            ? { type: "adminAck", ok: true, message: "Owner mode unlocked." }
            : { type: "adminAck", ok: false, message: "Wrong owner password." }
          ));
          break;
        case "admin.endRound":
          if (msg.password === OWNER_PASSWORD) room.adminEndRound(msg.result === "won" ? "won" : "lost");
          break;
        case "admin.spawnTrash":
          if (msg.password === OWNER_PASSWORD && typeof msg.count === "number") room.adminSpawnTrash(msg.count);
          break;
        case "admin.spawnPowerUp":
          if (msg.password === OWNER_PASSWORD && typeof msg.kind === "string" && isPowerUpKind(msg.kind))
            room.adminSpawnPowerUp(msg.kind);
          break;
        case "admin.kick":
          if (msg.password === OWNER_PASSWORD && typeof msg.playerId === "string" && msg.playerId !== playerId)
            room.adminKick(msg.playerId);
          break;
        case "admin.setTimer":
          if (msg.password === OWNER_PASSWORD && typeof msg.seconds === "number") room.adminSetTimer(msg.seconds);
          break;
      }
    });

    ws.on("close", () => { room.removePlayer(playerId); roomManager.disposeIfEmpty(room); });
    ws.on("error", (err: Error) => { console.warn("[ws]", playerId, err.message); });
  });

  console.log("[ws] Multiplayer WebSocket server attached at /api/ws");
}
