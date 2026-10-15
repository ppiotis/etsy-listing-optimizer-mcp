---
name: etsy-listing-audit
description: Audit and improve existing Etsy listings with analyze_listing. Use when the user pastes a listing, asks why a listing isn't selling or getting views, or wants a shop SEO review.
---

# Auditing an existing listing

1. Ask for the listing's title, tags, description, number of photos, whether it has a video, and the 1–3 keywords it *should* rank for. Paste-in is fine. No Etsy login is needed or used.
2. Run `analyze_listing` with `keywords` (primary first) and `digital` set correctly.
3. Report:
   - **Score and grade**, then any **blockers** first (title > 140 or tags > 20 characters: Etsy will reject edits).
   - The **top 3 fixes** in plain language, each with a concrete rewrite.
4. Rewrite. Use `generate_titles` / `generate_tags` with the listing's real facts, then re-run `analyze_listing` on the rewrite and show **before → after** scores.
5. For a multi-listing shop audit, analyse each listing, then summarise the patterns (e.g. "8/12 listings use under 10 tags", "no listing mentions instant download in the first 160 characters") and prioritise the best-selling listings first.

Be honest about limits. The score measures on-page best practice, not live search rank, and ranking also depends on reviews, conversion and price. Recommend checking Etsy Stats after ~2–4 weeks.
