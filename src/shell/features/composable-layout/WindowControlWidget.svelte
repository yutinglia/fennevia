<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { ProjectWidgetId } from "../../../app/toolbar-widgets-state";
  import {
    type BrowserWindowControlsStateAdapter,
    type WindowControlAction,
    type WindowControlsSnapshot,
  } from "../../../app/window-controls-state";
  import ShellIcon, { type ShellIconName } from "../../ShellIcon.svelte";

  type WindowProjectId = Extract<
    ProjectWidgetId,
    "close-window" | "minimize-window" | "toggle-maximize-window"
  >;

  type Props = Readonly<{
    customizeOpen: boolean;
    id: WindowProjectId;
    localeId: FenneviaLocale;
    onFatalError: (error: unknown) => void;
    windowControls: BrowserWindowControlsStateAdapter;
  }>;

  const props: Props = $props();
  let current: WindowControlsSnapshot = $state({ maximized: false });

  $effect(() => {
    current = props.windowControls.snapshot();
    return props.windowControls.subscribe((next) => {
      current = next;
    });
  });

  let action: WindowControlAction = $derived(
    props.id === "close-window"
      ? "close"
      : props.id === "minimize-window"
        ? "minimize"
        : "toggle-maximize",
  );
  let labelKey: MessageKey = $derived(
    props.id === "close-window"
      ? "window.close"
      : props.id === "minimize-window"
        ? "window.minimize"
        : current.maximized
          ? "window.restore"
          : "window.maximize",
  );
  let icon: ShellIconName = $derived(
    props.id === "close-window"
      ? "close"
      : props.id === "minimize-window"
        ? "minimize"
        : current.maximized
          ? "restore"
          : "maximize",
  );

  const activate = (): void => {
    if (props.customizeOpen) {
      return;
    }
    try {
      props.windowControls.invoke(action);
    } catch (error) {
      props.onFatalError(error);
    }
  };
</script>

<button
  aria-label={translate(props.localeId, labelKey)}
  class="fennevia-control fennevia-window-controls__button fennevia-layout-control"
  class:fennevia-window-controls__close={props.id === "close-window"}
  data-fennevia-window-control={action}
  disabled={props.customizeOpen}
  onclick={activate}
  tabindex={props.customizeOpen ? -1 : undefined}
  title={translate(props.localeId, labelKey)}
  type="button"
>
  <ShellIcon name={icon} />
</button>
