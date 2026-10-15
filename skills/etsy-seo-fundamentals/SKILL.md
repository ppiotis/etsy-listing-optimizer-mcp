---
name: etsy-seo-fundamentals
description: Etsy SEO rules and best practices the agent should apply when writing or reviewing any Etsy listing (titles, tags, descriptions, photos, attributes).
---

# Etsy SEO fundamentals

Etsy search matches a buyer's query against **title, tags, categories and attributes**, then ranks by relevance plus listing quality (conversion, reviews, recency, shipping/price competitiveness). You can control relevance and the inputs to quality.

## Hard limits (Etsy rejects listings that break these)
- **Title:** max **140 characters**. `%`, `:`, `&` and `+` may each appear **once**.
- **Tags:** up to **13**, each max **20 characters**; letters, numbers, spaces, `-`, `'`, `&`.
- Photos: up to 10; one video.

## Best practice
- **Title**: write it for humans first. Lead with the exact phrase a buyer types ("wedding budget planner"), then 1–3 differentiators (style, format, recipient). The first ~40 characters matter most because they show in search and on mobile. Don't repeat a word more than twice, and don't use ALL CAPS.
- **Tags**: use all 13. Prefer **multi-word buyer phrases** ("gift for bride") over single words. Each tag should target a *different* search. Etsy already matches plurals, so "planner" and "planners" waste a slot. Use **attributes and categories** too: they act like free tags, so don't spend tags on the exact category name.
- **Accuracy beats volume.** Never tag "handmade", "personalized", "gold" etc. unless it's true. The `generate_tags` tool only uses descriptors the seller confirmed via `modifiers`, plus always-true ones ("digital download" for digital items). When it returns `ask_seller_about_modifiers`, ask the user which apply.
- **Description**: the first ~160 characters may appear in Google results. Open with what it is, using the primary keyword naturally. Then add scannable sections: why you'll love it, what's included, how it works, size/format, delivery. For **digital products**, always say no physical item ships. This prevents disputes.
- **Photos**: use 7–10: hero, detail, scale/in-use, what's included, and for digital items mockups plus a "what you get" graphic. Add a 5–15s video.
- **Validate demand**: rule-based suggestions are hypotheses. Check Etsy search autocomplete and the shop's Stats → search terms, and keep phrases buyers actually use.
