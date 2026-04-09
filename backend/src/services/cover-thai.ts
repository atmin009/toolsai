/** Grapheme clusters (Thai vowels / tone marks stay attached). */
function graphemeSegments(s: string): string[] {
  try {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const seg = new Intl.Segmenter("th", { granularity: "grapheme" });
      return Array.from(seg.segment(s), (x) => x.segment);
    }
  } catch {
    // ignore
  }
  return Array.from(s);
}

function lenGraphemes(s: string): number {
  return graphemeSegments(s).length;
}

/** Safe slice on grapheme boundaries (avoids ▯ from split Thai syllables). */
export function graphemeSlice(s: string, start: number, end: number): string {
  return graphemeSegments(s).slice(start, end).join("");
}

/** Truncate without breaking Thai clusters; uses ASCII "..." (safe for bundled fonts). */
export function truncateGraphemes(s: string, max: number): string {
  const g = graphemeSegments(s);
  if (g.length <= max) return s;
  return g.slice(0, Math.max(0, max - 3)).join("") + "...";
}

/** NFC + strip invisible / exotic space / format chars that Satori may render as ▯ (tofu). */
export function sanitizeCoverText(s: string): string {
  return s
    .normalize("NFC")
    .replace(/\u200b/g, "")
    .replace(/\u200c|\u200d/g, "")
    .replace(/\ufffd/g, "")
    .replace(/[\u2000-\u200a\u202f\u205f\u3000\ufeff\ufe00-\ufe0f]/g, " ")
    .replace(/[\u202a-\u202e\u2060-\u2064\u2066-\u2069]/g, "")
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Latin-only brand lines (tagline). Drops non-ASCII so bundled Latin fonts never hit missing glyphs. */
export function sanitizeBrandLatin(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function segmentToParts(text: string, locale: string): string[] {
  try {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const seg = new Intl.Segmenter(locale, { granularity: "word" });
      const parts: string[] = [];
      for (const { segment } of seg.segment(text)) {
        if (segment.trim().length > 0) parts.push(segment);
      }
      if (parts.length) return parts;
    }
  } catch {
    // fall through
  }
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Line-break a title using word boundaries (Thai + English). Avoids naive mid-cluster cuts.
 */
export function splitCoverTitleThai(title: string, maxFirst = 28, maxSecond = 32): [string] | [string, string] {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t.length) return ["Untitled"];
  if (lenGraphemes(t) <= maxFirst) return [t];

  const hasThai = /[\u0E00-\u0E7F]/.test(t);
  const locale = hasThai ? "th" : "en";
  const wordSep = hasThai ? "" : " ";
  const parts = segmentToParts(t, locale);
  if (parts.length <= 1) {
    if (lenGraphemes(t) <= maxFirst) return [t];
    const a = graphemeSlice(t, 0, maxFirst);
    const rest = graphemeSlice(t, maxFirst, maxFirst + maxSecond);
    const more = lenGraphemes(t) > maxFirst + maxSecond;
    return [a.trim(), (rest.trim() + (more ? "..." : "")).trim()];
  }

  let line1 = "";
  let i = 0;
  while (i < parts.length) {
    const piece = parts[i];
    const next = line1 ? line1 + wordSep + piece : piece;
    if (lenGraphemes(next) <= maxFirst) {
      line1 = next;
      i++;
    } else break;
  }
  if (!line1) {
    line1 = parts[0];
    i = 1;
  }

  if (i >= parts.length) return [line1];

  let line2 = "";
  while (i < parts.length) {
    const piece = parts[i];
    const next = line2 ? line2 + wordSep + piece : piece;
    if (lenGraphemes(next) <= maxSecond) {
      line2 = next;
      i++;
    } else break;
  }
  if (line2 && i < parts.length) line2 = `${line2}...`;
  return line2 ? [line1, line2] : [line1];
}
