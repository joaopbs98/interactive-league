import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutomaticSquadSelection } from '../lib/simulation/autoLineup.mjs';

const player = (id, positions, rating) => ({ player_id: id, positions, rating });

test('automatic lineup fills all formation slots with unique players and keeps a goalkeeper in goal', () => {
  const roster = [
    player('gk1', 'GK', 58), player('gk2', 'GK', 55),
    player('lb', 'LB,LWB', 57), player('rb', 'RB,RWB', 56),
    player('cb1', 'CB', 60), player('cb2', 'CB,CDM', 59), player('cb3', 'CB', 54),
    player('cm1', 'CM,CDM', 60), player('cm2', 'CM', 58), player('cam', 'CAM,CM', 57),
    player('lw', 'LW,LM', 59), player('rw', 'RW,RM', 58), player('st', 'ST,CF', 60),
    player('sub1', 'ST', 54), player('sub2', 'CM', 53), player('sub3', 'LB', 52),
    player('sub4', 'RB', 51), player('sub5', 'CB', 50), player('sub6', 'LW', 49),
    player('sub7', 'RW', 48), player('reserve', 'CM', 47),
  ];

  const result = buildAutomaticSquadSelection(roster, ['GK', 'LB', 'CB', 'RB', 'CM', 'LW', 'RW', 'CB', 'CM', 'CM', 'ST']);
  assert.equal(result.startingLineup.length, 11);
  assert.equal(new Set(result.startingLineup).size, 11);
  assert.equal(result.startingLineup[0], 'gk1');
  assert.equal(result.bench.length, 7);
  assert.equal(result.reserves.length, 3);
  assert.equal(new Set([...result.startingLineup, ...result.bench, ...result.reserves]).size, 21);
});

test('automatic lineup never places an outfield player in goal when a goalkeeper is available', () => {
  const roster = [player('star', 'ST', 99), player('keeper', 'GK', 40), ...Array.from({ length: 10 }, (_, index) => player(`p${index}`, 'CM', 50 + index))];
  const result = buildAutomaticSquadSelection(roster, ['GK', ...Array(10).fill('CM')]);
  assert.equal(result.startingLineup[0], 'keeper');
});
