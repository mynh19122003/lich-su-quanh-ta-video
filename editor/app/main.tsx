import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// The handwriting fonts used by the episodes and by text clips.
for (const [family, file] of [
  ["Patrick Hand", "/fonts/PatrickHand-Regular.ttf"],
  ["Pacifico", "/fonts/Pacifico-Regular.ttf"],
]) {
  const face = new FontFace(family, `url(${file})`);
  face.load().then(() => document.fonts.add(face)).catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(<App />);
