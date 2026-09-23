# DESIGN.md

## Identity

Org-facing certificate platform. For training teams, schools, and event organizers. Feels like a dependable institutional tool: clear, trustworthy, efficient. One sentence: "A public workspace where any organization designs and prepares certificates without setup."

## Personality

- Professional and warm, not corporate-cold
- Paper/letterpress heritage without feeling antique
- Confident and orderly; no hype language

## Palette

Paper & ink. Warm off-white paper, near-black ink text, one accent.

| Role | Hex | Use |
|------|-----|-----|
| Paper | `#F7F4EE` | Page background |
| Paper raised | `#FFFDF8` | Cards, panels, preview mat |
| Ink | `#1C1A17` | Primary text |
| Ink muted | `#5C564E` | Secondary text (checked ≥4.5:1 on paper) |
| Rule | `#D9D2C5` | Decorative dividers only |
| Field border | `#8A8275` | Input/control edges (3.46:1 on paper, meets 3:1 non-text) |
| Accent (oxblood) | `#8B3A2E` | Primary CTA, active states, focus ring |
| Accent hover | `#6F2E24` | Primary button hover |

No gradients. Accent is sparing: primary action, selected template, focus.

## Typography

- **Display / headings**: Libre Baskerville. Reason: sturdy bookish serif that reads as institutional document (awards, diplomas), not fashion editorial. Used for page title, section titles, and certificate preview text.
- **UI / body**: Geist. Reason: already the project face; clear at 14-16px form label sizes without competing with the serif.
- Hierarchy from size and weight, not color noise.

## Mood & Dials

**ENERGY 2 / RHYTHM 2 / MOTION 2** (Balanced).

- Steady confidence; one deliberate break from uniform section stacking
- Transitions on controls and template swap only; no endless motion
- One focal point per screen: the certificate sheet on the desk mat

## Layout (desk composition)

The page is a **desk**, not a document of equal sections (R-05).

| Decision | Reason (R-31) |
|----------|----------------|
| Slim top bar, no hero `h1` block | The tool is the page; a marketing preamble reads as generated layout |
| Asymmetric grid: dense form rail (~20–22rem) + large sheet | Form is utility density; the sheet is the product (focal point) |
| No equal `h2` sections (Template/Details/Preview) | Removes uniform section rhythm; labels are quiet legend + micro type on the mat |
| Templates as visual sheet swatches | Miniatures of the real artifact; avoids three identical text cards (R-14) |
| One shadow only, on the certificate sheet | Single elevation: paper lifted off the desk (R-12) |
| Compact form spacing vs airy mat | Two densities = rhythm break without raising ENERGY |
| Generate notice under the form | Honest export gap lives next to the action, not a footer strip |
| Portrait + landscape orientation | Real product choice; changes sheet aspect on the desk |
| CSV-only recipients (`name` header) | Mass tool: one source of truth for names; no single recipient field |
| Optional PNG logo + PNG signature | Real assets on the certificate; PNG-only keeps export simple |
| Signature text or image | Either a printed name or an uploaded signature, not both fighting |
| Multi-line recognition | Recognition accepts Enter; newlines print as separate lines |
| Editable subtext with tokens | Default sentence under Recognition; `{{name}}` / `{{recognition}}` fill per recipient |
| Export 1 → PNG, 2+ → ZIP | Matches batch size; single file when only one name, archive when many |

Mobile: one column, order = bar → template strip → fields → full-width sheet. Tap targets ≥44px.

## Page Scope

Generator workspace (single page):

1. Slim top bar (wordmark + one utility line; no invented logo mark)
2. Template swatches + portrait/landscape orientation (visual minis, docked with preview)
3. Dense shared fields (organization, recognition, editable subtext, date)
4. Required CSV upload: header must include a `name` column; preview uses the first row
5. Optional organization logo (PNG only)
6. Signature: text fields or PNG upload + optional signer title
7. Live preview sheet on a desk mat; multi-recipient CSVs also get a paginated preview grid (select a name to load it on the desk)
8. Export: 1 recipient downloads a PNG; 2+ recipients download `certificates.zip` of PNGs

No marketing sections, no fake stats, no testimonials, no FAQ, no separate footer disclaimer.

## Non-goals

- No dark mode unless requested later (paper/ink is a fixed light identity)
- No invented trust badges, logos, or certifications
