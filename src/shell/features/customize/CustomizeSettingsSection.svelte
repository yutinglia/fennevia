<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { BrowserToolbarWidgetsStateAdapter } from "../../../app/toolbar-widgets-state";
  import type {
    SettingsTransferRequest,
    SettingsTransferResult,
  } from "../../../app/settings-transfer";

  const props: Readonly<{
    localeId: FenneviaLocale;
    toolbarWidgets: BrowserToolbarWidgetsStateAdapter;
    onFatalError: (error: unknown) => void;
  }> = $props();
  const t = (key: MessageKey) => translate(props.localeId, key);
  let busy = $state(false);
  let message = $state("");
  let preview: Extract<SettingsTransferResult, { status: "ready" }> | null =
    $state(null);
  let importButton: HTMLButtonElement | undefined = $state();
  let alive = true;

  onDestroy(() => {
    alive = false;
    void props.toolbarWidgets
      .transferSettings({ type: "cancel" })
      .catch((error) => {
        if (!props.toolbarWidgets.status().disposed) props.onFatalError(error);
      });
  });

  const run = async (request: SettingsTransferRequest): Promise<void> => {
    busy = true;
    message = "";
    try {
      const result = await props.toolbarWidgets.transferSettings(request);
      if (!alive) return;
      preview = result.status === "ready" ? result : null;
      if (result.status !== "ready")
        message = t(("customize.settings." + result.status) as MessageKey);
    } catch (error) {
      if (alive) props.onFatalError(error);
    } finally {
      if (alive) {
        busy = false;
        if (request.type === "apply-import" || request.type === "cancel") {
          await tick();
          if (alive) importButton?.focus({ preventScroll: true });
        }
      }
    }
  };

  const cancel = async (): Promise<void> => {
    await run({ type: "cancel" });
  };
  const focusOnMount = (node: HTMLButtonElement): void =>
    node.focus({ preventScroll: true });
  const handlePreviewKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      void cancel();
    }
  };
</script>

<fieldset
  class="fennevia-customize__section"
  aria-busy={busy}
  data-fennevia-settings-transfer=""
>
  <legend class="fennevia-customize__heading"
    >{t("customize.settings.heading")}</legend
  >
  <p class="fennevia-customize__interaction-help">
    {t("customize.settings.help")}
  </p>
  <div class="fennevia-customize__confirm-actions">
    <button
      class="fennevia-control"
      data-fennevia-settings-export=""
      disabled={busy || preview !== null}
      onclick={() =>
        void run({ type: "export", title: t("customize.settings.export") })}
      type="button">{t("customize.settings.export")}</button
    >
    <button
      bind:this={importButton}
      class="fennevia-control"
      data-fennevia-settings-import=""
      disabled={busy || preview !== null}
      onclick={() =>
        void run({
          type: "prepare-import",
          title: t("customize.settings.import"),
        })}
      type="button">{t("customize.settings.import")}</button
    >
  </div>
  {#if preview}
    <div
      class="fennevia-customize__confirm-alert"
      role="alertdialog"
      aria-labelledby="fennevia-settings-confirm-title"
      aria-describedby="fennevia-settings-confirm-description"
      tabindex="-1"
      onkeydown={handlePreviewKeydown}
      data-fennevia-settings-preview=""
    >
      <h3 id="fennevia-settings-confirm-title">
        {t("customize.settings.confirmTitle")}
      </h3>
      <p id="fennevia-settings-confirm-description">
        {translate(props.localeId, "customize.settings.confirmDescription", {
          count: preview.widgetCount,
        })}
      </p>
      {#if preview.missingCount > 0}
        <p>
          {translate(props.localeId, "customize.settings.missing", {
            count: preview.missingCount,
          })}
        </p>
      {/if}
      <div class="fennevia-customize__confirm-actions">
        <button
          class="fennevia-control"
          data-fennevia-settings-cancel=""
          disabled={busy}
          onclick={() => void cancel()}
          type="button"
          use:focusOnMount>{t("customize.settings.cancel")}</button
        >
        <button
          class="fennevia-control"
          data-fennevia-settings-apply=""
          disabled={busy}
          onclick={() =>
            preview && void run({ type: "apply-import", token: preview.token })}
          type="button">{t("customize.settings.apply")}</button
        >
      </div>
    </div>
  {/if}
  <output
    class="fennevia-customize__interaction-help"
    aria-live="polite"
    data-fennevia-settings-result=""
    >{busy ? t("customize.settings.working") : message}</output
  >
</fieldset>
