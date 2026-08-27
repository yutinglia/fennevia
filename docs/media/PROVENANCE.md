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
- SHA-256: `bd51b9a88510ed3bba3bf02fa5d7d258ad2b937b5569b5aa2e7043391a3861e2`.
- Classification: generated documentation/brand artwork.
- Generator: OpenAI's built-in image-generation tool; the tool did not expose a
  model/version identifier to this task.
- Inputs: the project-authored prompt below. The image was generated from a
  blank canvas in one pass with no screenshot, prior generated image,
  repository asset, source code, logo, icon, or external visual reference
  supplied to the generator.
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
Create a new original high-resolution 16:9 GitHub README hero for Fennevia
from a blank canvas. Do not use or reference any previous image. Make the
brand name "FENNEVIA" prominent and legible on the left, with the short slogan
"BROWSE YOUR WAY" beneath it.

On the right, show a sophisticated abstract concept of browser chrome
customization: a deconstructed modular browser shell with a blank top address
bar and toolbar, vertical panel stacks on both sides, a bottom rail, floating
empty widget blocks, subtle insertion guides, alignment measurements, and cyan
dotted placement outlines. It should clearly communicate browser chrome and a
customizable four-edge layout without showing a real screenshot.

No icons, logos, app symbols, URL text, real UI labels, random letters or
numbers, or microcopy beyond the exact brand and slogan. Use premium dark
graphite glass and metal, cyan/teal edge light, restrained violet accents, a
technical editorial blueprint style, crisp high-resolution raster rendering,
generous negative space, and a polished GitHub-dark-mode presentation without
becoming cyberpunk. The only readable text is "FENNEVIA" and
"BROWSE YOUR WAY".
```

## 4. Privacy, security, and visual review

- The captures contain no browsing URL, page title, query, bookmark title/URL,
  download filename, local path, account identifier, cookie, token, or page
  screenshot. Visible labels and counts are generic shell UI.
- A Private badge appears as an intentional product-state example, but no
  associated private browsing content or session data is present.
- The generated hero contains no Firefox/GitHub logo, icon, real UI label, URL,
  browsing title, user data, or remote runtime dependency. Its blank modular
  browser-chrome forms were generated without a visual reference and are not
  shipped as standalone reusable UI assets. The hero is documentation only and
  is not included in the installed privileged package.
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
