<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { AddressPopupController } from "../../../app/address-popup";
  import { translate } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import {
    createBrowserNavigationState,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
  } from "../../../app/navigation-state";

  type Props = Readonly<{
    addressPopup: AddressPopupController;
    customizeOpen: boolean;
    localeId: FenneviaLocale;
    navigation: BrowserNavigationStateAdapter;
    onOpenAddress: () => boolean;
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
  let popupVisible = $state(false);

  $effect(() => {
    current = props.navigation.snapshot();
    return props.navigation.subscribe((next) => {
      current = next;
    });
  });

  $effect(() => {
    const update = (phase: string): void => {
      popupVisible = phase !== "hidden" && phase !== "disposed";
    };
    update(props.addressPopup.snapshot().phase);
    return props.addressPopup.subscribe((snapshot) => update(snapshot.phase));
  });
</script>

<button
  aria-controls="fennevia-address-popup"
  aria-expanded={popupVisible}
  aria-haspopup="dialog"
  aria-label={translate(props.localeId, "nav.openAddress")}
  class="fennevia-address-launcher__button fennevia-layout-address-launcher"
  data-fennevia-address-launcher=""
  disabled={props.customizeOpen}
  onclick={() => props.onOpenAddress()}
  tabindex={props.customizeOpen ? -1 : undefined}
  title={translate(props.localeId, "nav.openAddress")}
  type="button"
>
  <span class="fennevia-address-launcher__location" dir="auto">
    {current.snapshot.addressValue ||
      translate(props.localeId, "address.placeholder")}
  </span>
</button>
