import React, { useEffect, useState } from "react";
import type { Project } from "../../src/project/types";

type QueueItem = {
  id: string;
  projectId: string;
  name: string;
  caption: string;
  status: "waiting" | "sending" | "sent" | "failed";
  sentAt?: number;
  error?: string | null;
  exported: boolean;
};
type Schedule = { enabled: boolean; time: string; nextRun: number | null; queue: QueueItem[] };

const call = async (url: string, body?: unknown, method = "POST"): Promise<Schedule> => {
  const res = await fetch(url, body === undefined ? {} : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Lỗi ${res.status}`);
  return json;
};

const when = (t: number) => {
  const d = new Date(t);
  const day = d.toDateString() === new Date().toDateString() ? "hôm nay" : d.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" });
  return `${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${day}`;
};

const STATUS: Record<QueueItem["status"], string> = { waiting: "Chờ", sending: "Đang gửi…", sent: "Đã gửi", failed: "Lỗi" };

// "Lịch gửi bản nháp": every day at a set time, the next clip in the queue goes to the TikTok inbox.
export const TikTokSchedule: React.FC<{ project: Project; caption: string; connected: boolean }> = ({ project, caption, connected }) => {
  const [s, setS] = useState<Schedule | null>(null);
  const [error, setError] = useState("");

  const run = (p: Promise<Schedule>) =>
    p.then((v) => (setS(v), setError(""))).catch((e) => setError((e as Error).message));

  useEffect(() => {
    run(call("/api/tiktok/schedule"));
    const t = setInterval(() => run(call("/api/tiktok/schedule")), 5000);
    return () => clearInterval(t);
  }, []);

  if (!s) return <p className="hint">Đang tải lịch…</p>;
  const item = (id: string, action: string) => run(call("/api/tiktok/schedule/item", { id, action }));
  const nextId = s.queue.find((q) => q.status === "waiting")?.id;
  const queued = s.queue.some((q) => q.projectId === project.id && q.status === "waiting");

  return (
    <>
      <p className="hint">
        Mỗi ngày đúng giờ đã đặt, trình dựng gửi clip kế tiếp trong hàng chờ vào hộp thư TikTok. Bạn mở app, gắn chú thích rồi bấm Đăng. Trình dựng phải đang chạy
        vào giờ đó. Nếu lúc đó máy tắt, clip sẽ được gửi ngay khi bạn mở lại trình dựng trong ngày.
      </p>
      <div className="opt-row">
        <label className="check">
          <input type="checkbox" checked={s.enabled} disabled={!connected} onChange={(e) => run(call("/api/tiktok/schedule", { enabled: e.target.checked }, "PUT"))} /> Bật gửi
          tự động mỗi ngày lúc
        </label>
        <input type="time" value={s.time} onChange={(e) => e.target.value && run(call("/api/tiktok/schedule", { time: e.target.value }, "PUT"))} />
      </div>
      <p className="hint">
        {!connected
          ? "Cần kết nối tài khoản TikTok trước."
          : s.nextRun
            ? `Lần gửi tới: ${when(s.nextRun)} · ${s.queue.find((q) => q.id === nextId)?.name}`
            : s.enabled
              ? "Hàng chờ đang trống, thêm clip để bắt đầu."
              : "Đang tắt."}
      </p>
      <button className="small" disabled={queued} onClick={() => run(call("/api/tiktok/schedule/add", { projectId: project.id, name: project.name, caption }))}>
        {queued ? "Dự án này đã có trong hàng chờ" : "＋ Thêm dự án này vào hàng chờ"}
      </button>
      {s.queue.length ? (
        <ul className="tt-queue">
          {s.queue.map((q, i) => (
            <li key={q.id} className={q.status}>
              <span className={`tag ${q.id === nextId ? "next" : q.status}`}>{q.id === nextId ? "Tiếp theo" : STATUS[q.status]}</span>
              <span className="name" title={q.error ?? q.caption}>
                {q.name}
                {q.status === "sent" && q.sentAt ? ` · ${new Date(q.sentAt).toLocaleString("vi-VN")}` : ""}
                {!q.exported && q.status !== "sent" ? " · ⚠ chưa xuất video" : ""}
                {q.error && q.status !== "sent" ? ` · ${q.error}` : ""}
              </span>
              {q.status === "failed" ? (
                <button className="small" onClick={() => item(q.id, "retry")}>
                  Thử lại
                </button>
              ) : null}
              {q.caption ? (
                <button className="small" title="Sao chép chú thích gợi ý" onClick={() => navigator.clipboard.writeText(q.caption).catch(() => undefined)}>
                  📋
                </button>
              ) : null}
              <button className="small" disabled={i === 0} onClick={() => item(q.id, "up")}>
                ↑
              </button>
              <button className="small" disabled={i === s.queue.length - 1} onClick={() => item(q.id, "down")}>
                ↓
              </button>
              <button className="small" disabled={q.status === "sending"} onClick={() => item(q.id, "remove")}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </>
  );
};
