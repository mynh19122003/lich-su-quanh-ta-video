// Script page mode for episodes generated from a written script (project.script).
// Loaded after app.js and reuses its helpers ($, el, toast, api). The script format and the
// character list match editor/app/episode.ts and editor/app/characters.json.

window.startGenEditor = async (id) => {
  const shared = await api("/script/characters.json");
  const project = await api(`/api/projects/${id}`);
  const chars = shared.characters;
  const bgNames = Object.keys(shared.backgrounds);
  const charFor = (name) => chars.find((c) => c.names.includes(name.trim().toLowerCase())) ?? chars[0];

  const parse = (src) => {
    const scenes = [];
    for (const raw of src.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("#")) {
        const [title, ...opts] = line.replace(/^#+\s*/, "").split("|").map((s) => s.trim());
        const scene = { title, background: "giấy", characters: [], lines: [] };
        for (const o of opts) {
          const [k, v = ""] = o.split(":").map((s) => s.trim());
          if (k.toLowerCase() === "nền") scene.background = v.toLowerCase();
          if (k.toLowerCase() === "nhân vật") scene.characters = v.split(",").map((s) => s.trim()).filter(Boolean);
        }
        scenes.push(scene);
        continue;
      }
      const m = line.match(/^([^:]{1,30}):\s*(.+)$/);
      if (!scenes.length) scenes.push({ title: "", background: "giấy", characters: [], lines: [] });
      scenes[scenes.length - 1].lines.push(m ? { who: m[1].trim(), text: m[2].trim() } : { who: "Người dẫn", text: line });
    }
    return scenes;
  };
  const serialize = (scenes) =>
    scenes
      .map((s) => {
        const head = [`# ${s.title || "Cảnh"}`, `nền: ${s.background || "giấy"}`];
        if (s.characters.length) head.push(`nhân vật: ${s.characters.join(", ")}`);
        return [head.join(" | "), ...s.lines.filter((l) => l.text.trim()).map((l) => `${l.who}: ${l.text.trim()}`)].join("\n");
      })
      .join("\n\n");

  let scenes = parse(project.script.text);
  let savedText = serialize(scenes);
  let view = { kind: "scene", index: 0 };

  // Make the episode-1 editor in app.js stand down.
  script = {};
  saved = JSON.stringify(script);
  for (const sel of ["#voices", "#render", "#studio"]) $(sel)?.classList.add("hidden");
  $("#update-ep").classList.remove("hidden");
  $("#ep-title").textContent = `${project.name} (kịch bản)`;
  document.querySelectorAll("aside section")[1]?.classList.add("hidden"); // job log is for episode 1 only

  const dirty = () => serialize(scenes) !== savedText;
  const mark = () => $("#dirty").classList.toggle("hidden", !dirty());

  const saveGen = async () => {
    try {
      const fresh = await api(`/api/projects/${id}`);
      fresh.script = { ...fresh.script, text: serialize(scenes) };
      await api(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(fresh) });
      savedText = serialize(scenes);
      mark();
      toast("Đã lưu kịch bản. Bấm “Cập nhật tập” để dựng lại video.");
      return true;
    } catch (e) {
      toast("Chưa lưu được: " + e.message, 5000);
      return false;
    }
  };
  window.genMode = { save: saveGen, dirty };

  $("#update-ep").addEventListener("click", async () => {
    if (dirty() && !(await saveGen())) return;
    location.href = `/?p=${encodeURIComponent(id)}&editScript=1`;
  });

  const tryLine = async (button, line) => {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Đang tạo…";
    try {
      const { url } = await api("/api/try", { method: "POST", body: JSON.stringify({ text: line.text, ...charFor(line.who).voice }) });
      new Audio(url).play();
    } catch (e) {
      toast(e.message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  };

  const update = () => {
    mark();
    renderNav();
  };

  const renderNav = () => {
    $("#scenes").replaceChildren(
      ...scenes.map((s, i) =>
        el(
          "button",
          { class: "item" + (view.kind === "scene" && view.index === i ? " active" : ""), onclick: () => ((view = { kind: "scene", index: i }), renderAll()) },
          `${i + 1}. ${s.title || "Cảnh"}`,
          el("small", {}, `${s.lines.length} câu · nền ${s.background}`),
        ),
      ),
      el(
        "button",
        {
          class: "item",
          onclick: () => {
            scenes.push({ title: "Cảnh mới", background: "giấy", characters: [], lines: [{ who: "Người dẫn", text: "" }] });
            view = { kind: "scene", index: scenes.length - 1 };
            update();
            renderAll();
          },
        },
        "+ Thêm cảnh",
      ),
      el("hr"),
      el("button", { class: "item" + (view.kind === "text" ? " active" : ""), onclick: () => ((view = { kind: "text" }), renderAll()) }, "Toàn bộ kịch bản", el("small", {}, "Sửa nhanh dạng chữ")),
    );
  };

  const renderScene = (si) => {
    const s = scenes[si];
    if (!s) return el("p", { class: "muted" }, "Chưa có cảnh nào.");
    const speakerOptions = (current) => {
      const known = chars.some((c) => c.label === current || c.names.includes(current.toLowerCase()));
      return [...chars.map((c) => el("option", { value: c.label, selected: c.label === current || (c.names.includes(current.toLowerCase()) && c.label !== current) }, c.label)), ...(known ? [] : [el("option", { value: current, selected: true }, `${current} (giọng người dẫn)`)])];
    };
    const moveScene = (d) => {
      const j = si + d;
      if (j < 0 || j >= scenes.length) return;
      [scenes[si], scenes[j]] = [scenes[j], scenes[si]];
      view = { kind: "scene", index: j };
      update();
      renderAll();
    };
    return el(
      "div",
      {},
      el(
        "div",
        { class: "scene-head" },
        el("h2", {}, `${si + 1}.`),
        el("input", { type: "text", value: s.title, style: "flex: 1; font-size: 18px", oninput: (e) => ((s.title = e.target.value), update()) }),
        el("button", { class: "small", onclick: () => moveScene(-1) }, "↑"),
        el("button", { class: "small", onclick: () => moveScene(1) }, "↓"),
        el(
          "button",
          {
            class: "small",
            onclick: () => {
              if (!confirm(`Xoá cảnh "${s.title}"?`)) return;
              scenes.splice(si, 1);
              view = { kind: "scene", index: Math.max(0, si - 1) };
              update();
              renderAll();
            },
          },
          "Xoá cảnh",
        ),
      ),
      el(
        "div",
        { class: "card" },
        el("label", { class: "field" }, "Nền cảnh"),
        el(
          "select",
          { onchange: (e) => ((s.background = e.target.value), update()) },
          [...bgNames, ...(bgNames.includes(s.background) ? [] : [s.background])].map((b) => el("option", { value: b, selected: b === s.background }, b)),
        ),
        el("label", { class: "field" }, "Nhân vật đứng trên sân khấu (người nói có hình cũng tự được thêm)"),
        el(
          "div",
          { class: "card-top" },
          chars
            .filter((c) => c.sticker)
            .map((c) =>
              el(
                "label",
                { class: "muted", style: "display: inline-flex; gap: 4px; align-items: center; margin-right: 10px" },
                el("input", {
                  type: "checkbox",
                  checked: s.characters.some((n) => charFor(n).sticker === c.sticker),
                  onchange: (e) => {
                    s.characters = s.characters.filter((n) => charFor(n).sticker !== c.sticker);
                    if (e.target.checked) s.characters.push(c.label);
                    update();
                  },
                }),
                c.label,
              ),
            ),
        ),
      ),
      s.lines.map((line, li) => {
        const tryBtn = el("button", { class: "small", onclick: () => tryLine(tryBtn, line) }, "Nghe thử");
        const move = (d) => {
          const j = li + d;
          if (j < 0 || j >= s.lines.length) return;
          [s.lines[li], s.lines[j]] = [s.lines[j], s.lines[li]];
          update();
          renderAll();
        };
        return el(
          "div",
          { class: "card" },
          el(
            "div",
            { class: "card-top" },
            el("span", { class: "num" }, `${li + 1}`),
            el("select", { onchange: (e) => ((line.who = e.target.value), update()) }, speakerOptions(line.who)),
            el("span", { class: "spacer" }),
            tryBtn,
            el("button", { class: "small", onclick: () => move(-1) }, "↑"),
            el("button", { class: "small", onclick: () => move(1) }, "↓"),
            el("button", { class: "small", onclick: () => (s.lines.splice(li, 1), update(), renderAll()) }, "Xoá"),
          ),
          el("textarea", { value: line.text, oninput: (e) => ((line.text = e.target.value), mark()) }),
        );
      }),
      el("button", { onclick: () => (s.lines.push({ who: "Người dẫn", text: "" }), update(), renderAll()) }, "+ Thêm câu"),
    );
  };

  const renderText = () =>
    el(
      "div",
      {},
      el("div", { class: "scene-head" }, el("h2", {}, "Toàn bộ kịch bản")),
      el("div", { class: "note" }, "Dòng bắt đầu bằng # mở một cảnh: # Tên cảnh | nền: giấy | nhân vật: Pháp, Bộ đội. Mỗi câu: Tên: lời nói."),
      el("textarea", {
        value: serialize(scenes),
        style: "min-height: 60vh; font-family: Consolas, monospace; font-size: 13px",
        onchange: (e) => {
          scenes = parse(e.target.value);
          update();
        },
      }),
    );

  const renderAll = () => {
    renderNav();
    const main = $("#editor");
    const top = main.scrollTop;
    main.replaceChildren(view.kind === "text" ? renderText() : renderScene(view.index));
    main.scrollTop = top;
  };

  window.addEventListener("beforeunload", (e) => {
    if (dirty()) e.preventDefault();
  });
  renderAll();
  const out = await api(`/api/projects/${id}/output`);
  if (out.url) {
    $("#output").src = `${out.url}?t=${out.mtime}`;
    $("#output-info").textContent = `Xuất lúc ${new Date(out.mtime).toLocaleString("vi-VN")}`;
  } else {
    $("#output-info").textContent = "Tập này chưa được xuất video.";
  }
};
