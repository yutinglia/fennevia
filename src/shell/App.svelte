<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";

  import {
    createInitialSmokeState,
    maximumSmokeInputLength,
    reduceSmokeState,
    type SmokeAction,
    type SmokeState,
  } from "../app/smoke-state";
  import {
    createBrowserTabsState,
    type TabSnapshot,
    type BrowserTabsState,
    type BrowserTabsStateAdapter,
  } from "../app/tab-state";
  import {
    findCloseFocusTarget,
    getDisplayTabTitle,
    getTabAccessibleName,
    getTabActionAccessibleName,
    getTabStripKeyAction,
    resolveRovingTabId,
  } from "../app/tab-strip";

  type Props = Readonly<{
    onDisposed: (state: SmokeState) => void;
    tabs: BrowserTabsStateAdapter;
    windowKind: "normal" | "private";
  }>;

  const closeFocusRetryDelayMs = 200;

  type DelayedFocusTimer = {
    id: number;
    view: Window;
  };

  const props: Props = $props();
  let smokeState: SmokeState = $state(createInitialSmokeState());
  let currentTabs: BrowserTabsState = $state(createBrowserTabsState([]));
  let rootElement: HTMLDivElement | undefined = $state();
  let rovingTabId: string | null = $state(null);
  let delayedFocusTimer: DelayedFocusTimer | undefined;
  const tabButtons: Array<{
    node: HTMLButtonElement;
    tabId: string;
  }> = [];

  $effect(() => {
    const initialTabs = props.tabs.snapshot();
    currentTabs = initialTabs;
    rovingTabId = resolveRovingTabId(
      initialTabs.tabs,
      untrack(() => rovingTabId),
    );
    const unsubscribe = props.tabs.subscribe((nextState) => {
      currentTabs = nextState;
      rovingTabId = resolveRovingTabId(nextState.tabs, rovingTabId);
    });
    return () => {
      unsubscribe();
    };
  });

  const dispatch = (action: SmokeAction) => {
    smokeState = reduceSmokeState(smokeState, action);
  };

  const handleInput = (event: Event) => {
    const input = event.currentTarget;
    if (input instanceof HTMLInputElement) {
      dispatch({ type: "input", value: input.value });
    }
  };

  const registerTabButton = (node: HTMLButtonElement, tabId: string) => {
    const registration = { node, tabId };
    tabButtons.push(registration);
    return {
      destroy() {
        const index = tabButtons.indexOf(registration);
        if (index >= 0) {
          tabButtons.splice(index, 1);
        }
      },
      update(nextTabId: string) {
        registration.tabId = nextTabId;
      },
    };
  };

  const focusTab = async (tabId: string | null) => {
    if (!tabId) {
      return;
    }
    rovingTabId = tabId;
    await tick();
    const button = tabButtons.find(
      (registration) => registration.tabId === tabId,
    )?.node;
    if (button?.isConnected) {
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const cancelDelayedFocus = () => {
    const timer = delayedFocusTimer;
    if (!timer) {
      return;
    }
    delayedFocusTimer = undefined;
    timer.view.clearTimeout(timer.id);
  };

  const restoreFocusAfterClose = (tabId: string | null) => {
    cancelDelayedFocus();
    void focusTab(tabId);
    const view = rootElement?.ownerDocument.defaultView;
    if (!view || !tabId) {
      return;
    }
    const timer: DelayedFocusTimer = { id: 0, view };
    timer.id = view.setTimeout(() => {
      if (delayedFocusTimer !== timer) {
        return;
      }
      delayedFocusTimer = undefined;
      void focusTab(resolveRovingTabId(currentTabs.tabs, tabId));
    }, closeFocusRetryDelayMs);
    delayedFocusTimer = timer;
  };

  const selectTab = (tabId: string) => {
    cancelDelayedFocus();
    rovingTabId = tabId;
    props.tabs.select(tabId);
    void focusTab(tabId);
  };

  const openTab = () => {
    cancelDelayedFocus();
    const openedTabId = props.tabs.open({ selected: true });
    void focusTab(openedTabId);
  };

  const closeTab = (tabId: string) => {
    cancelDelayedFocus();
    const focusTarget = findCloseFocusTarget(currentTabs.tabs, tabId);
    rovingTabId = focusTarget;
    props.tabs.close(tabId);
    restoreFocusAfterClose(resolveRovingTabId(currentTabs.tabs, focusTarget));
  };

  const togglePinned = (tab: TabSnapshot) => {
    cancelDelayedFocus();
    rovingTabId = tab.id;
    if (tab.pinned) {
      props.tabs.unpin(tab.id);
    } else {
      props.tabs.pin(tab.id);
    }
    void focusTab(tab.id);
  };

  const handleTabKeydown = (event: KeyboardEvent, tabId: string) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const view = event.currentTarget;
    const direction =
      view instanceof HTMLElement &&
      view.ownerDocument.defaultView?.getComputedStyle(view).direction === "rtl"
        ? "rtl"
        : "ltr";
    const action = getTabStripKeyAction(
      currentTabs.tabs,
      tabId,
      event.key,
      direction,
    );
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (action.type === "close") {
      closeTab(action.tabId);
    } else {
      selectTab(action.tabId);
    }
  };

  const setFaviconSource = (node: HTMLImageElement, source: string) => {
    const assign = (nextSource: string) => {
      node.hidden = false;
      node.src = nextSource;
    };
    node.onerror = () => {
      node.hidden = true;
      node.removeAttribute("src");
    };
    assign(source);
    return {
      destroy() {
        node.onerror = null;
        node.removeAttribute("src");
      },
      update: assign,
    };
  };

  const handleRootFocusOut = (event: FocusEvent) => {
    const nextTarget = event.relatedTarget;
    if (
      rootElement &&
      (!(nextTarget instanceof Node) || !rootElement.contains(nextTarget))
    ) {
      rovingTabId = resolveRovingTabId(currentTabs.tabs);
    }
  };

  const handleRootFocusIn = (event: FocusEvent) => {
    const registration = tabButtons.find(
      (candidate) => candidate.node === event.target,
    );
    if (registration) {
      rovingTabId = registration.tabId;
    }
  };

  onDestroy(() => {
    cancelDelayedFocus();
    tabButtons.length = 0;
    props.onDisposed(smokeState);
  });
</script>

<div
  id="fennevia-shell-app-root"
  bind:this={rootElement}
  class="fennevia-shell"
  data-fennevia-shell-root=""
  data-fennevia-window-kind={props.windowKind}
  onfocusin={handleRootFocusIn}
  onfocusout={handleRootFocusOut}
>
  <div class="fennevia-shell__heading">
    <strong>Fennevia tabs</strong>
    <span class:fennevia-shell__private={props.windowKind === "private"}>
      {props.windowKind === "private" ? "Private window" : "Normal window"}
    </span>
    <span class="fennevia-shell__tab-total">
      <output
        aria-label={`${currentTabs.tabs.length} open tabs`}
        data-fennevia-tab-count="">{currentTabs.tabs.length}</output
      >
      open
    </span>
  </div>

  <div class="fennevia-tab-strip">
    <div class="fennevia-tab-strip__scroll">
      <div
        aria-label="Open tabs"
        aria-orientation="horizontal"
        class="fennevia-tab-strip__list"
        data-fennevia-tab-list=""
        role="tablist"
      >
        {#each currentTabs.tabs as tab, index (tab.id)}
          <div
            class="fennevia-tab-strip__item"
            data-fennevia-loading={tab.loading}
            data-fennevia-pinned={tab.pinned}
            data-fennevia-selected={tab.selected}
            role="presentation"
          >
            <button
              use:registerTabButton={tab.id}
              aria-busy={tab.loading}
              aria-label={getTabAccessibleName(
                tab,
                index,
                currentTabs.tabs.length,
              )}
              aria-selected={tab.selected}
              class="fennevia-tab-strip__tab"
              data-fennevia-tab=""
              onclick={() => selectTab(tab.id)}
              onkeydown={(event) => handleTabKeydown(event, tab.id)}
              role="tab"
              tabindex={rovingTabId === tab.id ? 0 : -1}
              title={getDisplayTabTitle(tab)}
              type="button"
            >
              <span class="fennevia-tab-strip__visual" aria-hidden="true">
                <span class="fennevia-tab-strip__fallback">□</span>
                {#if tab.faviconUrl}
                  <img
                    use:setFaviconSource={tab.faviconUrl}
                    alt=""
                    class="fennevia-tab-strip__favicon"
                    decoding="async"
                    draggable="false"
                    referrerpolicy="no-referrer"
                  />
                {/if}
                {#if tab.loading}
                  <span class="fennevia-tab-strip__loading">↻</span>
                {/if}
              </span>
              <span class="fennevia-tab-strip__title" dir="auto">
                {getDisplayTabTitle(tab)}
              </span>
            </button>

            <button
              aria-label={getTabActionAccessibleName(
                tab.pinned ? "unpin" : "pin",
                tab,
              )}
              aria-pressed={tab.pinned}
              class="fennevia-tab-strip__action"
              data-fennevia-action={tab.pinned ? "unpin-tab" : "pin-tab"}
              onclick={(event) => {
                event.stopPropagation();
                togglePinned(tab);
              }}
              tabindex={rovingTabId === tab.id ? 0 : -1}
              title={tab.pinned ? "Unpin tab" : "Pin tab"}
              type="button">{tab.pinned ? "◆" : "◇"}</button
            >

            <button
              aria-label={getTabActionAccessibleName("close", tab)}
              class="fennevia-tab-strip__action"
              data-fennevia-action="close-tab"
              onclick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
              tabindex={rovingTabId === tab.id ? 0 : -1}
              title="Close tab"
              type="button">×</button
            >
          </div>
        {/each}
      </div>
    </div>

    <button
      aria-label="Open new tab"
      class="fennevia-tab-strip__new"
      data-fennevia-action="new-tab"
      onclick={openTab}
      title="New tab"
      type="button">+</button
    >
  </div>

  <div class="fennevia-shell-smoke__controls" aria-label="Frontend diagnostics">
    <button
      type="button"
      data-fennevia-action="increment"
      onclick={() => dispatch({ type: "increment" })}
    >
      Increment
    </button>

    <label>
      <span>Local input</span>
      <input
        data-fennevia-input=""
        maxlength={maximumSmokeInputLength}
        oninput={handleInput}
        type="text"
        value={smokeState.input}
      />
    </label>

    <button
      type="button"
      aria-expanded={smokeState.detailsVisible}
      data-fennevia-action="toggle-details"
      onclick={() => dispatch({ type: "toggle-details" })}
    >
      {smokeState.detailsVisible ? "Hide state" : "Show state"}
    </button>
  </div>

  {#if smokeState.detailsVisible}
    <p class="fennevia-shell-smoke__state" data-fennevia-conditional="">
      Counter
      <output data-fennevia-counter="">{smokeState.count}</output>
      <span aria-hidden="true">·</span>
      Input
      <output data-fennevia-input-output=""
        >{smokeState.input || "Empty"}</output
      >
      <span aria-hidden="true">·</span>
      Events
      <output data-fennevia-event-count="">{smokeState.eventCount}</output>
    </p>
  {/if}

  <template data-fennevia-template="">
    <span data-fennevia-template-content="">Fennevia XHTML template probe</span>
  </template>
</div>

<style>
  #fennevia-shell-app-root.fennevia-shell,
  #fennevia-shell-app-root * {
    box-sizing: border-box;
  }

  #fennevia-shell-app-root.fennevia-shell {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(150px, auto) minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px 10px;
    min-block-size: 76px;
    padding: 5px 10px 6px;
    overflow: hidden;
    color: var(--fennevia-shell-text);
    background: color-mix(
      in srgb,
      var(--fennevia-shell-surface) 94%,
      var(--fennevia-shell-accent)
    );
    border-block-start: 1px solid
      color-mix(in srgb, currentColor 14%, transparent);
    font: menu;
    font-size: 12px;
  }

  #fennevia-shell-app-root .fennevia-shell__heading,
  #fennevia-shell-app-root .fennevia-shell-smoke__controls,
  #fennevia-shell-app-root .fennevia-shell-smoke__controls label,
  #fennevia-shell-app-root .fennevia-shell-smoke__state {
    display: flex;
    align-items: center;
    gap: 7px;
    min-inline-size: 0;
    margin: 0;
  }

  #fennevia-shell-app-root .fennevia-shell__heading span,
  #fennevia-shell-app-root .fennevia-shell-smoke__controls label > span {
    color: color-mix(in srgb, currentColor 72%, transparent);
    white-space: nowrap;
  }

  #fennevia-shell-app-root .fennevia-shell__private {
    padding: 2px 6px;
    color: var(--fennevia-shell-text);
    border: 1px solid currentColor;
    border-radius: 999px;
  }

  #fennevia-shell-app-root .fennevia-shell__tab-total {
    font-variant-numeric: tabular-nums;
  }

  #fennevia-shell-app-root .fennevia-tab-strip {
    display: flex;
    align-items: stretch;
    gap: 6px;
    min-inline-size: 0;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__scroll {
    min-inline-size: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-color: color-mix(in srgb, currentColor 35%, transparent)
      transparent;
    scrollbar-width: thin;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__list {
    display: flex;
    align-items: stretch;
    gap: 4px;
    min-inline-size: max-content;
    min-block-size: 34px;
    padding: 1px;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 26px 26px;
    flex: none;
    inline-size: clamp(148px, 18vw, 220px);
    min-block-size: 32px;
    overflow: hidden;
    color: inherit;
    background: color-mix(
      in srgb,
      var(--fennevia-shell-surface) 96%,
      currentColor
    );
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    border-radius: 7px;
  }

  #fennevia-shell-app-root
    .fennevia-tab-strip__item[data-fennevia-pinned="true"] {
    inline-size: 116px;
    border-block-end-color: var(--fennevia-shell-accent);
  }

  #fennevia-shell-app-root
    .fennevia-tab-strip__item[data-fennevia-selected="true"] {
    background: color-mix(
      in srgb,
      var(--fennevia-shell-surface) 76%,
      var(--fennevia-shell-accent)
    );
    border-color: var(--fennevia-shell-accent);
  }

  #fennevia-shell-app-root .fennevia-tab-strip__tab,
  #fennevia-shell-app-root .fennevia-tab-strip__action,
  #fennevia-shell-app-root .fennevia-tab-strip__new {
    min-inline-size: 0;
    min-block-size: 30px;
    padding: 0;
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: 5px;
    font: inherit;
    cursor: default;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__tab {
    display: flex;
    align-items: center;
    gap: 7px;
    padding-inline: 8px 4px;
    overflow: hidden;
    text-align: start;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__visual {
    position: relative;
    display: grid;
    flex: 0 0 16px;
    inline-size: 16px;
    block-size: 16px;
    place-items: center;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__fallback,
  #fennevia-shell-app-root .fennevia-tab-strip__favicon,
  #fennevia-shell-app-root .fennevia-tab-strip__loading {
    position: absolute;
    inline-size: 16px;
    block-size: 16px;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__fallback {
    display: grid;
    color: color-mix(in srgb, currentColor 70%, transparent);
    place-items: center;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__favicon {
    object-fit: contain;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__loading {
    display: grid;
    color: var(--fennevia-shell-accent);
    background: var(--fennevia-shell-surface);
    place-items: center;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__title {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    unicode-bidi: plaintext;
    white-space: nowrap;
  }

  #fennevia-shell-app-root
    .fennevia-tab-strip__item[data-fennevia-pinned="true"]
    .fennevia-tab-strip__title {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__action {
    font-size: 14px;
    opacity: 0.68;
  }

  #fennevia-shell-app-root .fennevia-tab-strip__new {
    flex: 0 0 34px;
    inline-size: 34px;
    border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
    font-size: 18px;
  }

  #fennevia-shell-app-root button,
  #fennevia-shell-app-root input {
    box-sizing: border-box;
    min-block-size: 28px;
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 6px;
    color: inherit;
    background: color-mix(
      in srgb,
      var(--fennevia-shell-surface) 96%,
      currentColor
    );
    font: inherit;
  }

  #fennevia-shell-app-root button {
    padding-inline: 10px;
    cursor: default;
  }

  #fennevia-shell-app-root input {
    inline-size: min(24ch, 28vw);
    padding-inline: 8px;
  }

  #fennevia-shell-app-root button:hover {
    background: color-mix(
      in srgb,
      var(--fennevia-shell-surface) 82%,
      currentColor
    );
  }

  #fennevia-shell-app-root .fennevia-tab-strip__action:hover,
  #fennevia-shell-app-root .fennevia-tab-strip__action:focus-visible {
    opacity: 1;
  }

  #fennevia-shell-app-root button:focus-visible,
  #fennevia-shell-app-root input:focus-visible {
    outline: 2px solid var(--fennevia-shell-accent);
    outline-offset: 1px;
  }

  #fennevia-shell-app-root .fennevia-shell-smoke__state {
    justify-self: end;
    white-space: nowrap;
  }

  #fennevia-shell-app-root output {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  @media (max-width: 880px) {
    #fennevia-shell-app-root.fennevia-shell {
      grid-template-columns: minmax(130px, auto) minmax(0, 1fr);
    }

    #fennevia-shell-app-root .fennevia-shell-smoke__controls,
    #fennevia-shell-app-root .fennevia-shell-smoke__state {
      display: none;
    }
  }

  @media (forced-colors: active) {
    #fennevia-shell-app-root.fennevia-shell {
      border-color: CanvasText;
    }

    #fennevia-shell-app-root .fennevia-tab-strip__item,
    #fennevia-shell-app-root .fennevia-tab-strip__new,
    #fennevia-shell-app-root button,
    #fennevia-shell-app-root input {
      border-color: ButtonText;
    }

    #fennevia-shell-app-root
      .fennevia-tab-strip__item[data-fennevia-selected="true"] {
      color: HighlightText;
      background: Highlight;
      border-color: Highlight;
    }

    #fennevia-shell-app-root .fennevia-tab-strip__loading {
      color: Highlight;
      background: Canvas;
    }
  }
</style>
