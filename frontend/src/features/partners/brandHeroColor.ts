type Rgb = { r: number; g: number; b: number };

function parseColor(value: string | null | undefined): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value?.trim() ?? '');
  if (!match) return null;
  const encoded = Number.parseInt(match[1], 16);
  return { r: (encoded >> 16) & 255, g: (encoded >> 8) & 255, b: encoded & 255 };
}

function toHex(color: Rgb): string {
  return `#${[color.r, color.g, color.b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function contrastAgainstWhite(value: string): number {
  const color = parseColor(value);
  if (!color) return 0;
  const [red, green, blue] = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return 1.05 / (luminance + 0.05);
}

export function readableHeroColor(value: string | null | undefined, fallback: string): string {
  const selected = parseColor(value);
  if (!selected) return fallback;
  if (contrastAgainstWhite(toHex(selected)) >= 4.5) return toHex(selected);

  // Keep the selected hue; darken only as much as needed for text on the light hero.
  let readable = '#000000';
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const ratio = (low + high) / 2;
    const candidate = toHex({
      r: Math.round(selected.r * ratio),
      g: Math.round(selected.g * ratio),
      b: Math.round(selected.b * ratio)
    });
    if (contrastAgainstWhite(candidate) >= 4.5) {
      readable = candidate;
      low = ratio;
    } else {
      high = ratio;
    }
  }
  return readable;
}
