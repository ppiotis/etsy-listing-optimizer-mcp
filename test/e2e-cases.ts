import { expect } from "vitest";
import { wedding } from "./helpers.js";

export const e2eEnv: Record<string, string> = {};
export async function setupE2E() {
  return {};
}
export async function teardownE2E() {}
export const expectedTools = ["generate_titles", "generate_tags", "generate_description", "analyze_listing", "cluster_keywords", "suggest_long_tail"];
export interface Case {
  tool: string;
  args: (ctx: Record<string, unknown>) => Record<string, unknown>;
  isError?: boolean;
  check?: (text: string, ctx: Record<string, unknown>) => void;
}
const j = (t: string) => JSON.parse(t);
export const cases: Case[] = [
  { tool: "generate_titles", args: () => wedding, check: (t) => j(t).titles.forEach((x: { title: string }) => expect(x.title.length).toBeLessThanOrEqual(140)) },
  { tool: "generate_tags", args: () => wedding, check: (t) => expect(j(t).count).toBe(13) },
  { tool: "generate_description", args: () => ({ ...wedding, name: "Minimalist Wedding Budget Planner", whats_included: ["12-page PDF"] }), check: (t) => expect(j(t).primary_keyword_in_opening).toBe(true) },
  { tool: "analyze_listing", args: () => ({ title: "PLANNER planner planner planner", tags: ["planner"], description: "short", keywords: ["wedding budget planner"], digital: true }), check: (t) => expect(j(t).grade).toBe("F") },
  { tool: "cluster_keywords", args: () => ({ keywords: ["budget planner", "wedding budget planner", "wedding checklist", "bride gift"] }), check: (t) => expect(j(t).clusters.length).toBeGreaterThan(1) },
  { tool: "suggest_long_tail", args: () => ({ seed: "budget planner", digital: true }), check: (t) => expect(j(t).suggestions.length).toBeGreaterThan(5) },
  { tool: "generate_tags", args: () => ({ product_type: "", keywords: [] }), isError: true },
];
