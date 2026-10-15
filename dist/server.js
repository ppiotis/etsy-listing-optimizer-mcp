import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { safe } from "./result.js";
import * as etsy from "./etsy.js";
export const VERSION = "1.0.0";
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const keywords = z.array(z.string().trim().min(1).max(80)).min(1).max(50).describe("Target search phrases, most important first");
const attributes = z
    .object({
    color: z.string().max(40).optional(),
    material: z.string().max(40).optional(),
    style: z.string().max(40).optional().describe("e.g. boho, minimalist, vintage"),
    occasion: z.string().max(40).optional().describe("e.g. wedding, christmas, birthday"),
    recipient: z.string().max(40).optional().describe("e.g. her, mom, teacher"),
    size: z.string().max(40).optional(),
    format: z.string().max(40).optional().describe("e.g. pdf, canva template, svg"),
    personalization: z.boolean().optional(),
})
    .optional();
const product = {
    product_type: z.string().trim().min(1).max(60).describe("What the item is, e.g. 'wedding budget planner'"),
    keywords,
    digital: z.boolean().optional().describe("true for digital downloads"),
    attributes,
    modifiers: z.array(z.string().trim().min(1).max(30)).max(20).optional().describe("Descriptors the seller confirms are true (e.g. handmade, editable, canva). Only these are added beyond keywords/attributes."),
};
export function createServer() {
    const server = new McpServer({ name: "etsy-listing-optimizer", version: VERSION }, { instructions: "Deterministic Etsy listing SEO helpers. Works only on data the user provides; no Etsy account or API access. Typical flow: cluster_keywords → suggest_long_tail → generate_titles + generate_tags + generate_description → analyze_listing to verify." });
    server.registerTool("generate_titles", {
        title: "Generate Etsy titles",
        description: "Build 3–4 Etsy title variants (SEO keyword-first, concise ≤70, benefit-led, optional branded), each guaranteed ≤140 characters with %, :, & and + used at most once.",
        inputSchema: { ...product, brand: z.string().max(40).optional() },
        annotations: RO,
    }, safe((a) => etsy.generateTitles(a)));
    server.registerTool("generate_tags", {
        title: "Generate 13 Etsy tags",
        description: "Build up to 13 unique tags (each ≤20 characters, multi-word buyer phrases, no plural duplicates) from keywords, attributes and proven modifiers. Reports skipped phrases.",
        inputSchema: product,
        annotations: RO,
    }, safe((a) => etsy.generateTags(a)));
    server.registerTool("generate_description", {
        title: "Generate listing description",
        description: "Write a structured, scannable Etsy description: keyword-rich opening (first 160 chars), highlights, what's included, how it works, size/format, delivery, and a digital-download disclosure when digital.",
        inputSchema: {
            ...product,
            name: z.string().trim().min(1).max(140).describe("Product name as you'd say it to a buyer"),
            highlights: z.array(z.string().max(200)).max(10).optional(),
            whats_included: z.array(z.string().max(200)).max(20).optional(),
            how_to_use: z.array(z.string().max(200)).max(10).optional(),
            dimensions: z.string().max(200).optional(),
            care_or_requirements: z.string().max(300).optional(),
            shipping_or_delivery: z.string().max(300).optional(),
            call_to_action: z.string().max(200).optional(),
        },
        annotations: RO,
    }, safe((a) => etsy.generateDescription(a)));
    server.registerTool("analyze_listing", {
        title: "Score an Etsy listing",
        description: "Score a listing 0–100 (grade A–F) against Etsy best practices: title length and keyword placement, caps and stuffing, 13 tags ≤20 chars and multi-word, description length/opening/structure/disclosure, photos and video. Returns blockers and the top 5 fixes.",
        inputSchema: {
            title: z.string().max(500),
            tags: z.array(z.string().max(100)).max(30),
            description: z.string().max(20000),
            keywords: z.array(z.string().max(80)).max(20).optional().describe("Target keywords, primary first (improves accuracy)"),
            digital: z.boolean().optional(),
            photo_count: z.number().int().min(0).max(10).optional(),
            has_video: z.boolean().optional(),
            price: z.number().min(0).optional(),
        },
        annotations: RO,
    }, safe((a) => etsy.analyzeListing(a)));
    server.registerTool("cluster_keywords", {
        title: "Cluster keywords",
        description: "Group a raw keyword list (e.g. from Etsy search autocomplete, eRank or your Etsy Stats export) into themes by shared terms, pick a primary phrase per theme and flag tag-ready (≤20 char) phrases.",
        inputSchema: { keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(500) },
        annotations: RO,
    }, safe(({ keywords }) => etsy.clusterKeywords(keywords)));
    server.registerTool("suggest_long_tail", {
        title: "Suggest long-tail keywords",
        description: "Expand a seed phrase into long-tail variants using proven Etsy modifiers (digital or physical) and your attributes, flagging which fit as tags.",
        inputSchema: {
            seed: z.string().trim().min(1).max(80),
            digital: z.boolean().optional(),
            attributes,
            extra_modifiers: z.array(z.string().max(40)).max(20).optional(),
            max: z.number().int().min(1).max(100).optional(),
        },
        annotations: RO,
    }, safe(({ seed, ...o }) => etsy.suggestLongTail(seed, o)));
    return server;
}
