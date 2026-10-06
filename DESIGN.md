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

**Ceremonial template palette (sheet only, not app chrome):** navy ink `#1E3A8A`, muted `#4C6699`, blue accent `#1D4ED8`, rule `#BFDBFE` on white. Contrast checked: navy/muted/blue on white all ≥4.5:1.

**Academy template palette (sheet only; reference: user-supplied Appkademiya image):** navy `#0A1633`, muted `#3D4A66`, electric blue `#1A56F5`, rule `#C5D0E8` on light gray `#F7F8FA`. Right side: electric-blue underlay with a thin diagonal edge band under a navy panel (same clip path, ~2% offset); real logo from `public/appkademiya-logo.png` on the navy (no invented mark). Content column ends before the blue edge (`pr` ≥ panel width). Contrast: navy/muted/blue on light and white on navy all ≥4.5:1.

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
| Optional second signatory | Toggle stacks a second name/title (or second PNG) above the primary; date keeps a narrower third of the footer row |
| Multi-line recognition | Recognition accepts Enter; newlines print as separate lines |
| Editable subtext with tokens | Default sentence under Recognition; `{{name}}` / `{{recognition}}` fill per recipient |
| Export 1 → PNG, 2+ → ZIP | Matches batch size; single file when only one name, archive when many |
| Ceremonial template (blue/white seal) | Fourth formal option: double blue frame, seal mark, centered ceremonial type |
| Academy template (navy/electric diagonal) | Fifth option from owner reference image: light gray sheet, blue edge band under diagonal navy panel, `public/appkademiya-logo.png` on navy |

Mobile: one column, order = bar → template strip → fields → full-width sheet. Tap targets ≥44px.

## Page Scope

Generator workspace (single page):

1. Slim top bar (wordmark + one utility line; no invented logo mark — Appkademiya mark is `public/appkademiya-logo.png` on Academy only)
2. Template swatches (Classic, Modern, Minimal, Ceremonial, Academy) + portrait/landscape orientation (visual minis, docked with preview)
3. Dense shared fields (optional organization — blank when the logo already has the name; recognition; editable subtext; date → prints as MM/DD/YYYY on the sheet)
4. Required CSV upload: header must include a `name` column; preview uses the first row
5. Optional organization logo (PNG only); organization text is optional and hidden when blank
6. Signature: text fields or PNG upload + optional signer title; optional second signatory (text or PNG)
7. Live preview sheet on a desk mat; multi-recipient CSVs also get a paginated preview grid (select a name to load it on the desk)
8. Export: 1 recipient downloads a PNG; 2+ recipients download `certificates.zip` of PNGs

No marketing sections, no fake stats, no testimonials, no FAQ, no separate footer disclaimer.

## Non-goals

- No dark mode unless requested later (paper/ink is a fixed light identity)
- No invented trust badges, logos, or certifications
