<script lang="ts">
  import { untrack } from "svelte";

  import type {
    BrowserDownloadsState,
    BrowserDownloadsStateAdapter,
    DownloadItemState,
  } from "../app/download-state";

  type Props = Readonly<{
    downloads: BrowserDownloadsStateAdapter;
    onFatalError: (error: unknown) => void;
  }>;

  type DownloadPresentation = Readonly<{
    icon: string;
    label: string;
    tone: "danger" | "muted" | "positive" | "warning";
  }>;

  const props: Props = $props();
  let current: BrowserDownloadsState = $state(
    untrack(() => props.downloads.snapshot()),
  );

  const presentations: Readonly<
    Record<DownloadItemState, DownloadPresentation>
  > = Object.freeze({
    active: Object.freeze({
      icon: "↓",
      label: "Downloading",
      tone: "positive",
    }),
    canceled: Object.freeze({ icon: "×", label: "Canceled", tone: "muted" }),
    failed: Object.freeze({ icon: "!", label: "Failed", tone: "danger" }),
    paused: Object.freeze({ icon: "Ⅱ", label: "Paused", tone: "warning" }),
    queued: Object.freeze({ icon: "·", label: "Queued", tone: "muted" }),
    succeeded: Object.freeze({
      icon: "✓",
      label: "Finished",
      tone: "positive",
    }),
  });

  const countLabel = (
    count: number,
    singular: string,
    plural: string,
  ): string =>
    `${count}${current.countOverflow && count === 999 ? "+" : ""} ${
      count === 1 ? singular : plural
    }`;

  let summary = $derived.by(() => {
    if (current.phase === "loading") {
      return Object.freeze({
        detail: "Waiting for the native list",
        title: "Loading downloads",
      });
    }
    if (current.activeCount > 0) {
      return Object.freeze({
        detail:
          current.progressMode === "determinate"
            ? `${current.aggregatePercent}% overall`
            : "Total size is not yet known",
        title: countLabel(
          current.activeCount,
          "download active",
          "downloads active",
        ),
      });
    }
    if (current.pausedCount > 0) {
      return Object.freeze({
        detail: "Resume from Firefox when ready",
        title: countLabel(
          current.pausedCount,
          "download paused",
          "downloads paused",
        ),
      });
    }
    if (current.queuedCount > 0) {
      return Object.freeze({
        detail: "Waiting to start",
        title: countLabel(
          current.queuedCount,
          "download queued",
          "downloads queued",
        ),
      });
    }
    if (current.failedCount > 0) {
      return Object.freeze({
        detail: "Use Firefox Downloads for details",
        title: countLabel(
          current.failedCount,
          "recent failure",
          "recent failures",
        ),
      });
    }
    if (current.canceledCount > 0) {
      return Object.freeze({
        detail: "No transfer is active",
        title: countLabel(
          current.canceledCount,
          "download canceled",
          "downloads canceled",
        ),
      });
    }
    if (current.succeededCount > 0) {
      return Object.freeze({
        detail: "No transfer is active",
        title: countLabel(
          current.succeededCount,
          "download finished",
          "downloads finished",
        ),
      });
    }
    return Object.freeze({
      detail: "The surface stays quiet until needed",
      title: "No active downloads",
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
  aria-label="Download progress"
  class="fennevia-downloads"
  data-fennevia-default-focus=""
  data-fennevia-downloads=""
  data-fennevia-downloads-phase={current.phase}
  tabindex="-1"
>
  <div aria-live="polite" class="fennevia-downloads__summary">
    <span aria-hidden="true" class="fennevia-downloads__summary-icon">↓</span>
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
          ? `Overall download progress: ${current.aggregatePercent}%`
          : "Overall download progress: unknown total size"}
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
        data-fennevia-download-inactive="">Idle</span
      >
    {/if}
  </div>

  <ul
    aria-label="Current and recent download states"
    class="fennevia-downloads__items"
  >
    {#each current.items as item, index (item.id)}
      <li
        aria-label={`Download ${index + 1}: ${presentations[item.state].label}${
          item.progressPercent === null ? "" : `, ${item.progressPercent}%`
        }`}
        class="fennevia-downloads__item"
        data-fennevia-download-state={item.state}
        data-fennevia-status-tone={presentations[item.state].tone}
        title={`${presentations[item.state].label}${
          item.progressPercent === null ? "" : ` · ${item.progressPercent}%`
        }`}
      >
        <span aria-hidden="true">{presentations[item.state].icon}</span>
        {#if item.progressPercent !== null && item.state !== "succeeded"}
          <span>{item.progressPercent}%</span>
        {:else}
          <span>{presentations[item.state].label}</span>
        {/if}
      </li>
    {/each}
    {#if current.truncated}
      <li
        aria-label="More downloads are not shown"
        class="fennevia-downloads__more"
      >
        +
      </li>
    {/if}
  </ul>
</section>
