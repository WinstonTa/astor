import { useEffect, useState } from "react";

export function useThemePixelColors() {
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    div.className = "text-muted-foreground";
    const muted = getComputedStyle(div).color;
    div.className = "text-primary";
    const primary = getComputedStyle(div).color;
    document.body.removeChild(div);

    setColors([muted, muted, muted, muted, primary]);
  }, []);

  return colors;
}
