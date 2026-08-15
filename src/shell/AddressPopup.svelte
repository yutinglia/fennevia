<script lang="ts">
  import { onDestroy } from "svelte";

  import {
    type AddressPopupCloseReason,
    type AddressPopupController,
    type AddressPopupSnapshot,
  } from "../app/address-popup";
  import {
    createBrowserNavigationState,
    maximumNavigationAddressLength,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
  } from "../app/navigation-state";
  import {
    getConnectionSecurityPresentation,
    getTrackingProtectionPresentation,
  } from "./navigation-labels";

  type Props = Readonly<{
    navigation: BrowserNavigationStateAdapter;
    onDisposed: () => void;
    onFatalError: (error: unknown) => void;
    popup: AddressPopupController;
    windowKind: "normal" | "private";
  }>;

  const props: Props = $props();
  let popupState: AddressPopupSnapshot = $state({
    closeReason: null,
    draftValue: "",
    error: null,
    invocationSource: null,
    phase: "hidden",
    revision: 0,
  });
  let currentNavigation: BrowserNavigationState = $state(
    createBrowserNavigationState({
      addressValue: "",
      canGoBack: false,
      canGoForward: false,
      connectionSecurity: "unavailable",
      displayUri: "",
      loading: false,
      title: "",
      trackingProtection: "unavailable",
    }),
  );
  let connection = $derived(
    getConnectionSecurityPresentation(
      currentNavigation.snapshot.connectionSecurity,
    ),
  );
  let protection = $derived(
    getTrackingProtectionPresentation(
      currentNavigation.snapshot.trackingProtection,
    ),
  );
  let visible = $derived(
    popupState.phase !== "hidden" && popupState.phase !== "disposed",
  );

  $effect(() => {
    popupState = props.popup.snapshot();
    return props.popup.subscribe((snapshot) => {
      popupState = snapshot;
    });
  });

  $effect(() => {
    currentNavigation = props.navigation.snapshot();
    return props.navigation.subscribe((state) => {
      currentNavigation = state;
    });
  });

  const requestClose = (reason: AddressPopupCloseReason) => {
    props.popup.requestClose(reason);
  };

  const handleInput = (event: Event & { currentTarget: HTMLInputElement }) => {
    props.popup.updateDraft(event.currentTarget.value);
  };

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.isComposing) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      try {
        props.popup.submit();
      } catch (error) {
        props.onFatalError(error);
      }
      return;
    }
    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      requestClose("focus-left");
    }
  };

  const handleCloseKeydown = (event: KeyboardEvent) => {
    if (
      event.key === "Tab" &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      requestClose("focus-left");
    }
  };

  const statusText = () => {
    if (popupState.error === "empty") {
      return "Enter an address or search.";
    }
    if (popupState.error === "too-long") {
      return `Keep the address or search under ${maximumNavigationAddressLength.toLocaleString()} characters.`;
    }
    if (popupState.error === "submission-failed") {
      return "Firefox could not open this entry. Native controls remain available.";
    }
    if (popupState.error === "unsafe-scheme") {
      return "Executable address schemes are not opened here.";
    }
    if (popupState.phase === "submitting") {
      return "Opening with Firefox…";
    }
    if (currentNavigation.snapshot.loading) {
      return "The current page is loading.";
    }
    return "Enter to open · Escape to cancel";
  };

  onDestroy(() => {
    props.onDisposed();
  });
</script>

<div
  aria-hidden={!visible}
  class="fennevia-address-popup-root"
  data-fennevia-address-popup-phase={popupState.phase}
  data-fennevia-address-popup-root=""
  data-fennevia-window-kind={props.windowKind}
  hidden={!visible}
  inert={!visible}
  id="fennevia-address-popup-root"
>
  <button
    aria-label="Close address and search"
    class="fennevia-address-popup__backdrop"
    data-fennevia-address-popup-backdrop=""
    onclick={() => requestClose("outside")}
    tabindex="-1"
    type="button"
  ></button>

  <div
    aria-describedby="fennevia-address-popup-status"
    aria-labelledby="fennevia-address-popup-title"
    aria-modal="false"
    class="fennevia-address-popup"
    data-fennevia-address-popup=""
    id="fennevia-address-popup"
    role="dialog"
  >
    <header class="fennevia-address-popup__header">
      <div>
        <span class="fennevia-address-popup__eyebrow"
          >{props.windowKind === "private"
            ? "Private browsing"
            : "Fennevia"}</span
        >
        <h2 id="fennevia-address-popup-title">Address and search</h2>
      </div>
      <button
        aria-label="Close address and search"
        class="fennevia-control fennevia-address-popup__close"
        data-fennevia-address-popup-close=""
        onclick={() => requestClose("cancelled")}
        onkeydown={handleCloseKeydown}
        title="Close"
        type="button">×</button
      >
    </header>

    <label
      class="fennevia-address-popup__label"
      for="fennevia-address-popup-input">Enter an address or search</label
    >
    <div class="fennevia-address-popup__field-shell">
      <span aria-hidden="true" class="fennevia-address-popup__glyph">⌁</span>
      <input
        aria-busy={popupState.phase === "submitting"}
        aria-describedby="fennevia-address-popup-status"
        aria-invalid={popupState.phase === "invalid"}
        autocapitalize="none"
        autocomplete="off"
        class="fennevia-address-popup__input"
        data-fennevia-address-popup-input=""
        dir="auto"
        enterkeyhint="go"
        id="fennevia-address-popup-input"
        maxlength={maximumNavigationAddressLength}
        oninput={handleInput}
        onkeydown={handleInputKeydown}
        placeholder="Search or enter address"
        readonly={popupState.phase === "submitting" ||
          popupState.phase === "closing"}
        spellcheck="false"
        type="text"
        value={popupState.draftValue}
      />
      <span aria-hidden="true" class="fennevia-address-popup__enter">↵</span>
    </div>

    <output
      aria-live="polite"
      class="fennevia-address-popup__status"
      data-fennevia-address-popup-status=""
      id="fennevia-address-popup-status">{statusText()}</output
    >

    <div
      aria-label="Firefox site status"
      class="fennevia-address-popup__details"
      data-fennevia-address-popup-details=""
      role="group"
    >
      <div
        class="fennevia-address-popup__detail"
        data-fennevia-connection-detail=""
        data-fennevia-status-tone={connection.tone}
      >
        <span aria-hidden="true" class="fennevia-address-popup__detail-mark"
          >{connection.badge}</span
        >
        <span>
          <strong>Connection</strong>
          <span>{connection.label}</span>
        </span>
      </div>
      <div
        class="fennevia-address-popup__detail"
        data-fennevia-protection-detail=""
        data-fennevia-status-tone={protection.tone}
      >
        <span aria-hidden="true" class="fennevia-address-popup__detail-mark"
          >{protection.badge}</span
        >
        <span>
          <strong>Protection</strong>
          <span>{protection.label}</span>
        </span>
      </div>
    </div>
  </div>
</div>
