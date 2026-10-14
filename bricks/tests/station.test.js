'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {parseTrack} = require('../server/index');

test('original brick beats can enter the queue', () => {
  const track = parseTrack({kind:'beat',beat:'afterglow',title:'Afterglow'});
  assert.equal(track.kind, 'beat');
  assert.equal(track.beat, 'afterglow');
});

test('unsupported track types are rejected', () => {
  assert.equal(parseTrack({kind:'beat',beat:'unknown'}),null);
  assert.equal(parseTrack({kind:'other'}),null);
});