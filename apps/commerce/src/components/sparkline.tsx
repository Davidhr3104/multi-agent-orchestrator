export function Sparkline({
  points,
  className,
  filled = false,
}: {
  points: number[];
  className?: string;
  filled?: boolean;
}) {
  if (points.length < 2) return null;
  const w = 64;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const path = `M${coords.join(" L")}`;
  const areaPath = `${path} V${h} H0 Z`;

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} fill="none" preserveAspectRatio="none">
      {filled ? <path d={areaPath} fill="currentColor" fillOpacity="0.25" /> : null}
      <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
