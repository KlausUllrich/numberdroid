// Pure timing shared by browser previews and semantic consumers.
export function clipVisits(clip) {
  const forward = clip.frames.map((_, i) => i);
  return clip.playbackMode === 'pingpong' && forward.length > 2
    ? [...forward, ...forward.slice(1, -1).reverse()] : forward;
}
export function clipFrameDuration(clip, frameIndex) { return clip.frames[frameIndex].durationMs ?? 1000 / clip.fps; }
export function clipCycleDuration(clip) { return clipVisits(clip).reduce((sum, index) => sum + clipFrameDuration(clip, index), 0); }
export function clipFrameAtTime(clip, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('Playback time must be finite and nonnegative.');
  const visits = clipVisits(clip), durationMs = clipCycleDuration(clip);
  const completed = clip.playbackMode === 'once' && elapsedMs >= durationMs;
  let remaining = completed ? durationMs : clip.playbackMode === 'once' ? elapsedMs : elapsedMs % durationMs;
  if (completed) return { frameIndex: visits.at(-1), visitIndex: visits.length - 1, frameElapsedMs: clipFrameDuration(clip, visits.at(-1)), durationMs, completed: true };
  for (let visitIndex = 0; visitIndex < visits.length; visitIndex += 1) {
    const frameIndex = visits[visitIndex], frameDuration = clipFrameDuration(clip, frameIndex);
    if (remaining < frameDuration || visitIndex === visits.length - 1) return { frameIndex, visitIndex, frameElapsedMs: remaining, durationMs, completed: false };
    remaining -= frameDuration;
  }
}
export function clipTimeForFrame(clip, frameIndex) {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= clip.frames.length) throw new RangeError('Choose an authored frame.');
  return clip.frames.slice(0, frameIndex).reduce((sum, _, index) => sum + clipFrameDuration(clip, index), 0);
}
