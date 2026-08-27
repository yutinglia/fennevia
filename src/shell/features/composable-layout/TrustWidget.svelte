<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { BrowserToolsStateAdapter } from "../../../app/browser-tools-state";
  import type {
    EdgeName,
    EdgeShellController,
  } from "../../../app/edge-surfaces";
  import { translate } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import {
    createBrowserNavigationState,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
  } from "../../../app/navigation-state";
  import { resolveBrowserToolHost } from "../../browser-tool-host";
  import FirefoxTrustIcon from "../../FirefoxTrustIcon.svelte";
  import { getFirefoxTrustPresentation } from "../../navigation-labels";

  type Props = Readonly<{
    browserTools?: BrowserToolsStateAdapter;
    customizeOpen: boolean;
    edge: EdgeName;
    localeId: FenneviaLocale;
    navigation: BrowserNavigationStateAdapter;
    onFatalError: (error: unknown) => void;
    shell: EdgeShellController;
  }>;

  const props: Props = $props();
  let current: BrowserNavigationState = $state(
    createBrowserNavigationState({
      addressValue: "",
      canGoBack: false,
      canGoForward: false,
      connectionSecurity: "unavailable",
      displayUri: "",
      editableAddressValue: "",
      loading: false,
      title: "",
      trackingProtection: "unavailable",
    }),
  );
  let browserTools = $derived(props.browserTools?.snapshot());
  let presentation = $derived(
    getFirefoxTrustPresentation(
      current.snapshot.connectionSecurity,
      current.snapshot.trackingProtection,
      props.localeId,
    ),
  );
  let label = $derived(
    translate(props.localeId, "nav.openTrust", {
      connection: presentation.connectionLabel,
      protection: presentation.protectionLabel,
    }),
  );

  $effect(() => {
    current = props.navigation.snapshot();
    return props.navigation.subscribe((next) => {
      current = next;
    });
  });

  const activate = async (event: MouseEvent): Promise<void> => {
    if (props.customizeOpen || !props.browserTools) {
      return;
    }
    props.shell.setPopupHeld(props.edge, true);
    try {
      await props.browserTools.invoke(
        "site-information",
        resolveBrowserToolHost(event),
      );
    } catch (error) {
      props.shell.setPopupHeld(props.edge, false);
      props.onFatalError(error);
    }
  };
</script>

<button
  aria-label={label}
  class="fennevia-address-launcher__indicator fennevia-layout-control"
  data-fennevia-browser-tool="site-information"
  data-fennevia-status-tone={presentation.tone}
  data-fennevia-trust-status=""
  disabled={props.customizeOpen ||
    !browserTools?.siteInformation ||
    !browserTools.protections}
  onclick={(event) => void activate(event)}
  tabindex={props.customizeOpen ? -1 : undefined}
  title={label}
  type="button"
>
  <FirefoxTrustIcon state={presentation.iconState} />
</button>
