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
  import {
    createBrowserUrlbarSuggestionsState,
    type BrowserUrlbarSuggestionsState,
    type BrowserUrlbarSuggestionsStateAdapter,
    type UrlbarSuggestionGesture,
    type UrlbarSuggestionResult,
  } from "../app/urlbar-suggestions-state";
  import { translate, type MessageKey, type MessageVars } from "../app/i18n";
  import {
    defaultFenneviaLocale,
    type BrowserLocaleStateAdapter,
    type FenneviaLocale,
  } from "../app/locale-state";
  import { resolveBrowserToolHost } from "./browser-tool-host";
  import FirefoxIcon from "./FirefoxIcon.svelte";
  import FirefoxTrustIcon from "./FirefoxTrustIcon.svelte";
  import { getFirefoxTrustPresentation } from "./navigation-labels";
  import {
    getBlockedPermissionIndicatorLabel,
    getSharingIndicatorLabel,
    getSitePermissionPresentation,
  } from "./urlbar-coverage-labels";
  import { getUrlbarSuggestionSourceLabel } from "./urlbar-suggestions-labels";

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
    suggestions: BrowserUrlbarSuggestionsStateAdapter;
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
      editableAddressValue: "",
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
  let currentSuggestions: BrowserUrlbarSuggestionsState = $state(
    createBrowserUrlbarSuggestionsState({
      available: true,
      phase: "idle",
      queryRevision: 0,
      results: [],
    }),
  );
  let activeSuggestionIndex = $state(-1);
  let addressInput: HTMLInputElement | undefined = $state();
  let suggestionsListbox: HTMLDivElement | undefined = $state();
  let trust = $derived(
    getFirefoxTrustPresentation(
      currentNavigation.snapshot.connectionSecurity,
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
  let visuallyExposeStatus = $derived(
    popupState.error !== null ||
      popupState.phase === "submitting" ||
      currentSuggestions.snapshot.phase === "querying" ||
      currentSuggestions.snapshot.phase === "empty" ||
      currentSuggestions.snapshot.phase === "failed",
  );
  const suggestionOptionId = (index: number): string =>
    `fennevia-urlbar-suggestion-${currentSuggestions.snapshot.queryRevision}-${index}`;
  let activeSuggestionId = $derived(
    activeSuggestionIndex >= 0 &&
      activeSuggestionIndex < currentSuggestions.snapshot.results.length
      ? suggestionOptionId(activeSuggestionIndex)
      : undefined,
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
    currentSuggestions = props.suggestions.snapshot();
    return props.suggestions.subscribe((state) => {
      const previousQueryRevision = currentSuggestions.snapshot.queryRevision;
      const previousActiveIndex = activeSuggestionIndex;
      currentSuggestions = state;
      activeSuggestionIndex =
        state.snapshot.phase !== "results" ||
        state.snapshot.queryRevision !== previousQueryRevision
          ? -1
          : Math.min(previousActiveIndex, state.snapshot.results.length - 1);
    });
  });

  $effect(() => {
    currentNavigation = props.navigation.snapshot();
    return props.navigation.subscribe((state) => {
      currentNavigation = state;
    });
  });

  $effect(() => {
    const index = activeSuggestionIndex;
    const resultCount = currentSuggestions.snapshot.results.length;
    if (index < 0 || index >= resultCount) {
      return;
    }
    const option = suggestionsListbox?.children.item(index);
    if (option instanceof HTMLElement) {
      option.scrollIntoView({ block: "nearest" });
    }
  });

  const requestClose = (reason: AddressPopupCloseReason) => {
    props.popup.requestClose(reason);
  };

  const queryDraft = (value: string, composing = false) => {
    props.popup.updateDraft(value);
    const snapshot = props.popup.snapshot();
    if (snapshot.error === "too-long") {
      props.suggestions.cancel();
      return;
    }
    if (!composing) {
      props.suggestions.query(snapshot.draftValue);
    }
  };

  const handleInput = (event: Event & { currentTarget: HTMLInputElement }) => {
    queryDraft(
      event.currentTarget.value,
      "isComposing" in event && event.isComposing === true,
    );
  };

  const handleCompositionEnd = (
    event: Event & { currentTarget: HTMLInputElement },
  ) => {
    props.suggestions.query(event.currentTarget.value);
  };

  const handleSuggestionIconError = (event: Event): void => {
    if (event.currentTarget instanceof HTMLImageElement) {
      event.currentTarget.hidden = true;
    }
  };

  const moveActiveSuggestion = (index: number): void => {
    const count = currentSuggestions.snapshot.results.length;
    activeSuggestionIndex =
      count > 0 ? Math.max(0, Math.min(index, count - 1)) : -1;
  };

  const createGesture = (
    event: KeyboardEvent | MouseEvent,
  ): UrlbarSuggestionGesture =>
    Object.freeze({
      altKey: event.altKey,
      button: event instanceof MouseEvent && event.button === 1 ? 1 : 0,
      ctrlKey: event.ctrlKey,
      kind: event instanceof MouseEvent ? "pointer" : "keyboard",
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    });

  const executeSuggestion = (
    result: UrlbarSuggestionResult,
    event: KeyboardEvent | MouseEvent,
  ): void => {
    try {
      const execution = props.suggestions.execute(
        result.token,
        createGesture(event),
      );
      if (execution.status === "committed") {
        requestClose("committed");
      } else if (execution.status === "native-required") {
        handleNativeAccess();
      } else if (execution.status === "continued") {
        activeSuggestionIndex = -1;
        addressInput?.focus({ preventScroll: true });
      } else {
        props.suggestions.query(popupState.draftValue);
        addressInput?.focus({ preventScroll: true });
      }
    } catch (error) {
      props.onFatalError(error);
    }
  };

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.isComposing) {
      return;
    }
    const results = currentSuggestions.snapshot.results;
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      let nextIndex: number | null = null;
      if (event.key === "ArrowDown") {
        nextIndex = activeSuggestionIndex < 0 ? 0 : activeSuggestionIndex + 1;
      } else if (event.key === "ArrowUp") {
        nextIndex =
          activeSuggestionIndex < 0
            ? results.length - 1
            : activeSuggestionIndex - 1;
      } else if (event.key === "Home" && results.length > 0) {
        nextIndex = 0;
      } else if (event.key === "End" && results.length > 0) {
        nextIndex = results.length - 1;
      } else if (event.key === "PageDown" && results.length > 0) {
        nextIndex = activeSuggestionIndex < 0 ? 0 : activeSuggestionIndex + 5;
      } else if (event.key === "PageUp" && results.length > 0) {
        nextIndex =
          activeSuggestionIndex < 0
            ? results.length - 1
            : activeSuggestionIndex - 5;
      }
      if (nextIndex !== null && results.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        moveActiveSuggestion(nextIndex);
        return;
      }
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      try {
        const selected = results[activeSuggestionIndex];
        if (selected) {
          executeSuggestion(selected, event);
        } else {
          props.suggestions.cancel();
          props.popup.submit();
        }
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

  const handleSuggestionPointer = (
    result: UrlbarSuggestionResult,
    event: MouseEvent,
  ): void => {
    if (event.button !== 0 && event.button !== 1) {
      return;
    }
    event.preventDefault();
    executeSuggestion(result, event);
  };

  const suggestionFallbackIcon = (
    result: UrlbarSuggestionResult,
  ):
    | "bookmark-item"
    | "extensions"
    | "history"
    | "open-in-new"
    | "search"
    | "tab" => {
    if (result.execution === "native") {
      return "open-in-new";
    }
    if (result.source === "bookmarks") {
      return "bookmark-item";
    }
    if (result.source === "history") {
      return "history";
    }
    if (result.source === "tabs" || result.type === "remote-tab") {
      return "tab";
    }
    if (result.source === "addon") {
      return "extensions";
    }
    return "search";
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
    if (currentSuggestions.snapshot.phase === "querying") {
      return t("suggestions.loading");
    }
    if (currentSuggestions.snapshot.phase === "results") {
      return t("suggestions.count", {
        count: String(currentSuggestions.snapshot.results.length),
      });
    }
    if (currentSuggestions.snapshot.phase === "empty") {
      return t("suggestions.empty");
    }
    if (currentSuggestions.snapshot.phase === "failed") {
      return t("suggestions.failed");
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
      <div class="fennevia-address-popup__identity">
        <span class="fennevia-address-popup__brand"
          >{t("address.productName")}</span
        >
        <span aria-hidden="true" class="fennevia-address-popup__brand-divider"
        ></span>
        <h2 id="fennevia-address-popup-title">{t("address.title")}</h2>
        {#if props.windowKind === "private"}
          <span class="fennevia-address-popup__private">
            <FirefoxIcon name="private" />
            {t("address.privateBrowsing")}
          </span>
        {/if}
      </div>
      <button
        aria-label={t("address.closeAria")}
        class="fennevia-control fennevia-address-popup__close"
        data-fennevia-address-popup-close=""
        onclick={() => requestClose("cancelled")}
        onkeydown={handleCloseKeydown}
        title={t("address.close")}
        type="button"><FirefoxIcon name="close" /></button
      >
    </header>

    <label
      class="fennevia-address-popup__label"
      for="fennevia-address-popup-input">{t("address.fieldLabel")}</label
    >
    <div class="fennevia-address-popup__field-shell">
      <span aria-hidden="true" class="fennevia-address-popup__glyph">
        <FirefoxIcon name="search" />
      </span>
      <input
        aria-activedescendant={activeSuggestionId}
        aria-autocomplete="list"
        aria-busy={popupState.phase === "submitting" ||
          currentSuggestions.snapshot.phase === "querying"}
        aria-controls="fennevia-urlbar-suggestions"
        aria-describedby="fennevia-address-popup-status"
        aria-expanded={currentSuggestions.snapshot.results.length > 0}
        aria-haspopup="listbox"
        aria-invalid={popupState.phase === "invalid"}
        autocapitalize="none"
        autocomplete="off"
        bind:this={addressInput}
        class="fennevia-address-popup__input"
        data-fennevia-address-popup-input=""
        dir="auto"
        enterkeyhint="go"
        id="fennevia-address-popup-input"
        maxlength={maximumNavigationAddressLength}
        oncompositionend={handleCompositionEnd}
        oninput={handleInput}
        onkeydown={handleInputKeydown}
        placeholder={t("address.placeholder")}
        readonly={popupState.phase === "submitting" ||
          popupState.phase === "closing"}
        role="combobox"
        spellcheck="false"
        type="text"
        value={popupState.draftValue}
      />
    </div>

    <output
      aria-live="polite"
      class="fennevia-address-popup__status"
      class:fennevia-address-popup__status--visible={visuallyExposeStatus}
      data-fennevia-address-popup-status=""
      id="fennevia-address-popup-status">{statusText()}</output
    >

    <div
      aria-label={t("suggestions.listAria")}
      aria-multiselectable="false"
      class="fennevia-address-popup__suggestions"
      bind:this={suggestionsListbox}
      data-fennevia-urlbar-suggestions=""
      id="fennevia-urlbar-suggestions"
      role="listbox"
    >
      {#each currentSuggestions.snapshot.results as result, index (result.token)}
        <button
          aria-selected={activeSuggestionIndex === index}
          class="fennevia-address-popup__suggestion"
          data-fennevia-suggestion-execution={result.execution}
          data-fennevia-suggestion-source={result.source}
          id={suggestionOptionId(index)}
          onauxclick={(event) => handleSuggestionPointer(result, event)}
          onclick={(event) => handleSuggestionPointer(result, event)}
          onpointermove={() => (activeSuggestionIndex = index)}
          role="option"
          tabindex="-1"
          type="button"
        >
          <span
            aria-hidden="true"
            class="fennevia-address-popup__suggestion-icon"
          >
            <FirefoxIcon name={suggestionFallbackIcon(result)} />
            {#if result.icon}
              <img
                alt=""
                decoding="async"
                onerror={handleSuggestionIconError}
                src={result.icon}
              />
            {/if}
          </span>
          <span class="fennevia-address-popup__suggestion-copy">
            <strong dir="auto"
              >{result.title || t("suggestions.nativeResult")}</strong
            >
            {#if result.description}
              <span dir="auto">{result.description}</span>
            {/if}
          </span>
          <span class="fennevia-address-popup__suggestion-meta">
            <span class="fennevia-address-popup__suggestion-source"
              >{getUrlbarSuggestionSourceLabel(result.source, localeId)}</span
            >
            {#if result.heuristic}
              <span class="fennevia-address-popup__suggestion-badge"
                >{t("suggestions.heuristicBadge")}</span
              >
            {/if}
            {#if result.execution === "native"}
              <span class="fennevia-address-popup__suggestion-badge"
                >{t("suggestions.nativeBadge")}</span
              >
            {/if}
          </span>
        </button>
      {/each}
    </div>

    <section
      aria-label={t("address.firefoxControls")}
      class="fennevia-address-popup__utilities"
      data-fennevia-address-popup-details=""
      data-fennevia-urlbar-coverage=""
    >
      <button
        aria-label={t("address.openTrust", {
          connection: trust.connectionLabel,
          protection: trust.protectionLabel,
        })}
        class="fennevia-address-popup__utility fennevia-address-popup__utility--trust"
        data-fennevia-browser-tool="site-information"
        data-fennevia-status-tone={trust.tone}
        data-fennevia-trust-detail=""
        disabled={handoffDisabled ||
          !browserToolsSnapshot.siteInformation ||
          !browserToolsSnapshot.protections}
        onclick={(event) => void handleBrowserTool("site-information", event)}
        title={t("address.openTrust", {
          connection: trust.connectionLabel,
          protection: trust.protectionLabel,
        })}
        type="button"
      >
        <span aria-hidden="true" class="fennevia-address-popup__utility-mark">
          <FirefoxTrustIcon state={trust.iconState} />
        </span>
        <span class="fennevia-address-popup__utility-copy">
          <strong>{t("address.statusTrust")}</strong>
          <span>{trust.connectionLabel}</span>
        </span>
      </button>
      <button
        aria-label={t("address.openSitePermissions", {
          label: permissions.label,
        })}
        class="fennevia-address-popup__utility fennevia-address-popup__utility--permissions"
        data-fennevia-browser-tool="site-permissions"
        data-fennevia-permission-detail=""
        data-fennevia-status-tone={permissions.tone}
        disabled={handoffDisabled || !browserToolsSnapshot.sitePermissions}
        onclick={(event) => void handleBrowserTool("site-permissions", event)}
        title={t("address.openSitePermissions", {
          label: permissions.label,
        })}
        type="button"
      >
        <span aria-hidden="true" class="fennevia-address-popup__utility-mark"
          >{permissions.badge}</span
        >
        <span class="fennevia-address-popup__utility-copy">
          <strong>{t("address.statusSitePermissions")}</strong>
        </span>
      </button>

      <button
        class="fennevia-control fennevia-address-popup__utility fennevia-address-popup__native-access"
        data-fennevia-native-urlbar-access=""
        onclick={handleNativeAccess}
        onkeydown={handleNativeAccessKeydown}
        type="button"
      >
        <span aria-hidden="true" class="fennevia-address-popup__utility-mark">
          <FirefoxIcon name="open-in-new" />
        </span>
        <span class="fennevia-address-popup__utility-copy">
          <strong>{t("address.nativeAccess")}</strong>
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
    </section>
  </div>
</div>
