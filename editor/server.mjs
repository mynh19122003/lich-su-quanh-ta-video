// Local video editor: timeline app at /, Geneva script editor at /script.
// Run: npm run editor   then open http://localhost:3100
import react from "@vitejs/plugin-react";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createServer as createVite } from "vite";
import { createSchedule } from "./schedule.mjs";
import { createTiktok } from "./tiktok.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = path.join(ROOT, "projects");
const UPLOADS = path.join(ROOT, "public", "uploads");
const PORT = 3100;
const STUDIO_PORT = 3000;
const SCRIPT = path.join(ROOT, "src", "geneva", "script.json");
const TIMING = path.join(ROOT, "src", "geneva", "timing.json");
const TRY_DIR = path.join(ROOT, "out", "editor-try");
const OUTPUT = "out/tap1-hiep-dinh-giongevo.mp4";

// Absolute path of a working Python, so child processes don't depend on how PATH is set up.
const findPython = () => {
  if (process.env.PYTHON) return process.env.PYTHON;
  for (const cand of ["python", "py", "python3"]) {
    const r = spawnSync(cand, ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return "python";
};
const PYTHON = findPython();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
};

// One long-running job (voices, music or render) at a time; the UI polls its log.
let job = null;
let jobCounter = 0;
// Remotion's bundled ffmpeg, so the media scripts don't need a separate install.
// Each OS gets its own compositor package (win32-x64-msvc, darwin-arm64, darwin-x64, linux-…).
const FFMPEG = (() => {
  const dir = path.join(ROOT, "node_modules", "@remotion");
  const pkg = existsSync(dir) ? readdirSync(dir).find((d) => d.startsWith(`compositor-${process.platform}-${process.arch}`)) : undefined;
  const exe = pkg && path.join(dir, pkg, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  return exe && existsSync(exe) ? exe : "ffmpeg";
})();

const runJob = (name, steps, resultFile) => {
  if (job && job.running) {
    return false;
  }
  job = { id: ++jobCounter, name, running: true, ok: null, log: [], result: null, startedAt: Date.now() };
  const current = job;
  (async () => {
    for (const [cmd, args] of steps) {
      current.log.push(`$ ${cmd} ${args.join(" ")}`);
      const code = await new Promise((resolve) => {
        const child = spawn(cmd, args, { cwd: ROOT, shell: cmd === "npx", env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1", FFMPEG } });
        child.on("error", (err) => current.log.push(String(err.message)));
        const onData = (buf) => {
          // Remotion redraws its progress line with \r; keep only the latest state of it.
          for (const raw of buf.toString("utf8").split(/\n/)) {
            const line = raw.replace(/\r$/, "").split("\r").pop().replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trimEnd();
            if (!line) continue;
            const last = current.log[current.log.length - 1] ?? "";
            if (/^(Rendered|Encoded|Bundling)/.test(line) && /^(Rendered|Encoded|Bundling)/.test(last)) {
              current.log[current.log.length - 1] = line;
            } else {
              current.log.push(line);
            }
          }
          if (current.log.length > 400) current.log.splice(0, current.log.length - 400);
        };
        child.stdout.on("data", onData);
        child.stderr.on("data", onData);
        child.on("close", resolve);
      });
      if (code !== 0) {
        current.log.push(`✗ Lỗi (mã ${code})`);
        current.ok = false;
        current.running = false;
        return;
      }
    }
    if (resultFile) {
      try {
        current.result = JSON.parse(await readFile(resultFile, "utf8"));
      } catch (err) {
        current.log.push(`✗ Không đọc được kết quả: ${err.message}`);
        current.ok = false;
        current.running = false;
        return;
      }
    }
    current.log.push("✓ Xong");
    current.ok = true;
    current.running = false;
  })();
  return true;
};

// Same as runJob, for work done in this process (e.g. uploading to TikTok).
const runFnJob = (name, fn) => {
  if (job && job.running) return false;
  job = { id: ++jobCounter, name, running: true, ok: null, log: [], result: null, startedAt: Date.now() };
  const current = job;
  (async () => {
    try {
      current.result = await fn((line) => current.log.push(line));
      current.log.push("✓ Xong");
      current.ok = true;
    } catch (err) {
      current.log.push(`✗ ${err.message}`);
      current.ok = false;
    }
    current.running = false;
  })();
  return true;
};

const VOICE_STEPS = [
  [PYTHON, ["scripts/geneva_voice.py"]],
  [PYTHON, ["scripts/geneva_music.py"]],
];
const RENDER_STEP = ["npx", ["remotion", "render", "HiepDinhGiongevo", OUTPUT, "--concurrency=6"]];

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

// Serves a file with Range support so <audio>/<video> can seek.
const serveFile = (req, res, file) => {
  if (!existsSync(file) || !statSync(file).isFile()) {
    return send(res, 404, { error: "not found" });
  }
  const size = statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Cache-Control": "no-store",
    });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
    createReadStream(file).pipe(res);
  }
};

// Resolves a URL path under a base folder, refusing anything that escapes it.
const safeJoin = (base, rel) => {
  const full = path.resolve(base, decodeURIComponent(rel));
  return full.startsWith(base + path.sep) ? full : null;
};

const validateScript = (s) => {
  if (!s || typeof s !== "object" || !s.voices || !Array.isArray(s.scenes)) return "Thiếu voices hoặc scenes";
  for (const [i, scene] of s.scenes.entries()) {
    if (!scene.id || !Array.isArray(scene.lines)) return `Cảnh ${i + 1} thiếu id hoặc lines`;
    if (!["light", "tense", "sad"].includes(scene.mood)) return `Cảnh ${scene.id}: mood không hợp lệ`;
    for (const [j, line] of scene.lines.entries()) {
      if (!line.text || !line.text.trim()) return `Cảnh ${scene.id}, câu ${j + 1}: chưa có lời thoại`;
      if (!s.voices[line.who]) return `Cảnh ${scene.id}, câu ${j + 1}: nhân vật "${line.who}" chưa có giọng`;
    }
  }
  return null;
};

let tryCount = 0;
const tiktok = createTiktok({ root: ROOT, port: PORT });
const schedule = createSchedule({ root: ROOT, tiktok });
await schedule.start();

// The Edge voice service refuses several connections at once from one machine, so voice
// requests (episode lines, AI voice clips, voice previews) run one at a time.
let ttsQueue = Promise.resolve();
const runTts = (out, cfg) => {
  const run = ttsQueue.then(
    () =>
      new Promise((resolve) => {
        let stderr = "";
        const child = spawn(PYTHON, ["scripts/tts_once.py", out, ...cfg.slice(1)], {
          cwd: ROOT,
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        });
        child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
        child.stdin.end(cfg[0], "utf8");
        child.on("close", (code) => setTimeout(() => resolve({ code, stderr }), 250));
      }),
  );
  ttsQueue = run.then(() => undefined);
  return run;
};

// The timeline app (React + Remotion Player), served with hot reload. public/ is served at /
// so staticFile() paths work the same in the preview as in Remotion renders.
const vite = await createVite({
  root: path.join(ROOT, "editor", "app"),
  publicDir: path.join(ROOT, "public"),
  plugins: [react()],
  server: { middlewareMode: true, hmr: { port: PORT + 1 }, fs: { allow: [ROOT] } },
  appType: "spa",
  logLevel: "warn",
  // Pre-bundle everything up front: discovering a dependency mid-session makes Vite reload React twice.
  optimizeDeps: {
    entries: [path.join(ROOT, "editor", "app", "main.tsx")],
    include: [
      "react",
      "react-dom/client",
      "remotion",
      "@remotion/player",
      "@remotion/media",
      "@remotion/transitions",
      "@remotion/transitions/fade",
      "@remotion/effects/color-key",
      "d3-geo",
      "topojson-client",
      "opentype.js",
    ],
  },
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === "/script" || url.pathname === "/script/") {
      return serveFile(req, res, path.join(ROOT, "editor", "script.html"));
    }
    if (url.pathname === "/script/characters.json") {
      return serveFile(req, res, path.join(ROOT, "editor", "app", "characters.json"));
    }
    if (url.pathname === "/script/app.js" || url.pathname === "/script/style.css" || url.pathname === "/script/script-gen.js") {
      return serveFile(req, res, path.join(ROOT, "editor", url.pathname.slice("/script/".length)));
    }
    if (url.pathname.startsWith("/media/")) {
      const file = safeJoin(path.join(ROOT, "public"), url.pathname.slice("/media/".length));
      return file ? serveFile(req, res, file) : send(res, 403, { error: "forbidden" });
    }
    if (url.pathname.startsWith("/out/")) {
      const file = safeJoin(path.join(ROOT, "out"), url.pathname.slice("/out/".length));
      return file ? serveFile(req, res, file) : send(res, 403, { error: "forbidden" });
    }

    if (url.pathname === "/api/script" && req.method === "GET") {
      return send(res, 200, await readFile(SCRIPT, "utf8"));
    }
    if (url.pathname === "/api/script" && req.method === "PUT") {
      const body = JSON.parse(await readBody(req));
      const problem = validateScript(body);
      if (problem) return send(res, 400, { error: problem });
      await writeFile(SCRIPT, JSON.stringify(body, null, 2) + "\n", "utf8");
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/timing") {
      return send(res, 200, existsSync(TIMING) ? await readFile(TIMING, "utf8") : "{}");
    }
    if (url.pathname === "/api/output") {
      const file = path.join(ROOT, OUTPUT);
      return send(res, 200, existsSync(file) ? { url: "/" + OUTPUT, mtime: statSync(file).mtimeMs } : {});
    }
    if (url.pathname === "/api/job") {
      return send(res, 200, job ?? {});
    }
    if (url.pathname === "/api/voices" && req.method === "POST") {
      return runJob("Tạo giọng đọc và nhạc", VOICE_STEPS) ? send(res, 200, { ok: true }) : send(res, 409, { error: "Đang có việc khác chạy" });
    }
    if (url.pathname === "/api/render" && req.method === "POST") {
      return runJob("Xuất video", [...VOICE_STEPS, RENDER_STEP]) ? send(res, 200, { ok: true }) : send(res, 409, { error: "Đang có việc khác chạy" });
    }
    if (url.pathname === "/api/try" && req.method === "POST") {
      const { text, voice, rate, pitch } = JSON.parse(await readBody(req));
      if (!text?.trim()) return send(res, 400, { error: "Chưa có lời thoại" });
      mkdirSync(TRY_DIR, { recursive: true });
      const name = `try-${++tryCount % 20}.mp3`;
      const out = path.join(TRY_DIR, name);
      const { code } = await runTts(out, [text, voice, rate, pitch]);
      return code === 0 ? send(res, 200, { url: `/out/editor-try/${name}?t=${Date.now()}` }) : send(res, 500, { error: "Không tạo được giọng thử" });
    }

    // ----- timeline projects -----
    if (url.pathname === "/api/projects" && req.method === "GET") {
      mkdirSync(PROJECTS, { recursive: true });
      const files = (await readdir(PROJECTS)).filter((f) => f.endsWith(".json"));
      const list = [];
      for (const f of files) {
        try {
          const p = JSON.parse(await readFile(path.join(PROJECTS, f), "utf8"));
          list.push({ id: p.id, name: p.name, hasScript: !!p.script, mtime: statSync(path.join(PROJECTS, f)).mtimeMs });
        } catch {
          // skip unreadable project files
        }
      }
      return send(res, 200, list.sort((a, b) => b.mtime - a.mtime));
    }
    const projectMatch = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)(\/render|\/output)?$/);
    if (projectMatch) {
      const [, id, action] = projectMatch;
      const file = path.join(PROJECTS, `${id}.json`);
      const outRel = `out/${id}.mp4`;
      if (!action && req.method === "GET") {
        return existsSync(file) ? send(res, 200, await readFile(file, "utf8")) : send(res, 404, { error: "Không có dự án này" });
      }
      if (!action && req.method === "PUT") {
        const project = JSON.parse(await readBody(req));
        if (project.id !== id || !Array.isArray(project.tracks)) return send(res, 400, { error: "Dự án không hợp lệ" });
        mkdirSync(PROJECTS, { recursive: true });
        await writeFile(file, JSON.stringify(project, null, 1), "utf8");
        return send(res, 200, { ok: true });
      }
      if (action === "/output") {
        const rel = url.searchParams.get("audio") ? `out/${id}.mp3` : outRel;
        const out = path.join(ROOT, rel);
        return send(res, 200, existsSync(out) ? { url: "/" + rel, mtime: statSync(out).mtimeMs } : {});
      }
      if (action === "/render" && req.method === "POST") {
        if (!existsSync(file)) return send(res, 404, { error: "Chưa lưu dự án" });
        const opts = JSON.parse((await readBody(req)) || "{}");
        const crf = [16, 18, 23, 28].includes(opts.crf) ? opts.crf : 18;
        const scale = [1, 2 / 3, 0.5].some((v) => Math.abs(v - opts.scale) < 0.01) ? opts.scale : 1;
        const audioOnly = !!opts.audioOnly;
        const target = audioOnly ? `out/${id}.mp3` : outRel;
        // Remotion reads input props from a file: { project }.
        const propsFile = path.join(ROOT, "out", `props-${id}.json`);
        mkdirSync(path.dirname(propsFile), { recursive: true });
        const project = JSON.parse(await readFile(file, "utf8"));
        await writeFile(propsFile, JSON.stringify({ project }), "utf8");
        const args = ["remotion", "render", "ProjectVideo", target, `--props=out/props-${id}.json`, "--concurrency=6"];
        if (audioOnly) args.push("--codec=mp3");
        else args.push(`--crf=${crf}`, `--scale=${scale}`);
        const steps = [["npx", args]];
        // Vertical videos are for TikTok / Reels / Shorts: bring them up to feed loudness.
        if (!audioOnly && project.height > project.width) steps.push([PYTHON, ["scripts/normalize_loudness.py", target]]);
        return runJob(audioOnly ? "Xuất âm thanh" : "Xuất video", steps)
          ? send(res, 200, { ok: true, output: "/" + target })
          : send(res, 409, { error: "Đang có việc khác chạy" });
      }
    }
    // ----- TikTok -----
    if (url.pathname === "/api/tiktok/status") return send(res, 200, await tiktok.status());
    if (url.pathname === "/api/tiktok/config" && req.method === "POST") {
      await tiktok.saveConfig(JSON.parse(await readBody(req)));
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/tiktok/disconnect" && req.method === "POST") {
      await tiktok.disconnect();
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/tiktok/login") {
      res.writeHead(302, { Location: await tiktok.loginUrl() });
      return res.end();
    }
    if (url.pathname === "/tiktok/callback/" || url.pathname === "/tiktok/callback") {
      let message = "Đã kết nối tài khoản TikTok. Bạn có thể đóng trang này và quay lại trình dựng.";
      try {
        await tiktok.handleCallback(url.searchParams);
      } catch (err) {
        message = `Chưa kết nối được: ${err.message}`;
        console.warn("TikTok login lỗi:", err.message);
      }
      const html = `<!doctype html><meta charset="utf-8"><title>TikTok</title><body style="font-family:Segoe UI,sans-serif;background:#141417;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><div style="max-width:520px;text-align:center"><h2>${message.replace(/</g, "&lt;")}</h2><p><a style="color:#22c3c9" href="/">← Về trình dựng</a></p></div><script>setTimeout(()=>{try{window.opener&&window.opener.postMessage("tiktok-connected","*");}catch(e){} }, 300)</script></body>`;
      return send(res, 200, html, "text/html; charset=utf-8");
    }
    if (url.pathname === "/api/tiktok/direct-post" && req.method === "POST") {
      await tiktok.setDirectPost(JSON.parse(await readBody(req)).enabled);
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/tiktok/creator") {
      return send(res, 200, await tiktok.creatorInfo());
    }
    if (url.pathname === "/api/tiktok/publish" && req.method === "POST") {
      const opts = JSON.parse(await readBody(req));
      if (!/^[a-z0-9-]+$/.test(opts.projectId ?? "")) return send(res, 400, { error: "Dự án không hợp lệ" });
      const file = path.join(ROOT, "out", `${opts.projectId}.mp4`);
      if (!existsSync(file)) return send(res, 400, { error: "Chưa xuất video cho dự án này" });
      if (!opts.privacy) return send(res, 400, { error: "Chưa chọn ai được xem" });
      return runFnJob("Đăng lên TikTok", (log) => tiktok.directPost(file, opts, log))
        ? send(res, 200, { ok: true, id: jobCounter })
        : send(res, 409, { error: "Đang có việc khác chạy" });
    }
    if (url.pathname === "/api/tiktok/schedule") {
      if (req.method === "PUT") await schedule.update(JSON.parse(await readBody(req)));
      return send(res, 200, schedule.view());
    }
    if (url.pathname === "/api/tiktok/schedule/add" && req.method === "POST") {
      await schedule.add(JSON.parse(await readBody(req)));
      return send(res, 200, schedule.view());
    }
    if (url.pathname === "/api/tiktok/schedule/item" && req.method === "POST") {
      await schedule.change(JSON.parse(await readBody(req)));
      return send(res, 200, schedule.view());
    }
    if (url.pathname === "/api/tiktok/send" && req.method === "POST") {
      const { projectId } = JSON.parse(await readBody(req));
      if (!/^[a-z0-9-]+$/.test(projectId ?? "")) return send(res, 400, { error: "Dự án không hợp lệ" });
      const file = path.join(ROOT, "out", `${projectId}.mp4`);
      if (!existsSync(file)) return send(res, 400, { error: "Chưa xuất video cho dự án này" });
      return runFnJob("Gửi lên TikTok", (log) => tiktok.sendDraft(file, log))
        ? send(res, 200, { ok: true, id: jobCounter })
        : send(res, 409, { error: "Đang có việc khác chạy" });
    }

    // AI voice for a piece of text, saved as an uploaded asset.
    if (url.pathname === "/api/tts" && req.method === "POST") {
      const { text, voice, rate, pitch } = JSON.parse(await readBody(req));
      if (!text?.trim()) return send(res, 400, { error: "Chưa có chữ để đọc" });
      mkdirSync(UPLOADS, { recursive: true });
      const cfg = [text.trim(), voice || "vi-VN-NamMinhNeural", rate || "+0%", pitch || "+0Hz"];
      // Same text and voice -> same file, so retries and regenerated episodes reuse finished lines.
      const name = `giong-ai-${createHash("sha1").update(JSON.stringify(cfg)).digest("hex").slice(0, 16)}.mp3`;
      const out = path.join(UPLOADS, name);
      if (existsSync(out) && statSync(out).size > 0) {
        return send(res, 200, { src: `uploads/${name}`, seconds: statSync(out).size / 6000, cached: true });
      }
      const { code, stderr } = await runTts(out, cfg);
      if (code !== 0 || !existsSync(out) || statSync(out).size === 0) {
        if (existsSync(out)) rmSync(out, { force: true });
        console.warn("TTS lỗi:", stderr.trim().split("\n").slice(-2).join(" | "));
        return send(res, 502, { error: "Dịch vụ giọng đọc đang chập chờn, không đọc được câu này" });
      }
      // edge-tts writes 48 kbit/s CBR mp3, so size gives the length.
      return send(res, 200, { src: `uploads/${name}`, seconds: statSync(out).size / 6000 });
    }

    // Scene detection, speech-to-text and voice/music separation on an uploaded file.
    const toolMatch = url.pathname.match(/^\/api\/tools\/(scenes|transcribe|separate)$/);
    if (toolMatch && req.method === "POST") {
      const tool = toolMatch[1];
      const { src, model } = JSON.parse(await readBody(req));
      const media = src ? safeJoin(path.join(ROOT, "public"), src) : null;
      if (!media || !existsSync(media)) return send(res, 400, { error: "Không tìm thấy file" });
      mkdirSync(path.join(ROOT, "out"), { recursive: true });
      const outFile = path.join(ROOT, "out", `tool-${tool}-${Date.now()}.json`);
      const args = ["scripts/media_tools.py", tool, media, outFile, ...(tool === "transcribe" ? [model || "small"] : [])];
      const names = { scenes: "Tìm chuyển cảnh", transcribe: "Tạo phụ đề tự động", separate: "Tách giọng và nhạc nền" };
      return runJob(names[tool], [[PYTHON, args]], outFile)
        ? send(res, 200, { ok: true, id: jobCounter })
        : send(res, 409, { error: "Đang có việc khác chạy" });
    }
    if (url.pathname === "/api/upload" && req.method === "POST") {
      const original = url.searchParams.get("name") ?? "file";
      const ext = path.extname(original).toLowerCase();
      if (![".mp4", ".webm", ".mov", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp3", ".wav", ".m4a", ".ogg"].includes(ext)) {
        return send(res, 400, { error: `Chưa hỗ trợ loại file ${ext || "này"}` });
      }
      const base = path
        .basename(original, ext)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .slice(0, 50) || "file";
      mkdirSync(UPLOADS, { recursive: true });
      let name = `${base}${ext}`;
      for (let i = 2; existsSync(path.join(UPLOADS, name)); i++) name = `${base}-${i}${ext}`;
      await pipeline(req, createWriteStream(path.join(UPLOADS, name)));
      return send(res, 200, { src: `uploads/${name}` });
    }

    if (!url.pathname.startsWith("/api/")) {
      return vite.middlewares(req, res, () => send(res, 404, { error: "not found" }));
    }
    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 500, { error: String(err?.message ?? err) });
  }
});

// Remotion Studio gives the live animated preview; start it unless it's already up.
const studioUp = () =>
  new Promise((resolve) => {
    http.get(`http://localhost:${STUDIO_PORT}`, (r) => {
      r.resume();
      resolve(true);
    }).on("error", () => resolve(false));
  });

if (!(await studioUp())) {
  const studio = spawn("npx", ["remotion", "studio", "--no-open", `--port=${STUDIO_PORT}`], { cwd: ROOT, shell: true, stdio: "ignore" });
  process.on("exit", () => studio.kill());
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Trình dựng video: http://localhost:${PORT}`);
  console.log(`Sửa kịch bản tập Giơnevơ: http://localhost:${PORT}/script`);
  console.log(`Python: ${PYTHON}`);
  console.log(`Xem trước (Remotion Studio): http://localhost:${STUDIO_PORT}/HiepDinhGiongevo`);
});
