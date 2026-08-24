export class StudioError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'StudioError';
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

export function invariant(condition, code, message, details = {}) {
  if (!condition) {
    throw new StudioError(code, message, details);
  }
}

export function asStudioError(error) {
  if (error instanceof StudioError) {
    return error;
  }

  return new StudioError('INTERNAL_ERROR', 'Unexpected Studio error.', {
    cause: error instanceof Error ? error.message : String(error),
  });
}
