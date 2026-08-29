import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  PROCESSING_RESULT_ADOPTION_READ_FACTS_KIND,
  PROCESSING_RESULT_ADOPTION_READER_KIND,
  ProcessingResultAdoptionReadService,
} from '../packages/application/src/index.js';
import { StudioError } from '../packages/domain/src/errors.js';

const PROJECT_ID = 'project.read-boundary';
const TASK_ID = 'task.read-boundary';

function facts(adoptions = []) {
  return {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_READ_FACTS_KIND,
    projectId: PROJECT_ID,
    taskId: TASK_ID,
    adoptions,
  };
}

function reader({
  readTaskAdoptions = async () => facts(),
  withSelectedOutput = async () => {
    throw new StudioError(
      'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
      'The exact processed image preview is unavailable.',
    );
  },
} = {}) {
  return {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_READER_KIND,
    readTaskAdoptions,
    withSelectedOutput,
  };
}

function selection(branchRevision = null) {
  return {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    taskId: TASK_ID,
    ...(branchRevision === null ? {} : { branchRevision }),
  };
}

test('processing-result adoption read rejects sparse, accessor, extra-key, and proxy arrays without traps', async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = [];
  Object.defineProperty(accessor, '0', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return null;
    },
  });
  const extra = [];
  extra.extra = true;
  const proxied = new Proxy([], {
    ownKeys() {
      proxyCalls += 1;
      return ['length'];
    },
  });
  for (const adoptions of [new Array(1), accessor, extra, proxied]) {
    const service = new ProcessingResultAdoptionReadService({
      reader: reader({ readTaskAdoptions: async () => facts(adoptions) }),
    });
    await assert.rejects(
      service.readTaskAdoptions(selection()),
      (error) => error.code === 'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE'
        && error.message === 'Processed asset details are unavailable for this task.',
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test('processing-result adoption read never assimilates hostile thenables or Promise subclasses', async () => {
  let thenCalls = 0;
  const hostileThenable = {
    get then() {
      thenCalls += 1;
      throw new Error('then must not be inspected');
    },
  };
  class PromiseSubclass extends Promise {}
  for (const result of [
    hostileThenable,
    new PromiseSubclass((resolve) => resolve(facts())),
  ]) {
    const service = new ProcessingResultAdoptionReadService({
      reader: reader({ readTaskAdoptions: () => result }),
    });
    await assert.rejects(
      service.readTaskAdoptions(selection()),
      (error) => error.code === 'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE',
    );
  }
  assert.equal(thenCalls, 0);

  const lateValue = facts();
  const alreadyFulfilled = Promise.resolve(lateValue);
  queueMicrotask(() => Object.defineProperty(lateValue, 'then', {
    configurable: true,
    get() {
      thenCalls += 1;
      throw new Error('late then must not be inspected');
    },
  }));
  const lateService = new ProcessingResultAdoptionReadService({
    reader: reader({ readTaskAdoptions: () => alreadyFulfilled }),
  });
  await assert.rejects(
    lateService.readTaskAdoptions(selection()),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE',
  );
  assert.equal(thenCalls, 0);
});

test('processing-result adoption read rewrites expected and hostile port failures to fixed safe copy', async () => {
  const leaked = '/private/cas/0123456789abcdef secret-token';
  const taskService = new ProcessingResultAdoptionReadService({
    reader: reader({
      readTaskAdoptions: async () => {
        throw new StudioError('TASK_NOT_FOUND', leaked);
      },
    }),
  });
  await assert.rejects(
    taskService.readTaskAdoptions(selection()),
    (error) => error.code === 'TASK_NOT_FOUND'
      && error.message === 'The agent task does not exist.'
      && !error.message.includes(leaked),
  );

  const previewService = new ProcessingResultAdoptionReadService({
    reader: reader({
      withSelectedOutput: async () => {
        throw new StudioError('PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE', leaked);
      },
    }),
  });
  await assert.rejects(
    previewService.withSelectedOutput(selection(2), async () => null),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE'
      && error.message === 'The exact processed image preview is unavailable.'
      && !error.message.includes(leaked),
  );

  let proxyCalls = 0;
  const hostileError = new Proxy({}, {
    get() {
      proxyCalls += 1;
      throw new Error('error trap must not run');
    },
    getOwnPropertyDescriptor() {
      proxyCalls += 1;
      throw new Error('descriptor trap must not run');
    },
    getPrototypeOf() {
      proxyCalls += 1;
      throw new Error('prototype trap must not run');
    },
  });
  const hostileService = new ProcessingResultAdoptionReadService({
    reader: reader({ readTaskAdoptions: async () => { throw hostileError; } }),
  });
  await assert.rejects(
    hostileService.readTaskAdoptions(selection()),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE',
  );
  assert.equal(proxyCalls, 0);

  const abortError = new DOMException('The read was aborted.', 'AbortError');
  const abortService = new ProcessingResultAdoptionReadService({
    reader: reader({ readTaskAdoptions: async () => { throw abortError; } }),
  });
  await assert.rejects(
    abortService.readTaskAdoptions(selection()),
    (error) => error === abortError,
  );

  let nameGetterCalls = 0;
  const accessorAbortError = new DOMException('private abort reason', 'AbortError');
  Object.defineProperty(accessorAbortError, 'name', {
    get() {
      nameGetterCalls += 1;
      throw new Error('abort name getter must not run');
    },
  });
  const accessorAbortService = new ProcessingResultAdoptionReadService({
    reader: reader({ readTaskAdoptions: async () => { throw accessorAbortError; } }),
  });
  await assert.rejects(
    accessorAbortService.readTaskAdoptions(selection()),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE'
      && error.message === 'Processed asset details are unavailable for this task.',
  );
  assert.equal(nameGetterCalls, 0);
});

test('processing-result adoption preview rejects proxy prototype chains without traps', async () => {
  let prototypeTrapCalls = 0;
  const hostilePrototype = new Proxy(Readable.prototype, {
    getPrototypeOf() {
      prototypeTrapCalls += 1;
      throw new Error('readable prototype trap must not run');
    },
  });
  const hostileReadable = Object.create(hostilePrototype);
  const service = new ProcessingResultAdoptionReadService({
    reader: reader({
      withSelectedOutput: async (_selection, operation) => operation({
        schemaVersion: 1,
        mediaType: 'image/png',
        byteSize: 1,
        width: 1,
        height: 1,
        readable: hostileReadable,
      }),
    }),
  });
  await assert.rejects(
    service.withSelectedOutput(selection(2), async () => null),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
  );
  assert.equal(prototypeTrapCalls, 0);
});

test('processing-result adoption preview invokes the selected-output operation exactly once', async () => {
  const descriptor = {
    schemaVersion: 1,
    mediaType: 'image/png',
    byteSize: 1,
    width: 1,
    height: 1,
    readable: Readable.from([Buffer.from([0])]),
  };
  const service = new ProcessingResultAdoptionReadService({
    reader: reader({
      withSelectedOutput: async (_selection, operation) => {
        const marker = await operation(descriptor);
        try {
          await operation(descriptor);
        } catch {
          // A hostile reader cannot make the protected callback execute twice
          // by swallowing the exact-port rejection.
        }
        return marker;
      },
    }),
  });
  let operationCalls = 0;
  await assert.rejects(
    service.withSelectedOutput(selection(2), async () => {
      operationCalls += 1;
      return operationCalls;
    }),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
  );
  assert.equal(operationCalls, 1);
});

test('processing-result adoption read accepts only an unmodified AbortSignal and deeply freezes empty facts', async () => {
  const service = new ProcessingResultAdoptionReadService({ reader: reader() });
  const controller = new AbortController();
  const result = await service.readTaskAdoptions(selection(), { signal: controller.signal });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.adoptions));

  let getterCalls = 0;
  const fakeSignal = {};
  Object.defineProperty(fakeSignal, 'throwIfAborted', {
    get() {
      getterCalls += 1;
      throw new Error('fake signal getter must not run');
    },
  });
  await assert.rejects(
    service.readTaskAdoptions(selection(), { signal: fakeSignal }),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
  );
  assert.equal(getterCalls, 0);

  await assert.rejects(
    service.readTaskAdoptions(selection(), {
      signal: Object.create(AbortSignal.prototype),
    }),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID'
      && error.message === 'The processing-result adoption read signal must be a native AbortSignal.',
  );

  let proxyCalls = 0;
  const options = new Proxy({}, {
    getOwnPropertyDescriptor() {
      proxyCalls += 1;
      throw new Error('options trap must not run');
    },
  });
  await assert.rejects(
    service.readTaskAdoptions(selection(), options),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
  );
  assert.equal(proxyCalls, 0);
});
