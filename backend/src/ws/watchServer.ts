import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { WebSocketServer, type WebSocket } from "ws";
import { prisma } from "../lib/prismaClient.ts";
import { VIDEO_COMPLETION_THRESHOLD } from "../lib/requiredActions.ts";

const WATCH_PATH = "/ws/watch";

type AuthedProfile = { id: string; name?: string; role?: string };

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function authFromRequest(req: {
  headers: { cookie?: string };
}): AuthedProfile | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.access_token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
      id?: string;
      name?: string;
      role?: string;
    };
    if (!decoded?.id) return null;
    return { id: decoded.id, name: decoded.name, role: decoded.role };
  } catch {
    return null;
  }
}

type WatchMessage = {
  event?: string;
  videoId?: string;
  watched?: number;
  furthest?: number;
  lastPosition?: number;
  completed?: boolean;
  duration?: number;
  profileId?: string;
  videoWatchedId?: string;
  meta?: { actionId?: string } & Record<string, unknown>;
};

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

async function handleWatchMessage(
  ws: WebSocket,
  authed: AuthedProfile,
  raw: Buffer | string
) {
  let msg: WatchMessage;
  try {
    msg = JSON.parse(String(raw));
  } catch {
    return send(ws, { event: "watch-error", error: "invalid-json" });
  }

  if (msg.event && msg.event !== "video-watched") return;

  // The client must echo the viewer's profileId; it must match the JWT.
  if (!msg.profileId || msg.profileId !== authed.id) {
    return send(ws, { event: "watch-error", error: "profile-mismatch" });
  }

  const watched = num(msg.watched);
  if (watched === null) {
    return send(ws, { event: "watch-error", error: "invalid-watched" });
  }
  const furthest = num(msg.furthest) ?? watched;
  const lastPosition = num(msg.lastPosition) ?? 0;
  const duration = num(msg.duration);
  const actionId =
    msg.meta && typeof msg.meta.actionId === "string"
      ? msg.meta.actionId
      : null;

  try {
    let completion: { id: string; profileId: string; watchedSeconds: number } | null = null;

    if (msg.videoWatchedId) {
      completion = await prisma.requiredActionCompletion.findUnique({
        where: { id: msg.videoWatchedId },
        select: { id: true, profileId: true, watchedSeconds: true },
      });
      // Never allow updating another user's row, even with a guessed id.
      if (completion && completion.profileId !== authed.id) {
        return send(ws, { event: "watch-error", error: "profile-mismatch" });
      }
    }

    if (!completion && actionId) {
      completion = await prisma.requiredActionCompletion.upsert({
        where: {
          actionId_profileId: { actionId, profileId: authed.id },
        },
        create: { actionId, profileId: authed.id },
        update: {},
        select: { id: true, profileId: true, watchedSeconds: true },
      });
    }

    if (!completion) {
      return send(ws, { event: "watch-error", error: "unknown-video" });
    }

    const nextWatched = Math.max(completion.watchedSeconds, watched);
    const clientCompleted = msg.completed === true;
    const thresholdCompleted =
      duration !== null &&
      duration > 0 &&
      nextWatched >= duration * VIDEO_COMPLETION_THRESHOLD;
    const completed = clientCompleted || thresholdCompleted;

    const updated = await prisma.requiredActionCompletion.update({
      where: { id: completion.id },
      data: {
        watchedSeconds: nextWatched,
        furthestSeconds: Math.max(furthest, 0),
        lastPosition,
        ...(duration !== null ? { duration } : {}),
        ...(completed
          ? { status: "COMPLETED", completedAt: new Date() }
          : {}),
      },
      select: {
        id: true,
        watchedSeconds: true,
        status: true,
      },
    });

    return send(ws, {
      event: "watch-ack",
      videoWatchedId: updated.id,
      watched: updated.watchedSeconds,
      completed: updated.status === "COMPLETED",
    });
  } catch (err) {
    console.error("[ws/watch] failed to persist progress", err);
    return send(ws, { event: "watch-error", error: "persist-failed" });
  }
}

export function attachWatchServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: WATCH_PATH });

  wss.on("connection", (ws: WebSocket, req) => {
    const authed = authFromRequest(
      req as unknown as { headers: { cookie?: string } }
    );
    if (!authed) {
      ws.close(4401, "unauthorized");
      return;
    }

    ws.on("message", (data) => {
      void handleWatchMessage(ws, authed, data as Buffer);
    });

    ws.on("error", () => {
      // Per-socket errors are isolated; nothing to do.
    });
  });

  console.log(`[ws] watch server listening on ${WATCH_PATH}`);
  return wss;
}
