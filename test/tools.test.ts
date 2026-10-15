import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import * as etsy from "../src/etsy.js";
import { phraseKey, titleCase } from "../src/text.js";
const { fitWords } = etsy;
import { wedding, necklace } from "./helpers.js";

let client: Client;
type Text = { type: string; text: string };
async function call(name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Text[])[0].text;
  return { isError: Boolean(res.isError), text, json: () => JSON.parse(text) };
}
beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  client = new Client({ name: "unit", version: "1" });
  await client.connect(b);
});

// Small deterministic PRNG for property-style tests
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}
const VOCAB = ["wedding", "budget", "planner", "printable", "boho", "gold", "name", "necklace", "christmas", "svg", "bundle", "teacher", "gift", "personalized", "extraordinarily", "watercolor", "clipart", "digital", "sticker", "mothers", "day", "minimalist", "nursery", "wall", "art", "a4"];

describe("text helpers", () => {
  it("title-cases with acronyms and stopwords", () => {
    expect(titleCase("pdf planner for the bride")).toBe("PDF Planner for the Bride");
  });
  it("fitWords keeps the head noun", () => {
    expect(fitWords("wedding budget planner", 20)).toBe("budget planner");
    expect(fitWords("supercalifragilisticexpialidocious", 20)).toBeNull();
  });
  it("phraseKey merges plurals and word order", () => {
    expect(phraseKey("Wedding Planners")).toBe(phraseKey("planner wedding"));
  });
});

describe("generate_titles", () => {
  it("leads with the primary keyword, stays within limits, avoids stuffing", async () => {
    const r = (await call("generate_titles", wedding)).json();
    expect(r.titles.length).toBeGreaterThanOrEqual(3);
    expect(r.titles[0].title.startsWith("Wedding Budget Planner")).toBe(true);
    const concise = r.titles.find((t: { style: string }) => t.style === "concise");
    expect(concise.length).toBeLessThanOrEqual(70);
    for (const t of r.titles) {
      expect(t.title.length).toBeLessThanOrEqual(140);
      expect(t.length).toBe(t.title.length);
      const a = etsy.analyzeListing({ title: t.title, tags: [], description: "", keywords: wedding.keywords });
      expect(a.checks.find((c) => c.id === "no_keyword_stuffing")!.pass).toBe(true);
    }
    expect(r.titles[0].title).toContain("PDF");
  });
  it("adds a branded variant and uses special characters at most once", async () => {
    const r = (await call("generate_titles", { product_type: "art print", keywords: ["cats & dogs print", "pets & paws wall art", "100% cotton poster"], brand: "Paw & Co" })).json();
    expect(r.titles.some((t: { style: string }) => t.style === "branded")).toBe(true);
    for (const t of r.titles) {
      expect(t.title.split("&").length - 1).toBeLessThanOrEqual(1);
      expect(t.title.split("%").length - 1).toBeLessThanOrEqual(1);
    }
  });
  it("property: 300 random inputs never exceed 140 chars", () => {
    const r = rng(42);
    for (let i = 0; i < 300; i++) {
      const pick = (n: number) => Array.from({ length: n }, () => VOCAB[Math.floor(r() * VOCAB.length)]).join(" ");
      const p = { product_type: pick(2), keywords: Array.from({ length: 1 + Math.floor(r() * 8) }, () => pick(1 + Math.floor(r() * 5))), digital: r() > 0.5, attributes: { style: pick(1), occasion: pick(1) }, brand: r() > 0.7 ? pick(2) : undefined };
      for (const t of etsy.generateTitles(p).titles) expect(t.title.length).toBeLessThanOrEqual(140);
      const tags = etsy.generateTags(p).tags;
      expect(tags.length).toBeLessThanOrEqual(13);
      for (const tag of tags) {
        expect(tag.length).toBeLessThanOrEqual(20);
        expect(tag).toMatch(/^[a-z0-9 '&-]+$/);
      }
      expect(new Set(tags.map(phraseKey)).size).toBe(tags.length);
    }
  });
});

describe("generate_tags", () => {
  it("produces 13 unique multi-word-first tags for a well-specified digital product", async () => {
    const r = (await call("generate_tags", wedding)).json();
    expect(r.count).toBe(13);
    expect(r.all_within_limit).toBe(true);
    expect(r.tags).toContain("budget planner");
    expect(r.tags).toContain("digital download");
    const firstSingle = r.tags.findIndex((t: string) => !t.includes(" "));
    if (firstSingle >= 0) expect(r.tags.slice(firstSingle).every((t: string) => !t.includes(" "))).toBe(true);
  });
  it("never invents unconfirmed descriptors like 'handmade' and asks instead", async () => {
    const r = (await call("generate_tags", necklace)).json();
    expect(r.tags.join(" ")).not.toMatch(/handmade|boho|vintage/);
    expect(r.tags).toContain("gift for mom");
    expect(r.count).toBeLessThan(13);
    expect(r.ask_seller_about_modifiers).toContain("handmade");
    const more = (await call("generate_tags", { ...necklace, modifiers: ["handmade", "dainty", "14k gold"] })).json();
    expect(more.tags).toContain("handmade necklace");
    expect(more.count).toBeGreaterThan(r.count);
  });
  it("sanitises characters Etsy rejects", () => {
    expect(etsy.sanitizeTag("Boho #Wall Art!!")).toBe("boho wall art");
  });
});

describe("generate_description", () => {
  it("opens with the keyword, has sections, discloses digital delivery", async () => {
    const r = (await call("generate_description", { ...wedding, name: "Minimalist Wedding Budget Planner", highlights: ["Track every vendor"], whats_included: ["12-page PDF", "Bonus checklist"], how_to_use: ["Download", "Print or fill digitally"], dimensions: "A4 and US Letter" })).json();
    expect(r.primary_keyword_in_opening).toBe(true);
    expect(r.description).toContain("WHAT'S INCLUDED\n• 12-page PDF");
    expect(r.description).toContain("No physical item will be shipped");
    const score = etsy.analyzeListing({ title: "Wedding Budget Planner", tags: [], description: r.description, keywords: wedding.keywords, digital: true });
    expect(score.checks.filter((c) => c.area === "description").every((c) => c.pass)).toBe(true);
  });
  it("physical products get shipping/care sections and no digital note", async () => {
    const r = (await call("generate_description", { ...necklace, name: "Gold Name Necklace", care_or_requirements: "Avoid water", shipping_or_delivery: "Ships in 2 days" })).json();
    expect(r.description).toContain("CARE\n• Avoid water");
    expect(r.description).toContain("SHIPPING");
    expect(r.description).not.toContain("digital product");
  });
});

describe("analyze_listing", () => {
  it("a generated listing scores A", () => {
    const title = etsy.generateTitles(wedding).titles[0].title;
    const tags = etsy.generateTags(wedding).tags;
    const description = etsy.generateDescription({ ...wedding, name: "Minimalist Wedding Budget Planner", highlights: ["Track every vendor", "Auto totals"], whats_included: ["12-page PDF"], how_to_use: ["Download", "Print"] }).description;
    const r = etsy.analyzeListing({ title, tags, description, keywords: wedding.keywords, digital: true, photo_count: 10, has_video: true });
    expect(r.grade).toBe("A");
    expect(r.blockers).toEqual([]);
  });
  it("flags blockers and gives specific fixes for a weak listing", async () => {
    const r = (await call("analyze_listing", { title: "BEST PLANNER EVER planner planner planner " + "x".repeat(120), tags: ["planner", "planners", "a really very long tag phrase"], description: "Nice planner.", keywords: ["wedding budget planner"], digital: true, photo_count: 2, has_video: false })).json();
    expect(r.grade).toBe("F");
    expect(r.blockers.length).toBe(2);
    const ids = r.checks.filter((c: { pass: boolean }) => !c.pass).map((c: { id: string }) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["title_length", "primary_keyword_front", "no_all_caps", "no_keyword_stuffing", "tags_all_13", "tags_length", "tags_unique", "description_length", "digital_disclosure", "photos", "video"]));
    expect(r.top_fixes.length).toBe(5);
  });
  it("partial credit when no keywords are given; media optional", () => {
    const r = etsy.analyzeListing({ title: "Handmade Ceramic Mug, Speckled Stoneware Coffee Cup", tags: [], description: "" });
    expect(r.by_area.map((a) => a.area)).toEqual(["title", "tags", "description"]);
    expect(r.checks.find((c) => c.id === "primary_keyword_front")!.points).toBe(6);
  });
  it("special characters more than once are flagged", () => {
    const r = etsy.analyzeListing({ title: "Cats & Dogs & Birds: Print: Set", tags: [], description: "" });
    expect(r.checks.find((c) => c.id === "special_chars_once")!.pass).toBe(false);
  });
});

describe("keywords", () => {
  it("cluster_keywords groups by shared terms and dedupes plurals", async () => {
    const r = (await call("cluster_keywords", { keywords: ["budget planner", "Budget Planners", "wedding budget planner", "wedding planner printable", "bride gift", "wedding checklist"] })).json();
    expect(r.total_keywords).toBe(5);
    const planner = r.clusters.find((c: { theme: string }) => c.theme === "planner");
    expect(planner.keywords).toContain("wedding budget planner");
    expect(planner.suggested_primary).toBe("wedding budget planner");
    expect(r.clusters[r.clusters.length - 1].theme).toBe("other");
  });
  it("suggest_long_tail produces unique, flagged phrases", async () => {
    const r = (await call("suggest_long_tail", { seed: "name necklace", attributes: { material: "gold", recipient: "mom" }, extra_modifiers: ["dainty"], max: 10 })).json();
    expect(r.suggestions.length).toBe(10);
    expect(r.suggestions[0].phrase).toBe("dainty name necklace");
    expect(new Set(r.suggestions.map((s: { phrase: string }) => phraseKey(s.phrase))).size).toBe(10);
    for (const s of r.suggestions) expect(s.tag_ready).toBe(s.phrase.length <= 20);
  });
});

describe("validation and annotations", () => {
  it("rejects bad input with clear errors", async () => {
    expect((await call("generate_tags", { product_type: "x", keywords: [] })).isError).toBe(true);
    expect((await call("analyze_listing", { title: "x", tags: [], description: "", photo_count: 99 })).isError).toBe(true);
  });
  it("all tools are read-only and closed-world", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(6);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.openWorldHint).toBe(false);
    }
  });
});
