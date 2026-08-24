<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import {
    copyNavigationPointerGesture,
    createBrowserNavigationState,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
    type NavigationPointerGesture,
  } from "../../../app/navigation-state";
  import type { BrowserTabsStateAdapter } from "../../../app/tab-state";
  import type { ProjectWidgetId } from "../../../app/toolbar-widgets-state";
  import FirefoxIcon, { type FirefoxIconName } from "../../FirefoxIcon.svelte";

  type NavigationProjectId = Extract<
    ProjectWidgetId,
    "back" | "forward" | "home" | "new-tab" | "reload-stop"
  >;

  type Props = Readonly<{
    customizeOpen: boolean;
    id: NavigationProjectId;
    localeId: FenneviaLocale;
    navigation: BrowserNavigationStateAdapter;
    onFatalError: (error: unknown) => void;
    tabs: BrowserTabsStateAdapter;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey): string => translate(props.localeId, key);
  let current: BrowserNavigationState = $state(
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

  $effect(() => {
    current = props.navigation.snapshot();
    return props.navigation.subscribe((next) => {
      current = next;
    });
  });

  let label = $derived(
    props.id === "back"
      ? t("nav.back")
      : props.id === "forward"
        ? t("nav.forward")
        : props.id === "home"
          ? t("nav.home")
          : props.id === "new-tab"
            ? t("tab.newTab")
            : current.snapshot.loading
              ? t("nav.stop")
              : t("nav.reload"),
  );
  let icon: FirefoxIconName = $derived(
    props.id === "reload-stop"
      ? current.snapshot.loading
        ? "stop"
        : "reload"
      : props.id === "new-tab"
        ? "plus"
        : props.id,
  );
  let disabled = $derived(
    props.customizeOpen ||
      (props.id === "back" && !current.snapshot.canGoBack) ||
      (props.id === "forward" && !current.snapshot.canGoForward),
  );

  const gesture = (event: MouseEvent): NavigationPointerGesture =>
    copyNavigationPointerGesture({
      altKey: event.altKey,
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    });

  const activate = (event: MouseEvent): void => {
    if (props.customizeOpen || (event.button !== 0 && event.button !== 1)) {
      return;
    }
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
    }
    try {
      if (props.id === "back") {
        props.navigation.back(gesture(event));
      } else if (props.id === "forward") {
        props.navigation.forward(gesture(event));
      } else if (props.id === "home") {
        props.navigation.home(gesture(event));
      } else if (props.id === "reload-stop") {
        if (event.button === 1) {
          props.navigation.reload(gesture(event));
        } else {
          props.navigation.reloadOrStop();
        }
      } else {
        const relatedToCurrent =
          event.button === 1 || event.ctrlKey || event.metaKey;
        props.tabs.open({
          relatedToCurrent,
          selected: !(relatedToCurrent && event.shiftKey),
        });
      }
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.blur();
      }
    } catch (error) {
      props.onFatalError(error);
    }
  };
</script>

<button
  aria-busy={props.id === "reload-stop" && current.snapshot.loading}
  aria-label={label}
  class="fennevia-control fennevia-navigation__button fennevia-layout-control"
  data-fennevia-action={props.id}
  data-fennevia-loading={props.id === "reload-stop"
    ? current.snapshot.loading
    : undefined}
  {disabled}
  onauxclick={activate}
  onclick={activate}
  onmousedown={(event) => event.button === 1 && event.preventDefault()}
  tabindex={props.customizeOpen ? -1 : undefined}
  title={label}
  type="button"
>
  <FirefoxIcon name={icon} />
</button>
