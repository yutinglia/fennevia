<script lang="ts">
  import type { Choice } from "./api";
  let {
    label,
    choices,
    value = $bindable(""),
    busy,
    showPaths,
    text,
    browse,
  }: {
    label: string;
    choices: Choice[];
    value: string;
    busy: boolean;
    showPaths: boolean;
    text: typeof import("./i18n").en;
    browse: () => void;
  } = $props();
  const id = $props.id();
  let selected = $derived(choices.find((c) => c.token === value));
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="field-row">
    <select {id} bind:value disabled={busy}>
      <option value="">{text.choose}</option>
      {#each choices as choice (choice.token)}
        <option value={choice.token} disabled={!choice.available}
          >{choice.label}{choice.isDefault
            ? ` · ${text.default}`
            : ""}{!choice.available ? ` · ${text.unavailable}` : ""}</option
        >
      {/each}
    </select>
    <button onclick={browse} disabled={busy}>{text.browse}</button>
  </div>
  {#if !choices.length}<p class="hint">{text.empty}</p>{/if}
  {#if showPaths && selected}<p class="local-path">{selected.detail}</p>{/if}
</div>
