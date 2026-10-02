import type { PropertyKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Gold line drawings per property kind, shown until real listing photos are uploaded. */
function Drawing({ kind }: { kind: PropertyKind }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (kind) {
    case "penthouse":
      return (
        <g {...common}>
          <path d="M70 120V34h60v86" />
          <path d="M62 34h76l-6-10H68z" />
          <path d="M40 120V62h30M130 70h30v50" />
          {[44, 56, 68, 80, 92, 104].map((y) => (
            <path key={y} d={`M80 ${y}h12M108 ${y}h12`} />
          ))}
          <path d="M48 74h12M48 88h12M48 102h12M140 82h12M140 96h12" />
          <path d="M20 120h160" />
        </g>
      );
    case "apartment":
      return (
        <g {...common}>
          <path d="M55 120V40h90v80" />
          <path d="M50 40h100" />
          {[52, 68, 84, 100].map((y) => (
            <g key={y}>
              <path d={`M66 ${y}h16v8H66zM92 ${y}h16v8H92zM118 ${y}h16v8h-16z`} />
              <path d={`M62 ${y + 11}h76`} opacity={0.5} />
            </g>
          ))}
          <path d="M92 120v-8h16v8M20 120h160" />
        </g>
      );
    case "townhouse":
      return (
        <g {...common}>
          {[40, 80, 120].map((x) => (
            <g key={x}>
              <path d={`M${x} 120V64l20-18 20 18v56`} />
              <path d={`M${x + 8} 76h10v10H${x + 8}zM${x + 24} 76h8v10h-8z`} />
              <path d={`M${x + 14} 120v-18h12v18`} />
            </g>
          ))}
          <path d="M20 120h160" />
        </g>
      );
    case "loft":
      return (
        <g {...common}>
          <path d="M45 120V58l22-14 22 14 22-14 22 14 22-14v76" />
          <path d="M56 70h88M56 70v40h88V70" opacity={0.9} />
          {[72, 92, 112, 132].map((x) => (
            <path key={x} d={`M${x} 70v40`} opacity={0.6} />
          ))}
          <path d="M56 90h88" opacity={0.6} />
          <path d="M20 120h160" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <path d="M55 120V70l45-34 45 34v50" />
          <path d="M46 76l54-42 54 42" />
          <path d="M126 50V36h10v22" />
          <path d="M68 82h18v16H68zM114 82h18v16h-18z" />
          <path d="M92 120V96h16v24" />
          <path d="M20 120h160M30 120c0-10 8-16 14-16s10 6 10 16M150 120c0-12 8-18 14-18s10 8 10 18" />
        </g>
      );
  }
}

export function PropertyCover({
  kind,
  cover,
  className,
  artClassName,
  photo,
  photoAlt,
  children,
}: {
  kind: PropertyKind;
  cover: [string, string];
  className?: string;
  /** Positioning for the drawing; defaults to centred. */
  artClassName?: string;
  /** Sample listing photo; replaces the line drawing when present. */
  photo?: string;
  photoAlt?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)} style={{ background: `linear-gradient(145deg, ${cover[0]} 0%, #0b1220 55%, ${cover[0]} 100%)` }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={photoAlt ?? "Sample listing photo"} loading="lazy" className="absolute inset-0 -z-10 size-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-0 -z-10 opacity-60" style={{ background: `radial-gradient(70% 90% at 85% 0%, ${cover[1]}55, transparent 60%)` }} aria-hidden />
          <div
            className="absolute inset-0 -z-10 opacity-[0.07]"
            style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
            aria-hidden
          />
          <svg
            viewBox="0 0 200 130"
            className={cn("absolute bottom-0 h-[82%] w-auto text-[#e3c274] drop-shadow-[0_0_12px_rgba(201,162,75,0.35)]", artClassName ?? "inset-x-0 mx-auto")}
            aria-hidden
          >
            <Drawing kind={kind} />
          </svg>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />
      {children}
    </div>
  );
}
