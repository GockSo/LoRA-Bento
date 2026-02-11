import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use HSL for better looking colors (pastel-ish)
  // Hue: hash % 360
  // Saturation: 60-80% (fixed range)
  // Lightness: 40-60% (fixed range for readability)

  const h = Math.abs(hash) % 360;
  const s = 70; // 70% saturation
  const l = 45; // 45% lightness (good for dark/light mode text contrast usually, or use with white text)

  return `hsl(${h}, ${s}%, ${l}%)`;
}
