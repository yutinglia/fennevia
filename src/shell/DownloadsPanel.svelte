<script lang="ts">
  import { untrack } from "svelte";

  import type {
    BrowserDownloadsState,
    BrowserDownloadsStateAdapter,
    DownloadItemState,
  } from "../app/download-state";
  import { countLabel, translate, type MessageKey } from "../app/i18n";
  import {
    defaultFenneviaLocale,
    type FenneviaLocale,
  } from "../app/locale-state";
  import FirefoxIcon, { type FirefoxIconName } from "./FirefoxIcon.svelte";

  type Props = Readonly<{
    downloads: BrowserDownloadsStateAdapter;
    localeId?: FenneviaLocale;
    onFatalError: (error: unknown) => void;
    orientation?: "column" | "row";
  }>;

  type DownloadPresentation = Readonly<{
    icon: FirefoxIconName;
    label: string;
    tone: "danger" | "muted" | "positive" | "warning";
  }>;

  const props: Props = $props();
  let localeId: FenneviaLocale = $derived(
    props.localeId ?? defaultFenneviaLocale,
  );
  const t = (key: MessageKey, vars?: Record<string, number | string>): string =>
    translate(localeId, key, vars);
  let current: BrowserDownloadsState = $state(
    untrack(() => props.downloads.snapshot()),
  );

  const presentations = $derived(
    Object.freeze({
      active: Object.freeze({
        icon: "download",
        label: t("downloads.downloading"),
        tone: "positive",
      }),
      canceled: Object.freeze({
        icon: "close",
        label: t("downloads.canceled"),
        tone: "muted",
      }),
      failed: Object.freeze({
        icon: "error",
        label: t("downloads.failed"),
        tone: "danger",
      }),
      paused: Object.freeze({
        icon: "pause",
        label: t("downloads.paused"),
        tone: "warning",
      }),
      queued: Object.freeze({
        icon: "loading",
        label: t("downloads.queued"),
        tone: "muted",
      }),
      succeeded: Object.freeze({
        icon: "check",
        label: t("downloads.finished"),
        tone: "positive",
      }),
    } satisfies Record<DownloadItemState, DownloadPresentation>),
  );

  const counted = (
    count: number,
    oneKey: MessageKey,
    otherKey: MessageKey,
  ): string =>
    countLabel(
      localeId,
      count,
      current.countOverflow && count === 999,
      oneKey,
      otherKey,
    );

  let summary = $derived.by(() => {
    if (current.phase === "loading") {
      return Object.freeze({
        detail: t("downloads.detailLoading"),
        title: t("downloads.loading"),
      });
    }
    if (current.activeCount > 0) {
      return Object.freeze({
        detail:
          current.progressMode === "determinate"
            ? t("downloads.detailOverall", {
                percent: current.aggregatePercent ?? 0,
              })
            : t("downloads.detailIndeterminate"),
        title: counted(
          current.activeCount,
          "downloads.activeOne",
          "downloads.activeOther",
        ),
      });
    }
    if (current.pausedCount > 0) {
      return Object.freeze({
        detail: t("downloads.detailPaused"),
        title: counted(
          current.pausedCount,
          "downloads.pausedOne",
          "downloads.pausedOther",
        ),
      });
    }
    if (current.queuedCount > 0) {
      return Object.freeze({
        detail: t("downloads.detailQueued"),
        title: counted(
          current.queuedCount,
          "downloads.queuedOne",
          "downloads.queuedOther",
        ),
      });
    }
    if (current.failedCount > 0) {
      return Object.freeze({
        detail: t("downloads.detailFailed"),
        title: counted(
          current.failedCount,
          "downloads.failedOne",
          "downloads.failedOther",
        ),
      });
    }
    if (current.canceledCount > 0) {
      return Object.freeze({
        detail: t("downloads.detailCanceled"),
        title: counted(
          current.canceledCount,
          "downloads.canceledOne",
          "downloads.canceledOther",
        ),
      });
    }
    if (current.succeededCount > 0) {
      return Object.freeze({
        detail: t("downloads.detailFinished"),
        title: counted(
          current.succeededCount,
          "downloads.finishedOne",
          "downloads.finishedOther",
        ),
      });
    }
    return Object.freeze({
      detail: t("downloads.detailIdle"),
      title: t("downloads.none"),
    });
  });

  $effect(() => {
    try {
      current = props.downloads.snapshot();
      return props.downloads.subscribe((state) => {
        current = state;
      });
    } catch (error) {
      props.onFatalError(error);
    }
  });
</script>

<section
  aria-label={t("downloads.panelAria")}
  lang={localeId}
  class="fennevia-downloads"
  class:fennevia-downloads--horizontal={props.orientation === "row"}
  data-fennevia-orientation={props.orientation === "row"
    ? "horizontal"
    : "vertical"}
  data-fennevia-default-focus=""
  data-fennevia-downloads=""
  data-fennevia-downloads-phase={current.phase}
  tabindex="-1"
>
  <div aria-live="polite" class="fennevia-downloads__summary">
    <span aria-hidden="true" class="fennevia-downloads__summary-icon">
      <FirefoxIcon name="download" />
    </span>
    <span class="fennevia-downloads__summary-copy">
      <strong data-fennevia-download-summary="">{summary.title}</strong>
      <span>{summary.detail}</span>
    </span>
  </div>

  <div
    class="fennevia-downloads__progress"
    data-fennevia-download-progress={current.progressMode}
  >
    {#if current.activeCount > 0}
      <div
        aria-label={current.progressMode === "determinate"
          ? t("downloads.progressDeterminate", {
              percent: current.aggregatePercent ?? 0,
            })
          : t("downloads.progressUnknown")}
        aria-valuemax={current.progressMode === "determinate" ? 100 : undefined}
        aria-valuemin={current.progressMode === "determinate" ? 0 : undefined}
        aria-valuenow={current.progressMode === "determinate"
          ? current.aggregatePercent
          : undefined}
        class="fennevia-downloads__track"
        data-fennevia-download-track=""
        role="progressbar"
      >
        <span
          class="fennevia-downloads__track-value"
          style:--fennevia-download-progress={current.progressMode ===
          "determinate"
            ? `${current.aggregatePercent}%`
            : "38%"}
        ></span>
      </div>
    {:else}
      <span
        class="fennevia-downloads__inactive"
        data-fennevia-download-inactive="">{t("downloads.idle")}</span
      >
    {/if}
  </div>

  <ul aria-label={t("downloads.itemsAria")} class="fennevia-downloads__items">
    {#each current.items as item, index (item.id)}
      <li
        aria-label={item.progressPercent === null
          ? t("downloads.itemAria", {
              index: index + 1,
              label: presentations[item.state].label,
            })
          : t("downloads.itemAriaPercent", {
              index: index + 1,
              label: presentations[item.state].label,
              percent: item.progressPercent,
            })}
        class="fennevia-downloads__item"
        data-fennevia-download-state={item.state}
        data-fennevia-status-tone={presentations[item.state].tone}
        title={item.progressPercent === null
          ? presentations[item.state].label
          : t("downloads.itemTitlePercent", {
              label: presentations[item.state].label,
              percent: item.progressPercent,
            })}
      >
        <FirefoxIcon name={presentations[item.state].icon} />
        {#if item.progressPercent !== null && item.state !== "succeeded"}
          <span>{item.progressPercent}%</span>
        {:else}
          <span>{presentations[item.state].label}</span>
        {/if}
      </li>
    {/each}
    {#if current.truncated}
      <li aria-label={t("downloads.moreAria")} class="fennevia-downloads__more">
        <FirefoxIcon name="plus" />
      </li>
    {/if}
  </ul>
</section>
