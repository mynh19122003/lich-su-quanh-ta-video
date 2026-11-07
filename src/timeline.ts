// Scene timing, derived from the narration lengths in public/voice/*.mp3
// (regenerate with scripts/voiceover.py, then update VOICE_SECONDS).
export const FPS = 30;
export const TRANSITION_FRAMES = 18;
export const VOICE_DELAY_SECONDS = 0.5;
const TAIL_SECONDS = 1.0;
const OUTRO_SECONDS = 1.5;

export const VOICE_SECONDS = [6.648, 7.704, 6.504, 7.632, 7.224, 7.512];

export const SCENE_FRAMES = VOICE_SECONDS.map((d, i) =>
  Math.ceil(
    (VOICE_DELAY_SECONDS +
      d +
      TAIL_SECONDS +
      (i === VOICE_SECONDS.length - 1 ? OUTRO_SECONDS : 0)) *
      FPS,
  ),
);

export const TOTAL_FRAMES =
  SCENE_FRAMES.reduce((a, b) => a + b, 0) -
  TRANSITION_FRAMES * (SCENE_FRAMES.length - 1);
