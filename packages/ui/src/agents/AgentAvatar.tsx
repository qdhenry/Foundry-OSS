"use client";

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;

export function AgentAvatar({
  seed,
  name,
  size = "md",
}: {
  seed: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const hue = hashString(seed) % 360;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: `hsl(${hue} 70% 45%)` }}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
