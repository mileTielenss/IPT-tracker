#!/usr/bin/env node
// Haalt de maandkoersen van het fonds op en schrijft ze naar data/koersen.json.
//
// Dit script draait NIET in de browser maar in GitHub Actions. Daar geldt geen
// same-origin-policy en dus geen CORS: Yahoo antwoordt gewoon, zonder
// doorgeefluik. Het resultaat wordt mee gepubliceerd, zodat de app het als
// een gewoon bestand van zijn eigen origin kan lezen.
//
// Gebruik: node scripts/koersen-ophalen.mjs [ticker]
//
// Het script faalt met opzet niet hard: als Yahoo niet antwoordt blijft het
// bestaande bestand staan en gaat de publicatie gewoon door met de koersen
// van vorige maand. Een mislukte ophaling mag nooit historiek weggooien.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chartUrl, parseChart } from '../js/koersen.js';

const ticker = process.argv[2] || process.env.TICKER || 'SUSW.L';
const bestand = new URL('../data/koersen.json', import.meta.url).pathname;

function lees() {
  if (!existsSync(bestand)) return null;
  try {
    return JSON.parse(readFileSync(bestand, 'utf-8'));
  } catch {
    return null;
  }
}

// Gesorteerde sleutels: anders wisselt de volgorde per ophaling en staat er
// bij elke commit een onleesbare diff.
function schrijf(inhoud) {
  const gesorteerd = {};
  for (const sleutel of Object.keys(inhoud.koersen).sort()) {
    gesorteerd[sleutel] = inhoud.koersen[sleutel];
  }
  mkdirSync(dirname(bestand), { recursive: true });
  writeFileSync(bestand, `${JSON.stringify({ ...inhoud, koersen: gesorteerd }, null, 2)}\n`);
}

const bestaand = lees();
const oud = bestaand !== null && bestaand.ticker === ticker ? bestaand.koersen : {};

let antwoord;
try {
  antwoord = await fetch(chartUrl(ticker), {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; ipt-tracker)' },
    signal: AbortSignal.timeout(30000),
  });
} catch (fout) {
  console.error(`Yahoo antwoordde niet (${fout.message}); bestaand bestand blijft staan.`);
  process.exit(0);
}

if (!antwoord.ok) {
  console.error(`Yahoo gaf HTTP ${antwoord.status}; bestaand bestand blijft staan.`);
  process.exit(0);
}

const data = await antwoord.json();
const verse = parseChart(data);
if (Object.keys(verse).length === 0) {
  console.error('Yahoo gaf geen bruikbare koersen; bestaand bestand blijft staan.');
  process.exit(0);
}

// Nieuwe koersen gaan over de oude heen; maanden die Yahoo niet meer
// meestuurt blijven bewaard.
const koersen = { ...oud, ...verse };
const sleutels = Object.keys(koersen).sort();
schrijf({
  ticker,
  munt: data.chart.result[0].meta.currency,
  bijgewerkt: new Date().toISOString().slice(0, 10),
  van: sleutels[0],
  tot: sleutels[sleutels.length - 1],
  koersen,
});
console.log(`${sleutels.length} maandkoersen voor ${ticker} (${sleutels[0]} t/m ${sleutels[sleutels.length - 1]}).`);
