<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { FirefoxTrustIconState } from "./navigation-labels";

  type Props = Readonly<{
    state: FirefoxTrustIconState;
  }>;

  const { state }: Props = $props();

  const iconUrls: Readonly<Record<FirefoxTrustIconState, string>> =
    Object.freeze({
      active: "chrome://browser/skin/trust-icon-active.svg",
      disabled: "chrome://browser/skin/trust-icon-disabled.svg",
      insecure: "chrome://browser/skin/trust-icon-insecure.svg",
      warning: "chrome://browser/skin/trust-icon-warning.svg",
    });
  const maskImage = $derived(`url("${iconUrls[state]}")`);
</script>

<span
  aria-hidden="true"
  class="fennevia-firefox-trust-icon"
  data-fennevia-firefox-trust-icon={state}
  style:mask-image={maskImage}
  style:-webkit-mask-image={maskImage}
></span>
