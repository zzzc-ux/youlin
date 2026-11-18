import { avatarTone, displayName } from "@/lib/forum/format";
import { cn } from "@/lib/utils";

const SIZES = {
  lg: "size-7 text-[12px]",
  md: "size-[22px] text-[10.5px]",
  sm: "size-5 text-[10px]",
  xs: "size-[17px] text-[9px]",
} as const;

export function Avatar({
  author,
  className,
  size = "sm",
}: {
  author: string;
  className?: string;
  size?: keyof typeof SIZES;
}) {
  const name = displayName(author);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: avatarTone(name) }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
