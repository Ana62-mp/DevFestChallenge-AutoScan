import test from 'node:test';
import assert from 'node:assert/strict';
import {nextSighting,normalizePlate,validPlate} from '../src/lib/pattern.js';
test('normalizes Ecuadorian plates and rejects invalid values',()=>{assert.equal(normalizePlate('gba 4821'),'GBA-4821');assert.ok(validPlate('gba4821'));assert.ok(!validPlate('ABC123'));});
test('alerts on third recent sighting, suppresses duplicates within seven days',()=>{const now=1700000000000;const third=nextSighting({times:[now-10000,now-5000]},now);assert.equal(third.count,3);assert.ok(third.shouldAlert);assert.ok(!nextSighting({times:third.times,lastAlert:now},now+5000).shouldAlert);});
test('old sightings cannot trigger a new alert',()=>{const now=1700000000000;const next=nextSighting({times:[now-8*86400000,now-9*86400000]},now);assert.equal(next.count,1);assert.ok(!next.shouldAlert);});
