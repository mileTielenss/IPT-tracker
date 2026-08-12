import test from 'node:test';
import assert from 'node:assert/strict';
import { formatteerCenten, formatteerDatum, formatteerProcent, formatteerVerschil } from '../js/format.js';

test('formatteerCenten gebruikt nl-BE euro-notatie', () => {
  const tekst = formatteerCenten(123456);
  assert.ok(tekst.includes('1.234,56'));
  assert.ok(tekst.includes('€'));
  assert.ok(formatteerCenten(-6250).includes('62,50'));
});

test('formatteerDatum toont dd/mm/jjjj', () => {
  assert.equal(formatteerDatum('2026-06-05'), '05/06/2026');
});

test('formatteerProcent', () => {
  assert.ok(formatteerProcent(0.125).includes('12,5'));
});

test('formatteerVerschil in euro en procent', () => {
  assert.equal(formatteerVerschil(1000, null), '');
  const tekst = formatteerVerschil(1500, 1000);
  assert.ok(tekst.startsWith('+'));
  assert.ok(tekst.includes('50'));
  const daling = formatteerVerschil(500, 1000);
  assert.ok(daling.includes('-'));
  const zonderProcent = formatteerVerschil(500, 0);
  assert.ok(!zonderProcent.includes('('));
});
