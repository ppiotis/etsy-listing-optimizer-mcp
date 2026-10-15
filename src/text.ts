export const STOPWORDS = new Set(["a", "an", "and", "the", "for", "of", "to", "in", "on", "with", "by", "your", "my", "or", "at", "from", "is", "it", "this", "that"]);

const ACRONYMS = new Set(["pdf", "svg", "png", "jpg", "diy", "a4", "a5", "us", "uk", "3d", "ai", "eps", "dxf", "kdp"]);

export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export const words = (s: string) => norm(s).split(/[^a-z0-9']+/).filter(Boolean);
export const stem = (w: string) => (w.length > 3 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
export const contentTokens = (s: string) => words(s).filter((w) => !STOPWORDS.has(w)).map(stem);
export const titleCase = (s: string) =>
  norm(s)
    .split(" ")
    .map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : i > 0 && STOPWORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
export const uniqBy = <T>(xs: T[], key: (x: T) => string) => {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
/** Key used to treat "planner" / "planners" and word order variants as the same phrase. */
export const phraseKey = (s: string) => contentTokens(s).sort().join(" ");
