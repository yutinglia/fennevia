<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import {
    isPopupBrowserToolAction,
    type BrowserToolAction,
    type BrowserToolsStateAdapter,
  } from "../../../app/browser-tools-state";
  import type {
    EdgeName,
    EdgeShellController,
  } from "../../../app/edge-surfaces";
  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { ProjectWidgetId } from "../../../app/toolbar-widgets-state";
  import { resolveBrowserToolHost } from "../../browser-tool-host";
  import FirefoxIcon, { type FirefoxIconName } from "../../FirefoxIcon.svelte";

  type BrowserToolProjectId = Extract<
    ProjectWidgetId,
    | "application-menu"
    | "extensions"
    | "settings"
    | "show-bookmarks"
    | "show-downloads"
    | "show-translate"
  >;

  type Props = Readonly<{
    browserTools?: BrowserToolsStateAdapter;
    customizeOpen: boolean;
    edge: EdgeName;
    id: BrowserToolProjectId;
    localeId: FenneviaLocale;
    onDismiss: (edge: EdgeName) => void;
    onFatalError: (error: unknown) => void;
    onRevealProject: (id: ProjectWidgetId) => boolean;
    shell: EdgeShellController;
  }>;

  const props: Props = $props();
  let snapshot = $derived(props.browserTools?.snapshot());
  let action: BrowserToolAction | null = $derived(
    props.id === "application-menu"
      ? "application-menu"
      : props.id === "extensions"
        ? "extensions"
        : props.id === "settings"
          ? "settings"
          : props.id === "show-downloads"
            ? "downloads"
            : props.id === "show-translate"
              ? "translate"
              : null,
  );
  let labelKey: MessageKey = $derived(
    props.id === "application-menu"
      ? "nav.firefoxMenu"
      : props.id === "extensions"
        ? "nav.extensions"
        : props.id === "settings"
          ? "nav.settings"
          : props.id === "show-bookmarks"
            ? "widget.showBookmarks"
            : props.id === "show-downloads"
              ? "widget.showDownloads"
              : "widget.showTranslate",
  );
  let icon: FirefoxIconName = $derived(
    props.id === "application-menu"
      ? "menu"
      : props.id === "extensions"
        ? "extensions"
        : props.id === "settings"
          ? "settings"
          : props.id === "show-bookmarks"
            ? "bookmark"
            : props.id === "show-downloads"
              ? "download"
              : "translate",
  );
  let available = $derived(
    props.id === "application-menu"
      ? snapshot?.applicationMenu
      : props.id === "extensions"
        ? snapshot?.extensions
        : props.id === "settings"
          ? snapshot?.settings
          : props.id === "show-bookmarks"
            ? true
            : props.id === "show-downloads"
              ? snapshot?.downloads
              : snapshot?.translate,
  );

  const activate = async (event: MouseEvent): Promise<void> => {
    if (props.customizeOpen) {
      return;
    }
    if (props.id === "show-bookmarks") {
      props.onRevealProject("bookmarks");
      return;
    }
    const browserTools = props.browserTools;
    if (!browserTools || !action) {
      return;
    }
    const popup = isPopupBrowserToolAction(action);
    if (popup) {
      props.shell.setPopupHeld(props.edge, true);
    } else {
      props.onDismiss(props.edge);
    }
    try {
      const opened = await browserTools.invoke(
        action,
        popup ? resolveBrowserToolHost(event) : undefined,
        event,
      );
      if (popup && !opened) {
        props.shell.setPopupHeld(props.edge, false);
      }
    } catch (error) {
      if (popup) {
        props.shell.setPopupHeld(props.edge, false);
      }
      props.onFatalError(error);
    }
  };
</script>

<button
  aria-haspopup={props.id === "application-menu" ? "menu" : undefined}
  aria-label={translate(props.localeId, labelKey)}
  class="fennevia-control fennevia-browser-tools__button fennevia-layout-control"
  data-fennevia-browser-tool={props.id === "show-downloads"
    ? "downloads"
    : props.id === "show-translate"
      ? "translate"
      : props.id}
  disabled={props.customizeOpen || !available}
  onclick={(event) => void activate(event)}
  tabindex={props.customizeOpen ? -1 : undefined}
  title={translate(props.localeId, labelKey)}
  type="button"
>
  <FirefoxIcon name={icon} />
</button>
