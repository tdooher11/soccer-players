import {measureText} from '@remotion/layout-utils';

type FitOpts = {
  text: string;
  fontFamily: string;
  fontWeight: number;
  maxWidth: number;
  maxLines: number;
  maxSize: number;
  minSize: number;
};

const wrap = (text: string, size: number, o: FitOpts): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    const {width} = measureText({text: candidate, fontFamily: o.fontFamily, fontWeight: o.fontWeight, fontSize: size, validateFontIsLoaded: false});
    if (width <= o.maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/**
 * Largest font size (step 2px) at which `text` fits in maxLines within maxWidth.
 * `multiLineMax` caps the size whenever the text needs more than one line.
 */
export const fitText = (o: FitOpts & {multiLineMax?: number}): {size: number; lines: number} => {
  for (let size = o.maxSize; size >= o.minSize; size -= 2) {
    if (o.multiLineMax && size > o.multiLineMax && wrap(o.text, size, o).length > 1) continue;
    const lines = wrap(o.text, size, o);
    const widest = Math.max(
      ...lines.map((l) => measureText({text: l, fontFamily: o.fontFamily, fontWeight: o.fontWeight, fontSize: size, validateFontIsLoaded: false}).width),
    );
    if (lines.length <= o.maxLines && widest <= o.maxWidth) return {size, lines: lines.length};
  }
  return {size: o.minSize, lines: o.maxLines};
};
