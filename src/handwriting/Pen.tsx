import React from "react";

// A fountain pen whose nib tip sits at (x, y), leaning to the bottom-left like a right-handed writer.
export const Pen: React.FC<{ x: number; y: number; size: number }> = ({
  x,
  y,
  size,
}) => {
  const s = size / 100;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(-40)`}>
      {/* nib */}
      <path d="M0 0 L-9 -26 Q0 -34 9 -26 Z" fill="#c9a24b" stroke="#6b5220" strokeWidth={1.5} />
      <line x1={0} y1={-3} x2={0} y2={-24} stroke="#6b5220" strokeWidth={1.2} />
      {/* grip and barrel */}
      <rect x={-10} y={-48} width={20} height={22} rx={3} fill="#2b2b2b" />
      <rect x={-12} y={-150} width={24} height={104} rx={8} fill="#7a1f1f" />
      <rect x={-12} y={-118} width={24} height={5} fill="#c9a24b" />
      <rect x={6} y={-145} width={4} height={90} rx={2} fill="rgba(255,255,255,0.25)" />
    </g>
  );
};
