<script lang="ts">
  import type { ProgressLightPresentation } from "../app/progress-light";

  type Props = Readonly<{
    presentation: ProgressLightPresentation;
  }>;

  const props: Props = $props();
</script>

<div
  aria-hidden="true"
  class="fennevia-progress-light"
  data-fennevia-progress-light={props.presentation.kind}
  data-fennevia-progress-mode={props.presentation.mode}
  data-fennevia-progress-visible={props.presentation.mode !== "idle"}
>
  <span
    class="fennevia-progress-light__beam"
    style:--fennevia-progress-light-percent={props.presentation.mode ===
      "determinate" && props.presentation.percent !== null
      ? `${props.presentation.percent}%`
      : undefined}
  ></span>
</div>
