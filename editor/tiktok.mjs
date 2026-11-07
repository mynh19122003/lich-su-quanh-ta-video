// TikTok account link (Login Kit for Desktop, PKCE) and "send to inbox" draft upload.
// Keys and tokens live in .tiktok/ at the project root, never in the browser or in git.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const USER_URL = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url";
const INBOX_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
const CREATOR_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const DIRECT_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
// video.publish (Direct Post) is only requested once the user has enabled it for their app.
const scopesFor = (config) => `user.info.basic,video.upload${config?.directPost ? ",video.publish" : ""}`;

export const createTiktok = ({ root, port }) => {
  const dir = path.join(root, ".tiktok");
  const configFile = path.join(dir, "config.json");
  const tokenFile = path.join(dir, "tokens.json");
  // Must be registered exactly like this in the TikTok developer portal (Login Kit, Desktop).
  const redirectUri = `http://localhost:${port}/tiktok/callback/`;
  const pending = new Map(); // state -> code_verifier, for logins in progress

  const readJson = async (file) => (existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null);
  const writeJson = async (file, data) => {
    mkdirSync(dir, { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 1), "utf8");
  };

  const tokenRequest = async (fields) => {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams(fields),
    });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(body.error_description || body.error || `TikTok trả lỗi ${res.status}`);
    const now = Date.now();
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      openId: body.open_id,
      scope: body.scope,
      expiresAt: now + body.expires_in * 1000,
      refreshExpiresAt: now + body.refresh_expires_in * 1000,
    };
  };

  // A valid access token, refreshed when it is about to expire (refresh tokens rotate).
  const accessToken = async () => {
    const config = await readJson(configFile);
    const tokens = await readJson(tokenFile);
    if (!config || !tokens) throw new Error("Chưa kết nối tài khoản TikTok");
    if (tokens.expiresAt - Date.now() > 5 * 60 * 1000) return tokens.accessToken;
    if (tokens.refreshExpiresAt < Date.now()) throw new Error("Phiên đăng nhập TikTok đã hết hạn, hãy kết nối lại");
    const fresh = await tokenRequest({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    });
    await writeJson(tokenFile, { ...tokens, ...fresh });
    return fresh.accessToken;
  };

  const api = async (url, token, body) => {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json; charset=UTF-8" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json.error && json.error.code !== "ok")) {
      throw new Error(`${json.error?.code ?? res.status}: ${json.error?.message ?? "lỗi không rõ"}`);
    }
    return json.data;
  };

  const status = async () => {
    const config = await readJson(configFile);
    const tokens = await readJson(tokenFile);
    return {
      configured: !!config,
      clientKeyHint: config ? `${config.clientKey.slice(0, 4)}…` : null,
      connected: !!tokens && tokens.refreshExpiresAt > Date.now(),
      scopes: tokens?.scope?.split(",") ?? [],
      directPost: !!config?.directPost,
      displayName: tokens?.displayName ?? null,
      avatarUrl: tokens?.avatarUrl ?? null,
      redirectUri,
    };
  };

  const saveConfig = async ({ clientKey, clientSecret }) => {
    if (!clientKey?.trim() || !clientSecret?.trim()) throw new Error("Cần cả Client Key và Client Secret");
    const old = await readJson(configFile);
    await writeJson(configFile, { clientKey: clientKey.trim(), clientSecret: clientSecret.trim(), directPost: !!old?.directPost });
    await rm(tokenFile, { force: true }); // keys changed: the old login no longer applies
  };

  const loginUrl = async () => {
    const config = await readJson(configFile);
    if (!config) throw new Error("Chưa nhập Client Key / Client Secret");
    const state = randomBytes(16).toString("hex");
    const verifier = randomBytes(48).toString("base64url").replace(/[^A-Za-z0-9\-._~]/g, "").slice(0, 64);
    pending.set(state, { verifier, at: Date.now() });
    for (const [k, v] of pending) if (Date.now() - v.at > 15 * 60 * 1000) pending.delete(k);
    // TikTok desktop PKCE uses a hex-encoded SHA-256 of the verifier (not base64url).
    const challenge = createHash("sha256").update(verifier).digest("hex");
    const q = new URLSearchParams({
      client_key: config.clientKey,
      response_type: "code",
      scope: scopesFor(config),
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `${AUTH_URL}?${q}`;
  };

  const handleCallback = async (params) => {
    if (params.get("error")) throw new Error(params.get("error_description") || params.get("error"));
    const state = params.get("state");
    const entry = pending.get(state);
    if (!entry) throw new Error("Phiên đăng nhập không hợp lệ hoặc đã quá hạn, hãy thử kết nối lại");
    pending.delete(state);
    const config = await readJson(configFile);
    const tokens = await tokenRequest({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      code: params.get("code"),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: entry.verifier,
    });
    let user = {};
    try {
      user = (await api(USER_URL, tokens.accessToken)).user ?? {};
    } catch {
      // the name is only for display
    }
    await writeJson(tokenFile, { ...tokens, displayName: user.display_name ?? null, avatarUrl: user.avatar_url ?? null });
  };

  const disconnect = async () => {
    const config = await readJson(configFile);
    const tokens = await readJson(tokenFile);
    if (config && tokens) {
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_key: config.clientKey, client_secret: config.clientSecret, token: tokens.accessToken }),
      }).catch(() => undefined);
    }
    await rm(tokenFile, { force: true });
  };

  // Turning Direct Post on adds a scope, so the user has to log in again to grant it.
  const setDirectPost = async (enabled) => {
    const config = await readJson(configFile);
    if (!config) throw new Error("Chưa nhập Client Key / Client Secret");
    await writeJson(configFile, { ...config, directPost: !!enabled });
  };

  const creatorInfo = async () => api(CREATOR_URL, await accessToken(), {});

  // Chunks must be 5-64 MB and never larger than the file; files up to 64 MB go up in one piece.
  // The last chunk takes the remainder.
  const sourceInfo = (file) => {
    const size = statSync(file).size;
    const MB = 1024 * 1024;
    const chunkSize = size <= 64 * MB ? size : 10 * MB;
    const count = Math.max(1, Math.floor(size / chunkSize));
    return { size, chunkSize, count, info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: count } };
  };

  const uploadChunks = async (file, uploadUrl, { size, chunkSize, count }, log) => {
    const fd = openSync(file, "r");
    try {
      for (let i = 0; i < count; i++) {
        const start = i * chunkSize;
        const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
        const buf = Buffer.alloc(end - start + 1);
        readSync(fd, buf, 0, buf.length, start);
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "video/mp4", "Content-Length": String(buf.length), "Content-Range": `bytes ${start}-${end}/${size}` },
          body: buf,
        });
        if (res.status !== 201 && res.status !== 206) throw new Error(`Tải phần ${i + 1} lỗi (${res.status}): ${await res.text()}`);
        log(`Đã tải ${i + 1}/${count} phần`);
      }
    } finally {
      closeSync(fd);
    }
  };

  // Uploads `file` to the user's TikTok inbox as a draft. `log` receives progress lines.
  const sendDraft = async (file, log) => {
    const src = sourceInfo(file);
    log(`Video ${(src.size / 1048576).toFixed(1)} MB, chia ${src.count} phần`);
    const init = await api(INBOX_INIT_URL, await accessToken(), { source_info: src.info });
    await uploadChunks(file, init.upload_url, src, log);
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const s = await api(STATUS_URL, await accessToken(), { publish_id: init.publish_id });
      if (s.status === "SEND_TO_USER_INBOX" || s.status === "PUBLISH_COMPLETE") {
        log("TikTok đã nhận video và gửi bản nháp vào hộp thư của bạn");
        return { publishId: init.publish_id, status: s.status };
      }
      if (s.status === "FAILED") throw new Error(`TikTok từ chối video: ${s.fail_reason}`);
      log(`TikTok đang xử lý… (${s.status})`);
    }
    log("TikTok vẫn đang xử lý; bản nháp sẽ xuất hiện trong hộp thư khi xong");
    return { publishId: init.publish_id, status: "PROCESSING" };
  };

  // Posts `file` straight to the profile with its caption (Direct Post, scope video.publish).
  // Unaudited apps may only use SELF_ONLY, and only while the account itself is private.
  const directPost = async (file, opts, log) => {
    const src = sourceInfo(file);
    log(`Video ${(src.size / 1048576).toFixed(1)} MB, chia ${src.count} phần`);
    const init = await api(DIRECT_INIT_URL, await accessToken(), {
      post_info: {
        title: opts.title ?? "",
        privacy_level: opts.privacy,
        disable_comment: !!opts.disableComment,
        disable_duet: !!opts.disableDuet,
        disable_stitch: !!opts.disableStitch,
        video_cover_timestamp_ms: opts.coverMs ?? 1000,
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: src.info,
    });
    await uploadChunks(file, init.upload_url, src, log);
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const s = await api(STATUS_URL, await accessToken(), { publish_id: init.publish_id });
      if (s.status === "PUBLISH_COMPLETE") {
        log("Đã đăng lên TikTok");
        return { publishId: init.publish_id, status: s.status, postIds: s.publicaly_available_post_id ?? [] };
      }
      if (s.status === "FAILED") throw new Error(`TikTok từ chối video: ${s.fail_reason}`);
      log(`TikTok đang xử lý… (${s.status})`);
    }
    log("TikTok vẫn đang xử lý; video sẽ hiện trên trang cá nhân khi xong");
    return { publishId: init.publish_id, status: "PROCESSING" };
  };

  return { status, saveConfig, setDirectPost, loginUrl, handleCallback, disconnect, sendDraft, creatorInfo, directPost, redirectUri };
};
