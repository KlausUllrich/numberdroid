import { describe, expect, it } from "vitest";
import { pointerExceededTapSlop, shouldCommitWorkbenchTap } from "./workbenchInteraction";

describe("Level Workbench mobile pointer arbitration", () => {
  it("keeps a stationary single pointer eligible for semantic selection", () => {
    expect(pointerExceededTapSlop({ x: 10, y: 20 }, { x: 14, y: 23 })).toBe(false);
    expect(shouldCommitWorkbenchTap({ moved: false, multiPointerGesture: false })).toBe(true);
  });

  it("does not turn pan motion into a selection tap", () => {
    expect(pointerExceededTapSlop({ x: 10, y: 20 }, { x: 19, y: 20 })).toBe(true);
    expect(shouldCommitWorkbenchTap({ moved: true, multiPointerGesture: false })).toBe(false);
  });

  it("never commits a selection after a pinch/multi-pointer gesture", () => {
    expect(shouldCommitWorkbenchTap({ moved: false, multiPointerGesture: true })).toBe(false);
  });
});
