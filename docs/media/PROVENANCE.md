<!-- SPDX-License-Identifier: MPL-2.0 -->

# Fennevia documentation-media provenance

## 1. Owner decision and review

- Owning decision: direct repository-owner request in the 2026-08-27 Fennevia
  layout/customization task; no separate issue number was supplied.
- Review date: 2026-08-28.
- Reviewer: Codex, against `docs/licensing-and-provenance.md`,
  `THIRD_PARTY_NOTICES.md`, the project privacy rules, and the visible files.
- Purpose: replace the README's older stylized layout map with a current
  customization-focused hero and add a screenshot showcase for the owner layout.

## 2. Owner-provided runtime captures

The repository owner captured and supplied the six PNG files below specifically
for inclusion in Fennevia. Under the repository's inbound-contribution rule,
they are contributed under MPL-2.0. They are exact copies of the selected
attachments; no crop, repaint, resampling, or content edit was applied.

| Project path | Classification | SHA-256 |
| --- | --- | --- |
| `docs/media/fennevia-layout-showcase.png` | owner-provided runtime capture | `fc528eebaa0470c3033d916c759e9644948a65c2b1e1cf7ee35b0fb031f74385` |
| `docs/media/fennevia-customize-widgets.png` | owner-provided runtime capture | `3aefabf47e7000d3cf86e3275cbc114abcc75961ce6a433e9a2bddee4aef318d` |
| `docs/media/fennevia-customize-guide.png` | owner-provided runtime capture | `de2a979ee04a289a2d7758b6b46b371d505dcecf190be5a0d3013f639cd09cf7` |
| `docs/media/fennevia-customize-panels.png` | owner-provided runtime capture | `718f63b815a4851cd5b376bc2cc34c4a94dc935a934a36ec4392fe5c1bef2977` |
| `docs/media/fennevia-customize-interaction.png` | owner-provided runtime capture | `cc05227fa03c1f03ce8dd9789d0e6e585632cf54ba1237f33628d8adc07917de` |
| `docs/media/fennevia-customize-appearance.png` | owner-provided runtime capture | `57b48c083165d9d80515248e595143bed5cb3083372af98daee462658af7f481` |

There is no upstream repository, external asset package, or third-party image
license for these captures. The owner remains responsible for the inbound
rights representation described by `docs/licensing-and-provenance.md` §4.

## 3. Generated README hero

- Project path: `docs/media/fennevia-customize-hero.png`.
- SHA-256: `9e141dc6b6782d5407bbe49b83fe62f7dd871d86f1eec9b85611b0a8ea8b3650`.
- Classification: generated documentation/brand artwork.
- Generator: OpenAI's built-in image-generation tool; the tool did not expose a
  model/version identifier to this task.
- Inputs: the owner-provided current Widgets, Panels, Interaction, Appearance,
  and Guide captures as visual references, plus the project-authored prompt
  below. The generator accepts at most five images, so the ordinary-layout
  capture was not a generation input; the Widgets capture contains the same
  four-edge composition. No prior repository SVG, source code, or external
  design reference was supplied to the generator.
- Rights basis: the OpenAI Terms of Use effective 2026-01-01 state that, as
  between the user and OpenAI and to the extent permitted by law, the user owns
  Output and OpenAI assigns any interest it has in that Output. The repository
  owner explicitly requested inclusion here under Fennevia's MPL-2.0 inbound
  rule. Terms source: <https://openai.com/policies/terms-of-use/>.
- Modifications: the selected output was copied into the project without raster
  editing. README alt text and captions are independently authored Fennevia
  documentation.
- Attribution/notices: no OpenAI, GitHub, Mozilla, Firefox, extension, or font
  asset is bundled; no separate attribution or license file is required by the
  recorded source. The root MPL-2.0 license covers the project contribution.

### Final generation prompt

```text
Use case: ads-marketing
Asset type: stylized GitHub README brand hero for Fennevia
Primary request: Create a premium brand illustration inspired by the supplied current Fennevia interface. Find the middle ground between an exact screenshot and a disconnected concept: preserve the recognizable four-edge layout and customization story, but abstract all real UI copy into elegant visual symbols.
Reference use: use the screenshots only for layout proportions, panel hierarchy, dark material, cyan edit boundaries, gold site-status accent, customization controls, and the relationship between the address row and tabs. Do not reproduce their readable interface text.
Core composition: wide landscape. A dark browser-like frame occupies about 75–80% of the canvas. It has a slim full-width Top edge, a Left edge with an address capsule aligned exactly to the same inner width as a larger vertical tab stack, a narrow Right bookmarks edge, and a Bottom download/status edge. A centered floating customization workspace sits above a visibly darkened inactive page.
Customization visual language: cyan dotted outlines around every edge; a few elegant draggable modular tiles inside the center; one directional move cue; an abstract five-segment tab rail with no labels; a restrained color-swatch strip and radius/opacity controls made from dots and short bars. Make customization the focal point without showing dense settings.
Brand area: reserve clean negative space on the left or upper-left. Render only exact brand text "FENNEVIA" and smaller exact style text "MAKE THE BROWSER YOURS". No other readable words, letters, numbers, URLs, labels, badges, or microcopy anywhere.
Style/medium: sophisticated vector-like editorial illustration rendered as a crisp raster; GitHub dark-mode presentation; glassmorphism with disciplined depth; charcoal #181820 and #24242e, cyan #10bfd3, soft white, muted gold Trust accent, tiny purple accent. More stylized than a screenshot, but restrained and product-authentic.
Geometry constraints: keep the real four-edge silhouette and panel proportions recognizable; address capsule and tab stack must share both horizontal edges; central workspace must sit inside the page opening and remain below Top and between Left/Right; Bottom stays directly under the center region. Website content behind the workspace is near-black and inactive.
Visual polish: subtle technical grid, clean highlights, precise corner radii, soft shadows, sparse glow, strong hierarchy, generous breathing room. Suitable as the first image in a GitHub README.
Avoid: any real UI text; fake UI text; random letters or numbers; private badge; extension logo; Firefox logo; GitHub logo; Octocat; URLs; page titles; decorative star/compass/planet; floating handles outside the browser frame; excessive neon; cyberpunk atmosphere; 3D device mockup; people; watermark; overly literal screenshot recreation.
```

## 4. Privacy, security, and visual review

- The captures contain no browsing URL, page title, query, bookmark title/URL,
  download filename, local path, account identifier, cookie, token, or page
  screenshot. Visible labels and counts are generic shell UI.
- A Private badge appears as an intentional product-state example, but no
  associated private browsing content or session data is present.
- The generated hero contains no Firefox/GitHub logo, real UI label, URL,
  browsing title, user data, or remote runtime dependency. It retains abstract
  widget icon shapes inspired by the owner-provided customization reference;
  none is shipped as a standalone reusable logo or runtime asset. The hero is
  documentation only and is not included in the installed privileged package.
- The images make no Firefox compatibility or completed-validation claim; both
  READMEs keep that evidence boundary beside the showcase.

## 5. Update and removal

When a screenshot changes, replace only its explicit project file, update its
hash here, and recheck both README captions and privacy content. When the hero
changes, record the new final prompt, generator/source terms, hash, and review.
To remove this media set, remove both README references, the seven PNG files,
this record, and the matching root notice entry in one change. The older
project-authored `fennevia-overview.svg` remains independently removable and is
not an input to this media set.
