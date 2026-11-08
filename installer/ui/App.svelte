<script lang="ts">
  import { onMount } from "svelte";
  import { invoke, type Scan, type Choice, type SavedChoice } from "./api";
  import { en, zh } from "./i18n";
  import LocationField from "./LocationField.svelte";
  import ReviewPanel from "./ReviewPanel.svelte";
  import { Requests } from "./requests";
  let language = $state(
    navigator.language.toLowerCase().startsWith("zh") ? "zh-Hant" : "en",
  );
  let text = $derived(language === "zh-Hant" ? zh : en);
  let data = $state<Scan>({
    programs: [],
    profiles: [],
    saved: [],
    warnings: [],
    savedError: null,
  });
  let firefox = $state("");
  let profile = $state("");
  let busy = $state(false);
  let showPaths = $state(false);
  let error = $state("");
  let result = $state("");
  let clearOpen = $state(false);
  const requests = new Requests();
  $effect(() => {
    document.documentElement.lang = language;
  });

  function replace(next: Scan) {
    const selectedFirefox = data.programs.find(
      (p) => p.token === firefox,
    )?.detail;
    const selectedProfile = data.profiles.find(
      (p) => p.token === profile,
    )?.detail;
    data = next;
    firefox =
      next.programs.find((p) => p.available && p.detail === selectedFirefox)
        ?.token ?? "";
    profile =
      next.profiles.find((p) => p.available && p.detail === selectedProfile)
        ?.token ?? "";
  }
  async function run<T>(work: () => Promise<T>, commit: (value: T) => void) {
    if (busy) return;
    busy = true;
    error = "";
    result = "";
    await requests.run(work, commit, (code) => (error = code));
    busy = requests.busy;
  }
  async function scan() {
    await run(() => invoke<Scan>("scan_targets"), replace);
  }
  async function browse(kind: "firefox" | "profile") {
    await run(
      () => invoke<Choice | null>("pick_target", { kind }),
      (choice) => {
        if (!choice) return;
        if (kind === "firefox") {
          data.programs = [...data.programs, choice];
          firefox = choice.available ? choice.token : "";
        } else {
          data.profiles = [...data.profiles, choice];
          profile = choice.available ? choice.token : "";
        }
        if (!choice.available) error = "UNREGISTERED_PROFILE";
      },
    );
  }
  function useSaved(item: SavedChoice) {
    if (busy || !item.firefox.available || !item.profile.available) return;
    if (!data.programs.some((p) => p.token === item.firefox.token))
      data.programs = [...data.programs, item.firefox];
    if (!data.profiles.some((p) => p.token === item.profile.token))
      data.profiles = [...data.profiles, item.profile];
    firefox = item.firefox.token;
    profile = item.profile.token;
    result = "";
  }
  async function save() {
    await run(
      () => invoke<Scan>("save_target", { firefox, profile }),
      (value) => {
        replace(value);
        result = text.success;
      },
    );
  }
  async function forget(id: string) {
    await run(
      () => invoke<Scan>("forget_target", { id }),
      (value) => {
        replace(value);
        result = text.forgotten;
      },
    );
  }
  async function clear() {
    clearOpen = false;
    await run(
      () => invoke<Scan>("clear_targets", { confirmed: true }),
      (value) => {
        replace(value);
        result = text.cleared;
      },
    );
  }
  onMount(() => {
    void invoke<void>("frontend_ready").catch(() => {
      error = "PERMISSION";
    });
    void scan();
    return () => requests.cancel();
  });
</script>

<div class="app">
  <header>
    <div class="brand">
      <span class="mark" aria-hidden="true">F</span> FENNEVIA
      <span class="tag">SETUP</span>
    </div>
    <label class="language"
      >{text.language}<select bind:value={language}
        ><option value="en">English</option><option value="zh-Hant"
          >繁體中文</option
        ></select
      ></label
    >
  </header>
  <main>
    <div class="intro">
      <p class="eyebrow">01 / LOCATIONS</p>
      <h1>{text.title}</h1>
      <p>{text.subtitle}</p>
    </div>
    <div class="workspace">
      <section class="panel" aria-labelledby="locations-title">
        <div class="section-heading">
          <h2 id="locations-title">{text.locations}</h2>
          <button onclick={scan} disabled={busy}
            >{busy ? text.scanning : text.scan}</button
          >
        </div>
        <LocationField
          label={text.firefox}
          choices={data.programs}
          bind:value={firefox}
          {busy}
          {showPaths}
          {text}
          browse={() => browse("firefox")}
        />
        <LocationField
          label={text.profile}
          choices={data.profiles}
          bind:value={profile}
          {busy}
          {showPaths}
          {text}
          browse={() => browse("profile")}
        />
        <label class="checkbox"
          ><input type="checkbox" bind:checked={showPaths} />{text.paths}</label
        >
        <div class="save">
          <button
            class="primary"
            onclick={save}
            disabled={busy || !firefox || !profile || !!data.savedError}
            >{text.remember}</button
          >
          <p class="hint">{text.rememberHint}</p>
        </div>
      </section>
      <aside class="panel saved" aria-labelledby="saved-title">
        <h2 id="saved-title">{text.saved}</h2>
        {#if data.savedError}<p class="notice">{text.savedError}</p>{/if}
        {#if !data.saved.length}<p class="empty">{text.noSaved}</p>{/if}
        {#each data.saved as item (item.id)}
          <article>
            <strong>{item.firefox.label}</strong>
            <p>
              {item.profile.label}{item.profile.isDefault
                ? ` · ${text.default}`
                : ""}
            </p>
            {#if !item.firefox.available || !item.profile.available}<p
                class="notice"
              >
                {text.unavailable}
              </p>{/if}
            {#if showPaths}<p class="local-path">
                {item.firefox.detail}<br />{item.profile.detail}
              </p>{/if}
            <div class="actions">
              <button
                onclick={() => useSaved(item)}
                disabled={busy ||
                  !item.firefox.available ||
                  !item.profile.available}>{text.use}</button
              ><button
                class="quiet"
                onclick={() => forget(item.id)}
                disabled={busy}>{text.forget}</button
              >
            </div>
          </article>
        {/each}
        {#if data.saved.length || data.savedError}<button
            class="quiet clear"
            onclick={() => (clearOpen = true)}
            disabled={busy}>{text.clear}</button
          >{/if}
        {#if clearOpen}<div class="confirm">
            <p>{text.clearConfirm}</p>
            <button onclick={clear}>{text.clear}</button><button
              onclick={() => (clearOpen = false)}
              >{language === "en" ? "Cancel" : "取消"}</button
            >
          </div>{/if}
      </aside>
    </div>
    <div class="status" role="status" aria-live="polite">
      {busy ? text.scanning : result}
    </div>
    {#if error}<p role="alert" class="error">
        {text.errorDetails[error] ?? text.error} · {error}
      </p>{/if}
    {#if data.warnings.length}<p class="notice">
        {text.warning}
        {data.warnings.join(" · ")}
      </p>{/if}
    <ReviewPanel
      {firefox}
      {profile}
      {language}
      isDefault={data.profiles.some((p) => p.token === profile && p.isDefault)}
      parentBusy={busy}
      onApplying={(value) => (busy = value)}
    />
    <section class="development">
      <strong>{text.phase}</strong>
      <p>{text.phaseBody}</p>
    </section>
  </main>
  <footer>{text.footer}</footer>
</div>
