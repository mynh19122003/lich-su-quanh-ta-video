import { parse, type Font } from "opentype.js";
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

const cache = new Map<string, Promise<Font>>();

const loadFont = (src: string) => {
  let promise = cache.get(src);
  if (!promise) {
    promise = fetch(src)
      .then((res) => res.arrayBuffer())
      .then((buf) => parse(buf));
    cache.set(src, promise);
  }
  return promise;
};

// Loads a font file as outlines so text can be drawn stroke by stroke.
export const useFont = (src: string): Font | null => {
  const [font, setFont] = useState<Font | null>(null);
  const [handle] = useState(() => delayRender(`Loading font ${src}`));

  useEffect(() => {
    loadFont(src)
      .then((f) => {
        setFont(f);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [src, handle]);

  return font;
};
