import React, { useEffect, useMemo, useState } from "react";
import { projectDuration, type Project } from "../../src/project/types";
import { buildCaption, captionIdeas } from "./caption";
import { TikTokSchedule } from "./TikTokSchedule";

type Status = {
  configured: boolean;
  clientKeyHint: string | null;
  connected: boolean;
  scopes: string[];
  directPost: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  redirectUri: string;
};
type Creator = {
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
};

const PRIVACY: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Mọi người",
  MUTUAL_FOLLOW_FRIENDS: "Bạn bè (theo dõi lẫn nhau)",
  FOLLOWER_OF_CREATOR: "Người theo dõi",
  SELF_ONLY: "Chỉ mình tôi",
};
type Job = { id?: number; running?: boolean; ok?: boolean | null; log?: string[] };

const call = async <T,>(url: string, opts: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Lỗi ${res.status}`);
  return body as T;
};

type Props = { project: Project; onClose: () => void; onExport: () => void };

// "Đăng lên TikTok": link the account, write the caption, send the exported video as a draft.
export const TikTokDialog: React.FC<Props> = ({ project, onClose, onExport }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [keys, setKeys] = useState({ clientKey: "", clientSecret: "" });
  const [editKeys, setEditKeys] = useState(false);
  const [output, setOutput] = useState<{ url?: string; mtime?: number } | null>(null);
  const ideas = useMemo(() => captionIdeas(project), [project]);
  const [title, setTitle] = useState(ideas.titles[0]);
  const [caption, setCaption] = useState(buildCaption(ideas.titles[0], ideas.description, ideas.hashtags));
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"draft" | "direct">("draft");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [creatorError, setCreatorError] = useState("");
  // TikTok requires the user to pick the audience themselves: no default.
  const [privacy, setPrivacy] = useState("");
  const [allow, setAllow] = useState({ comment: true, duet: false, stitch: false });

  const refresh = () => call<Status>("/api/tiktok/status").then(setStatus).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
    call<{ url?: string; mtime?: number }>(`/api/projects/${project.id}/output`).then(setOutput);
    // The login window tells us when it is done.
    const onMsg = (e: MessageEvent) => e.data === "tiktok-connected" && refresh();
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [project.id]);

  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(async () => {
      const j = await call<Job>("/api/job");
      if (j.id === job.id) setJob(j);
    }, 1500);
    return () => clearInterval(t);
  }, [job?.running, job?.id]);

  const copy = async (text = caption) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Trình duyệt không cho sao chép tự động, hãy bôi đen rồi Ctrl+C.");
    }
  };

  const canDirect = !!status?.connected && !!status.scopes?.includes("video.publish");
  useEffect(() => {
    if (mode !== "direct" || !canDirect) return;
    setCreatorError("");
    call<Creator>("/api/tiktok/creator")
      .then(setCreator)
      .catch((e) => setCreatorError(`Không lấy được thông tin kênh: ${(e as Error).message}`));
  }, [mode, canDirect]);
  const tooLong = !!creator?.max_video_post_duration_sec && projectDuration(project) / project.fps > creator.max_video_post_duration_sec;

  const enableDirect = async () => {
    try {
      await call("/api/tiktok/direct-post", { method: "POST", body: JSON.stringify({ enabled: true }) });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const publish = async () => {
    setError("");
    try {
      const { id } = await call<{ id: number }>("/api/tiktok/publish", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          title: caption,
          privacy,
          disableComment: creator?.comment_disabled || !allow.comment,
          disableDuet: creator?.duet_disabled || !allow.duet,
          disableStitch: creator?.stitch_disabled || !allow.stitch,
        }),
      });
      setJob({ id, running: true, log: [] });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveKeys = async () => {
    setError("");
    try {
      await call("/api/tiktok/config", { method: "POST", body: JSON.stringify(keys) });
      setKeys({ clientKey: "", clientSecret: "" });
      setEditKeys(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const send = async () => {
    setError("");
    try {
      await copy();
      const { id } = await call<{ id: number }>("/api/tiktok/send", { method: "POST", body: JSON.stringify({ projectId: project.id }) });
      setJob({ id, running: true, log: [] });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const vertical = project.height > project.width;
  const sent = job && !job.running && job.ok;

  return (
    <div className="modal-bg">
      <div className="modal wide tiktok">
        <h3>📤 Đăng lên TikTok</h3>

        <section>
          <h4>1. Tài khoản</h4>
          {!status ? (
            <p className="hint">Đang kiểm tra…</p>
          ) : !status.configured || editKeys ? (
            <>
              <p className="hint">
                Dán Client Key và Client Secret của ứng dụng TikTok bạn đã tạo (xem file <code>TIKTOK.md</code> để biết cách tạo). Khoá chỉ lưu trên máy này,
                trong thư mục <code>.tiktok/</code>.
              </p>
              <div className="opt-row">
                <span>Client Key</span>
                <input type="text" value={keys.clientKey} onChange={(e) => setKeys({ ...keys, clientKey: e.target.value })} autoComplete="off" />
              </div>
              <div className="opt-row">
                <span>Client Secret</span>
                <input type="password" value={keys.clientSecret} onChange={(e) => setKeys({ ...keys, clientSecret: e.target.value })} autoComplete="off" />
              </div>
              <p className="hint">
                Địa chỉ chuyển hướng (Redirect URI) cần khai báo trong app TikTok: <code>{status.redirectUri}</code>
              </p>
              <button className="primary" onClick={saveKeys}>
                Lưu khoá
              </button>{" "}
              {editKeys ? <button onClick={() => setEditKeys(false)}>Huỷ</button> : null}
            </>
          ) : status.connected ? (
            <div className="tt-account">
              {status.avatarUrl ? <img src={status.avatarUrl} alt="" /> : null}
              <span>
                Đã kết nối: <b>{status.displayName ?? "tài khoản TikTok"}</b>
              </span>
              <span className="spacer" />
              <button className="small" onClick={() => call("/api/tiktok/disconnect", { method: "POST" }).then(refresh)}>
                Ngắt kết nối
              </button>
            </div>
          ) : (
            <div className="tt-account">
              <span className="hint">Khoá ứng dụng: {status.clientKeyHint}</span>
              <span className="spacer" />
              <button className="small" onClick={() => setEditKeys(true)}>
                Đổi khoá
              </button>
              <button className="primary" onClick={() => window.open("/tiktok/login", "tiktok-login", "width=520,height=760")}>
                Kết nối tài khoản TikTok
              </button>
            </div>
          )}
        </section>

        <section>
          <h4>2. Video</h4>
          {output?.url ? (
            <p className="hint">
              Dùng file đã xuất <code>out/{project.id}.mp4</code> (xuất lúc {new Date(output.mtime!).toLocaleString("vi-VN")}). Nếu bạn sửa dự án sau lúc đó,
              hãy xuất lại trước khi gửi.{" "}
              <button className="small" onClick={onExport}>
                Xuất lại
              </button>
            </p>
          ) : (
            <p className="hint">
              Dự án chưa có video xuất ra.{" "}
              <button className="small primary" onClick={onExport}>
                Xuất video trước
              </button>
            </p>
          )}
          {!vertical ? <p className="hint">Mẹo: TikTok hiển thị đẹp nhất với khung dọc 9:16 (đổi trong phần Dự án).</p> : null}
        </section>

        <section>
          <h4>3. Tiêu đề và hashtag</h4>
          <div className="tt-titles">
            {ideas.titles.map((t) => (
              <label key={t} className="check">
                <input
                  type="radio"
                  checked={t === title}
                  onChange={() => {
                    setTitle(t);
                    setCaption(buildCaption(t, ideas.description, ideas.hashtags));
                  }}
                />
                {t}
              </label>
            ))}
          </div>
          <textarea rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <p className="hint">
            {caption.length}/2200 ký tự.{" "}
            <button className="small" onClick={() => copy()}>
              {copied ? "Đã sao chép ✓" : "Sao chép"}
            </button>{" "}
            Kiểu gửi bản nháp của TikTok không nhận tiêu đề từ app, nên tiêu đề được sao chép sẵn để bạn dán khi bấm đăng trong TikTok.
          </p>
        </section>


        <section>
          <h4>4. Cách đăng</h4>
          <label className="check">
            <input type="radio" checked={mode === "draft"} onChange={() => setMode("draft")} /> Gửi bản nháp vào hộp thư (bạn bấm đăng trong app TikTok trên điện thoại)
          </label>
          <label className="check">
            <input type="radio" checked={mode === "direct"} onChange={() => setMode("direct")} /> Tự đăng thẳng lên trang cá nhân, kèm tiêu đề
          </label>
          {mode === "direct" ? (
            !status?.directPost ? (
              <div className="tt-direct">
                <p className="hint">
                  Tự đăng cần quyền <code>video.publish</code>. Trong trang TikTok for Developers (Sandbox) → <b>Content Posting API</b>, bật <b>Direct Post</b>, rồi ở{" "}
                  <b>Scopes</b> thêm <code>video.publish</code> và lưu lại. Xong bấm nút dưới đây và kết nối tài khoản lại một lần.
                </p>
                <button className="primary" onClick={enableDirect}>
                  Tôi đã bật Direct Post
                </button>
              </div>
            ) : !status.scopes.includes("video.publish") ? (
              <div className="tt-direct">
                <p className="hint">Cần kết nối lại tài khoản để cấp thêm quyền tự đăng.</p>
                <button className="primary" onClick={() => window.open("/tiktok/login", "tiktok-login", "width=520,height=760")}>
                  Kết nối lại tài khoản TikTok
                </button>{" "}
                <button className="small" onClick={() => call("/api/tiktok/direct-post", { method: "POST", body: JSON.stringify({ enabled: false }) }).then(refresh)}>
                  Thôi, không dùng tự đăng
                </button>
              </div>
            ) : !creator ? (
              <p className="hint">{creatorError || "Đang lấy thông tin kênh…"}</p>
            ) : (
              <div className="tt-direct">
                <p className="hint">
                  Đăng lên kênh <b>{creator.creator_nickname}</b>
                  {creator.max_video_post_duration_sec ? ` · video tối đa ${Math.floor(creator.max_video_post_duration_sec / 60)} phút` : ""}
                </p>
                {tooLong ? <p className="error">Video dài hơn giới hạn của kênh, TikTok sẽ từ chối.</p> : null}
                <div className="opt-row">
                  <span>Ai được xem</span>
                  <select value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
                    <option value="">Chọn…</option>
                    {creator.privacy_level_options.map((o) => (
                      <option key={o} value={o}>
                        {PRIVACY[o] ?? o}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="check">
                  <input type="checkbox" checked={allow.comment} disabled={creator.comment_disabled} onChange={(e) => setAllow({ ...allow, comment: e.target.checked })} /> Cho bình luận
                </label>
                <label className="check">
                  <input type="checkbox" checked={allow.duet} disabled={creator.duet_disabled} onChange={(e) => setAllow({ ...allow, duet: e.target.checked })} /> Cho Duet
                </label>
                <label className="check">
                  <input type="checkbox" checked={allow.stitch} disabled={creator.stitch_disabled} onChange={(e) => setAllow({ ...allow, stitch: e.target.checked })} /> Cho Stitch
                </label>
                <p className="hint">
                  App chưa được TikTok duyệt nên chỉ đăng được ở chế độ <b>Chỉ mình tôi</b>, và tài khoản phải đang để <b>riêng tư</b> lúc đăng. Muốn công khai: sau khi đăng,
                  chuyển tài khoản về công khai rồi đổi video sang “Mọi người” trong TikTok Studio. Khi đăng, bạn đồng ý với{" "}
                  <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">
                    Xác nhận sử dụng nhạc của TikTok
                  </a>
                  .
                </p>
              </div>
            )
          ) : null}
        </section>

        <section>
          <h4>5. Lịch gửi bản nháp mỗi ngày</h4>
          <TikTokSchedule project={project} caption={caption} connected={!!status?.connected} />
        </section>

        {job ? (
          <section>
            <h4>{job.running ? "Đang gửi…" : sent ? (mode === "direct" ? "Đã đăng ✓" : "Đã gửi ✓") : "Gửi lỗi"}</h4>
            <pre className="log">{(job.log ?? []).slice(-6).join("\n")}</pre>
            {sent && mode === "direct" ? <p>Video đã lên trang cá nhân của bạn. Vào TikTok Studio để đổi chế độ hiển thị nếu muốn công khai.</p> : null}
            {sent && mode === "draft" ? (
              <p>
                Mở app TikTok trên điện thoại → <b>Hộp thư</b> → thông báo bản nháp → dán tiêu đề đã sao chép → <b>Đăng</b>.
              </p>
            ) : null}
          </section>
        ) : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="modal-actions" style={{ gap: 8 }}>
          <button onClick={onClose} disabled={!!job?.running}>
            Đóng
          </button>
          {mode === "draft" ? (
            <button className="primary" disabled={!status?.connected || !output?.url || !!job?.running} onClick={send}>
              Gửi bản nháp lên TikTok
            </button>
          ) : (
            <button className="primary" disabled={!canDirect || !creator || !privacy || !output?.url || tooLong || !!job?.running} onClick={publish}>
              Đăng lên TikTok
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
