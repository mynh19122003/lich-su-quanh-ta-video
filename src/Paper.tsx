import React from "react";
import { AbsoluteFill } from "remotion";

// Aged paper: warm base, fibrous noise and darker edges.
export const Paper: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#f2e6cc" }}>
      <svg width="100%" height="100%" style={{ position: "absolute" }}>
        <filter id="paper-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={4} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.18 0"
          />
        </filter>
        <filter id="paper-blotch">
          <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves={2} seed={11} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.55  0 0 0 0 0.38  0 0 0 0 0.15  0 0 0 0.22 -0.05"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-blotch)" />
        <rect width="100%" height="100%" filter="url(#paper-grain)" />
      </svg>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(90,60,20,0.35) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
