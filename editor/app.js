// Script editor UI: edits src/geneva/script.json through the local server.

const SCENE_NAMES = {
  "mo-dau": "Mở đầu",
  "bang-den": "Bảng đen",
  "phap-quay-lai": "Pháp quay lại",
  domino: "Thuyết đôminô",
  "dien-bien-phu": "Điện Biên Phủ",
  "hoi-nghi": "Hội nghị",
  "vi-tuyen": "Vĩ tuyến",
  "noi-dung": "Nội dung hiệp định",
  "khong-tan-thanh": "Không tán thành",
  "300-ngay": "300 ngày",
  diem: "Ngô Đình Diệm",
  1956: "Năm 1956",
  "dong-khoi": "Đồng Khởi",
  "my-vao": "Mỹ vào",
  ket: "Kết",
};
const SPEAKERS = {
  narrator: "Người dẫn",
  teacher: "Cô giáo",
  vm: "Việt Minh",
  phap: "Pháp",
  my: "Mỹ",
  tq: "Trung Quốc",
  diem: "Ngô Đình Diệm",
};
const VOICES = { "vi-VN-NamMinhNeural": "Nam - NamMinh", "vi-VN-HoaiMyNeural": "Nữ - HoaiMy" };
const MOODS = { light: "Vui, nhẹ nhàng", tense: "Căng thẳng", sad: "Buồn" };

let script = null;
let saved = ""; // JSON of the script as last saved
let voiced = null; // script as of the last voice generation (to flag changed lines)
let timing = {};
let view = { kind: "scene", index: 0 };
let polling = null;

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c !== null && c !== undefined && c !== false) node.append(c);
  }
  return node;
};

const toast = (msg, ms = 3000) => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add("hidden"), ms);
};

const api = async (url, opts = {}) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Lỗi ${res.status}`);
  return body;
};

const isDirty = () => JSON.stringify(script) !== saved;
const markDirty = () => $("#dirty").classList.toggle("hidden", !isDirty());

const lineChanged = (si, li) => {
  const a = script.scenes[si]?.lines[li];
  const b = voiced?.scenes[si]?.lines[li];
  return !b || a.text !== b.text || a.who !== b.who || JSON.stringify(script.voices[a.who]) !== JSON.stringify(voiced.voices[b.who]);
};

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------- sidebar ----------
const renderNav = () => {
  const nav = $("#scenes");
  nav.replaceChildren(
    ...script.scenes.map((s, i) => {
      const t = timing.scenes?.find((x) => x.id === s.id);
      return el(
        "button",
        {
          class: "item" + (view.kind === "scene" && view.index === i ? " active" : ""),
          onclick: () => {
            view = { kind: "scene", index: i };
            render();
          },
        },
        `${i + 1}. ${SCENE_NAMES[s.id] ?? s.id}`,
        el("small", {}, `${s.lines.length} câu · ${MOODS[s.mood]}${t ? ` · ${fmt(t.start)} (${t.duration.toFixed(0)}s)` : ""}`),
      );
    }),
    el("hr"),
    el(
      "button",
      {
        class: "item" + (view.kind === "voices" ? " active" : ""),
        onclick: () => {
          view = { kind: "voices" };
          render();
        },
      },
      "Giọng nhân vật",
      el("small", {}, "Tốc độ, cao độ từng giọng"),
    ),
  );
  if (timing.total) {
    nav.append(el("p", { class: "muted", style: "padding: 0 10px; font-size: 13px" }, `Tổng thời lượng: ${fmt(timing.total)}`));
  }
};

// ---------- trying a voice ----------
const tryVoice = async (button, text, who) => {
  const cfg = script.voices[who];
  button.disabled = true;
  const label = button.textContent;
  button.textContent = "Đang tạo…";
  try {
    const { url } = await api("/api/try", { method: "POST", body: JSON.stringify({ text, ...cfg }) });
    new Audio(url).play();
  } catch (e) {
    toast(e.message);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
};

// ---------- scene editor ----------
const renderScene = (si) => {
  const scene = script.scenes[si];
  const t = timing.scenes?.find((x) => x.id === scene.id);
  const update = () => {
    markDirty();
    renderNav();
  };

  const cards = scene.lines.map((line, li) => {
    const changed = lineChanged(si, li);
    const lt = t?.lines[li];
    const file = `/media/geneva/voice/${String(si).padStart(2, "0")}-${String(li).padStart(2, "0")}.mp3`;
    const move = (d) => {
      const j = li + d;
      if (j < 0 || j >= scene.lines.length) return;
      [scene.lines[li], scene.lines[j]] = [scene.lines[j], scene.lines[li]];
      update();
      render();
    };
    const tryBtn = el("button", { class: "small", onclick: () => tryVoice(tryBtn, line.text, line.who) }, "Nghe thử");
    return el(
      "div",
      { class: "card" + (changed ? " changed" : "") },
      el(
        "div",
        { class: "card-top" },
        el("span", { class: "num" }, `${li + 1}`),
        el(
          "select",
          {
            onchange: (e) => {
              line.who = e.target.value;
              update();
              render();
            },
          },
          Object.entries(SPEAKERS)
            .filter(([k]) => script.voices[k])
            .map(([k, name]) => el("option", { value: k, selected: k === line.who }, name)),
        ),
        el("span", { class: "muted", title: "Giây nghỉ thêm sau câu này" }, "nghỉ"),
        el("input", {
          type: "number",
          min: 0,
          max: 5,
          step: 0.1,
          value: line.pause ?? 0,
          style: "width: 70px",
          oninput: (e) => {
            const v = Number(e.target.value);
            if (v > 0) line.pause = v;
            else delete line.pause;
            update();
          },
        }),
        el("span", { class: "muted" }, "giây"),
        changed ? el("span", { class: "pill" }, "chưa tạo giọng") : lt ? el("span", { class: "muted" }, `${lt.duration.toFixed(1)}s`) : null,
        el("span", { class: "spacer" }),
        !changed ? el("button", { class: "small", onclick: () => new Audio(file + "?t=" + Date.now()).play() }, "▶ Bản đã tạo") : null,
        tryBtn,
        el("button", { class: "small", title: "Lên", onclick: () => move(-1) }, "↑"),
        el("button", { class: "small", title: "Xuống", onclick: () => move(1) }, "↓"),
        el(
          "button",
          {
            class: "small",
            title: "Xoá câu",
            onclick: () => {
              if (!confirm("Xoá câu này?")) return;
              scene.lines.splice(li, 1);
              update();
              render();
            },
          },
          "Xoá",
        ),
      ),
      el("label", { class: "field" }, "Lời đọc (máy đọc đúng như chữ ở đây)"),
      el("textarea", {
        value: line.text,
        oninput: (e) => {
          line.text = e.target.value;
          markDirty();
        },
        onchange: () => render(),
      }),
      el("label", { class: "field" }, "Phụ đề hiển thị (để trống nếu giống lời đọc, ví dụ đọc “Bông-giua” nhưng hiện “Bonjour”)"),
      el("input", {
        type: "text",
        value: line.subtitle ?? "",
        placeholder: line.text,
        oninput: (e) => {
          const v = e.target.value.trim();
          if (v) line.subtitle = e.target.value;
          else delete line.subtitle;
          markDirty();
        },
      }),
    );
  });

  return el(
    "div",
    {},
    el(
      "div",
      { class: "scene-head" },
      el("h2", {}, `${si + 1}. ${SCENE_NAMES[scene.id] ?? scene.id}`),
      el("label", { class: "muted" }, "Nhạc nền: "),
      el(
        "select",
        {
          onchange: (e) => {
            scene.mood = e.target.value;
            update();
          },
        },
        Object.entries(MOODS).map(([k, v]) => el("option", { value: k, selected: k === scene.mood }, v)),
      ),
      t
        ? el(
            "button",
            {
              class: "small",
              onclick: () => {
                const v = $("#output");
                if (!v.src) return toast("Chưa có video đã xuất");
                v.currentTime = t.start;
                v.play();
              },
            },
            `▶ Xem cảnh này trong video (${fmt(t.start)})`,
          )
        : null,
    ),
    el(
      "div",
      { class: "note" },
      "Hình động của cảnh chạy theo số thứ tự câu (câu 1, câu 2…). Sửa chữ, đổi người nói, thêm câu ở cuối cảnh thì thoải mái. Xoá hoặc đổi thứ tự câu sẽ làm hình động gắn với câu đó chạy lệch hoặc không xuất hiện.",
    ),
    cards,
    el(
      "button",
      {
        onclick: () => {
          scene.lines.push({ who: "narrator", text: "" });
          update();
          render();
          document.querySelector("main textarea:last-of-type")?.focus();
        },
      },
      "+ Thêm câu",
    ),
  );
};

// ---------- voices editor ----------
const renderVoices = () => {
  const sample = { value: "Năm 1954, Hiệp định Giơnevơ được ký kết." };
  const num = (s) => Number(String(s).replace(/[^-\d.]/g, "")) || 0;
  return el(
    "div",
    {},
    el("div", { class: "scene-head" }, el("h2", {}, "Giọng nhân vật")),
    el("div", { class: "note" }, "Đổi giọng ở đây áp dụng cho mọi câu của nhân vật đó. Sau khi đổi, bấm “Tạo giọng & nhạc” để đọc lại."),
    el("label", { class: "field" }, "Câu dùng để nghe thử"),
    el("input", { type: "text", value: sample.value, oninput: (e) => (sample.value = e.target.value) }),
    Object.entries(script.voices).map(([who, cfg]) => {
      const tryBtn = el("button", { class: "small", onclick: () => tryVoice(tryBtn, sample.value, who) }, "Nghe thử");
      const rateOut = el("span", { style: "width: 50px" }, cfg.rate);
      const pitchOut = el("span", { style: "width: 60px" }, cfg.pitch);
      return el(
        "div",
        { class: "card" },
        el(
          "div",
          { class: "voice-row" },
          el("strong", {}, SPEAKERS[who] ?? who),
          el(
            "div",
            {},
            el(
              "div",
              { class: "card-top" },
              el(
                "select",
                {
                  onchange: (e) => {
                    cfg.voice = e.target.value;
                    markDirty();
                  },
                },
                Object.entries(VOICES).map(([k, v]) => el("option", { value: k, selected: k === cfg.voice }, v)),
              ),
              el("span", { class: "spacer" }),
              tryBtn,
            ),
            el(
              "div",
              { class: "range" },
              el("span", { class: "muted", style: "width: 70px" }, "Tốc độ"),
              el("input", {
                type: "range",
                min: -40,
                max: 40,
                value: num(cfg.rate),
                oninput: (e) => {
                  const v = Number(e.target.value);
                  cfg.rate = `${v >= 0 ? "+" : ""}${v}%`;
                  rateOut.textContent = cfg.rate;
                  markDirty();
                },
              }),
              rateOut,
            ),
            el(
              "div",
              { class: "range" },
              el("span", { class: "muted", style: "width: 70px" }, "Cao độ"),
              el("input", {
                type: "range",
                min: -50,
                max: 50,
                value: num(cfg.pitch),
                oninput: (e) => {
                  const v = Number(e.target.value);
                  cfg.pitch = `${v >= 0 ? "+" : ""}${v}Hz`;
                  pitchOut.textContent = cfg.pitch;
                  markDirty();
                },
              }),
              pitchOut,
            ),
          ),
        ),
      );
    }),
  );
};

const render = () => {
  renderNav();
  const main = $("#editor");
  const scrollTop = main.scrollTop;
  main.replaceChildren(view.kind === "voices" ? renderVoices() : renderScene(view.index));
  main.scrollTop = scrollTop;
};

// ---------- saving and jobs ----------
const save = async () => {
  if (window.genMode) return window.genMode.save();
  try {
    await api("/api/script", { method: "PUT", body: JSON.stringify(script) });
    saved = JSON.stringify(script);
    markDirty();
    toast("Đã lưu kịch bản");
    return true;
  } catch (e) {
    toast("Chưa lưu được: " + e.message, 5000);
    return false;
  }
};

const loadOutput = async () => {
  const out = await api("/api/output");
  const v = $("#output");
  if (out.url) {
    v.src = `${out.url}?t=${out.mtime}`;
    $("#output-info").textContent = `Xuất lúc ${new Date(out.mtime).toLocaleString("vi-VN")}`;
  } else {
    $("#output-info").textContent = "Chưa có video. Bấm “Xuất video”.";
  }
};

const showJob = (job) => {
  const state = $("#job-state");
  if (!job.name) return;
  state.classList.remove("hidden", "ok", "err");
  if (job.running) state.textContent = `${job.name}…`;
  else if (job.ok) {
    state.textContent = `${job.name}: xong`;
    state.classList.add("ok");
  } else {
    state.textContent = `${job.name}: lỗi`;
    state.classList.add("err");
  }
  const log = $("#log");
  log.textContent = job.log.join("\n");
  log.scrollTop = log.scrollHeight;
  for (const b of ["#voices", "#render"]) $(b).disabled = job.running;
};

const poll = async () => {
  const job = await api("/api/job");
  showJob(job);
  if (!job.running) {
    clearInterval(polling);
    polling = null;
    if (job.ok) {
      timing = await api("/api/timing");
      voiced = JSON.parse(saved);
      await loadOutput();
      render();
      toast(`${job.name}: xong`);
    }
  }
};

const startJob = async (url) => {
  if (isDirty() && !(await save())) return;
  try {
    await api(url, { method: "POST" });
    clearInterval(polling);
    polling = setInterval(poll, 1000);
    poll();
  } catch (e) {
    toast(e.message);
  }
};

$("#save").addEventListener("click", save);
$("#voices").addEventListener("click", () => startJob("/api/voices"));
$("#render").addEventListener("click", () => {
  if (confirm("Xuất lại toàn bộ video? Việc này mất khoảng 10–15 phút.")) startJob("/api/render");
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    save();
  }
});
window.addEventListener("beforeunload", (e) => {
  if (isDirty()) e.preventDefault();
});

// Episode picker: episode 1 is edited here; generated episodes switch to script-gen.js.
const populateEpisodes = async () => {
  const list = await api("/api/projects");
  const current = new URLSearchParams(location.search).get("ep") ?? "";
  const pick = $("#episode");
  pick.replaceChildren(
    el("option", { value: "", selected: !current }, "Tập 1 - Hiệp định Giơnevơ (hoạt hình làm tay)"),
    ...list.filter((p) => p.hasScript).map((p) => el("option", { value: p.id, selected: p.id === current }, p.name)),
  );
  pick.onchange = () => {
    location.href = pick.value ? `/script?ep=${encodeURIComponent(pick.value)}` : "/script";
  };
  return current;
};

(async () => {
  const ep = await populateEpisodes();
  if (ep && window.startGenEditor) {
    await window.startGenEditor(ep);
    return;
  }
  script = await api("/api/script");
  saved = JSON.stringify(script);
  voiced = JSON.parse(saved);
  timing = await api("/api/timing");
  $("#ep-title").textContent = script.title ?? "Kịch bản";
  render();
  await loadOutput();
  const job = await api("/api/job");
  showJob(job);
  if (job.running) polling = setInterval(poll, 1000);
})();
