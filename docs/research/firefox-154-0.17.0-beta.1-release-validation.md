# Firefox 154.0.1 and Fennevia 0.17.0-beta.1 release validation

## 1. Scope and candidate

- Validation date: 2026-08-26
- Release candidate: `0.17.0-beta.1`
- Target: stock Firefox 154.0.1 release, BuildID `20260824154132`, in the
  marker-owned copied program and development profile
- Status: in progress; this record will be completed from observed release
  checks before publication

This is a package-specific validation record, not a wider support claim.
Retained Firefox 153.0.4 and 154.0 evidence remains in the existing historical
records. Linux, macOS, ESR, Beta, Nightly, and later Firefox releases are not
inferred.

## 2. Candidate changes

Relative to `v0.16.0-beta.1`, this candidate includes:

- a feature-first customize palette with adjacent companion actions and an
  optional localized layout Guide (ADR-078);
- a search-first address popup and one bounded retry for the first completed
  empty zero-prefix Firefox Urlbar query (ADR-079);
- a viewport-driven narrow four-panel mosaic at 560 and 360 CSS px (ADR-080);
- a 16 CSS pixel tab-detach intent threshold, child drag-event ownership, and
  same-window stale-transfer recovery (ADR-081);
- synchronous Fluent-first built-in widget labels before the legacy
  CustomizableUI fallback.

The release adds no dependency, runtime endpoint, telemetry, content-accessible
resource mapping, arbitrary persistence, or replacement for Firefox-owned
security prompts.

## 3. Validation results

Pending. Every completed row will record the exact command, observed result,
and cleanup boundary. Unrun manual rows will remain explicit and will not be
inferred from automated checks.
