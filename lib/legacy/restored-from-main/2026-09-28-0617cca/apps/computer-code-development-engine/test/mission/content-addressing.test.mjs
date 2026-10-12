import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { semanticId } from "@red-cup-engineering/computer-content-engineering-services-section/semiotic-content-address";
import { stableIdentity, transitionFingerprint } from '../../src/mission/mission-runtime.mjs';

test('mission identity uses shared canonical content with kind as data', () => {
  const a = { source: { b: 2, a: 1 }, order: [1, 2] };
  const b = { order: [1, 2], source: { a: 1, b: 2 } };
  assert.equal(stableIdentity('mission', a), semanticId({ kind: 'mission', value: a }));
  assert.equal(stableIdentity('mission', a), stableIdentity('mission', b));
  assert.notEqual(stableIdentity('mission', a), stableIdentity('checkpoint', a));
  assert.notEqual(stableIdentity('mission', a), stableIdentity('mission', { ...a, order: [2, 1] }));
});

test('transition identity preserves action meaning, workspace bytes and file membership', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'mission-content-'));
  try {
    writeFileSync(join(workspace, 'a.mjs'), 'one');
    writeFileSync(join(workspace, 'b.mjs'), 'two');
    const node = { workspace, writablePaths: ['b.mjs', 'a.mjs'] };
    const action = { action: 'edit', args: { path: 'a.mjs', blocks: { search: 'one', replace: 'new' } } };
    const reordered = { args: { blocks: { replace: 'new', search: 'one' }, path: 'a.mjs' }, action: 'edit' };
    const id = transitionFingerprint(node, action);
    assert.match(id, /^ni:\/\/\/sha-256;/);
    assert.equal(id, transitionFingerprint({ ...node, writablePaths: [...node.writablePaths].reverse() }, reordered));
    writeFileSync(join(workspace, 'a.mjs'), 'changed');
    assert.notEqual(id, transitionFingerprint(node, action));
    assert.notEqual(transitionFingerprint(node, action), transitionFingerprint({ ...node, writablePaths: ['a.mjs'] }, action));
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});
