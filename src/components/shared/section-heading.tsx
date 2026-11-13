import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  as: Tag = "h2",
}: {
  as?: "h1" | "h2";
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">{eyebrow}</p>
      )}
      <Tag className="text-4xl leading-[1.05] sm:text-5xl">{title}</Tag>
      {description && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

export function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <section className="bg-espresso px-5 pb-16 pt-36 text-background sm:pb-24 sm:pt-44">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#e39a80]">{eyebrow}</p>
        <h1 className="max-w-3xl text-5xl leading-[1.02] sm:text-7xl">{title}</h1>
        {description && <p className="mt-6 max-w-xl text-lg text-background/70">{description}</p>}
      </div>
    </section>
  );
}
