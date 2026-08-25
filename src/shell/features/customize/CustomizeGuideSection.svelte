<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";

  type Props = Readonly<{
    localeId: FenneviaLocale;
  }>;

  type GuideDefinition = Readonly<{
    description: MessageKey;
    label: MessageKey;
  }>;

  type GuideFeaturePair = Readonly<{
    companion: MessageKey;
    feature: MessageKey;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey): string => translate(props.localeId, key);
  const joinGuideLabels = (...keys: readonly MessageKey[]): string =>
    keys.map((key) => t(key)).join(" · ");

  const guideDefinitions: readonly GuideDefinition[] = Object.freeze([
    { description: "customize.guide.rowDescription", label: "widget.row" },
    {
      description: "customize.guide.columnDescription",
      label: "widget.column",
    },
    {
      description: "customize.guide.expandedDescription",
      label: "widget.expanded",
    },
    {
      description: "customize.guide.centerDescription",
      label: "widget.center",
    },
    {
      description: "customize.guide.paddingDescription",
      label: "widget.padding",
    },
    {
      description: "customize.guide.flexibleSpaceDescription",
      label: "widget.flexibleSpace",
    },
    {
      description: "customize.guide.spaceDescription",
      label: "widget.space",
    },
    {
      description: "customize.guide.separatorDescription",
      label: "widget.separator",
    },
  ]);

  const guideFeaturePairs: readonly GuideFeaturePair[] = Object.freeze([
    { companion: "widget.trust", feature: "widget.addressLauncher" },
    { companion: "tab.newTab", feature: "widget.tabs" },
    { companion: "widget.showBookmarks", feature: "surface.bookmarks" },
    {
      companion: "widget.showDownloads",
      feature: "widget.downloadStatus",
    },
  ]);
</script>

<div class="fennevia-customize__guide" data-fennevia-customize-guide="">
  <section
    aria-labelledby="fennevia-customize-guide-title"
    class="fennevia-customize__guide-hero"
  >
    <p class="fennevia-customize__guide-kicker">
      {t("customize.guide.kicker")}
    </p>
    <h3
      class="fennevia-customize__guide-title"
      id="fennevia-customize-guide-title"
    >
      {t("customize.guide.title")}
    </h3>
    <p>{t("customize.guide.intro")}</p>
  </section>

  <section aria-labelledby="fennevia-customize-guide-companions">
    <h3 id="fennevia-customize-guide-companions">
      {t("customize.guide.companionsTitle")}
    </h3>
    <p>{t("customize.guide.companionsDescription")}</p>
    <ul class="fennevia-customize__guide-pairs">
      {#each guideFeaturePairs as pair (pair.feature)}
        <li>
          <strong>{t(pair.feature)}</strong>
          <span aria-hidden="true">+</span>
          <span>{t(pair.companion)}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="fennevia-customize-guide-edges">
    <h3 id="fennevia-customize-guide-edges">
      {t("customize.guide.edgesTitle")}
    </h3>
    <p>{t("customize.guide.edgesIntro")}</p>
    <div class="fennevia-customize__guide-edge-map">
      <article class="fennevia-customize__guide-card">
        <h4>{t("customize.guide.horizontalEdges")}</h4>
        <p>{t("customize.guide.horizontalEdgesDescription")}</p>
      </article>
      <article class="fennevia-customize__guide-card">
        <h4>{t("customize.guide.verticalEdges")}</h4>
        <p>{t("customize.guide.verticalEdgesDescription")}</p>
      </article>
    </div>
  </section>

  <section aria-labelledby="fennevia-customize-guide-recipes">
    <h3 id="fennevia-customize-guide-recipes">
      {t("customize.guide.recipesTitle")}
    </h3>
    <p>{t("customize.guide.recipesIntro")}</p>
    <div class="fennevia-customize__guide-recipes">
      <article class="fennevia-customize__guide-recipe">
        <h4>{t("customize.guide.topRecipeTitle")}</h4>
        <div
          aria-label={t("customize.guide.topRecipeAria")}
          class="fennevia-customize__guide-diagram fennevia-customize__guide-diagram--row"
          role="img"
        >
          <span aria-hidden="true">{t("customize.guide.controls")}</span>
          <span aria-hidden="true" data-fennevia-guide-expanded="">
            {t("widget.expanded")} · {t("widget.addressLauncher")}
          </span>
          <span aria-hidden="true">{t("customize.guide.tools")}</span>
        </div>
        <p>{t("customize.guide.topRecipeDescription")}</p>
      </article>

      <article class="fennevia-customize__guide-recipe">
        <h4>{t("customize.guide.sideRecipeTitle")}</h4>
        <div
          aria-label={t("customize.guide.sideRecipeAria")}
          class="fennevia-customize__guide-diagram fennevia-customize__guide-diagram--column"
          role="img"
        >
          <span aria-hidden="true">{t("tab.newTab")}</span>
          <span aria-hidden="true" data-fennevia-guide-expanded="">
            {t("widget.expanded")} · {t("widget.tabs")}
          </span>
        </div>
        <p>{t("customize.guide.sideRecipeDescription")}</p>
      </article>

      <article class="fennevia-customize__guide-recipe">
        <h4>{t("customize.guide.bottomRecipeTitle")}</h4>
        <div
          aria-label={t("customize.guide.bottomRecipeAria")}
          class="fennevia-customize__guide-diagram fennevia-customize__guide-diagram--row"
          role="img"
        >
          <span aria-hidden="true" data-fennevia-guide-expanded="">
            {joinGuideLabels(
              "widget.expanded",
              "widget.center",
              "widget.downloadStatus",
            )}
          </span>
        </div>
        <p>{t("customize.guide.bottomRecipeDescription")}</p>
      </article>
    </div>
  </section>

  <section aria-labelledby="fennevia-customize-guide-layout-widgets">
    <h3 id="fennevia-customize-guide-layout-widgets">
      {t("customize.guide.layoutWidgetsTitle")}
    </h3>
    <p>{t("customize.guide.layoutWidgetsIntro")}</p>
    <dl class="fennevia-customize__guide-definitions">
      {#each guideDefinitions as definition (definition.label)}
        <div>
          <dt>{t(definition.label)}</dt>
          <dd>{t(definition.description)}</dd>
        </div>
      {/each}
    </dl>
  </section>

  <section aria-labelledby="fennevia-customize-guide-editing">
    <h3 id="fennevia-customize-guide-editing">
      {t("customize.guide.editingTitle")}
    </h3>
    <ol class="fennevia-customize__guide-steps">
      <li>{t("customize.guide.editingChoose")}</li>
      <li>{t("customize.guide.editingAdd")}</li>
      <li>{t("customize.guide.editingInspect")}</li>
      <li>{t("customize.guide.editingRecover")}</li>
    </ol>
  </section>
</div>
