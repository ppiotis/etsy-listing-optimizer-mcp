import { contentTokens, norm, phraseKey, stem, STOPWORDS, titleCase, uniqBy, words } from "./text.js";

export const LIMITS = { titleMax: 140, titleConcise: 70, tagCount: 13, tagMax: 20, descriptionMin: 300 } as const;

export interface ProductInput {
  product_type: string;
  keywords: string[];
  digital?: boolean;
  attributes?: {
    color?: string;
    material?: string;
    style?: string;
    occasion?: string;
    recipient?: string;
    size?: string;
    format?: string;
    personalization?: boolean;
  };
  brand?: string;
  /** Extra descriptors the seller confirms are TRUE for this item, e.g. ["handmade", "editable", "canva"]. */
  modifiers?: string[];
}

/** Descriptors that are always true for the product class, so safe to use without asking. */
export const SAFE_DEFAULT_MODIFIERS = { digital: ["digital download", "instant download"], physical: ["gift idea", "unique gift"] };
const MODIFIER_WORDS = new Set(["printable", "editable", "template", "pdf", "digital", "download", "instant", "canva", "svg", "png", "custom", "personalized", "handmade", "minimalist", "boho", "vintage"]);

export const DIGITAL_MODIFIERS = ["printable", "digital download", "instant download", "editable", "template", "pdf", "canva template", "digital planner", "2026", "minimalist"];
export const PHYSICAL_MODIFIERS = ["handmade", "personalized", "custom", "unique gift", "gift idea", "vintage style", "boho", "minimalist"];

const ONCE_CHARS = ["%", ":", "&", "+"];

export function sanitizeTag(raw: string): string {
  return norm(raw).replace(/[^a-z0-9 '&-]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Fit a phrase into maxLen. Prefers the longest contiguous multi-word window that keeps the
 * final (head) noun, e.g. "wedding budget planner" (22) -> "budget planner". Returns null if impossible.
 */
export function fitWords(phrase: string, maxLen: number): string | null {
  if (phrase.length <= maxLen) return phrase;
  const w = phrase.split(" ");
  for (let len = w.length - 1; len >= 2; len--) {
    const tail = w.slice(w.length - len).join(" ");
    if (tail.length <= maxLen) return tail;
  }
  for (let len = w.length - 1; len >= 2; len--) {
    for (let i = 0; i + len <= w.length; i++) {
      const win = w.slice(i, i + len).join(" ");
      if (win.length <= maxLen) return win;
    }
  }
  return null;
}

const hasRepeatedWord = (t: string) => {
  const ws = t.split(" ").map(stem);
  return new Set(ws).size !== ws.length;
};

function attributePhrases(p: ProductInput): string[] {
  const a = p.attributes ?? {};
  const t = norm(p.product_type);
  const out: string[] = [];
  if (a.personalization) out.push(`personalized ${t}`, `custom ${t}`);
  if (a.style) out.push(`${a.style} ${t}`);
  if (a.color) out.push(`${a.color} ${t}`);
  if (a.material) out.push(`${a.material} ${t}`);
  if (a.occasion) out.push(`${a.occasion} ${t}`, `${a.occasion} gift`);
  if (a.recipient) out.push(`gift for ${a.recipient}`, `${a.recipient} gift`);
  if (a.format) out.push(`${a.format} ${t}`, a.format);
  if (a.size) out.push(`${a.size} ${t}`);
  return out.map(norm);
}

export function generateTags(p: ProductInput) {
  const t = norm(p.product_type);
  const userMods = (p.modifiers ?? []).map(norm).filter(Boolean);
  const safeMods = p.digital ? SAFE_DEFAULT_MODIFIERS.digital : SAFE_DEFAULT_MODIFIERS.physical;
  const singleMods = userMods.filter((m) => !m.includes(" "));
  const heads = uniqBy(
    [t, ...p.keywords.slice(0, 3)].map((k) => contentTokens(k).filter((w) => !MODIFIER_WORDS.has(w)).slice(-1)[0]).filter((x): x is string => Boolean(x)),
    (x) => x,
  );
  // Long keywords (> 20 chars) also contribute their natural 2–3 word sub-phrases (the seller's own words).
  const windows = p.keywords.map(norm).filter((k) => k.length > LIMITS.tagMax).flatMap((k) => {
    const w = k.split(" ");
    const out: string[] = [];
    for (const len of [3, 2]) for (let i = 0; i + len <= w.length; i++) {
      const win = w.slice(i, i + len);
      if (STOPWORDS.has(win[0]) || STOPWORDS.has(win[len - 1])) continue;
      out.push(win.join(" "));
    }
    return out.filter((x) => x.length <= LIMITS.tagMax);
  });
  const primaryCandidates = [...p.keywords.map(norm), t, ...attributePhrases(p), ...windows];
  // Generated combos must fit as-is (never truncated) so they stay natural phrases.
  const combos = [...heads.flatMap((h) => singleMods.map((m) => `${m} ${h}`)), ...userMods.filter((m) => m.includes(" ")), ...safeMods].filter((c) => c.length <= LIMITS.tagMax);
  const candidates = [...primaryCandidates, ...combos, ...singleMods];
  const skipped: Array<{ phrase: string; reason: string }> = [];
  const multi: string[] = [];
  const single: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const s = sanitizeTag(raw);
    if (!s) continue;
    const tag = fitWords(s, LIMITS.tagMax);
    if (!tag) {
      skipped.push({ phrase: s, reason: `can't fit in ${LIMITS.tagMax} characters` });
      continue;
    }
    if (hasRepeatedWord(tag)) continue;
    const key = phraseKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    (tag.includes(" ") ? multi : single).push(tag);
  }
  const accepted = [...multi, ...single].slice(0, LIMITS.tagCount);
  return {
    tags: accepted,
    count: accepted.length,
    all_within_limit: accepted.every((x) => x.length <= LIMITS.tagMax),
    skipped,
    tips: [
      "Use all 13 tags; multi-word phrases match more buyer searches than single words.",
      "Tags don't need to repeat words already in your title or categories, but strong buyer phrases can appear in both.",
      ...(accepted.length < LIMITS.tagCount ? [`Only ${accepted.length} unique tags could be built. Add more keywords, attributes, or confirmed modifiers.`] : []),
    ],
    ask_seller_about_modifiers: accepted.length < LIMITS.tagCount ? (p.digital ? DIGITAL_MODIFIERS : PHYSICAL_MODIFIERS).filter((m) => !userMods.includes(m) && !safeMods.includes(m)) : [],
  };
}

function capOnceChars(s: string): string {
  for (const ch of ONCE_CHARS) {
    const i = s.indexOf(ch);
    if (i < 0) continue;
    const rest = s.slice(i + 1).split(ch).join(ch === "&" ? "and" : " ");
    s = s.slice(0, i + 1) + rest;
  }
  return s.replace(/\s+/g, " ").trim();
}

function joinWithin(parts: string[], sep: string, max: number): string {
  const out: string[] = [];
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const w of xs.flatMap((x) => words(x)).filter((w) => w.length > 2).map(stem)) m.set(w, (m.get(w) ?? 0) + 1);
    return m;
  };
  for (const p of parts) {
    const next = [...out, p];
    if (next.join(sep).length > max) continue;
    if ([...count(next).values()].some((n) => n > 2)) continue; // avoid keyword stuffing
    out.push(p);
  }
  return out.join(sep);
}

export function generateTitles(p: ProductInput) {
  const a = p.attributes ?? {};
  const type = titleCase(p.product_type);
  const kws = uniqBy(p.keywords.map(titleCase), phraseKey);
  const primary = kws[0] ?? type;
  const primaryHasType = contentTokens(primary).includes(contentTokens(type).slice(-1)[0] ?? "");
  const lead = primaryHasType ? primary : `${primary} ${type}`;
  const extras = [
    ...kws.slice(1),
    ...(a.style ? [titleCase(`${a.style} ${p.product_type}`)] : []),
    ...(a.occasion ? [titleCase(`${a.occasion} gift`)] : []),
    ...(a.recipient ? [titleCase(`gift for ${a.recipient}`)] : []),
    ...(p.digital ? ["Instant Download"] : a.personalization ? ["Personalized Gift"] : []),
    ...(a.format ? [titleCase(a.format)] : []),
  ];
  const dedupedExtras = uniqBy(extras, phraseKey).filter((x) => phraseKey(x) !== phraseKey(lead));
  const build = (style: string, parts: string[], sep: string, max: number) => {
    const title = capOnceChars(joinWithin(parts, sep, max));
    return { style, title, length: title.length };
  };
  const variants = [
    build("seo_keyword_first", [lead, ...dedupedExtras], ", ", LIMITS.titleMax),
    build("concise", [lead, ...dedupedExtras.slice(0, 2)], ", ", LIMITS.titleConcise),
    build("benefit_led", [[a.style && titleCase(a.style), lead].filter(Boolean).join(" "), p.digital ? "Instant Download" : "Ready to Gift", ...dedupedExtras.filter((x) => x !== "Instant Download")], " | ", LIMITS.titleMax),
  ];
  if (p.brand) variants.push(build("branded", [lead, ...dedupedExtras.slice(0, 3), titleCase(p.brand)], ", ", LIMITS.titleMax));
  return {
    titles: uniqBy(variants, (v) => v.title),
    limit: LIMITS.titleMax,
    tips: [
      "Lead with the phrase a buyer would actually type; the first ~40 characters show in search results.",
      "Etsy recommends clear, readable titles: don't stuff every tag into the title.",
      "Characters %, :, & and + may be used only once per title.",
    ],
  };
}

export interface DescriptionInput extends ProductInput {
  name: string;
  highlights?: string[];
  whats_included?: string[];
  how_to_use?: string[];
  dimensions?: string;
  care_or_requirements?: string;
  shipping_or_delivery?: string;
  call_to_action?: string;
}

export function generateDescription(d: DescriptionInput) {
  const primary = d.keywords[0] ?? d.product_type;
  const secondary = d.keywords.slice(1, 3);
  const article = /^[aeiou]/i.test(primary.trim()) ? "an" : "a";
  const opener = `${d.name}: ${article} ${norm(primary)}${d.attributes?.style ? ` with a clean ${norm(d.attributes.style)} design` : ""}${d.digital ? ", ready to download instantly" : ""}.${secondary.length ? ` Perfect if you're looking for a ${secondary.map(norm).join(" or ")}.` : ""}`;
  const sec = (title: string, items?: string[]) => (items?.length ? `\n\n${title}\n${items.map((i) => `• ${i.trim()}`).join("\n")}` : "");
  const digitalNote = d.digital ? "\n\nPLEASE NOTE\n• This is a digital product. No physical item will be shipped.\n• Files are available to download instantly after purchase from your Etsy Purchases page.\n• Colours may vary slightly between screens and printers." : "";
  const body = [
    opener,
    sec("WHY YOU'LL LOVE IT", d.highlights),
    sec("WHAT'S INCLUDED", d.whats_included),
    sec("HOW IT WORKS", d.how_to_use),
    d.dimensions ? `\n\nSIZE & FORMAT\n• ${d.dimensions}` : "",
    d.care_or_requirements ? `\n\n${d.digital ? "REQUIREMENTS" : "CARE"}\n• ${d.care_or_requirements}` : "",
    d.shipping_or_delivery ? `\n\n${d.digital ? "DELIVERY" : "SHIPPING"}\n• ${d.shipping_or_delivery}` : "",
    digitalNote,
    `\n\n${d.call_to_action ?? "Add it to your basket now, or tap ♡ to save it for later. Questions? Send me a message."}`,
  ].join("");
  return { description: body, length: body.length, first_160: body.slice(0, 160), primary_keyword_in_opening: norm(body.slice(0, 160)).includes(norm(primary)) };
}

export interface ListingInput {
  title: string;
  tags: string[];
  description: string;
  keywords?: string[];
  digital?: boolean;
  photo_count?: number;
  has_video?: boolean;
  price?: number;
}

interface Check {
  id: string;
  area: "title" | "tags" | "description" | "media";
  pass: boolean;
  points: number;
  max: number;
  message: string;
  fix?: string;
}

export function analyzeListing(l: ListingInput) {
  const checks: Check[] = [];
  const add = (c: Omit<Check, "points"> & { points?: number }) => checks.push({ ...c, points: c.points ?? (c.pass ? c.max : 0) });
  const title = l.title.trim();
  const primary = l.keywords?.[0] ? norm(l.keywords[0]) : null;

  // Title (35)
  add({ id: "title_length", area: "title", max: 8, pass: title.length > 0 && title.length <= LIMITS.titleMax, message: `Title is ${title.length}/${LIMITS.titleMax} characters`, fix: title.length > LIMITS.titleMax ? "Shorten to 140 characters or fewer (Etsy will reject it)." : "Add a descriptive title." });
  add({ id: "title_not_too_short", area: "title", max: 4, pass: title.length >= 30, message: title.length >= 30 ? "Title has enough detail" : "Title is very short", fix: "Include what it is plus one or two key descriptors (style, use, recipient)." });
  if (primary) {
    const pos = norm(title).indexOf(primary);
    add({ id: "primary_keyword_front", area: "title", max: 10, pass: pos >= 0 && pos < 40, points: pos >= 0 && pos < 40 ? 10 : pos >= 0 ? 5 : 0, message: pos < 0 ? `Primary keyword "${primary}" is missing from the title` : pos < 40 ? "Primary keyword is in the first 40 characters" : "Primary keyword appears late in the title", fix: `Move "${primary}" to the start of the title.` });
  } else {
    add({ id: "primary_keyword_front", area: "title", max: 10, pass: true, points: 6, message: "No target keywords given; partial credit. Pass keywords for a precise score." });
  }
  const caps = title.split(/\s+/).filter((w) => w.length > 3 && /^[A-Z0-9]+$/.test(w) && /[A-Z]/.test(w));
  add({ id: "no_all_caps", area: "title", max: 4, pass: caps.length === 0, message: caps.length ? `ALL-CAPS words: ${caps.join(", ")}` : "No shouting in title", fix: "Use title case instead of ALL CAPS." });
  const counts = new Map<string, number>();
  for (const w of words(title).filter((w) => w.length > 2).map(stem)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const repeated = [...counts.entries()].filter(([, n]) => n > 2).map(([w]) => w);
  add({ id: "no_keyword_stuffing", area: "title", max: 5, pass: repeated.length === 0, message: repeated.length ? `Words repeated 3+ times: ${repeated.join(", ")}` : "No keyword stuffing", fix: "Say each idea once; use tags for variants." });
  const badOnce = ONCE_CHARS.filter((c) => title.split(c).length - 1 > 1);
  add({ id: "special_chars_once", area: "title", max: 4, pass: badOnce.length === 0, message: badOnce.length ? `Used more than once: ${badOnce.join(" ")}` : "Special characters used correctly", fix: "Etsy allows %, :, & and + only once in a title." });

  // Tags (30)
  const tags = l.tags.map((t) => t.trim()).filter(Boolean);
  add({ id: "tags_all_13", area: "tags", max: 10, pass: tags.length === 13, points: Math.round((Math.min(tags.length, 13) / 13) * 10), message: `${tags.length}/13 tags used`, fix: "Use all 13 tag slots." });
  const tooLong = tags.filter((t) => t.length > LIMITS.tagMax);
  add({ id: "tags_length", area: "tags", max: 6, pass: tooLong.length === 0, message: tooLong.length ? `Over 20 characters: ${tooLong.join(", ")}` : "All tags are within 20 characters", fix: "Shorten tags to 20 characters (Etsy rejects longer ones)." });
  const multi = tags.filter((t) => t.includes(" ")).length;
  add({ id: "tags_multiword", area: "tags", max: 8, pass: tags.length > 0 && multi / tags.length >= 0.6, points: tags.length ? Math.round(Math.min(1, multi / tags.length / 0.6) * 8) : 0, message: `${multi}/${tags.length} tags are multi-word phrases`, fix: "Turn single words into buyer phrases, e.g. 'planner' → 'weekly planner pdf'." });
  const dupKeys = tags.length - new Set(tags.map(phraseKey)).size;
  add({ id: "tags_unique", area: "tags", max: 6, pass: dupKeys === 0, message: dupKeys ? `${dupKeys} duplicate or plural-variant tag(s)` : "No duplicate tags", fix: "Etsy already matches plurals; replace duplicates with new phrases." });

  // Description (25)
  const desc = l.description.trim();
  add({ id: "description_length", area: "description", max: 7, pass: desc.length >= LIMITS.descriptionMin, points: Math.round(Math.min(1, desc.length / LIMITS.descriptionMin) * 7), message: `Description is ${desc.length} characters`, fix: "Aim for 300+ characters covering what it is, what's included and how it works." });
  if (primary) add({ id: "description_opening_keyword", area: "description", max: 7, pass: norm(desc.slice(0, 160)).includes(primary), message: norm(desc.slice(0, 160)).includes(primary) ? "Primary keyword appears in the first 160 characters" : "Opening sentence doesn't mention the primary keyword", fix: "The first 160 characters can show in Google results: describe the item using your main keyword." });
  else add({ id: "description_opening_keyword", area: "description", max: 7, pass: true, points: 4, message: "No keywords given; partial credit." });
  const structured = /\n\s*[•\-*✓✔]/.test(desc) || /\n[A-Z][A-Z '&]{3,}\n/.test(desc);
  add({ id: "description_scannable", area: "description", max: 5, pass: structured, message: structured ? "Description uses sections or bullets" : "Description is a wall of text", fix: "Add short sections (WHAT'S INCLUDED, HOW IT WORKS) with bullet points." });
  if (l.digital) {
    const disclosed = /digital|instant download|no physical/i.test(desc);
    add({ id: "digital_disclosure", area: "description", max: 6, pass: disclosed, message: disclosed ? "Digital delivery is clearly disclosed" : "Doesn't say it's a digital download", fix: "State clearly: 'This is a digital download. No physical item will be shipped.' This cuts disputes." });
  } else {
    const included = /includ|dimension|size|material|measur/i.test(desc);
    add({ id: "physical_details", area: "description", max: 6, pass: included, message: included ? "Includes size/material details" : "Missing size, materials or what's included", fix: "Add dimensions, materials and what's in the box." });
  }

  // Media (10)
  if (l.photo_count !== undefined) add({ id: "photos", area: "media", max: 7, pass: l.photo_count >= 7, points: Math.round(Math.min(1, l.photo_count / 7) * 7), message: `${l.photo_count}/10 photos`, fix: "Use at least 7 of the 10 image slots: hero, detail, scale, in-use, what's included." });
  if (l.has_video !== undefined) add({ id: "video", area: "media", max: 3, pass: l.has_video, message: l.has_video ? "Has a listing video" : "No listing video", fix: "Add a 5–15s video; Etsy shows video in search on many surfaces." });

  const max = checks.reduce((a, c) => a + c.max, 0);
  const got = checks.reduce((a, c) => a + c.points, 0);
  const score = Math.round((got / max) * 100);
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 65 ? "C" : score >= 50 ? "D" : "F";
  const blockers = checks.filter((c) => ["title_length", "tags_length"].includes(c.id) && !c.pass).map((c) => c.message);
  return {
    score,
    grade,
    blockers,
    by_area: (["title", "tags", "description", "media"] as const).map((area) => ({ area, points: checks.filter((c) => c.area === area).reduce((a, c) => a + c.points, 0), max: checks.filter((c) => c.area === area).reduce((a, c) => a + c.max, 0) })).filter((x) => x.max > 0),
    top_fixes: checks.filter((c) => !c.pass && c.fix).sort((a, b) => b.max - b.points - (a.max - a.points)).slice(0, 5).map((c) => c.fix),
    checks,
  };
}

export function clusterKeywords(keywords: string[]) {
  const kws = uniqBy(keywords.map(norm).filter(Boolean), phraseKey);
  const tokenFreq = new Map<string, number>();
  for (const k of kws) for (const t of new Set(contentTokens(k))) tokenFreq.set(t, (tokenFreq.get(t) ?? 0) + 1);
  const clusters = new Map<string, string[]>();
  for (const k of kws) {
    const toks = [...new Set(contentTokens(k))];
    const best = toks.sort((a, b) => (tokenFreq.get(b) ?? 0) - (tokenFreq.get(a) ?? 0) || b.length - a.length || a.localeCompare(b))[0] ?? k;
    const theme = (tokenFreq.get(best) ?? 0) > 1 ? best : "other";
    clusters.set(theme, [...(clusters.get(theme) ?? []), k]);
  }
  const out = [...clusters.entries()]
    .map(([theme, list]) => ({
      theme,
      keywords: list,
      suggested_primary: [...list].sort((a, b) => contentTokens(b).length - contentTokens(a).length || a.length - b.length)[0],
      tag_ready: list.filter((k) => sanitizeTag(k).length <= LIMITS.tagMax),
    }))
    .sort((a, b) => (a.theme === "other" ? 1 : b.theme === "other" ? -1 : b.keywords.length - a.keywords.length));
  return { clusters: out, total_keywords: kws.length, guidance: "Use one cluster's suggested_primary to lead the title; spread the other clusters across tags so each tag targets a different search." };
}

export function suggestLongTail(seed: string, opts: { digital?: boolean; attributes?: ProductInput["attributes"]; extra_modifiers?: string[]; max?: number }) {
  const s = norm(seed);
  const head = contentTokens(s).slice(-1)[0] ?? s;
  const mods = [...(opts.extra_modifiers ?? []).map(norm), ...(opts.digital ? DIGITAL_MODIFIERS : PHYSICAL_MODIFIERS)];
  const a = opts.attributes ?? {};
  const attr = [a.style, a.color, a.material, a.occasion, a.format].filter((x): x is string => Boolean(x)).map(norm);
  const raw = [
    ...mods.map((m) => (m.startsWith("gift for") ? `${s} ${m}` : `${m} ${s}`)),
    ...attr.map((x) => `${x} ${s}`),
    ...(a.recipient ? [`${s} for ${norm(a.recipient)}`, `${head} gift for ${norm(a.recipient)}`] : []),
    ...attr.flatMap((x) => mods.slice(0, 3).map((m) => `${x} ${m} ${head}`)),
  ];
  const list = uniqBy(raw.map((x) => x.replace(/\s+/g, " ").trim()), phraseKey)
    .filter((x) => phraseKey(x) !== phraseKey(s))
    .slice(0, opts.max ?? 25)
    .map((phrase) => ({ phrase, length: phrase.length, tag_ready: sanitizeTag(phrase).length <= LIMITS.tagMax, words: phrase.split(" ").length }));
  return { seed: s, suggestions: list, note: "Rule-based variants from proven Etsy modifiers. Validate demand with Etsy search autocomplete or your Etsy Stats > Search terms before committing." };
}
