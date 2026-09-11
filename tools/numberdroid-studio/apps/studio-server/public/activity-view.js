import { libraryElement as el } from './library-detail-view.js';

const text = value => value === undefined || value === null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
const time = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Time not recorded' : date.toLocaleString(); };

/** Preserve the immutable event; presentation is an exact-history owner read projection. */
export function renderActivityRows({ events = [], onInspect = () => {} }) {
  const list = el('div', 'activity-rows'); list.dataset.activityRows = '';
  if (!events.length) { list.append(el('p', 'activity-empty', 'No saved activity yet. Decisions and saved work will appear here.')); return list; }
  const ordered = events.map((event, index) => ({ event, index })).sort((a, b) => {
    const at = new Date(a.event.occurredAt).getTime(), bt = new Date(b.event.occurredAt).getTime();
    return (Number.isFinite(at) && Number.isFinite(bt) && bt - at) || (b.event.revision ?? 0) - (a.event.revision ?? 0) || b.index - a.index;
  });
  for (const { event } of ordered) {
    const p = event.presentation ?? {}, failed = p.severity === 'warning' || p.outcome === 'failed' || p.outcome === 'FAILED' || /failed|rejected/i.test(event.summary ?? '');
    const row = el('article', `activity-row${failed ? ' failed' : ''}`); row.dataset.activityEvent = event.id ?? event.eventId ?? '';
    const icon = el('span', 'activity-icon', failed ? '!' : /accept/i.test(p.title ?? '') ? '✓' : '•'); icon.setAttribute('aria-hidden', 'true');
    const content = el('div', 'activity-content');
    content.append(el('h3', '', p.title || 'Recorded project activity'), el('small', 'activity-meta', [p.actorLabel || event.actor?.displayName || event.actor?.id || 'Actor not recorded', time(event.occurredAt), p.outcome].filter(Boolean).join(' · ')));
    content.append(el('p', '', p.summary || event.summary || 'This older event has no descriptive summary. Its original technical record is preserved below.'));
    if (p.feedback) { const feedback = el('blockquote', 'activity-feedback', p.feedback.summary ?? ''); for (const item of p.feedback.itemComments ?? []) feedback.append(el('p', '', `${item.name || 'Content item'}: ${item.comment ?? item.text ?? ''}`)); content.append(feedback); }
    const details = el('details', 'activity-technical'); details.dataset.activityDisclosure = String(event.id ?? event.eventId ?? 'event'); details.append(el('summary', '', 'Technical details'));
    const facts = el('dl');
    for (const [key, value] of Object.entries({ Command: event.commandType, 'Project revision': event.revision, Event: event.id ?? event.eventId, Actor: event.actor?.id, Task: event.taskId, ...(p.technical ?? {}) })) if (value !== undefined && value !== null && value !== '') facts.append(el('dt', '', key), el('dd', '', text(value)));
    details.append(facts); content.append(details);
    const actions = el('div', 'activity-actions');
    if (p.inspect) { const inspect = el('button', 'secondary', 'Inspect event →'); inspect.type = 'button'; inspect.dataset.activityInspect = String(event.id ?? event.eventId ?? ''); inspect.addEventListener('click', () => onInspect(event, { current: false })); actions.append(inspect); }
    if (p.currentReview) { const current = el('button', 'secondary', 'Open current review →'); current.type = 'button'; current.dataset.activityCurrentReview = p.currentReview.reviewId; current.addEventListener('click', () => onInspect(event, { current: true })); actions.append(current); }
    row.append(icon, content, actions); list.append(row);
  }
  return list;
}
