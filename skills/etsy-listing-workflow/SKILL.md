---
name: etsy-listing-workflow
description: Step-by-step workflow for creating a new optimised Etsy listing (especially digital products) with the etsy-listing-optimizer tools. Use when the user wants a new listing, title, tags or description.
---

# Creating a listing end to end

1. **Gather facts.** Ask only for what's missing: what the item is (`product_type`), digital or physical, 3–10 phrases buyers would search, style / format / occasion / recipient / material, and what's included. Ask which descriptors are true (handmade, editable, Canva, personalised…) and pass them as `modifiers`.
2. **Organise keywords.** If the user has a raw list (autocomplete, eRank, Stats export), run `cluster_keywords`. Use the biggest cluster's `suggested_primary` as keyword #1 and order the rest by importance.
3. **Expand (optional).** `suggest_long_tail` on the primary keyword to fill gaps. Keep the `tag_ready` ones and confirm they're accurate.
4. **Generate:**
   - `generate_titles`: present the `seo_keyword_first` and `concise` options and recommend one. Etsy's current guidance favours shorter, readable titles.
   - `generate_tags`: show all 13. If fewer, relay `ask_seller_about_modifiers`.
   - `generate_description`: then personalise one or two sentences in the seller's voice. Don't invent features.
5. **Verify.** Run `analyze_listing` on the final title + tags + description (plus `photo_count`, `has_video` if known). Fix anything in `blockers`, then the `top_fixes`, and re-run until the grade is A or B.
6. **Deliver** a copy-paste block: Title, 13 tags (comma-separated), Description. Suggest attributes to set in Etsy and a photo shot list.

This plugin never logs into Etsy or publishes anything. The user pastes the result into Etsy themselves.
