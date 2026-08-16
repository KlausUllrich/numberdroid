export type PointerPoint = { x: number; y: number };

export const WORKBENCH_TAP_SLOP_PX = 8;

export function pointerExceededTapSlop(
  start: PointerPoint,
  current: PointerPoint,
  slopPx = WORKBENCH_TAP_SLOP_PX,
) {
  return Math.hypot(current.x - start.x, current.y - start.y) > slopPx;
}

export function shouldCommitWorkbenchTap(input: {
  moved: boolean;
  multiPointerGesture: boolean;
}) {
  return !input.moved && !input.multiPointerGesture;
}
