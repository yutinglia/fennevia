<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import {
    createDefaultToolbarStyle,
    toolbarStyleBounds,
    toolbarStyleDensities,
    type ToolbarStyleSnapshot,
  } from "../../../app/toolbar-widgets-state";
  import {
    translate,
    type MessageKey,
    type MessageVars,
  } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";

  type Props = Readonly<{
    localeId: FenneviaLocale;
    onSetStyle: (style: Readonly<Partial<ToolbarStyleSnapshot>>) => void;
    style: ToolbarStyleSnapshot;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(props.localeId, key, vars);
  const densityLabel = (density: string): string =>
    translate(props.localeId, ("customize.density." + density) as MessageKey);

  const motionPresets: readonly number[] = [0, 120, 180, 280];
  const defaultStyle = createDefaultToolbarStyle();
  let autoHideDelay = $state(defaultStyle.autoHideDelay);
  let edgeTriggerSize = $state(defaultStyle.edgeTriggerSize);
  let shortcutHintDuration = $state(defaultStyle.shortcutHintDuration);
  let temporaryRevealDuration = $state(defaultStyle.temporaryRevealDuration);
  let windowLeaveHideDelay = $state(defaultStyle.windowLeaveHideDelay);

  $effect(() => {
    autoHideDelay = props.style.autoHideDelay;
    edgeTriggerSize = props.style.edgeTriggerSize;
    shortcutHintDuration = props.style.shortcutHintDuration;
    temporaryRevealDuration = props.style.temporaryRevealDuration;
    windowLeaveHideDelay = props.style.windowLeaveHideDelay;
  });

  const setStyle = (style: Readonly<Partial<ToolbarStyleSnapshot>>) =>
    props.onSetStyle(style);
</script>

<section
  aria-label={t("customize.interaction")}
  class="fennevia-customize__section"
>
  <h3 class="fennevia-customize__heading">{t("customize.interaction")}</h3>
  <p class="fennevia-customize__note">{t("customize.interactionHelp")}</p>

  <div class="fennevia-customize__interaction-grid">
    <label
      class="fennevia-customize__interaction-field"
      for="fennevia-customize-auto-hide-delay"
    >
      <span class="fennevia-customize__interaction-label"
        >{t("customize.autoHideDelay")}</span
      >
      <output
        class="fennevia-customize__interaction-value"
        for="fennevia-customize-auto-hide-delay">{autoHideDelay} ms</output
      >
    </label>
    <input
      aria-describedby="fennevia-customize-auto-hide-delay-help"
      bind:value={autoHideDelay}
      class="fennevia-customize__range"
      data-fennevia-customize-auto-hide-delay=""
      id="fennevia-customize-auto-hide-delay"
      max={toolbarStyleBounds.autoHideDelay.max}
      min={toolbarStyleBounds.autoHideDelay.min}
      onchange={() => setStyle({ autoHideDelay })}
      step="20"
      type="range"
    />
    <small
      class="fennevia-customize__interaction-help"
      id="fennevia-customize-auto-hide-delay-help"
      >{t("customize.autoHideDelayHelp")}</small
    >

    <label
      class="fennevia-customize__interaction-field"
      for="fennevia-customize-window-leave-hide-delay"
    >
      <span class="fennevia-customize__interaction-label"
        >{t("customize.windowLeaveHideDelay")}</span
      >
      <output
        class="fennevia-customize__interaction-value"
        for="fennevia-customize-window-leave-hide-delay"
        >{windowLeaveHideDelay} ms</output
      >
    </label>
    <input
      aria-describedby="fennevia-customize-window-leave-hide-delay-help"
      bind:value={windowLeaveHideDelay}
      class="fennevia-customize__range"
      data-fennevia-customize-window-leave-hide-delay=""
      id="fennevia-customize-window-leave-hide-delay"
      max={toolbarStyleBounds.windowLeaveHideDelay.max}
      min={toolbarStyleBounds.windowLeaveHideDelay.min}
      onchange={() => setStyle({ windowLeaveHideDelay })}
      step="20"
      type="range"
    />
    <small
      class="fennevia-customize__interaction-help"
      id="fennevia-customize-window-leave-hide-delay-help"
      >{t("customize.windowLeaveHideDelayHelp")}</small
    >

    <label
      class="fennevia-customize__interaction-field"
      for="fennevia-customize-temporary-reveal-duration"
    >
      <span class="fennevia-customize__interaction-label"
        >{t("customize.temporaryRevealDuration")}</span
      >
      <output
        class="fennevia-customize__interaction-value"
        for="fennevia-customize-temporary-reveal-duration"
        >{temporaryRevealDuration} ms</output
      >
    </label>
    <input
      aria-describedby="fennevia-customize-temporary-reveal-duration-help"
      bind:value={temporaryRevealDuration}
      class="fennevia-customize__range"
      data-fennevia-customize-temporary-reveal-duration=""
      id="fennevia-customize-temporary-reveal-duration"
      max={toolbarStyleBounds.temporaryRevealDuration.max}
      min={toolbarStyleBounds.temporaryRevealDuration.min}
      onchange={() => setStyle({ temporaryRevealDuration })}
      step="100"
      type="range"
    />
    <small
      class="fennevia-customize__interaction-help"
      id="fennevia-customize-temporary-reveal-duration-help"
      >{t("customize.temporaryRevealDurationHelp")}</small
    >

    <label
      class="fennevia-customize__interaction-field"
      for="fennevia-customize-shortcut-hint-duration"
    >
      <span class="fennevia-customize__interaction-label"
        >{t("customize.shortcutHintDuration")}</span
      >
      <output
        class="fennevia-customize__interaction-value"
        for="fennevia-customize-shortcut-hint-duration"
        >{shortcutHintDuration === 0
          ? t("customize.shortcutHintOff")
          : `${shortcutHintDuration} ms`}</output
      >
    </label>
    <input
      aria-describedby="fennevia-customize-shortcut-hint-duration-help"
      bind:value={shortcutHintDuration}
      class="fennevia-customize__range"
      data-fennevia-customize-shortcut-hint-duration=""
      id="fennevia-customize-shortcut-hint-duration"
      max={toolbarStyleBounds.shortcutHintDuration.max}
      min={toolbarStyleBounds.shortcutHintDuration.min}
      onchange={() => setStyle({ shortcutHintDuration })}
      step="100"
      type="range"
    />
    <small
      class="fennevia-customize__interaction-help"
      id="fennevia-customize-shortcut-hint-duration-help"
      >{t("customize.shortcutHintDurationHelp")}</small
    >

    <label
      class="fennevia-customize__interaction-field"
      for="fennevia-customize-edge-trigger-size"
    >
      <span class="fennevia-customize__interaction-label"
        >{t("customize.edgeTriggerSize")}</span
      >
      <output
        class="fennevia-customize__interaction-value"
        for="fennevia-customize-edge-trigger-size">{edgeTriggerSize} px</output
      >
    </label>
    <input
      aria-describedby="fennevia-customize-edge-trigger-size-help"
      bind:value={edgeTriggerSize}
      class="fennevia-customize__range"
      data-fennevia-customize-edge-trigger-size=""
      id="fennevia-customize-edge-trigger-size"
      max={toolbarStyleBounds.edgeTriggerSize.max}
      min={toolbarStyleBounds.edgeTriggerSize.min}
      onchange={() => setStyle({ edgeTriggerSize })}
      step="1"
      type="range"
    />
    <small
      class="fennevia-customize__interaction-help"
      id="fennevia-customize-edge-trigger-size-help"
      >{t("customize.edgeTriggerSizeHelp")}</small
    >
  </div>

  <div
    aria-label={t("customize.density")}
    class="fennevia-customize__style-row"
    role="group"
  >
    <span class="fennevia-customize__style-label">{t("customize.density")}</span
    >
    {#each toolbarStyleDensities as density (density)}
      <button
        aria-pressed={props.style.density === density}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-density={density}
        onclick={() => setStyle({ density })}
        type="button">{densityLabel(density)}</button
      >
    {/each}
  </div>

  <div
    aria-label={t("customize.styleMotion")}
    class="fennevia-customize__style-row"
    role="group"
  >
    <span class="fennevia-customize__style-label"
      >{t("customize.labelMotion")}</span
    >
    {#each motionPresets as motion (motion)}
      <button
        aria-pressed={props.style.motion === motion}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-motion={motion}
        onclick={() => setStyle({ motion })}
        type="button">{motion}ms</button
      >
    {/each}
  </div>
</section>
