<script lang="ts">
  import { onDestroy } from "svelte";

  import {
    createInitialSmokeState,
    maximumSmokeInputLength,
    reduceSmokeState,
    type SmokeAction,
    type SmokeState,
  } from "../app/smoke-state";
  import {
    createBrowserTabsState,
    type BrowserTabsState,
    type BrowserTabsStateAdapter,
  } from "../app/tab-state";

  type Props = Readonly<{
    onDisposed: (state: SmokeState) => void;
    tabs: BrowserTabsStateAdapter;
    windowKind: "normal" | "private";
  }>;

  const props: Props = $props();
  let smokeState: SmokeState = $state(createInitialSmokeState());
  let currentTabs: BrowserTabsState = $state(createBrowserTabsState([]));

  $effect(() => {
    currentTabs = props.tabs.snapshot();
    return props.tabs.subscribe((nextState) => {
      currentTabs = nextState;
    });
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

  onDestroy(() => {
    props.onDisposed(smokeState);
  });
</script>

<div
  id="fennevia-shell-app-root"
  class="fennevia-shell-smoke"
  data-fennevia-smoke-root=""
  data-fennevia-window-kind={props.windowKind}
>
  <div class="fennevia-shell-smoke__heading">
    <strong>Svelte 5 smoke island</strong>
    <span>{props.windowKind === "private" ? "Private window" : "Normal window"}</span>
    <span>
      <output data-fennevia-tab-count="">{currentTabs.tabs.length}</output>
      tabs synchronized
    </span>
  </div>

  <div class="fennevia-shell-smoke__controls">
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
      <output data-fennevia-input-output="">{smokeState.input || "Empty"}</output>
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
  #fennevia-shell-app-root.fennevia-shell-smoke {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(max-content, 0.65fr) minmax(320px, 1.35fr) auto;
    align-items: center;
    gap: 8px 14px;
    min-block-size: 42px;
    padding: 6px 12px;
    color: var(--fennevia-shell-text);
    background: color-mix(in srgb, var(--fennevia-shell-surface) 92%, var(--fennevia-shell-accent));
    border-block-start: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    font: menu;
    font-size: 12px;
  }

  #fennevia-shell-app-root .fennevia-shell-smoke__heading,
  #fennevia-shell-app-root .fennevia-shell-smoke__controls,
  #fennevia-shell-app-root .fennevia-shell-smoke__controls label,
  #fennevia-shell-app-root .fennevia-shell-smoke__state {
    display: flex;
    align-items: center;
    gap: 7px;
    min-inline-size: 0;
    margin: 0;
  }

  #fennevia-shell-app-root .fennevia-shell-smoke__heading span,
  #fennevia-shell-app-root .fennevia-shell-smoke__controls label > span {
    color: color-mix(in srgb, currentColor 72%, transparent);
    white-space: nowrap;
  }

  #fennevia-shell-app-root button,
  #fennevia-shell-app-root input {
    box-sizing: border-box;
    min-block-size: 28px;
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 6px;
    color: inherit;
    background: color-mix(in srgb, var(--fennevia-shell-surface) 96%, currentColor);
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
    background: color-mix(in srgb, var(--fennevia-shell-surface) 82%, currentColor);
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
    #fennevia-shell-app-root.fennevia-shell-smoke {
      grid-template-columns: 1fr;
    }

    #fennevia-shell-app-root .fennevia-shell-smoke__state {
      justify-self: start;
    }
  }

  @media (forced-colors: active) {
    #fennevia-shell-app-root.fennevia-shell-smoke {
      border-color: CanvasText;
    }

    #fennevia-shell-app-root button,
    #fennevia-shell-app-root input {
      border-color: ButtonText;
    }
  }
</style>
