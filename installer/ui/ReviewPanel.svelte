<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    invoke,
    type Action,
    type InstallationStatus,
    type PackageChoice,
    type Preview,
    type Applied,
    type Progress,
  } from "./api";
  import { Requests } from "./requests";
  import { en, zh } from "./i18n";
  let {
    firefox,
    profile,
    isDefault,
    language,
    parentBusy,
    onApplying,
  }: {
    firefox: string;
    profile: string;
    isDefault: boolean;
    language: string;
    parentBusy: boolean;
    onApplying: (value: boolean) => void;
  } = $props();
  const gate = new Requests();
  let text = $derived(language === "zh-Hant" ? zh : en);
  let status = $state<InstallationStatus | null>(null);
  let source = $state<PackageChoice | null>(null);
  let loadingSource = $state(true);
  let disposed = false;
  let preview = $state<Preview | null>(null);
  let action = $state<Action>("install");
  let confirmed = $state(false);
  let busy = $state(false);
  let error = $state("");
  let accepted = $state(false);
  let consumed = $state(false);
  let applying = $state(false);
  let applied = $state<Applied | null>(null);
  let progress = $state<Progress | null>(null);
  let progressTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  async function pollProgress() {
    try {
      const value = await invoke<Progress | null>("installation_progress");
      if (applying && !disposed) progress = value;
    } catch {
      // The authoritative apply result reports failures; progress is advisory.
    } finally {
      if (applying && !disposed)
        progressTimer = globalThis.setTimeout(pollProgress, 500);
    }
  }
  const actions: Action[] = [
    "install",
    "update",
    "repair",
    "disable",
    "enable",
    "uninstall",
  ];
  $effect(() => {
    void firefox;
    void profile;
    void action;
    gate.cancel();
    busy = false;
    status = null;
    preview = null;
    error = "";
    confirmed = false;
    accepted = false;
    consumed = false;
    applied = null;
  });
  async function run<T>(work: () => Promise<T>, commit: (value: T) => void) {
    if (busy || parentBusy || loadingSource) return;
    busy = true;
    error = "";
    await gate.run(work, commit, (code) => (error = code));
    busy = gate.busy;
  }
  const inspect = () =>
    run(
      () => invoke<InstallationStatus>("inspect_targets", { firefox, profile }),
      (value) => (status = value),
    );
  const choosePackage = () =>
    run(
      () => invoke<PackageChoice | null>("pick_package"),
      (value) => {
        if (value) {
          source = value;
          preview = null;
          accepted = false;
          consumed = false;
          applied = null;
        }
      },
    );
  onMount(() => {
    void invoke<PackageChoice | null>("bundled_package")
      .then((value) => {
        if (!disposed) source = value;
      })
      .catch((code: unknown) => {
        if (!disposed) error = typeof code === "string" ? code : "IO";
      })
      .finally(() => {
        if (!disposed) loadingSource = false;
      });
  });
  const review = () =>
    run(
      () =>
        invoke<Preview>("preview_action", {
          firefox,
          profile,
          action,
          package: source?.token ?? null,
          defaultConfirmed: confirmed,
        }),
      (value) => {
        preview = value;
        accepted = false;
        consumed = false;
        applied = null;
      },
    );
  async function apply(elevate = false) {
    const approval = elevate ? applied?.elevationApproval : preview?.approval;
    if (!approval || !preview || !accepted || applying || busy || parentBusy)
      return;
    const digest = preview.digest;
    applying = true;
    progress = null;
    progressTimer = globalThis.setTimeout(pollProgress, 500);
    onApplying(true);
    error = "";
    // Consume locally before IPC as well as in the host. Never automatically retry.
    preview = { ...preview, approval: null };
    consumed = true;
    applied = null;
    try {
      applied = await invoke<Applied>("apply_action", {
        approval,
        digest,
        confirmed: true,
        elevate,
      });
    } catch (code) {
      error = typeof code === "string" ? code : "IO";
    } finally {
      applying = false;
      globalThis.clearTimeout(progressTimer);
      onApplying(false);
      accepted = false;
      status = null;
    }
  }
  onDestroy(() => {
    disposed = true;
    globalThis.clearTimeout(progressTimer);
    gate.cancel();
  });
</script>

<section class="panel review" aria-labelledby="review-title">
  <div class="section-heading">
    <h2 id="review-title">{text.reviewTitle}</h2>
    <button
      onclick={inspect}
      disabled={busy || parentBusy || !firefox || !profile}
      >{text.inspect}</button
    >
  </div>
  {#if status}
    <p role="status">
      {text.installStates[status.state]}{status.version
        ? ` · ${status.version}`
        : ""}
    </p>
    {#if status.incomplete}<p class="notice">{text.incomplete}</p>{/if}
    {#if status.missingFiles || status.changedFiles}<p class="notice">
        {text.missingFiles}: {status.missingFiles} · {text.changedFiles}: {status.changedFiles}
      </p>{/if}
  {/if}
  <p>{text.previewHint}</p>
  <div class="actions">
    <button
      onclick={choosePackage}
      disabled={busy || parentBusy || loadingSource}
      >{text.choosePackage}</button
    >{#if loadingSource}<span role="status">{text.loadingPackage}</span
      >{/if}{#if source}<span
        >{source.version} · {source.fileCount} {text.files}</span
      >{/if}
  </div>
  <label class="operation-label"
    >{text.operation}<select bind:value={action} disabled={busy || parentBusy}
      >{#each actions as option (option)}<option value={option}
          >{text.actions[option]}</option
        >{/each}</select
    ></label
  >
  {#if isDefault}<label class="checkbox"
      ><input
        type="checkbox"
        bind:checked={confirmed}
        onchange={() => {
          preview = null;
          accepted = false;
          applied = null;
        }}
        disabled={busy || parentBusy}
      />{text.confirmDefault}</label
    >{/if}
  <button
    class="primary"
    onclick={review}
    disabled={busy ||
      loadingSource ||
      parentBusy ||
      !firefox ||
      !profile ||
      (isDefault && !confirmed) ||
      (!["disable", "uninstall"].includes(action) && !source)}
    >{busy ? text.scanning : text.preview}</button
  >
  {#if error}<p role="alert" class="error">
      {text.errorDetails[error] ?? text.error}
      <span class="error-code">({error})</span>
    </p>{/if}
  {#if preview}
    <div class="preview-result" role="status">
      <h3>{text.previewResult}</h3>
      <p>
        {preview.operations.length
          ? `${preview.operations.length} ${text.changes}`
          : text.noChanges}
      </p>
    </div>
    {#if preview.operations.length}<ol class="operation-list">
        {#each preview.operations as item (`${item.scope}:${item.kind}:${item.path}`)}<li
          >
            <strong>{text.kinds[item.kind]}</strong> · {item.scope === "program"
              ? text.firefox
              : text.profile}<code
              >{item.path}{item.destinationPath
                ? ` → ${item.destinationPath}`
                : ""}</code
            >
          </li>{/each}
      </ol>{/if}
    {#if preview.approval || applied?.elevationApproval}
      <p class="notice">{text.writeWarning}</p>
      <label class="checkbox"
        ><input
          type="checkbox"
          bind:checked={accepted}
          disabled={applying}
        />{text.confirmChanges}</label
      >
      <button
        class="primary"
        onclick={() => apply(Boolean(applied?.elevationApproval))}
        disabled={!accepted || applying || busy || parentBusy}
        >{applied?.elevationApproval ? text.elevate : text.apply}</button
      >
    {:else if !applied && !applying}<p class="hint">
        {consumed ? text.previewAgain : text.readOnlyPreview}
      </p>{/if}
  {/if}
  {#if applying}<p role="status">{text.applying}</p>
    {#if progress}<p role="status">
        {text.progressPhases[progress.phase]}{#if progress.total}
          · {progress.completed} / {progress.total}{/if}
      </p>{/if}
  {/if}
  {#if applied}<p role="status">{text.outcomes[applied.outcome.state]}</p>
    {#if applied.outcome.error}<p class="error" role="alert">
        {text.errorDetails[applied.outcome.error] ?? text.error}
      </p>{/if}
    {#if applied.elevationApproval}<p class="notice">
        {text.elevationHint}
      </p>{/if}
  {/if}
</section>
