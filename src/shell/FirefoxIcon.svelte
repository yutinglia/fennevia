<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  export type FirefoxIconName =
    | "account"
    | "arrow-down"
    | "arrow-right"
    | "back"
    | "bookmark"
    | "bookmark-item"
    | "camera"
    | "check"
    | "close"
    | "crashed"
    | "customize"
    | "developer"
    | "download"
    | "edit"
    | "error"
    | "extensions"
    | "firefox-view"
    | "forward"
    | "fullscreen"
    | "history"
    | "home"
    | "library"
    | "loading"
    | "menu"
    | "microphone"
    | "new-window"
    | "pause"
    | "picture-in-picture"
    | "pin"
    | "plus"
    | "print"
    | "private"
    | "reload"
    | "search"
    | "screen-share"
    | "screenshot"
    | "settings"
    | "sidebar"
    | "stop"
    | "tab"
    | "tab-audio-blocked"
    | "tab-audio-muted"
    | "tab-audio-playing"
    | "tab-close"
    | "open-in-new"
    | "translate";

  type Props = Readonly<{
    name: FirefoxIconName;
  }>;

  const { name }: Props = $props();

  const iconUrls: Readonly<Record<FirefoxIconName, string>> = Object.freeze({
    account: "chrome://browser/skin/fxa/avatar-empty.svg",
    "arrow-down": "chrome://global/skin/icons/arrow-down.svg",
    "arrow-right": "chrome://global/skin/icons/arrow-right.svg",
    back: "chrome://browser/skin/back.svg",
    bookmark: "chrome://browser/skin/bookmark-star-on-tray.svg",
    "bookmark-item": "chrome://browser/skin/bookmark.svg",
    camera: "chrome://browser/skin/notification-icons/camera.svg",
    check: "chrome://global/skin/icons/check.svg",
    close: "chrome://global/skin/icons/close.svg",
    crashed: "chrome://browser/skin/tabbrowser/crashed.svg",
    customize: "chrome://browser/skin/customize.svg",
    developer: "chrome://global/skin/icons/developer.svg",
    download: "chrome://browser/skin/downloads/downloads.svg",
    edit: "chrome://global/skin/icons/edit.svg",
    error: "chrome://global/skin/icons/error.svg",
    extensions: "chrome://mozapps/skin/extensions/extension.svg",
    "firefox-view": "chrome://browser/skin/firefox-view.svg",
    forward: "chrome://browser/skin/forward.svg",
    fullscreen: "chrome://browser/skin/fullscreen.svg",
    history: "chrome://browser/skin/history.svg",
    home: "chrome://browser/skin/home.svg",
    library: "chrome://browser/skin/library.svg",
    loading: "chrome://global/skin/icons/loading.svg",
    menu: "chrome://browser/skin/menu.svg",
    microphone: "chrome://browser/skin/notification-icons/microphone.svg",
    "new-window": "chrome://browser/skin/window.svg",
    "open-in-new": "chrome://global/skin/icons/open-in-new.svg",
    pause: "chrome://global/skin/media/pause-fill.svg",
    "picture-in-picture":
      "chrome://global/skin/media/picture-in-picture-closed.svg",
    pin: "chrome://browser/skin/pin.svg",
    plus: "chrome://global/skin/icons/plus.svg",
    print: "chrome://global/skin/icons/print.svg",
    private: "chrome://browser/skin/privateBrowsing.svg",
    reload: "chrome://global/skin/icons/reload.svg",
    search: "chrome://global/skin/icons/search-glass.svg",
    "screen-share": "chrome://browser/skin/notification-icons/screen.svg",
    screenshot: "chrome://browser/skin/screenshot.svg",
    settings: "chrome://global/skin/icons/settings.svg",
    sidebar: "chrome://browser/skin/sidebar-collapsed.svg",
    stop: "chrome://global/skin/icons/close.svg",
    tab: "chrome://global/skin/icons/defaultFavicon.svg",
    "tab-audio-blocked":
      "chrome://browser/skin/tabbrowser/tab-audio-blocked-circle-12.svg",
    "tab-audio-muted":
      "chrome://browser/skin/tabbrowser/tab-audio-muted-small.svg",
    "tab-audio-playing":
      "chrome://browser/skin/tabbrowser/tab-audio-playing-small.svg",
    "tab-close": "resource://content-accessible/close-12.svg",
    translate: "chrome://browser/skin/translations.svg",
  });
  const maskImage = $derived(`url("${iconUrls[name]}")`);
</script>

<span
  aria-hidden="true"
  class="fennevia-firefox-icon"
  data-fennevia-firefox-icon={name}
  style:mask-image={maskImage}
  style:-webkit-mask-image={maskImage}
></span>
