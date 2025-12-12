import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "200px",
  md: "260px",
  lg: "320px",
};

type PrismLogoProps = {
  className?: string;
  size?: keyof typeof sizeMap;
  showWordmark?: boolean;
};

type PrismStyle = CSSProperties & {
  "--prism-size"?: string;
};

export function PrismLogo({ className, size = "md", showWordmark = true }: PrismLogoProps) {
  const resolvedSize = sizeMap[size] ?? sizeMap.md;
  const customStyle: PrismStyle = {
    "--prism-size": resolvedSize,
  };
  const frameStyle: CSSProperties = {
    width: resolvedSize,
    margin: "20px auto",
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex w-full flex-col items-center gap-3 justify-center" style={frameStyle}>
        <div className="audio-prism" style={customStyle}>
          <span className="audio-prism__core">
            <span className="audio-prism__face audio-prism__face--front" />
            <span className="audio-prism__face audio-prism__face--right" />
            <span className="audio-prism__face audio-prism__face--left" />
          </span>
          <span className="audio-prism__halo" />
          <span className="audio-prism__reflection" />
        </div>
        {showWordmark && (
          <span className="block w-full text-center text-[0.6rem] font-semibold uppercase tracking-[0.5em] text-slate-200/80">
            AudioPrism
          </span>
        )}
      </div>
    </div>
  );
}
