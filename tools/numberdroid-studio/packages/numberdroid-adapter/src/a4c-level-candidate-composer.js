import { createHash } from 'node:crypto';
import {
  candidateManifestSha256,
  createTaskCandidateDiff,
  createTaskCandidatePayload,
  createTaskCandidatePreview,
  invariant,
  validateCandidateManifest,
} from '../../domain/src/index.js';
import {
  NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
  NUMBERDROID_ADAPTER_VERSION,
} from './adapter-identity.js';
import {
  NUMBERDROID_LEVEL_AUTHORING_PROJECTION_VERSION,
  createNumberdroidLevelAuthoringProjection,
  validateNumberdroidLevelAuthoringProjection,
  validateNumberdroidLevelSpec,
} from './level-authoring-projection.js';

export const NUMBERDROID_A4C_CANDIDATE_COMPOSER_SCHEMA_VERSION = 1;
export const NUMBERDROID_A4C_CANDIDATE_COMPOSER_KIND = 'numberdroid.a4c-candidate-composer';
export const NUMBERDROID_A4C_REFERENCE_SOURCE_SHA256 = '6acf09035b8c75b56f0557745a973b25bbf4e758294e6a226a06571e0a07f77c';
export const NUMBERDROID_A4C_REFERENCE_PLAN_SHA256 = '21f9e5c1fe5f584176c7429244359ba2693ed0197b26841b43b556481d7b0c6b';
export const NUMBERDROID_A4C_REFERENCE_PROJECTION_SHA256 = '12609f0972c242cece2d751bace8f85f62f66e49f38358d3a87160b273cd8142';
export const NUMBERDROID_A4C_COMPILER_VERSION = 'numberdroid-level-compiler.sha256:01b144303ff217054f01c0dcd85acc3d442a02c1727ad9b01291dcc5c2559ce1';

const EXPECTED_SPEC_ID = 'a4b-key-reference';
const EXPECTED_SPEC_VERSION = 2;
const EXPECTED_GAPS = Object.freeze(['numberdroid.requirement-trace.not-authored']);
const SOURCE_PATH = 'candidate/levels/a4b-key-reference/level-spec.json';
const PLAN_PATH = 'candidate/levels/a4b-key-reference/semantic-plan.json';
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactFields(value, fields, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), 'NUMBERDROID_A4C_COMPOSER_INVALID', `${label} must be an object.`);
  invariant(Object.keys(value).every((field) => fields.includes(field)), 'NUMBERDROID_A4C_COMPOSER_INVALID', `${label} contains an unsupported field.`);
  return value;
}

function output(logicalPath, role, content) {
  return {
    logicalPath,
    mediaType: 'application/json',
    byteSize: Buffer.byteLength(content),
    sha256: sha256(content),
    role,
    content,
  };
}

function outputClosureFingerprint(outputs) {
  return sha256(canonicalJson(outputs.map(({ content: _content, ...descriptor }) => descriptor)));
}

function candidateFindings(projection, validation) {
  const findings = projection.gaps.map((gap) => ({
    severity: 'WARNING',
    ruleId: gap.gapId,
    objectRef: `level-spec:${projection.source.levelSpec.id}`,
    explanation: gap.description,
    remediation: 'Review the retained gap and author immutable requirement trace only under a separate approved source change.',
    validatorVersion: projection.projectionVersion,
  }));
  for (const finding of validation.findings) {
    findings.push({
      severity: finding.severity,
      ruleId: finding.ruleId === 'LEVEL_AUTHORING_TRACE_MISSING'
        ? 'studio.level-authoring.trace-missing'
        : `studio.level-authoring.${finding.ruleId.toLocaleLowerCase('en-US').replaceAll('_', '-')}`,
      objectRef: `${finding.targetKind}:${finding.targetId}`,
      explanation: finding.explanation,
      remediation: finding.remediation,
      validatorVersion: validation.validatorVersion,
    });
  }
  return findings;
}

function previewSteps(levelSpec) {
  const events = new Map(levelSpec.events.map((event) => [event.id, event]));
  return levelSpec.triggers.flatMap((trigger) => trigger.eventIds.map((eventId) => {
    const event = events.get(eventId);
    let targetRef;
    if (event.kind === 'drop-item') targetRef = event.pickupId;
    else if (event.kind === 'set-variable') targetRef = event.variableId;
    else if (event.kind === 'show-text') targetRef = event.textRefId;
    else targetRef = event.id;
    return {
      triggerKind: trigger.kind,
      triggerRef: trigger.id,
      actionKind: event.kind,
      actionRef: event.id,
      targetRef,
    };
  })).map((step, index) => ({ sequence: index + 1, ...step }));
}

function validateExactProjection(projection, compiler) {
  const validated = validateNumberdroidLevelAuthoringProjection(projection, compiler);
  invariant(validated.source.levelSpec.id === EXPECTED_SPEC_ID
    && validated.source.levelSpec.version === EXPECTED_SPEC_VERSION
    && validated.source.sha256 === NUMBERDROID_A4C_REFERENCE_SOURCE_SHA256,
  'NUMBERDROID_A4C_SOURCE_MISMATCH', 'A4c requires the exact A4b reference LevelSpec source.');
  invariant(validated.compiler.compilerVersion === NUMBERDROID_A4C_COMPILER_VERSION
    && validated.compiler.sha256 === NUMBERDROID_A4C_REFERENCE_PLAN_SHA256,
  'NUMBERDROID_A4C_COMPILER_MISMATCH', 'A4c requires the exact pinned Numberdroid compiler closure.');
  invariant(validated.fingerprint === NUMBERDROID_A4C_REFERENCE_PROJECTION_SHA256,
    'NUMBERDROID_A4C_PROJECTION_MISMATCH', 'A4c requires the exact A4b projection closure.');
  invariant(validated.capabilityDelta.target.profileVersion === 3
    && validated.capabilityDelta.target.fingerprint === NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
  'NUMBERDROID_A4C_PROFILE_MISMATCH', 'A4c requires the exact Numberdroid profile-v3 capability closure.');
  invariant(canonicalJson(validated.gaps.map(({ gapId }) => gapId)) === canonicalJson(EXPECTED_GAPS),
    'NUMBERDROID_A4C_GAP_BLOCKED', 'A4c refuses an unexpected projection gap.');
  return validated;
}

export function validateNumberdroidA4cCandidateComposer(value) {
  const composer = exactFields(value, ['schemaVersion', 'kind', 'binding', 'source', 'project', 'compose'], 'composer');
  invariant(composer.schemaVersion === NUMBERDROID_A4C_CANDIDATE_COMPOSER_SCHEMA_VERSION
    && composer.kind === NUMBERDROID_A4C_CANDIDATE_COMPOSER_KIND,
  'NUMBERDROID_A4C_COMPOSER_INVALID', 'Unsupported A4c candidate-composer port.');
  const binding = exactFields(composer.binding, [
    'sourceId', 'sourceVersion', 'sourceSha256', 'compilerVersion', 'planSha256',
    'projectionVersion', 'projectionFingerprint', 'profileId', 'profileVersion',
    'profileFingerprint', 'adapterId', 'adapterVersion', 'outputPaths',
  ], 'composer.binding');
  invariant(binding.sourceId === EXPECTED_SPEC_ID
    && binding.sourceVersion === EXPECTED_SPEC_VERSION
    && binding.sourceSha256 === NUMBERDROID_A4C_REFERENCE_SOURCE_SHA256
    && binding.compilerVersion === NUMBERDROID_A4C_COMPILER_VERSION
    && binding.planSha256 === NUMBERDROID_A4C_REFERENCE_PLAN_SHA256
    && binding.projectionVersion === NUMBERDROID_LEVEL_AUTHORING_PROJECTION_VERSION
    && binding.projectionFingerprint === NUMBERDROID_A4C_REFERENCE_PROJECTION_SHA256
    && binding.profileId === NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileId
    && binding.profileVersion === 3
    && binding.profileFingerprint === NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT
    && binding.adapterId === 'numberdroid'
    && binding.adapterVersion === NUMBERDROID_ADAPTER_VERSION
    && canonicalJson(binding.outputPaths) === canonicalJson([PLAN_PATH, SOURCE_PATH].sort()),
  'NUMBERDROID_A4C_COMPOSER_INVALID', 'The A4c composer binding is not the exact approved closure.');
  invariant(typeof composer.source === 'function' && typeof composer.project === 'function' && typeof composer.compose === 'function',
    'NUMBERDROID_A4C_COMPOSER_INVALID', 'The A4c composer must expose source, project, and compose functions.');
  return Object.freeze({
    schemaVersion: composer.schemaVersion,
    kind: composer.kind,
    binding: deepFreeze(structuredClone(binding)),
    source: (...args) => composer.source(...args),
    project: (...args) => composer.project(...args),
    compose: (...args) => composer.compose(...args),
  });
}

export function createNumberdroidA4cCandidateComposer({ levelSpec, compiler }) {
  const source = validateNumberdroidLevelSpec(levelSpec);
  invariant(source.id === EXPECTED_SPEC_ID && source.version === EXPECTED_SPEC_VERSION
    && sha256(canonicalJson(source)) === NUMBERDROID_A4C_REFERENCE_SOURCE_SHA256,
  'NUMBERDROID_A4C_SOURCE_MISMATCH', 'The configured A4c source is not the exact A4b reference LevelSpec.');
  invariant(compiler?.compilerVersion === NUMBERDROID_A4C_COMPILER_VERSION,
    'NUMBERDROID_A4C_COMPILER_MISMATCH', 'The configured compiler port is not the approved Numberdroid compiler pin.');
  const binding = deepFreeze({
    sourceId: EXPECTED_SPEC_ID,
    sourceVersion: EXPECTED_SPEC_VERSION,
    sourceSha256: NUMBERDROID_A4C_REFERENCE_SOURCE_SHA256,
    compilerVersion: NUMBERDROID_A4C_COMPILER_VERSION,
    planSha256: NUMBERDROID_A4C_REFERENCE_PLAN_SHA256,
    projectionVersion: NUMBERDROID_LEVEL_AUTHORING_PROJECTION_VERSION,
    projectionFingerprint: NUMBERDROID_A4C_REFERENCE_PROJECTION_SHA256,
    profileId: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileId,
    profileVersion: 3,
    profileFingerprint: NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
    adapterId: 'numberdroid',
    adapterVersion: NUMBERDROID_ADAPTER_VERSION,
    outputPaths: [PLAN_PATH, SOURCE_PATH].sort(),
  });

  const composer = {
    schemaVersion: NUMBERDROID_A4C_CANDIDATE_COMPOSER_SCHEMA_VERSION,
    kind: NUMBERDROID_A4C_CANDIDATE_COMPOSER_KIND,
    binding,
    source() {
      const content = canonicalJson(source);
      return deepFreeze({
        schemaVersion: 1,
        kind: 'numberdroid.a4c-level-candidate-source',
        sourceId: source.id,
        sourceVersion: source.version,
        logicalPath: SOURCE_PATH,
        mediaType: 'application/json',
        byteSize: Buffer.byteLength(content),
        sha256: sha256(content),
        content,
      });
    },
    project() {
      return validateExactProjection(createNumberdroidLevelAuthoringProjection({ levelSpec: source, compiler }), compiler);
    },
    compose({ projection: rawProjection, validation, projectId, taskId, branchId, baseRevision, branchHeadRevision }) {
      const projection = validateExactProjection(rawProjection, compiler);
      invariant(validation?.status === 'VALID'
        && validation.fingerprints?.requirementSet === projection.a3a.requirementSetFingerprint
        && validation.fingerprints?.levelGraph === projection.a3a.levelGraphFingerprint
        && validation.fingerprints?.logicGraph === projection.a3a.logicGraphFingerprint
        && validation.fingerprints?.capabilityManifest === NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT
        && !validation.findings?.some(({ severity }) => severity === 'ERROR')
        && typeof validation.fingerprint === 'string' && HASH_PATTERN.test(validation.fingerprint),
      'NUMBERDROID_A4C_VALIDATION_BLOCKED', 'A4c requires one valid A3a validation closure for the projected source.');
      const outputs = [
        output(SOURCE_PATH, 'level-source', projection.source.canonicalJson),
        output(PLAN_PATH, 'compiled-plan', projection.compiler.canonicalJson),
      ].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
      const outputClosure = outputClosureFingerprint(outputs);
      const manifest = validateCandidateManifest({
        schemaVersion: 1,
        kind: 'studio.candidate-manifest',
        status: 'VERIFIED',
        project: { projectId, revision: branchHeadRevision },
        snapshot: { snapshotId: projection.fingerprint },
        capabilityProfile: {
          profileId: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileId,
          profileVersion: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileVersion,
          fingerprint: NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
        },
        adapter: { id: 'numberdroid', version: NUMBERDROID_ADAPTER_VERSION, candidateHash: outputClosure },
        compiler: {
          id: 'numberdroid.level-compiler',
          version: projection.compiler.compilerVersion,
          status: 'SUCCEEDED',
          evidenceHash: projection.compiler.sha256,
        },
        semanticRevisions: [
          { kind: 'level-spec', id: projection.source.levelSpec.id, revision: projection.source.levelSpec.version, fingerprint: projection.source.sha256 },
          { kind: 'level-graph', id: projection.a3a.levelGraph.levelGraphId, revision: projection.a3a.levelGraph.version, fingerprint: projection.a3a.levelGraphFingerprint },
          { kind: 'logic-graph', id: projection.a3a.logicGraph.logicGraphId, revision: projection.a3a.logicGraph.version, fingerprint: projection.a3a.logicGraphFingerprint },
        ],
        requirements: [{
          id: projection.a3a.requirementSet.requirementSetId,
          version: projection.a3a.requirementSet.version,
          fingerprint: projection.a3a.requirementSetFingerprint,
        }],
        recipes: [],
        artifacts: [],
        outputs: outputs.map(({ content: _content, ...descriptor }) => ({ kind: 'file', ...descriptor })),
        findings: candidateFindings(projection, validation),
        stages: { candidate: 'VERIFIED', materialize: 'NOT_AUTHORIZED', commit: 'NOT_AUTHORIZED', publish: 'NOT_AUTHORIZED' },
      });
      const candidate = createTaskCandidatePayload({ candidateManifest: manifest, outputs });
      invariant(candidate.candidateFingerprint === candidateManifestSha256(manifest),
        'NUMBERDROID_A4C_CANDIDATE_MISMATCH', 'The A4c manifest and candidate payload do not form one closure.');
      const preview = createTaskCandidatePreview({
        candidateFingerprint: candidate.candidateFingerprint,
        title: 'A4b actor-to-text Level Candidate',
        summary: 'Portable read-only preview of defeat, key drop, collection, Boolean state, and visible text. Not runtime output.',
        facts: [
          { factId: 'level-spec', label: 'LevelSpec', value: `${source.id}@${source.version}` },
          { factId: 'actor', label: 'Actor', value: source.encounters[0].id },
          { factId: 'pickup', label: 'Pickup', value: source.pickups[0].id },
          { factId: 'state', label: 'Boolean state', value: source.variables[0].id },
          { factId: 'text', label: 'Visible text', value: source.textReferences[0].text },
        ],
        steps: previewSteps(source),
      });
      const diff = createTaskCandidateDiff({
        projectId,
        taskId,
        branchId,
        baseRevision,
        branchHeadRevision,
        candidateFingerprint: candidate.candidateFingerprint,
        changes: [{
          changeId: `level-candidate:${source.id}`,
          operation: 'ADD',
          objectKind: 'level-candidate',
          objectRef: source.id,
          summary: `Add immutable Level Candidate ${source.id}@${source.version}.`,
        }],
        outputs: outputs.map(({ logicalPath, sha256: afterSha256 }) => ({
          logicalPath,
          operation: 'ADD',
          beforeSha256: null,
          afterSha256,
        })),
      });
      return deepFreeze({
        projectionFingerprint: projection.fingerprint,
        candidate,
        preview,
        diff,
        compilerPins: [
          { id: 'numberdroid.level-compiler', version: projection.compiler.compilerVersion, evidenceHash: projection.compiler.sha256 },
          { id: 'numberdroid.level-authoring-projection', version: projection.projectionVersion, evidenceHash: projection.fingerprint },
          { id: 'studio.level-authoring-validator', version: validation.validatorVersion, evidenceHash: validation.fingerprint },
        ],
      });
    },
  };
  return validateNumberdroidA4cCandidateComposer(composer);
}
