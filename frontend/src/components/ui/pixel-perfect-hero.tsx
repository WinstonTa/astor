import { useEffect, useState } from "react";
import { ArrowRight, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppBackground } from "@/components/AppBackground";

const BRAND_LOGOS = [
  () => (
    <div className="flex items-center justify-start gap-2 text-sm font-semibold text-foreground/75 opacity-60 transition-opacity duration-300 hover:opacity-100 md:text-base dark:text-foreground/80">
      <svg viewBox="0 0 24 24" className="h-[22px] fill-current md:h-[26px]" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      </svg>
      Anthropic
    </div>
  ),
  () => (
    <svg
      className="h-[22px] w-auto select-none opacity-60 transition-opacity duration-300 hover:opacity-100 sm:h-[28px]"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="2" className="fill-[#61dafb]" />
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61dafb" strokeWidth="1.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61dafb" strokeWidth="1.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61dafb" strokeWidth="1.2" transform="rotate(120 12 12)" />
    </svg>
  ),
  () => (
    <div className="flex items-center justify-start gap-2 text-sm font-bold text-foreground/75 opacity-60 transition-opacity duration-300 hover:opacity-100 md:text-base dark:text-foreground/80">
      <svg viewBox="0 0 24 24" className="h-[22px] fill-[#336791] md:h-[26px]" aria-hidden="true">
        <path d="M12 2C8.5 2 6 4.5 6 8c0 2.5 1.5 4.5 3.5 5.5v6.5c0 1.1.9 2 2 2s2-.9 2-2v-6.5c2-1 3.5-3 3.5-5.5 0-3.5-2.5-6-6-6z" />
      </svg>
      PostgreSQL
    </div>
  ),
  () => (
    <div className="flex items-center justify-start gap-2 text-sm font-bold text-foreground/75 opacity-60 transition-opacity duration-300 hover:opacity-100 md:text-base dark:text-foreground/80">
      <svg viewBox="0 0 24 24" className="h-[18px] fill-[#3178c6] sm:h-[22px]" aria-hidden="true">
        <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
      </svg>
      TypeScript
    </div>
  ),
];

export interface PixelHeroProps {
  word1?: string;
  word2?: string;
  description?: string;
  primaryCta?: string;
  primaryCtaMobile?: string;
  secondaryCta?: string;
  secondaryCtaMobile?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  githubUrl?: string;
}

export function PixelHero({
  word1 = "Agent",
  word2 = "Deck.",
  description = "A marketplace of specialist agents with isolated memory, live telemetry, and guardrails. Deploy your fleet and let each app handle what it does best.",
  primaryCta = "Open Marketplace",
  primaryCtaMobile = "Open",
  secondaryCta = "View GitHub",
  secondaryCtaMobile = "GitHub",
  onPrimaryClick,
  onSecondaryClick,
  githubUrl = "https://github.com/WinstonTa/astor",
}: PixelHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTimer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(loadTimer);
  }, []);

  return (
    <div className="relative isolate flex min-h-[100dvh] w-full flex-col justify-between overflow-hidden bg-background px-2 py-8 select-none sm:px-6 md:justify-center md:gap-6 md:py-0">
      <div className="pointer-events-none absolute inset-0 z-0">
        <AppBackground intensity="hero" />
      </div>

      <div className="pointer-events-none order-1 mt-28 flex w-full flex-col items-center justify-center text-center sm:mt-0 md:order-1">
        <h1 className="tahoe-glass-text flex w-full flex-row flex-wrap items-center justify-center gap-1.5 px-1 text-[2.8rem] leading-none sm:gap-4 sm:text-6xl md:text-8xl lg:gap-6 lg:text-9xl">
          <span className="font-serif font-medium italic">{word1}</span>
          <span className="font-sans font-extrabold tracking-tighter">{word2}</span>
        </h1>
      </div>

      <div className="pointer-events-none order-2 my-auto flex w-full flex-col items-center justify-center px-1 text-center md:order-2 md:my-0">
        <p className="max-w-[95%] px-1 text-sm leading-relaxed font-light text-foreground/85 sm:max-w-md sm:text-lg md:max-w-xl md:text-xl">
          {description}
        </p>

        <div className="pointer-events-auto mt-14 block w-full md:hidden">
          <div className="mb-5 text-[11px] font-medium tracking-wider text-muted-foreground/80 uppercase">
            Built with
          </div>
          <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_15%,white_85%,transparent)]">
            <div className="animate-marquee flex w-max gap-12 py-1">
              <div className="flex items-center gap-12">
                {BRAND_LOGOS.map((Logo, i) => (
                  <Logo key={i} />
                ))}
              </div>
              <div className="flex items-center gap-12" aria-hidden="true">
                {BRAND_LOGOS.map((Logo, i) => (
                  <Logo key={`c-${i}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-auto order-4 mt-4 mb-4 flex transform flex-row items-center justify-center gap-3 px-1 transition-all duration-1000 md:order-3 md:mt-10 md:mb-0",
          isLoaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        )}
        style={{ transitionDelay: "450ms" }}
      >
        <button
          type="button"
          onClick={onPrimaryClick}
          className="btn-primary-glass relative inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-primary-foreground ring-1 ring-primary/20 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] md:h-12 md:gap-2 md:px-8 md:text-sm"
        >
          <span className="inline md:hidden">{primaryCtaMobile}</span>
          <span className="hidden md:inline">{primaryCta}</span>
          <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </button>
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onSecondaryClick}
          className="btn-secondary-glass relative inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-card-foreground ring-1 ring-border/50 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] md:h-12 md:gap-2 md:px-8 md:text-sm"
        >
          <Github className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="inline md:hidden">{secondaryCtaMobile}</span>
          <span className="hidden md:inline">{secondaryCta}</span>
        </a>
      </div>

      <div
        className={cn(
          "pointer-events-auto absolute right-0 bottom-8 left-0 order-3 z-10 hidden w-full transform flex-col items-center justify-center gap-4 transition-all duration-1000 md:order-4 md:flex",
          isLoaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        )}
        style={{ transitionDelay: "600ms" }}
      >
        <span className="text-xs font-medium tracking-wider text-muted-foreground/80 uppercase select-none">
          Built with
        </span>
        <div className="relative w-full max-w-5xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_15%,white_85%,transparent)]">
          <div className="animate-marquee flex w-max gap-16 py-3">
            <div className="flex items-center gap-16">
              {BRAND_LOGOS.map((Logo, i) => (
                <Logo key={i} />
              ))}
            </div>
            <div className="flex items-center gap-16" aria-hidden="true">
              {BRAND_LOGOS.map((Logo, i) => (
                <Logo key={`c-${i}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
