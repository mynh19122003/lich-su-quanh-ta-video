import React, { useState } from "react";
import type { Project } from "../../src/project/types";
import { buildEpisode, characterFor, EXAMPLE_SCRIPT, parseScript, type VoicedLine } from "./episode";
import { uid } from "./store";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "tap-moi";

// With `existing`, edits that episode's script and rebuilds it in place.
type Props = { existing?: Project; onClose: () => void; onCreated: (id: string, name: string) => void };

// "Tạo tập từ kịch bản": voices every line, then lays out a new project.
export const EpisodeDialog: React.FC<Props> = ({ existing, onClose, onCreated }) => {
  const [name, setName] = useState(existing?.name ?? "Tập mới");
  const [script, setScript] = useState(existing?.script?.text ?? EXAMPLE_SCRIPT);
  const [frame, setFrame] = useState<"16:9" | "9:16">(existing?.script?.frame ?? "16:9");
  const [music, setMusic] = useState(existing?.script?.music ?? true);
  const [progress, setProgress] = useState<{ done: number; total: number; line: string } | null>(null);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  // Finished voice lines, kept across retries so only the failed ones are voiced again.
  const voicedRef = React.useRef(new Map<string, VoicedLine>());

  const scenes = parseScript(script);
  const total = scenes.reduce((n, s) => n + s.lines.length, 0);
  const keyOf = (who: string, text: string) => JSON.stringify([text, characterFor(who).voice]);

  const voiceLine = async (who: string, text: string) => {
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, ...characterFor(who).voice }),
        });
        const body = await res.json();
        if (res.ok) return body as VoicedLine;
        lastError = body.error;
      } catch (e) {
        lastError = (e as Error).message;
      }
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    throw new Error(lastError || "Không đọc được");
  };

  const generate = async () => {
    setError("");
    setFailed([]);
    const lines = scenes.flatMap((sc) => sc.lines);
    const todo = lines.filter((l) => !voicedRef.current.has(keyOf(l.who, l.text)));
    let done = lines.length - todo.length;
    const bad: string[] = [];
    setProgress({ done, total, line: "Đang đọc giọng…" });
    // The server voices one line at a time (the service rejects parallel requests); two workers
    // keep its queue busy without piling up requests.
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const l = todo[next++];
        try {
          voicedRef.current.set(keyOf(l.who, l.text), await voiceLine(l.who, l.text));
          done++;
          setProgress({ done, total, line: `${l.who}: ${l.text}` });
        } catch {
          bad.push(`${l.who}: ${l.text}`);
        }
      }
    };
    await Promise.all([worker(), worker()]);
    if (bad.length) {
      setFailed(bad);
      setError(`Dịch vụ giọng đọc đang chập chờn: còn ${bad.length} câu chưa đọc được. Bấm “Thử lại các câu lỗi”, các câu đã xong được giữ nguyên.`);
      setProgress(null);
      return;
    }
    try {
      setProgress({ done, total, line: "Đang dựng timeline…" });
      const voiced: VoicedLine[][] = scenes.map((sc) => sc.lines.map((l) => voicedRef.current.get(keyOf(l.who, l.text))!));
      const [width, height] = frame === "16:9" ? [1920, 1080] : [1080, 1920];
      const id = existing?.id ?? `${slug(name)}-${uid().slice(0, 4)}`;
      const project = buildEpisode({ id, name, width, height, music, script: { text: script, frame, music } }, scenes, voiced);
      const res = await fetch(`/api/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) });
      if (!res.ok) throw new Error("Không lưu được dự án");
      onCreated(id, name);
    } catch (e) {
      setError((e as Error).message);
      setProgress(null);
    }
  };

  return (
    <div className="modal-bg">
      <div className="modal wide">
        <h3>{existing ? `📝 Sửa kịch bản: ${existing.name}` : "✨ Tạo tập từ kịch bản"}</h3>
        {existing && !progress ? (
          <p className="hint">
            “Cập nhật tập” dựng lại toàn bộ timeline của tập này từ kịch bản. Những gì bạn đã sửa tay trên timeline của tập này sẽ bị thay. Câu không đổi dùng lại giọng cũ nên rất nhanh.
          </p>
        ) : null}
        {progress ? (
          <>
            <div className="bar">
              <div style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
            </div>
            <p>
              Đang đọc giọng {progress.done}/{progress.total}…
            </p>
            <p className="hint">{progress.line}</p>
          </>
        ) : (
          <>
            <div className="opt-row">
              <span>Tên tập</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="opt-row">
              <span>Khung hình</span>
              <select value={frame} onChange={(e) => setFrame(e.target.value as "16:9" | "9:16")}>
                <option value="16:9">16:9 ngang (YouTube)</option>
                <option value="9:16">9:16 dọc (TikTok, Reels, Shorts)</option>
              </select>
            </div>
            <label className="check">
              <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> Thêm nhạc nền mẫu
            </label>
            <label className="field">Kịch bản</label>
            <textarea className="script" rows={14} value={script} onChange={(e) => setScript(e.target.value)} />
            <div className="hint script-help">
              <p>
                <b>Dòng bắt đầu bằng #</b> mở một cảnh: <code># Tên cảnh | nền: giấy | nhân vật: Pháp, Việt Minh</code>
              </p>
              <p>
                <b>Nền:</b> giấy, phòng họp, bầu trời, bảng đen, đêm, chiến trường, bản đồ, hoặc mã màu như #22313f.
              </p>
              <p>
                <b>Mỗi câu thoại:</b> <code>Tên: lời nói</code>. Nhân vật có hình và giọng riêng: Người dẫn, Người dẫn nữ, Cô giáo, Việt Minh, Pháp, Mỹ, Liên Xô, Trung Quốc, Anh, Ngô Đình Diệm, Bảo Đại, Người dân.
                Tên khác sẽ dùng giọng người dẫn.
              </p>
              <p>
                Đang có {scenes.length} cảnh, {total} câu. Mỗi câu mất khoảng 1–3 giây để đọc giọng.
              </p>
            </div>
            {error ? <p className="error">{error}</p> : null}
            {failed.length ? (
              <ul className="failed">
                {failed.slice(0, 6).map((f) => (
                  <li key={f}>{f}</li>
                ))}
                {failed.length > 6 ? <li>… và {failed.length - 6} câu khác</li> : null}
              </ul>
            ) : null}
          </>
        )}
        <div className="modal-actions" style={{ gap: 8 }}>
          <button disabled={!!progress} onClick={onClose}>
            Huỷ
          </button>
          <button className="primary" disabled={!!progress || !total} onClick={generate}>
            {failed.length ? "Thử lại các câu lỗi" : existing ? "Cập nhật tập" : "Tạo tập"}
          </button>
        </div>
      </div>
    </div>
  );
};
