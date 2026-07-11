import { PixelCanvas } from "@/components/ui/pixel-canvas";
import { useThemePixelColors } from "@/lib/useThemePixelColors";

export function AppBackground({ intensity = "app" }: { intensity?: "hero" | "app" }) {
  const colors = useThemePixelColors();
  const isHero = intensity === "hero";

  return (
    <>
      {colors.length > 0 && (
        <PixelCanvas
          colors={colors}
          gap={isHero ? 6 : 9}
          speed={isHero ? 30 : 18}
          className={isHero ? "opacity-100" : "opacity-55"}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isHero
            ? "radial-gradient(circle at center, transparent 0%, var(--color-background) 100%)"
            : "radial-gradient(ellipse 80% 70% at 50% 20%, transparent 0%, var(--color-background) 72%)",
          opacity: isHero ? 0.8 : 0.92,
        }}
      />
    </>
  );
}
