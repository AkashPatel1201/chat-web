import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "idle" | "dnd" | "offline";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

const statusClasses = {
  online: "bg-emerald-500 ring-emerald-950",
  idle: "bg-amber-500 ring-amber-950",
  dnd: "bg-rose-500 ring-rose-950",
  offline: "bg-zinc-500 ring-zinc-950",
};

export function Avatar({
  src,
  alt = "Avatar",
  fallback = "U",
  size = "md",
  status,
  className,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  // Generate pleasant background color based on name/fallback
  const getBgColor = (text: string) => {
    const colors = [
      "from-blue-600 to-indigo-600",
      "from-violet-600 to-purple-600",
      "from-pink-600 to-rose-600",
      "from-emerald-600 to-teal-600",
      "from-amber-600 to-orange-600",
      "from-cyan-600 to-blue-600",
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold overflow-visible",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <div className="relative h-full w-full rounded-full overflow-hidden flex items-center justify-center">
        {src && !imageError ? (
          <img
            src={src}
            alt={alt}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br text-white font-medium uppercase shadow-inner",
              getBgColor(fallback)
            )}
          >
            {fallback.slice(0, 2)}
          </div>
        )}
      </div>

      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-background",
            statusClasses[status],
            size === "sm" && "h-2.5 w-2.5",
            size === "md" && "h-3 w-3",
            size === "lg" && "h-3.5 w-3.5",
            size === "xl" && "h-4 w-4"
          )}
        />
      )}
    </div>
  );
}
