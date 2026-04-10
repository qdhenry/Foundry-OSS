interface FoundryMarkProps {
  size?: number;
  variant?: "dark" | "light" | "slate" | "mono-white" | "mono-black" | "flat";
  className?: string;
}

const VARIANTS = {
  dark: {
    gradientTop: "#93c5fd",
    gradientBottom: "#3b82f6",
    topBar: "#93c5fd",
    midBar: "#60a5fa",
    nodes: ["#bfdbfe", "#93c5fd", "#93c5fd", "#60a5fa", "#3b82f6"],
    innerColor: "#0a0e1a",
    innerOpacity: [0.35, 0.2],
  },
  light: {
    gradientTop: "#2563eb",
    gradientBottom: "#1e40af",
    topBar: "#2563eb",
    midBar: "#1e40af",
    nodes: ["#3b82f6", "#2563eb", "#2563eb", "#1e40af", "#1e40af"],
    innerColor: "#fff",
    innerOpacity: [0.18, 0.18],
  },
  slate: {
    gradientTop: "#1e40af",
    gradientBottom: "#1e3a8a",
    topBar: "#1e40af",
    midBar: "#1e3a8a",
    nodes: ["#2563eb", "#1e40af", "#1e40af", "#1e3a8a", "#1e3a8a"],
    innerColor: "#f1f5f9",
    innerOpacity: [0.12, 0.12],
  },
  "mono-white": {
    gradientTop: "#ffffff",
    gradientBottom: "#a0a0a0",
    topBar: "#ffffff",
    midBar: "#c0c0c0",
    nodes: ["#ffffff", "#e0e0e0", "#e0e0e0", "#c0c0c0", "#a0a0a0"],
    innerColor: "#000",
    innerOpacity: [0.3, 0.3],
  },
  "mono-black": {
    gradientTop: "#1a1a1a",
    gradientBottom: "#4a4a4a",
    topBar: "#1a1a1a",
    midBar: "#333",
    nodes: ["#1a1a1a", "#2a2a2a", "#2a2a2a", "#3a3a3a", "#4a4a4a"],
    innerColor: "#fff",
    innerOpacity: [0.12, 0.12],
  },
  flat: {
    gradientTop: "#3b82f6",
    gradientBottom: "#3b82f6",
    topBar: "#3b82f6",
    midBar: "#3b82f6",
    nodes: ["#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6"],
    innerColor: null,
    innerOpacity: [0, 0],
  },
} as const;

export function FoundryMark({ size = 24, variant = "dark", className }: FoundryMarkProps) {
  const v = VARIANTS[variant];
  const height = (size * 72) / 60;
  const gradientId = `foundry-grad-${variant}`;
  const showInner = variant !== "flat" && size >= 24;

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 60 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Foundry mark"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={v.gradientTop} />
          <stop offset="100%" stopColor={v.gradientBottom} />
        </linearGradient>
      </defs>

      <line
        x1="12"
        y1="10"
        x2="12"
        y2="62"
        stroke={`url(#${gradientId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="10"
        x2="50"
        y2="10"
        stroke={v.topBar}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="34"
        x2="42"
        y2="34"
        stroke={v.midBar}
        strokeWidth="6"
        strokeLinecap="round"
      />

      <circle cx="12" cy="10" r="7" fill={v.nodes[0]} />
      <circle cx="50" cy="10" r="5" fill={v.nodes[1]} />
      <circle cx="12" cy="34" r="6" fill={v.nodes[2]} />
      <circle cx="42" cy="34" r="4.5" fill={v.nodes[3]} />
      <circle cx="12" cy="62" r="5" fill={v.nodes[4]} />

      {showInner && (
        <>
          <circle
            cx="12"
            cy="10"
            r="3"
            fill={v.innerColor ?? undefined}
            opacity={v.innerOpacity[0]}
          />
          <circle
            cx="12"
            cy="34"
            r="2.5"
            fill={v.innerColor ?? undefined}
            opacity={v.innerOpacity[1]}
          />
        </>
      )}
    </svg>
  );
}
