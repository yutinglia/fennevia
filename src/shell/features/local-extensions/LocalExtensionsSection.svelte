<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import {
    copyLocalExtensionsSnapshot,
    type LocalExtensionsBridge,
    type LocalExtensionsSnapshot,
    type LocalExtensionRequest,
    type LocalExtensionResult,
    type LocalExtensionRow,
  } from "../../../app/local-extensions";
  const props: Readonly<{
    localeId: FenneviaLocale;
    bridge?: LocalExtensionsBridge;
  }> = $props();
  const t = (key: string) =>
    translate(props.localeId, `localExtensions.${key}` as MessageKey);
  let snapshot: LocalExtensionsSnapshot | null = $state(null);
  let preview: Extract<LocalExtensionResult, { status: "preview" }> | null =
    $state(null);
  let removal: LocalExtensionRow | null = $state(null);
  let working = $state(false);
  let message = $state("");
  let alive = true;
  let addButton: HTMLButtonElement | undefined = $state();
  let returnFocus: HTMLButtonElement | undefined;
  const busy = $derived.by(() => working || snapshot?.busy === true);
  const confirming = $derived(!!preview || !!removal);
  $effect(() => {
    const bridge = props.bridge;
    if (!bridge) {
      snapshot = null;
      return;
    }
    snapshot = copyLocalExtensionsSnapshot(bridge.snapshot());
    return bridge.subscribe((value) => {
      snapshot = copyLocalExtensionsSnapshot(value);
    });
  });
  onDestroy(() => {
    alive = false;
    void props.bridge?.request({ type: "cancel" });
  });
  const remember = (event: MouseEvent) => {
    if (event.currentTarget instanceof HTMLButtonElement)
      returnFocus = event.currentTarget;
  };
  const restore = async () => {
    await tick();
    if (alive)
      (returnFocus?.isConnected ? returnFocus : addButton)?.focus({
        preventScroll: true,
      });
  };
  const run = async (request: LocalExtensionRequest): Promise<void> => {
    if (!props.bridge) return;
    working = true;
    message = "";
    try {
      const result = await props.bridge.request(request);
      if (!alive) return;
      preview = result.status === "preview" ? result : null;
      if (result.status !== "preview") message = t(result.status);
      if (["confirm", "cancel", "remove"].includes(request.type)) {
        removal = null;
        working = false;
        await restore();
      }
    } catch {
      if (alive) message = t("failed");
    } finally {
      if (alive) working = false;
    }
  };
  const cancel = () => {
    removal = null;
    void run({ type: "cancel" });
  };
  const focusCancel = (node: HTMLButtonElement) =>
    node.focus({ preventScroll: true });
  const dialogKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) cancel();
    }
  };
  const permission = (value: string) => {
    const colon = value.indexOf(":");
    const category = value.slice(0, colon);
    const detail = value.slice(colon + 1);
    const known = [
      "storage",
      "tabs",
      "bookmarks",
      "history",
      "downloads",
      "cookies",
      "webRequest",
      "webRequestBlocking",
      "scripting",
      "nativeMessaging",
      "clipboardRead",
      "clipboardWrite",
      "declarativeNetRequest",
      "privacy",
      "proxy",
    ];
    if (category === "permission" && known.includes(detail))
      return t("permission." + detail);
    return (
      t(
        category === "site"
          ? "site"
          : category === "data"
            ? "data"
            : "otherPermission",
      ) + detail
    );
  };
</script>

<section
  class="fennevia-customize__section local-extensions"
  aria-label={t("heading")}
  aria-busy={busy}
  data-fennevia-local-extensions=""
>
  <h3 class="fennevia-customize__heading">{t("heading")}</h3>
  <p class="fennevia-customize__interaction-help">{t("help")}</p>
  {#if !snapshot || snapshot.status !== "ready"}
    <p role="status">{t(snapshot?.status ?? "unavailable")}</p>
  {:else}
    <div class="fennevia-customize__confirm-actions">
      <button
        bind:this={addButton}
        class="fennevia-control"
        type="button"
        disabled={busy || confirming}
        data-fennevia-local-add-file=""
        onclick={(event) => {
          remember(event);
          void run({ type: "prepare", source: "file", title: t("addFile") });
        }}>{t("addFile")}</button
      >
      <button
        class="fennevia-control"
        type="button"
        disabled={busy || confirming}
        data-fennevia-local-add-folder=""
        onclick={(event) => {
          remember(event);
          void run({
            type: "prepare",
            source: "folder",
            title: t("addFolder"),
          });
        }}>{t("addFolder")}</button
      >
      <button
        class="fennevia-control"
        type="button"
        disabled={busy || confirming || !snapshot.enabled}
        onclick={() => void run({ type: "disable-all" })}
        >{t("disableAll")}</button
      >
    </div>
    {#if !snapshot.rows.length}<p>{t("empty")}</p>{/if}
    <ul class="extension-list">
      {#each snapshot.rows as row, index (index)}
        <li class="extension-row">
          <p><strong>{row.name}</strong> <span>{row.version}</span></p>
          <p>{t("state." + row.state)}</p>
          <div class="fennevia-customize__confirm-actions">
            <button
              class="fennevia-control"
              type="button"
              aria-pressed={row.enabled}
              disabled={busy || confirming}
              onclick={() =>
                void run({
                  type: row.enabled ? "disable" : "enable",
                  token: row.token,
                })}>{t(row.enabled ? "disable" : "enable")}</button
            >
            <button
              class="fennevia-control"
              type="button"
              disabled={busy || confirming || !row.enabled}
              onclick={() => void run({ type: "reload", token: row.token })}
              >{t("reload")}</button
            >
            <button
              class="fennevia-control"
              type="button"
              disabled={busy || confirming}
              onclick={(event) => {
                remember(event);
                void run({
                  type: "prepare",
                  source: "file",
                  title: t("updateFile"),
                  token: row.token,
                });
              }}>{t("updateFile")}</button
            >
            <button
              class="fennevia-control"
              type="button"
              disabled={busy || confirming}
              onclick={(event) => {
                remember(event);
                void run({
                  type: "prepare",
                  source: "folder",
                  title: t("updateFolder"),
                  token: row.token,
                });
              }}>{t("updateFolder")}</button
            >
            <button
              class="fennevia-control"
              type="button"
              disabled={busy || confirming}
              onclick={(event) => {
                remember(event);
                removal = row;
              }}>{t("remove")}</button
            >
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {#if preview || removal}
    <div
      class="fennevia-customize__confirm-alert"
      role="alertdialog"
      aria-labelledby="fennevia-local-confirm-title"
      aria-describedby="fennevia-local-confirm-help"
      tabindex="-1"
      onkeydown={dialogKey}
      data-fennevia-local-preview=""
    >
      <h4 id="fennevia-local-confirm-title">
        {(removal
          ? t("remove")
          : preview?.update
            ? t("update")
            : t("addEnable")) +
          " — " +
          (removal?.name ?? preview?.name ?? "")}
      </h4>
      <p id="fennevia-local-confirm-help">
        {removal ? t("removeHelp") : t("confirmHelp")}
      </p>
      {#if preview}
        <p>{t("version")}{preview.version}</p>
        <h5>{t("required")}</h5>
        {#if preview.required.length}<ul>
            {#each preview.required as item (item)}<li>
                {permission(item)}
              </li>{/each}
          </ul>{:else}<p>{t("none")}</p>{/if}
        <h5>{t("optional")}</h5>
        {#if preview.optional.length}<ul>
            {#each preview.optional as item (item)}<li>
                {permission(item)}
              </li>{/each}
          </ul>{:else}<p>{t("none")}</p>{/if}
      {/if}
      <div class="fennevia-customize__confirm-actions">
        <button
          use:focusCancel
          class="fennevia-control"
          type="button"
          disabled={busy}
          data-fennevia-local-cancel=""
          onclick={cancel}>{t("cancel")}</button
        >
        <button
          class="fennevia-control"
          type="button"
          disabled={busy}
          data-fennevia-local-confirm=""
          onclick={() =>
            removal
              ? void run({ type: "remove", token: removal.token })
              : preview && void run({ type: "confirm", token: preview.token })}
          >{removal
            ? t("remove")
            : preview?.update
              ? t("update")
              : t("addEnable")}</button
        >
      </div>
    </div>
  {/if}
  <output aria-live="polite" data-fennevia-local-result=""
    >{busy ? t("working") : message}</output
  >
  {#if props.bridge}
    <div class="fennevia-customize__confirm-actions">
      <button
        class="fennevia-control"
        type="button"
        disabled={confirming}
        onclick={() => void run({ type: "open-addons" })}>{t("native")}</button
      >
      <button
        class="fennevia-control"
        type="button"
        disabled={confirming}
        onclick={() => void run({ type: "open-debugging" })}
        >{t("debugging")}</button
      >
    </div>
  {/if}
</section>
