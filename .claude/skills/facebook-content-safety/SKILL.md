---
name: facebook-content-safety
description: Use when reviewing or rewriting Vietnamese Facebook posts, captions, images, Reels, news-style posts, celebrity posts, private messages, brand criticism, or sensitive content for community-standard, privacy, copyright, and reputational risk.
---

# Facebook Content Safety

Default to Vietnamese output. Use this skill as a safety and compliance layer, not as a way to bypass platform rules.

## Review Workflow

1. Classify topic risk: low, medium, high.
2. Check protected groups and private information.
3. Check text for violence, self-harm, sexual content, minors, hate, harassment, crime, accidents, health, finance, controlled goods, copyright, and brand criticism.
4. Check image/video for faces, names, IDs, plate numbers, blood, weapons, drugs, nudity, self-harm scenes, graphic injury, logos, and screenshots.
5. Rewrite safely:
   - remove identifiers
   - reduce graphic detail
   - use neutral wording
   - cite credible sources
   - avoid accusations without verified source
   - protect minors and victims
6. Return a publish checklist.

Read `references/facebook-risk-checklist.md` for specific categories and `references/risk-terms.md` for risky term groups.

## Important Stance

- Do not help users publish content that violates platform rules.
- Do not provide coded language for illegal goods, sexual exploitation, hate, harassment, or harmful behavior.
- If the user asks to "lách", reframe to compliant rewriting and risk reduction.
- For allegations, use careful wording: "the report alleges", "according to [source]", "not independently verified".

## Output Template

```markdown
## Risk level
## Main risks
## Safer rewrite
## Image/video edits needed
## Before publishing
```
