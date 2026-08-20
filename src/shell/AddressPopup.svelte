<script lang="ts">
  import { onDestroy } from "svelte";

  import {
    type AddressPopupCloseReason,
    type AddressPopupController,
    type AddressPopupSnapshot,
  } from "../app/address-popup";
  import type {
    BrowserToolAction,
    BrowserToolsStateAdapter,
  } from "../app/browser-tools-state";
  import {
    createBrowserNavigationState,
    maximumNavigationAddressLength,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
  } from "../app/navigation-state";
  import {
    createBrowserUrlbarCoverageState,
    type BrowserUrlbarCoverageState,
    type BrowserUrlbarCoverageStateAdapter,
  } from "../app/urlbar-coverage-state";
  import { translate, type MessageKey, type MessageVars } from "../app/i18n";
  import {
    defaultFenneviaLocale,
    type BrowserLocaleStateAdapter,
    type FenneviaLocale,
  } from "../app/locale-state";
  import { resolveBrowserToolHost } from "./browser-tool-host";
  import {
    getConnectionSecurityPresentation,
    getTrackingProtectionPresentation,
  } from "./navigation-labels";
  import {
    getBlockedPermissionIndicatorLabel,
    getSharingIndicatorLabel,
    getSitePermissionPresentation,
    getUrlbarItemLabel,
    getUrlbarItemTone,
  } from "./urlbar-coverage-labels";

  type Props = Readonly<{
    browserTools: BrowserToolsStateAdapter;
    coverage: BrowserUrlbarCoverageStateAdapter;
    navigation: BrowserNavigationStateAdapter;
    onOpenBrowserTool: (
      action: BrowserToolAction,
      host?: unknown,
    ) => Promise<boolean>;
    locale: BrowserLocaleStateAdapter;
    onOpenNativeUrlbar: () => boolean;
    onDisposed: () => void;
    onFatalError: (error: unknown) => void;
    popup: AddressPopupController;
    windowKind: "normal" | "private";
  }>;

  const props: Props = $props();
  let localeId: FenneviaLocale = $state(defaultFenneviaLocale);
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(localeId, key, vars);
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
  let currentCoverage: BrowserUrlbarCoverageState = $state(
    createBrowserUrlbarCoverageState({
      items: [],
      permissions: {
        available: false,
        blocked: [],
        hasPermissions: false,
        sharing: [],
      },
    }),
  );
  let connection = $derived(
    getConnectionSecurityPresentation(
      currentNavigation.snapshot.connectionSecurity,
      localeId,
    ),
  );
  let protection = $derived(
    getTrackingProtectionPresentation(
      currentNavigation.snapshot.trackingProtection,
      localeId,
    ),
  );
  let permissions = $derived(
    getSitePermissionPresentation(
      currentCoverage.snapshot.permissions,
      localeId,
    ),
  );
  let browserToolsSnapshot = $derived(props.browserTools.snapshot());
  let handoffDisabled = $derived(
    popupState.phase === "submitting" || popupState.phase === "closing",
  );
  let visible = $derived(
    popupState.phase !== "hidden" && popupState.phase !== "disposed",
  );

  $effect(() => {
    const locale = props.locale;
    localeId = locale.snapshot().id;
    return locale.subscribe((snapshot) => {
      localeId = snapshot.id;
    });
  });

  $effect(() => {
    popupState = props.popup.snapshot();
    return props.popup.subscribe((snapshot) => {
      popupState = snapshot;
    });
  });

  $effect(() => {
    currentCoverage = props.coverage.snapshot();
    return props.coverage.subscribe((state) => {
      currentCoverage = state;
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

  const handleBrowserTool = async (
    action: BrowserToolAction,
    event: MouseEvent,
  ) => {
    try {
      await props.onOpenBrowserTool(action, resolveBrowserToolHost(event));
    } catch {
      // A single native-panel handoff failure must not fail-open the window.
    }
  };

  const handleNativeAccess = () => {
    try {
      if (!props.onOpenNativeUrlbar()) {
        throw new Error("FENNEVIA_NATIVE_URLBAR_ACCESS_REJECTED");
      }
    } catch (error) {
      props.onFatalError(error);
    }
  };

  const handleNativeAccessKeydown = (event: KeyboardEvent) => {
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
      return t("address.empty");
    }
    if (popupState.error === "too-long") {
      return t("address.tooLong", {
        max: String(maximumNavigationAddressLength),
      });
    }
    if (popupState.error === "submission-failed") {
      return t("address.submissionFailed");
    }
    if (popupState.error === "unsafe-scheme") {
      return t("address.unsafeScheme");
    }
    if (popupState.phase === "submitting") {
      return t("address.submitting");
    }
    if (currentNavigation.snapshot.loading) {
      return t("address.loading");
    }
    return t("address.enterHint");
  };

  onDestroy(() => {
    props.onDisposed();
  });
</script>

<div
  aria-hidden={!visible}
  lang={localeId}
  class="fennevia-address-popup-root"
  data-fennevia-address-popup-phase={popupState.phase}
  data-fennevia-address-popup-root=""
  data-fennevia-window-kind={props.windowKind}
  hidden={!visible}
  inert={!visible}
  id="fennevia-address-popup-root"
>
  <button
    aria-label={t("address.closeAria")}
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
            ? t("address.privateBrowsing")
            : t("address.productName")}</span
        >
        <h2 id="fennevia-address-popup-title">{t("address.title")}</h2>
      </div>
      <button
        aria-label={t("address.closeAria")}
        class="fennevia-control fennevia-address-popup__close"
        data-fennevia-address-popup-close=""
        onclick={() => requestClose("cancelled")}
        onkeydown={handleCloseKeydown}
        title={t("address.close")}
        type="button">×</button
      >
    </header>

    <label
      class="fennevia-address-popup__label"
      for="fennevia-address-popup-input">{t("address.fieldLabel")}</label
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
        placeholder={t("address.placeholder")}
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
      aria-label={t("permission.statusAria")}
      class="fennevia-address-popup__details"
      data-fennevia-address-popup-details=""
      role="group"
    >
      <button
        aria-label={t("address.openSiteInformation", {
          label: connection.label,
        })}
        class="fennevia-address-popup__detail"
        data-fennevia-browser-tool="site-information"
        data-fennevia-connection-detail=""
        data-fennevia-status-tone={connection.tone}
        disabled={handoffDisabled || !browserToolsSnapshot.siteInformation}
        onclick={(event) => void handleBrowserTool("site-information", event)}
        title={t("address.openSiteInformation", {
          label: connection.label,
        })}
        type="button"
      >
        <span aria-hidden="true" class="fennevia-address-popup__detail-mark"
          >{connection.badge}</span
        >
        <span class="fennevia-address-popup__detail-copy">
          <strong>{t("address.statusConnection")}</strong>
          <span>{connection.label}</span>
        </span>
      </button>
      <button
        aria-label={t("address.openTrackingProtection", {
          label: protection.label,
        })}
        class="fennevia-address-popup__detail"
        data-fennevia-browser-tool="protections"
        data-fennevia-protection-detail=""
        data-fennevia-status-tone={protection.tone}
        disabled={handoffDisabled || !browserToolsSnapshot.protections}
        onclick={(event) => void handleBrowserTool("protections", event)}
        title={t("address.openTrackingProtection", {
          label: protection.label,
        })}
        type="button"
      >
        <span aria-hidden="true" class="fennevia-address-popup__detail-mark"
          >{protection.badge}</span
        >
        <span class="fennevia-address-popup__detail-copy">
          <strong>{t("address.statusProtection")}</strong>
          <span>{protection.label}</span>
        </span>
      </button>
      <div
        class="fennevia-address-popup__detail fennevia-address-popup__detail--permissions"
        data-fennevia-status-tone={permissions.tone}
      >
        <button
          aria-label={t("address.openSitePermissions", {
            label: permissions.label,
          })}
          class="fennevia-address-popup__detail-action"
          data-fennevia-browser-tool="site-permissions"
          data-fennevia-permission-detail=""
          disabled={handoffDisabled || !browserToolsSnapshot.sitePermissions}
          onclick={(event) => void handleBrowserTool("site-permissions", event)}
          title={t("address.openSitePermissions", {
            label: permissions.label,
          })}
          type="button"
        >
          <span aria-hidden="true" class="fennevia-address-popup__detail-mark"
            >{permissions.badge}</span
          >
          <span class="fennevia-address-popup__detail-copy">
            <strong>{t("address.statusSitePermissions")}</strong>
            <span>{permissions.label}</span>
          </span>
        </button>
        {#if currentCoverage.snapshot.permissions.sharing.length > 0 || currentCoverage.snapshot.permissions.blocked.length > 0}
          <ul
            aria-label={t("permission.indicatorsAria")}
            class="fennevia-address-popup__permission-indicators"
            data-fennevia-permission-indicators=""
          >
            {#each currentCoverage.snapshot.permissions.sharing as kind (kind)}
              <li data-fennevia-status-tone="warning">
                {getSharingIndicatorLabel(kind, localeId)}
              </li>
            {/each}
            {#each currentCoverage.snapshot.permissions.blocked as kind (kind)}
              <li>{getBlockedPermissionIndicatorLabel(kind, localeId)}</li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    <section
      aria-labelledby="fennevia-address-popup-firefox-controls-title"
      class="fennevia-address-popup__firefox-controls"
      data-fennevia-urlbar-coverage=""
    >
      <div class="fennevia-address-popup__firefox-controls-copy">
        <strong id="fennevia-address-popup-firefox-controls-title"
          >{t("address.firefoxControls")}</strong
        >
        <span>{t("address.nativeAccessDescription")}</span>
      </div>

      {#if currentCoverage.snapshot.items.length > 0}
        <ul
          aria-label={t("address.urlbarItemsAria")}
          class="fennevia-address-popup__urlbar-items"
          data-fennevia-urlbar-items=""
        >
          {#each currentCoverage.snapshot.items as kind (kind)}
            <li data-fennevia-status-tone={getUrlbarItemTone(kind)}>
              {getUrlbarItemLabel(kind, localeId)}
            </li>
          {/each}
        </ul>
      {:else}
        <span class="fennevia-address-popup__urlbar-empty"
          >{t("address.noPageActions")}</span
        >
      {/if}

      <button
        class="fennevia-control fennevia-address-popup__native-access"
        data-fennevia-native-urlbar-access=""
        onclick={handleNativeAccess}
        onkeydown={handleNativeAccessKeydown}
        type="button"
      >
        <span aria-hidden="true">↗</span>
        <span>{t("address.nativeAccess")}</span>
      </button>
    </section>
  </div>
</div>
