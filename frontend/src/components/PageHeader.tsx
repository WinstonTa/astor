import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  titleSerif,
  titleSans,
  description,
  className,
}: {
  eyebrow: string;
  titleSerif: string;
  titleSans: string;
  description: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-col gap-3 animate-rise", className)}>
      <span className="text-[11px] font-medium tracking-[0.2em] text-primary/90 uppercase">
        {eyebrow}
      </span>
      <h1 className="tahoe-glass-heading flex flex-wrap items-baseline gap-x-2 gap-y-0 leading-tight">
        <span className="font-serif text-[28px] font-medium italic sm:text-[32px]">{titleSerif}</span>
        <span className="font-sans text-[28px] font-extrabold tracking-tight sm:text-[32px]">{titleSans}</span>
      </h1>
      <p className="max-w-xl text-[14px] leading-relaxed font-light text-foreground/75">{description}</p>
    </header>
  );
}
