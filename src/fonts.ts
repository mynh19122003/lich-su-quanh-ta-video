import { continueRender, delayRender, staticFile } from "remotion";

// Registers the bundled handwriting fonts as CSS fonts for plain text (credits, stamps, timeline text).
const FONTS: [string, string][] = [
  ["Patrick Hand", "fonts/PatrickHand-Regular.ttf"],
  ["Pacifico", "fonts/Pacifico-Regular.ttf"],
];

const handle = delayRender("Loading fonts");
Promise.all(
  FONTS.map(([family, file]) => {
    const face = new FontFace(family, `url(${staticFile(file)})`);
    return face.load().then(() => document.fonts.add(face));
  }),
)
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
