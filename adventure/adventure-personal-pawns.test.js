const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./adventure-personal-pawns.js');

test('every supplied participant has a unique immutable personal pawn', () => {
  assert.equal(A.PROFILES.length, 5);
  assert.equal(new Set(A.PROFILES.map(p => p.id)).size, 5);
  assert.equal(new Set(A.PROFILES.map(p => p.mount.image)).size, 5);
  for (const profile of A.PROFILES) {
    assert.equal(A.forId(profile.id), profile);
    assert.equal(A.forName(profile.username), profile);
    assert.equal(A.canChoosePawn(profile.username), false);
    assert.match(profile.mount.image, /^\/adventure\/assets\/players\/[a-z-]+\.webp$/);
    assert(Object.isFrozen(profile) && Object.isFrozen(profile.mount));
  }
});
test('personal assignment survives harmless username spelling differences', () => {
  assert.equal(A.forName('  MIKEB  ').id, 'mikeb');
  assert.equal(A.forName('ＭｉｋｅＢ').id, 'mikeb');
  assert.equal(A.forName(' Elliott   DA   bomb ').id, 'elliott-da-bomb');
  assert.equal(A.canChoosePawn(' nIlLeBaE '), false);
});
test('only people without a personal image retain the standard pawn choice', () => {
  for (const username of ['Anna', 'guest', 'Mike', 'MikeB2', '', null, undefined]) {
    assert.equal(A.forName(username), null);
    assert.equal(A.canChoosePawn(username), true);
  }
  assert.equal(A.forId('__proto__'), null);
  assert.equal(A.forId('unknown'), null);
});
