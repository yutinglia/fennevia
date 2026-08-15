export const maximumSmokeInputLength = 80;

export type SmokeAction =
  | Readonly<{ type: "increment" }>
  | Readonly<{ type: "input"; value: string }>
  | Readonly<{ type: "toggle-details" }>;

export type SmokeState = Readonly<{
  count: number;
  detailsVisible: boolean;
  eventCount: number;
  input: string;
}>;

export function createInitialSmokeState(): SmokeState {
  return Object.freeze({
    count: 0,
    detailsVisible: true,
    eventCount: 0,
    input: "",
  });
}

export function reduceSmokeState(
  state: SmokeState,
  action: SmokeAction,
): SmokeState {
  switch (action.type) {
    case "increment":
      return Object.freeze({
        ...state,
        count: state.count + 1,
        eventCount: state.eventCount + 1,
      });
    case "input":
      return Object.freeze({
        ...state,
        eventCount: state.eventCount + 1,
        input: String(action.value).slice(0, maximumSmokeInputLength),
      });
    case "toggle-details":
      return Object.freeze({
        ...state,
        detailsVisible: !state.detailsVisible,
        eventCount: state.eventCount + 1,
      });
  }
}
