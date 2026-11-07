import type { PlayerRef } from "@remotion/player";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { EMBEDDABLE } from "../../src/project/compositions";
import { itemEnd, projectDuration, type Asset, type Item, type Project } from "../../src/project/types";
import { EpisodeDialog } from "./EpisodeDialog";
import { Inspector, type Tools } from "./Inspector";
import { Library, TEXT_PRESETS, type DropPayload, type VoiceSettings } from "./Library";
import { Preview } from "./Preview";
import { findItem, fmtTime, playhead, splitItemAt, trackFor, uid, usePlayhead, useProjectHistory } from "./store";
import { TEMPLATES } from "./templates";
import { TikTokDialog } from "./TikTokDialog";
import { Timeline } from "./Timeline";
import { applySeparation, compositionSceneCuts, compositionSubtitles, detachCompositionAudio, detachVideoAudio, splitAtScenes, transcriptSubtitles } from "./tools";

const api = async <T,>(url: string, opts: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Lỗi ${res.status}`);
  return body as T;
};

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "du-an";

const starterProject = (): Project => ({
  id: "tap-1-giongevo",
  name: "Tập 1 - Hiệp định Giơnevơ",
  fps: 30,
  width: 1920,
  height: 1080,
  assets: [],
  tracks: [
    { id: uid(), kind: "text", name: "Chữ 1", items: [] },
    {
      id: uid(),
      kind: "visual",
      name: "Hình 1",
      items: [{ id: uid(), type: "composition", compositionId: "HiepDinhGiongevo", from: 0, durationInFrames: EMBEDDABLE.HiepDinhGiongevo.durationInFrames, trimStart: 0 }],
    },
    { id: uid(), kind: "audio", name: "Âm thanh 1", items: [] },
  ],
});

// Reads duration / size of a media file in the browser before uploading it.
const probe = (file: File, fps: number): Promise<Pick<Asset, "kind" | "durationInFrames" | "width" | "height">> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (v: Pick<Asset, "kind" | "durationInFrames" | "width" | "height">) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => done({ kind: "image", width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done({ kind: "image" });
      img.src = url;
      return;
    }
    const kind = file.type.startsWith("audio/") ? "audio" : "video";
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      done({
        kind,
        durationInFrames: Number.isFinite(el.duration) ? Math.max(1, Math.round(el.duration * fps)) : undefined,
        width: kind === "video" ? (el as HTMLVideoElement).videoWidth : undefined,
        height: kind === "video" ? (el as HTMLVideoElement).videoHeight : undefined,
      });
    el.onerror = () => done({ kind });
    el.src = url;
  });

type Job = { id?: number; name?: string; running?: boolean; ok?: boolean | null; log?: string[]; result?: unknown };

const TimeReadout: React.FC<{ fps: number; duration: number }> = ({ fps, duration }) => {
  const frame = usePlayhead();
  return (
    <span className="time">
      {fmtTime(frame, fps, true)} / {fmtTime(duration, fps)}
    </span>
  );
};

export const App: React.FC = () => {
  const history = useProjectHistory(starterProject());
  const { project, mutate } = history;
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ppf, setPpf] = useState(0.5);
  const [exporting, setExporting] = useState<{ job: Job; output?: string; audioOnly?: boolean } | null>(null);
  const [exportOpts, setExportOpts] = useState<{ crf: number; scale: number; audioOnly: boolean } | null>(null);
  const [task, setTask] = useState<{ title: string; job: Job; message?: string } | null>(null);
  const [episodeOpen, setEpisodeOpen] = useState<"new" | "edit" | null>(null);
  const [tiktokOpen, setTiktokOpen] = useState(false);
  const playerRef = useRef<PlayerRef | null>(null);
  const lastSaved = useRef("");

  // ----- loading and autosave -----
  const openProject = useCallback(
    async (id: string) => {
      const p = await api<Project>(`/api/projects/${id}`);
      history.reset(p);
      lastSaved.current = JSON.stringify(p);
      setSelectedId(null);
      playhead.set(0);
      playerRef.current?.seekTo(0);
      localStorage.setItem("last-project", id);
      setPpf(Math.max(0.05, Math.min(8, (window.innerWidth - 220) / (projectDuration(p) + 10 * p.fps))));
    },
    [history],
  );

  useEffect(() => {
    (async () => {
      let list = await api<{ id: string; name: string }[]>("/api/projects");
      if (!list.length) {
        const p = starterProject();
        await api(`/api/projects/${p.id}`, { method: "PUT", body: JSON.stringify(p) });
        list = [{ id: p.id, name: p.name }];
      }
      setProjects(list);
      const wanted = new URLSearchParams(location.search).get("p") ?? localStorage.getItem("last-project");
      await openProject(list.find((x) => x.id === wanted)?.id ?? list[0].id);
      setLoaded(true);
      // Coming from the script page's "Cập nhật tập" button.
      if (new URLSearchParams(location.search).get("editScript")) {
        setEpisodeOpen("edit");
        window.history.replaceState(null, "", location.pathname);
      }
    })().catch((e) => alert("Không mở được dự án: " + e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const json = JSON.stringify(project);
    if (json === lastSaved.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await api(`/api/projects/${project.id}`, { method: "PUT", body: json });
        lastSaved.current = json;
        setSaveState("saved");
        setProjects((ps) => ps.map((x) => (x.id === project.id ? { ...x, name: project.name } : x)));
      } catch {
        setSaveState("error");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [project, loaded]);

  // ----- player -----
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => playhead.set(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("seeked", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("seeked", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [loaded]);

  const duration = projectDuration(project);
  const seek = useCallback(
    (f: number) => {
      const clamped = Math.max(0, Math.min(duration - 1, Math.round(f)));
      playerRef.current?.seekTo(clamped);
      playhead.set(clamped);
    },
    [duration],
  );
  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isPlaying()) p.pause();
    else {
      if (playhead.get() >= duration - 1) p.seekTo(0);
      p.play();
    }
  };

  // ----- editing actions -----
  const addPayload = useCallback(
    (raw: string | DropPayload, at: number = playhead.get(), trackId: string | null = null) => {
      const payload: DropPayload = typeof raw === "string" ? JSON.parse(raw) : raw;
      const id = uid();
      if (payload.kind === "template") {
        mutate((p) => TEMPLATES.find((t) => t.id === payload.id)?.build(p, at));
        return;
      }
      mutate((p) => {
        let item: Item | null = null;
        if (payload.kind === "comp") {
          const c = EMBEDDABLE[payload.id];
          item = { id, type: "composition", compositionId: payload.id, from: at, durationInFrames: c.durationInFrames, trimStart: 0 };
        } else if (payload.kind === "sticker") {
          item = { id, type: "sticker", sticker: payload.id, from: at, durationInFrames: 4 * p.fps, x: p.width / 2, y: p.height / 2, size: 480, flip: false, opacity: 1 };
        } else if (payload.kind === "text") {
          const preset = TEXT_PRESETS[payload.preset].preset;
          item = { id, type: "text", from: at, durationInFrames: 3 * p.fps, x: p.width / 2, y: p.height / 2, ...structuredClone(preset) };
        } else {
          const a = p.assets.find((x) => x.id === payload.id);
          if (!a) return;
          const dur = a.durationInFrames ?? 5 * p.fps;
          if (a.kind === "audio") {
            item = { id, type: "audio", assetId: a.id, from: at, durationInFrames: dur, trimStart: 0, volume: 1 };
          } else {
            const ar = a.width && a.height ? a.width / a.height : p.width / p.height;
            const fullW = Math.min(p.width, p.height * ar);
            const w = a.kind === "image" ? fullW * 0.6 : fullW;
            const h = w / ar;
            const base = { id, assetId: a.id, from: at, durationInFrames: dur, x: (p.width - w) / 2, y: (p.height - h) / 2, width: w, height: h, opacity: 1 };
            item = a.kind === "image" ? { ...base, type: "image" } : { ...base, type: "video", trimStart: 0, volume: 1 };
          }
        }
        if (item) trackFor(p, item.type, trackId ?? undefined).items.push(item);
      });
      setSelectedId(id);
    },
    [mutate],
  );

  const upload = async (files: File[]) => {
    for (const file of files) {
      try {
        const meta = await probe(file, project.fps);
        const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        mutate((p) => {
          p.assets.push({ id: uid(), name: file.name, src: body.src, ...meta });
        });
      } catch (e) {
        alert(`Không tải được ${file.name}: ${(e as Error).message}`);
      }
    }
  };

  const removeAsset = (id: string) => {
    const used = project.tracks.some((t) => t.items.some((i) => "assetId" in i && i.assetId === id));
    if (used && !confirm("Tư liệu này đang dùng trên timeline. Bỏ nó sẽ xoá luôn các đoạn đó. Tiếp tục?")) return;
    mutate((p) => {
      p.assets = p.assets.filter((a) => a.id !== id);
      for (const t of p.tracks) t.items = t.items.filter((i) => !("assetId" in i) || i.assetId !== id);
    });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    mutate((p) => {
      for (const t of p.tracks) t.items = t.items.filter((i) => i.id !== selectedId);
    });
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    const f = findItem(project, selectedId);
    if (!f) return;
    const id = uid();
    mutate((p) => {
      const src = findItem(p, selectedId)!;
      src.track.items.push({ ...structuredClone(src.item), id, from: itemEnd(src.item) });
    });
    setSelectedId(id);
  };

  // Splits the selected clip at the playhead, or every clip under it when nothing is selected.
  const split = () => {
    const at = playhead.get();
    const sel = findItem(project, selectedId);
    const targets = sel
      ? [sel.item.id]
      : project.tracks.flatMap((t) => t.items).filter((i) => at > i.from && at < itemEnd(i)).map((i) => i.id);
    const valid = targets.filter((id) => {
      const it = findItem(project, id)!.item;
      return at > it.from && at < itemEnd(it);
    });
    if (!valid.length) return;
    mutate((p) => {
      for (const id of valid) splitItemAt(p, id, [at]);
    });
  };

  // ----- automatic tools -----
  // Runs a server-side tool as a background job, showing its log, and resolves with its result.
  const runTool = async <T,>(tool: "scenes" | "transcribe" | "separate", body: object): Promise<T> => {
    const titles = { scenes: "Tìm chuyển cảnh", transcribe: "Tạo phụ đề tự động", separate: "Tách giọng và nhạc nền" };
    setTask({ title: titles[tool], job: { running: true, log: [] } });
    const { id } = await api<{ id: number }>(`/api/tools/${tool}`, { method: "POST", body: JSON.stringify(body) });
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      const job = await api<Job>("/api/job");
      if (job.id !== id) continue;
      setTask({ title: titles[tool], job });
      if (!job.running) {
        if (!job.ok) throw new Error("Công cụ chạy lỗi, xem nhật ký.");
        return job.result as T;
      }
    }
  };

  const assetOf = (item: Item) => ("assetId" in item ? project.assets.find((a) => a.id === item.assetId) : undefined);
  const notify = (title: string, message: string) => setTask({ title, job: { running: false, ok: true, log: [] }, message });


  // Voices `text` with the AI voice and lays it (and optionally a subtitle) on the timeline.
  const addVoice = async (text: string, cfg: VoiceSettings, withSubtitle: boolean, at: number = playhead.get(), replaceTextId?: string) => {
    try {
      const r = await api<{ src: string; seconds: number }>("/api/tts", { method: "POST", body: JSON.stringify({ text, ...cfg }) });
      const dur = Math.max(1, Math.round(r.seconds * project.fps));
      mutate((p) => {
        const asset = { id: uid(), kind: "audio" as const, name: `Giọng AI: ${text.slice(0, 30)}`, src: r.src, durationInFrames: dur };
        p.assets.push(asset);
        let voiceTrack = p.tracks.find((t) => t.kind === "audio" && t.name === "Giọng AI");
        if (!voiceTrack) {
          voiceTrack = { id: uid(), kind: "audio", name: "Giọng AI", items: [] };
          p.tracks.push(voiceTrack);
        }
        voiceTrack.items.push({ id: uid(), type: "audio", assetId: asset.id, from: at, durationInFrames: dur, trimStart: 0, volume: 1 });
        if (replaceTextId) {
          const f = findItem(p, replaceTextId);
          if (f) f.item.durationInFrames = dur;
        } else if (withSubtitle) {
          let subs = p.tracks.find((t) => t.kind === "text" && t.name === "Phụ đề");
          if (!subs) {
            subs = { id: uid(), kind: "text", name: "Phụ đề", items: [] };
            p.tracks.unshift(subs);
          }
          subs.items.push({ id: uid(), type: "text", from: at, durationInFrames: dur, x: p.width / 2, y: p.height - 90, ...structuredClone(TEXT_PRESETS[1].preset), text, fontSize: 46 });
        }
      });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const tools: Tools = {
    splitScenes: async (id) => {
      const item = findItem(project, id)?.item;
      if (!item) return;
      try {
        let cuts: number[];
        if (item.type === "composition") cuts = compositionSceneCuts(item);
        else {
          const asset = assetOf(item);
          if (!asset) return;
          const r = await runTool<{ cuts: number[] }>("scenes", { src: asset.src });
          cuts = r.cuts.map((sec) => Math.round(sec * project.fps));
        }
        const { mutation, count } = splitAtScenes(item, cuts);
        if (count) mutate(mutation);
        notify("Tự chia theo chuyển cảnh", count ? `Đã chia thành ${count + 1} đoạn.` : "Không tìm thấy chỗ chuyển cảnh nào trong đoạn này.");
      } catch (e) {
        notify("Tự chia theo chuyển cảnh", (e as Error).message);
      }
    },
    detachAudio: (id) => {
      const item = findItem(project, id)?.item;
      if (!item) return;
      if (item.type === "video") mutate(detachVideoAudio(item));
      else if (item.type === "composition") mutate(detachCompositionAudio(item));
    },
    separateVoice: async (id) => {
      const item = findItem(project, id)?.item;
      const asset = item ? assetOf(item) : undefined;
      if (!item || !asset) return;
      try {
        const r = await runTool<{ vocals: string; no_vocals: string }>("separate", { src: asset.src });
        mutate(applySeparation(item, r, asset.name));
        notify("Tách giọng và nhạc nền", "Đã tạo 2 lớp âm thanh: giọng và nhạc nền. Đoạn gốc đã được tắt tiếng.");
      } catch (e) {
        notify("Tách giọng và nhạc nền", (e as Error).message);
      }
    },
    readText: (id) => {
      const item = findItem(project, id)?.item;
      if (item?.type !== "text") return;
      addVoice(item.text.replace(/\n/g, " "), { voice: "vi-VN-NamMinhNeural", rate: "+0%", pitch: "+0Hz" }, false, item.from, item.id);
    },
    autoSubtitles: async (id, model) => {
      const item = findItem(project, id)?.item;
      if (!item) return;
      try {
        if (item.type === "composition") {
          const { mutation, count } = compositionSubtitles(item);
          mutate(mutation);
          notify("Phụ đề", `Đã tạo ${count} đoạn phụ đề trên lớp "Phụ đề". Phụ đề in sẵn của tập đã được tắt.`);
          return;
        }
        const asset = assetOf(item);
        if (!asset) return;
        const r = await runTool<{ segments: { start: number; end: number; text: string }[] }>("transcribe", { src: asset.src, model });
        const { mutation, count } = transcriptSubtitles(item, r.segments, project.fps);
        if (count) mutate(mutation);
        notify("Phụ đề tự động", count ? `Đã tạo ${count} đoạn phụ đề. Bấm vào từng đoạn để sửa chữ.` : "Không nhận ra lời nói nào.");
      } catch (e) {
        notify("Phụ đề tự động", (e as Error).message);
      }
    },
  };


  const addTrack = (kind: "visual" | "text" | "audio") =>
    mutate((p) => {
      const label = { visual: "Hình", text: "Chữ", audio: "Âm thanh" }[kind];
      const n = p.tracks.filter((t) => t.kind === kind).length + 1;
      const t = { id: uid(), kind, name: `${label} ${n}`, items: [] };
      if (kind === "audio") p.tracks.push(t);
      else p.tracks.unshift(t);
    });

  // ----- keyboard -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if (ctrl && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        history.redo();
      } else if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (!ctrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        split();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? project.fps : 1;
        seek(playhead.get() + (e.key === "ArrowLeft" ? -step : step));
      } else if (e.key === "Home") seek(0);
      else if (e.key === "End") seek(duration - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ----- export -----
  const startExport = async (opts: { crf: number; scale: number; audioOnly: boolean }) => {
    try {
      await api(`/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify(project) });
      lastSaved.current = JSON.stringify(project);
      await api(`/api/projects/${project.id}/render`, { method: "POST", body: JSON.stringify(opts) });
      setExportOpts(null);
      setExporting({ job: { running: true, log: [] }, audioOnly: opts.audioOnly });
    } catch (e) {
      alert((e as Error).message);
    }
  };
  useEffect(() => {
    if (!exporting?.job.running) return;
    const t = setInterval(async () => {
      const job = await api<Job>("/api/job");
      let output: string | undefined;
      if (!job.running && job.ok) {
        const out = await api<{ url?: string; mtime?: number }>(`/api/projects/${project.id}/output${exporting?.audioOnly ? "?audio=1" : ""}`);
        output = out.url ? `${out.url}?t=${out.mtime}` : undefined;
      }
      setExporting((cur) => ({ job, output, audioOnly: cur?.audioOnly }));
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exporting?.job.running, project.id]);

  const newProject = async () => {
    const name = prompt("Tên dự án mới:", "Dự án mới");
    if (!name) return;
    const p: Project = { ...starterProject(), id: `${slug(name)}-${uid().slice(0, 4)}`, name, tracks: [] };
    await api(`/api/projects/${p.id}`, { method: "PUT", body: JSON.stringify(p) });
    setProjects((ps) => [{ id: p.id, name: p.name }, ...ps]);
    await openProject(p.id);
  };

  const progress = (() => {
    const last = [...(exporting?.job.log ?? [])].reverse().find((l) => /Rendered \d+\/\d+/.test(l));
    const m = last?.match(/Rendered (\d+)\/(\d+)/);
    return m ? Number(m[1]) / Number(m[2]) : 0;
  })();

  const zoomBy = (factor: number) => setPpf((z) => Math.max(0.02, Math.min(12, z * factor)));

  return (
    <div className="app">
      <header className="topbar">
        <div className="left">
          <strong className="brand">Trình dựng video</strong>
          <select value={project.id} onChange={(e) => openProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button onClick={newProject}>+ Dự án mới</button>
          <button onClick={() => setEpisodeOpen("new")}>✨ Tạo tập từ kịch bản</button>
          <span className={`save ${saveState}`}>{saveState === "saving" ? "Đang lưu…" : saveState === "error" ? "Lỗi lưu!" : "Đã lưu"}</span>
        </div>
        <div className="right">
          <button disabled={!history.canUndo} onClick={history.undo} title="Hoàn tác (Ctrl+Z)">
            ↶ Hoàn tác
          </button>
          <button disabled={!history.canRedo} onClick={history.redo} title="Làm lại (Ctrl+Y)">
            ↷ Làm lại
          </button>
          {project.script ? (
            <button onClick={() => setEpisodeOpen("edit")}>📝 Sửa kịch bản</button>
          ) : (
            <a className="button" href="/script" target="_blank" rel="noopener">
              📝 Sửa kịch bản
            </a>
          )}
          <button onClick={() => setTiktokOpen(true)}>📤 TikTok</button>
          <button className="primary" onClick={() => setExportOpts({ crf: 18, scale: 1, audioOnly: false })}>
            Xuất video
          </button>
        </div>
      </header>
      <div className="workspace">
        <Library project={project} onAdd={(p) => addPayload(p)} onAddVoice={(t, c, w) => addVoice(t, c, w)} onUpload={upload} onRemoveAsset={removeAsset} />
        <Preview api={history} playerRef={playerRef} selectedId={selectedId} onSelect={setSelectedId} />
        <Inspector api={history} selectedId={selectedId} busy={!!task?.job.running} tools={tools} onDelete={deleteSelected} onDuplicate={duplicateSelected} />
      </div>
      <div className="tl-toolbar">
        <button className="play" onClick={togglePlay} title="Phát / dừng (Space)">
          {playing ? "❚❚" : "▶"}
        </button>
        <TimeReadout fps={project.fps} duration={duration} />
        <button onClick={split} title="Tách ở đầu phát (S)">
          ✂ Tách
        </button>
        <button onClick={deleteSelected} disabled={!selectedId} title="Xoá (Delete)">
          🗑 Xoá
        </button>
        <span className="sep" />
        <button onClick={() => addTrack("visual")}>+ Lớp hình</button>
        <button onClick={() => addTrack("text")}>+ Lớp chữ</button>
        <button onClick={() => addTrack("audio")}>+ Lớp âm thanh</button>
        <span className="spacer" />
        <button onClick={() => zoomBy(1 / 1.5)} title="Thu nhỏ">
          −
        </button>
        <input type="range" min={-4} max={2.5} step={0.01} value={Math.log10(ppf)} onChange={(e) => setPpf(10 ** Number(e.target.value))} />
        <button onClick={() => zoomBy(1.5)} title="Phóng to">
          +
        </button>
        <button onClick={() => setPpf(Math.max(0.02, (window.innerWidth - 220) / (duration + 5 * project.fps)))}>Vừa khung</button>
      </div>
      <div
        className="tl-wrap"
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
          }
        }}
      >
        <Timeline api={history} selectedId={selectedId} onSelect={setSelectedId} onSeek={seek} ppf={ppf} onDropPayload={addPayload} />
      </div>
      {task ? (
        <div className="modal-bg">
          <div className="modal">
            <h3>{task.title}</h3>
            {task.job.running ? <p>Đang chạy… Lần đầu dùng công cụ AI sẽ mất thêm thời gian để tải mô hình.</p> : null}
            {task.message ? <p>{task.message}</p> : null}
            {(task.job.log ?? []).length ? <pre className="log">{(task.job.log ?? []).slice(-10).join("\n")}</pre> : null}
            <div className="modal-actions">
              <button disabled={task.job.running} onClick={() => setTask(null)}>
                {task.job.running ? "Đang chạy…" : "Đóng"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {tiktokOpen ? (
        <TikTokDialog
          project={project}
          onClose={() => setTiktokOpen(false)}
          onExport={() => {
            setTiktokOpen(false);
            setExportOpts({ crf: 18, scale: 1, audioOnly: false });
          }}
        />
      ) : null}
      {episodeOpen ? (
        <EpisodeDialog
          existing={episodeOpen === "edit" ? project : undefined}
          onClose={() => setEpisodeOpen(null)}
          onCreated={async (id, name) => {
            setEpisodeOpen(null);
            setProjects((ps) => [{ id, name }, ...ps.filter((x) => x.id !== id)]);
            await openProject(id);
          }}
        />
      ) : null}
      {exportOpts ? (
        <div className="modal-bg">
          <div className="modal">
            <h3>Xuất video</h3>
            <div className="opt-row">
              <span>Loại file</span>
              <select value={exportOpts.audioOnly ? "mp3" : "mp4"} onChange={(e) => setExportOpts({ ...exportOpts, audioOnly: e.target.value === "mp3" })}>
                <option value="mp4">Video MP4</option>
                <option value="mp3">Chỉ âm thanh MP3</option>
              </select>
            </div>
            {!exportOpts.audioOnly ? (
              <>
                <div className="opt-row">
                  <span>Độ phân giải</span>
                  <select value={exportOpts.scale} onChange={(e) => setExportOpts({ ...exportOpts, scale: Number(e.target.value) })}>
                    <option value={1}>
                      Gốc ({project.width}×{project.height})
                    </option>
                    <option value={2 / 3}>
                      Giảm 2/3 ({Math.round((project.width * 2) / 3)}×{Math.round((project.height * 2) / 3)})
                    </option>
                    <option value={0.5}>
                      Một nửa ({project.width / 2}×{project.height / 2})
                    </option>
                  </select>
                </div>
                <div className="opt-row">
                  <span>Chất lượng</span>
                  <select value={exportOpts.crf} onChange={(e) => setExportOpts({ ...exportOpts, crf: Number(e.target.value) })}>
                    <option value={16}>Rất cao (file lớn)</option>
                    <option value={18}>Cao</option>
                    <option value={23}>Trung bình</option>
                    <option value={28}>Nhẹ (file nhỏ, gửi nhanh)</option>
                  </select>
                </div>
              </>
            ) : null}
            <p className="hint">
              Thời lượng {fmtTime(duration, project.fps)}. Video dài vài phút có thể mất 5–15 phút để xuất.
            </p>
            <div className="modal-actions" style={{ gap: 8 }}>
              <button onClick={() => setExportOpts(null)}>Huỷ</button>
              <button className="primary" onClick={() => startExport(exportOpts)}>
                Bắt đầu xuất
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {exporting ? (
        <div className="modal-bg">
          <div className="modal">
            <h3>Xuất video</h3>
            {exporting.job.running ? (
              <>
                <div className="bar">
                  <div style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p>{progress ? `Đang xuất… ${Math.round(progress * 100)}%` : "Đang chuẩn bị…"}</p>
              </>
            ) : exporting.job.ok ? (
              <>
                <p>
                  Xong! File nằm ở out/{project.id}.{exporting.audioOnly ? "mp3" : "mp4"}
                </p>
                {exporting.output ? (
                  exporting.audioOnly ? (
                    <audio src={exporting.output} controls style={{ width: "100%" }} />
                  ) : (
                    <video src={exporting.output} controls style={{ width: "100%" }} />
                  )
                ) : null}
              </>
            ) : (
              <p className="error">Xuất lỗi. Xem chi tiết bên dưới.</p>
            )}
            <pre className="log">{(exporting.job.log ?? []).slice(-8).join("\n")}</pre>
            <div className="modal-actions">
              <button onClick={() => setExporting(null)}>{exporting.job.running ? "Chạy nền" : "Đóng"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
