// Daily TikTok drafts: at a fixed time each day, the next exported clip in the queue
// is sent to the user's TikTok inbox. The user adds the caption and posts it in the app.
// State lives in .tiktok/schedule.json; it only runs while the editor server is running.
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const RETRY_MS = 10 * 60 * 1000;
const MAX_TRIES = 3;

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const createSchedule = ({ root, tiktok }) => {
  const dir = path.join(root, ".tiktok");
  const file = path.join(dir, "schedule.json");
  const videoFor = (projectId) => path.join(root, "out", `${projectId}.mp4`);
  let state = { enabled: false, time: "19:00", lastSentDay: null, nextTryAt: 0, queue: [] };
  let busy = false;

  const load = async () => {
    if (existsSync(file)) state = { ...state, ...JSON.parse(await readFile(file, "utf8")) };
  };
  const save = async () => {
    mkdirSync(dir, { recursive: true });
    await writeFile(file, JSON.stringify(state, null, 1), "utf8");
  };

  // The next moment a draft will go out, or null when nothing is waiting.
  const nextRun = () => {
    if (!state.enabled || !state.queue.some((i) => i.status === "waiting")) return null;
    const [h, m] = state.time.split(":").map(Number);
    const at = new Date();
    at.setHours(h, m, 0, 0);
    if (state.lastSentDay === localDay() || state.skipDay === localDay()) at.setDate(at.getDate() + 1);
    return Math.max(at.getTime(), state.nextTryAt || 0, Date.now());
  };

  const tick = async () => {
    if (busy) return;
    const when = nextRun();
    if (when === null || when > Date.now()) return;
    const item = state.queue.find((i) => i.status === "waiting");
    busy = true;
    try {
      if (!existsSync(videoFor(item.projectId))) throw new Error("Dự án chưa được xuất video");
      item.status = "sending";
      await save();
      const result = await tiktok.sendDraft(videoFor(item.projectId), (line) => console.log(`[Lịch TikTok] ${line}`));
      Object.assign(item, { status: "sent", sentAt: Date.now(), publishId: result.publishId, error: null });
      state.lastSentDay = localDay();
      console.log(`[Lịch TikTok] Đã gửi bản nháp: ${item.name}`);
    } catch (err) {
      item.tries = (item.tries ?? 0) + 1;
      item.error = err.message;
      item.status = item.tries >= MAX_TRIES ? "failed" : "waiting";
      state.nextTryAt = Date.now() + RETRY_MS;
      console.warn(`[Lịch TikTok] Gửi lỗi (lần ${item.tries}): ${err.message}`);
    } finally {
      busy = false;
      await save();
    }
  };

  const view = () => ({
    enabled: state.enabled,
    time: state.time,
    nextRun: nextRun(),
    queue: state.queue.map((i) => ({ ...i, exported: existsSync(videoFor(i.projectId)) })),
  });

  const update = async ({ enabled, time }) => {
    if (time !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Giờ không hợp lệ");
      state.time = time;
    }
    if (enabled !== undefined) {
      // Switching on after today's time has passed starts tomorrow instead of sending at once.
      if (enabled && !state.enabled) {
        const [h, m] = state.time.split(":").map(Number);
        const passed = new Date().getHours() * 60 + new Date().getMinutes() >= h * 60 + m;
        state.skipDay = passed ? localDay() : null;
      }
      state.enabled = !!enabled;
    }
    state.nextTryAt = 0;
    await save();
  };

  const add = async ({ projectId, name, caption }) => {
    if (!/^[a-z0-9-]+$/.test(projectId ?? "")) throw new Error("Dự án không hợp lệ");
    state.queue.push({ id: randomBytes(4).toString("hex"), projectId, name: name || projectId, caption: caption ?? "", status: "waiting", addedAt: Date.now() });
    await save();
  };

  // action: remove | up | down | retry | caption
  const change = async ({ id, action, caption }) => {
    const i = state.queue.findIndex((q) => q.id === id);
    if (i < 0) throw new Error("Không tìm thấy mục này");
    const item = state.queue[i];
    if (item.status === "sending") throw new Error("Mục này đang được gửi");
    const q = state.queue;
    if (action === "remove") q.splice(i, 1);
    else if (action === "up" && i > 0) [q[i - 1], q[i]] = [q[i], q[i - 1]];
    else if (action === "down" && i < q.length - 1) [q[i + 1], q[i]] = [q[i], q[i + 1]];
    else if (action === "retry") Object.assign(item, { status: "waiting", tries: 0, error: null });
    else if (action === "caption") item.caption = String(caption ?? "");
    await save();
  };

  const start = async () => {
    await load();
    if (state.queue.some((i) => i.status === "sending")) {
      // The server stopped mid-upload: try that clip again.
      for (const i of state.queue) if (i.status === "sending") i.status = "waiting";
      await save();
    }
    setInterval(() => tick().catch((e) => console.warn(`[Lịch TikTok] ${e.message}`)), 30 * 1000);
  };

  return { start, tick, view, update, add, change };
};
