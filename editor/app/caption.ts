// Title, description and hashtag suggestions for posting a project, built from its script
// (or its text clips when it has none). Pure templates: no network, no AI.
import type { Project } from "../../src/project/types";
import { parseScript } from "./episode";

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

const tag = (s: string) => "#" + strip(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

// Topic words people search for -> hashtag.
const TOPICS: [RegExp, string][] = [
  [/giơnevơ|geneva/i, "#hiepdinhgeneva"],
  [/điện biên phủ/i, "#dienbienphu"],
  [/mậu thân/i, "#tetmauthan1968"],
  [/trường sơn/i, "#duongtruongson"],
  [/vạn tường/i, "#vantuong"],
  [/paris/i, "#hiepdinhparis"],
  [/30\/4|30 tháng 4|giải phóng miền nam/i, "#30thang4"],
  [/đồng khởi/i, "#dongkhoi"],
  [/chống mỹ|với mỹ|quân mỹ|nước mỹ/i, "#khangchienchongmy"],
  [/chống pháp|người pháp/i, "#khangchienchongphap"],
  [/hồ chí minh/i, "#hochiminh"],
];

const BASE_TAGS = ["#lichsu", "#lichsuvietnam", "#vietnam", "#hoclichsu", "#xuhuong", "#fyp"];

export type CaptionIdeas = { titles: string[]; description: string; hashtags: string[] };

export const captionIdeas = (p: Project): CaptionIdeas => {
  const text = p.script?.text ?? p.tracks.flatMap((t) => t.items.flatMap((i) => (i.type === "text" ? [i.text] : []))).join("\n");
  const scenes = p.script ? parseScript(p.script.text) : [];
  const years = [...new Set(text.match(/\b(18|19|20)\d{2}\b/g) ?? [])].sort();
  const span = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : (years[0] ?? "");
  // "Tập 2 - Chiến tranh cục bộ" -> episode label + topic.
  const m = p.name.match(/^(tập\s*\d+)\s*[-:–]\s*(.+)$/i);
  const episode = m ? m[1].replace(/^tập/i, "Tập") : "";
  const topic = (m ? m[2] : p.name).trim();
  const firstScenes = scenes
    .map((s) => s.title.replace(/^tập\s*\d+\s*:\s*/i, "").replace(/\s*\(.*\)\s*$/, "").split(",")[0].trim())
    .filter((t) => t && !/tóm lại|mở đầu|kết/i.test(t))
    .slice(1, 4);
  const hook = scenes.flatMap((s) => s.lines).find((l) => /\?$/.test(l.text.trim()))?.text.trim();

  const titles = [
    `${topic}${span ? ` (${span})` : ""} – tóm tắt trong vài phút`,
    `${episode ? `${episode}: ` : ""}${topic} kể theo kiểu hoạt hình 🎬`,
    hook ? `“${hook}” – ${topic}` : `Vì sao lại có ${topic.toLowerCase()}?`,
    firstScenes.length ? `${firstScenes.slice(0, 2).join(", ")}… ${topic} trong một video` : `${topic}: những điều sách giáo khoa kể nhanh`,
  ].map((t) => t.replace(/\s+/g, " ").trim());

  const description = [
    `${episode ? `${episode} – ` : ""}${topic}${span ? `, giai đoạn ${span}` : ""}.`,
    firstScenes.length ? `Trong tập này: ${firstScenes.join(", ")} và nhiều hơn nữa.` : "",
    "Theo dõi kênh để xem các tập tiếp theo!",
  ]
    .filter(Boolean)
    .join(" ");

  const topical = TOPICS.filter(([re]) => re.test(text) || re.test(p.name)).map(([, h]) => h);
  const hashtags = [...new Set([...topical, tag(topic), ...BASE_TAGS])].filter((h) => h.length > 2).slice(0, 10);
  return { titles, description, hashtags };
};

export const buildCaption = (title: string, description: string, hashtags: string[]) =>
  [title, description, hashtags.join(" ")].filter((s) => s.trim()).join("\n\n").slice(0, 2200);
