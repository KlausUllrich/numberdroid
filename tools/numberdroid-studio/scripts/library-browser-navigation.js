/** Shared production navigation used by existing editor regression captures. */
export const libraryDetailsSelector = (kind, assetId) => `[data-library-action="details"][data-library-kind="${kind}"][data-library-asset-id="${assetId}"]`;
export const libraryReviewSelector = (kind, proposalId) => `[data-library-action="review"][data-library-kind="${kind}"][data-library-proposal-id="${proposalId}"]`;

export function libraryNavigation({ evaluate, click, waitFor }) {
  const present = selector => `Boolean(document.querySelector(${JSON.stringify(selector)}))`;
  async function assets() {
    // Editor callers first use their existing Back action; only Library routes
    // are unwound here, preserving each controller's existing leave guard.
    for (let count = 0; count < 4 && await evaluate(present('[data-library-action="back"]')); count += 1) {
      await click('[data-library-action="back"]');
    }
    await waitFor(present('[data-library-action="tab"][data-library-tab="assets"]'), 'Library Assets tab');
    await click('[data-library-action="tab"][data-library-tab="assets"]');
  }
  async function details(kind, assetId) {
    const selector = libraryDetailsSelector(kind, assetId);
    await waitFor(present(selector), `Saved ${kind} Library card`);
    await click(selector);
    await waitFor(present('[data-library-detail]'), `Exact ${kind} detail`);
    await waitFor(present('[data-library-detail] [data-library-action="edit"]:not(:disabled)'), `Resolved saved ${kind} editor entrance`);
  }
  async function review(kind, proposalId) {
    await click('[data-library-action="tab"][data-library-tab="pending"]');
    const selector = libraryReviewSelector(kind, proposalId);
    await waitFor(present(selector), `Pending ${kind} review entry`);
    await click(selector);
  }
  return { assets, details, review };
}
