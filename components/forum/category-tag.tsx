import { cn } from "@/lib/utils";

export type ForumStatus = "open" | "done" | null;

export function CategoryTag({
  category,
  status,
}: {
  category: string;
  status?: ForumStatus;
}) {
  const suffix =
    status === "done"
      ? "已解决"
      : status === "open"
        ? category === "招领"
          ? "待认领"
          : "寻找中"
        : null;
  const dot =
    status === "done"
      ? "bg-emerald-600"
      : status === "open"
        ? "bg-amber-600"
        : null;

  const label = suffix ? `${category} · ${suffix}` : category;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-muted px-1.5 py-0.5 text-[11.5px] leading-[1.5] text-foreground/65">
      {dot ? <i className={cn("size-[5px] rounded-full", dot)} /> : null}
      {label}
    </span>
  );
}
