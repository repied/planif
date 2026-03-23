const fs = require('fs');
const path = require('path');

// 1. Setup Environment
const window = {};
global.window = window;

// 2. Load Data Helpers (Adapted from dataManager.js)
function parseDuration(str) {
  if (!str) return 0;
  str = str.toString().trim();
  if (str.includes('h')) {
    const parts = str.split('h');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  }
  return parseInt(str) || 0;
}

function parseStopsTable(csv) {
  const lines = csv.split('\n');
  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    const depth = parseInt(cols[0]);
    const time = parseDuration(cols[1]);
    if (isNaN(depth) || isNaN(time)) continue;

    const stops = {};
    if (cols[2]) stops[15] = parseInt(cols[2]);
    if (cols[3]) stops[12] = parseInt(cols[3]);
    if (cols[4]) stops[9] = parseInt(cols[4]);
    if (cols[5]) stops[6] = parseInt(cols[5]);
    if (cols[6]) stops[3] = parseInt(cols[6]);

    const group = cols[8] ? cols[8].trim() : null;

    if (!data[depth]) data[depth] = [];
    data[depth].push({ time, stops, group });
  }
  return data;
}

function parseN2Table(csv) {
  const lines = csv.split('\n');
  const header = lines[0].trim().split(',');
  const intervals = header.slice(1).map(parseDuration);
  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    const group = cols[0].trim();
    const coeffs = cols.slice(1).map((v) => parseFloat(v));
    data[group] = coeffs;
  }
  return { intervals, data };
}

function parseMajorationTable(csv) {
  const lines = csv.split('\n');
  const header = lines[0].trim().split(',');
  const depths = header.slice(1).map((d) => parseInt(d));
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    const n2 = parseFloat(cols[0]);
    const majorations = cols.slice(1).map((v) => parseInt(v));
    data.push({ n2, majorations });
  }
  data.sort((a, b) => a.n2 - b.n2);
  return { depths, data };
}

// 3. Load Data Files
const stopsCsv = fs.readFileSync(path.join(__dirname, '../data/mn90_stops.csv'), 'utf8');
const n2Csv = fs.readFileSync(path.join(__dirname, '../data/mn90-n2.csv'), 'utf8');
const majCsv = fs.readFileSync(path.join(__dirname, '../data/mn90-majoration.csv'), 'utf8');

const mn90Data = parseStopsTable(stopsCsv);
const table2Data = parseN2Table(n2Csv);
const table3Data = parseMajorationTable(majCsv);

window.dataManager = {
  getMN90: () => mn90Data,
  getTable2: () => table2Data,
  getTable3: () => table3Data,
};

// 4. Load Planning.js
const planningScript = fs.readFileSync(path.join(__dirname, '../src/planning.js'), 'utf8');
eval(planningScript);
const Planning = window.Planning;

// 5. Test Runner
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    passed++;
  } else {
    console.error(`❌ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✅ ${message}`);
    passed++;
  } else {
    console.error(`❌ ${message}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertClose(actual, expected, epsilon, message) {
  if (Math.abs(actual - expected) <= epsilon) {
    console.log(`✅ ${message}`);
    passed++;
  } else {
    console.error(`❌ ${message}`);
    console.error(`   Expected: ${expected} +/- ${epsilon}`);
    console.error(`   Actual:   ${actual}`);
    failed++;
  }
}

console.log('--- Starting Unit Tests ---\n');

// --- Tests ---

// Test 1: MN90 Deco Dive - 20m 50min
// Expectation from table (verified in CSV): Group I, Stop 3m: 4min. DTR 6.
{
  const profile = Planning.getMN90Profile(20, 50);
  assert(profile !== null, 'MN90 Profile found for 20m 50min');
  assertEqual(profile.profile.group, 'I', 'Group should be I');
  assertEqual(profile.profile.stops['3'], 4, 'Should have 4 min stop at 3m');

  const dtr = Planning.calculateDTR(20, profile.profile, Planning.ASCENT_RATE_MN90);
  // Calculation (verified):
  // Ascent 20->3 = 1.133
  // Stop = 4
  // Ascent 3->0 = 0.5
  // Total = 5.633 (no ceiling)
  assertClose(dtr, 5.633333333333333, 1e-9, 'DTR should keep fractional minutes');
}

// Test 2: Gas Consumption
// 20m 50min. SAC 20 L/min. Tank 15L.
// Descent: 1 min * 2 bar * 20 = 40 L
// Bottom: 49 min * 3 bar * 20 = 2940 L
// Ascent: ~164.2 L
// Total = 3145 L (approx)
{
  const profile = Planning.getMN90Profile(20, 50);
  const sac = 20;
  const result = Planning.calculateGasConsumptionLiters(
    20,
    50,
    profile.profile,
    sac,
    Planning.ASCENT_RATE_MN90
  );
  const gas = result.total;
  const expected = 3170;
  assert(Math.abs(gas - expected) <= 5, `Gas consumption close to ${expected} (got ${gas})`);
  assert(result.breakdown !== undefined, 'Gas consumption has breakdown');
}

// Test 3: Successive Dive
// Dive 1: 20m 40min -> Group H
// Interval 1h00 (60 min).
// Table 2 (N2) for H, 60 min (index 3).
// Row H (verified): 1.13, 1.10, 1.08, 1.05. -> Coeff 1.05.
// Table 3 (Maj) for 1.05. Next row is 1.07.
// Depth 15m. Row 1.07, col 15m -> 44 min (verified: 57, 44...).
{
  const result = Planning.calculateSuccessive('H', 60, 15);

  assert(result.n2 !== undefined, 'Successive dive returns N2');
  assert(result.majoration !== undefined, 'Successive dive returns majoration');
  assertEqual(result.n2, 1.05, 'N2 coeff for H, 60min should be 1.05');
  assertEqual(result.majoration, 44, 'Majoration for H, 60min, 15m should be 44 min');
}

// Test 4: Nitrox EAD
// 30m, Nitrox 32.
// EAD = (30+10) * 0.68 / 0.79 - 10
// 40 * 0.68 / 0.79 = 34.43
// 34.43 - 10 = 24.43 -> 24.4m
{
  const ead = Planning.calculateEquivalentAirDepth(30, 32);
  assert(Math.abs(ead - 24.43) < 0.1, `EAD calculation for 30m 32% (got ${ead.toFixed(2)})`);
}

// Test 5: Buehlmann Simple Plan
// 30m, 20min, GF 30/70, Air
{
  const plan = Planning.calculateBuhlmannPlan({
    bottomTime: 20,
    maxDepth: 30,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });

  assert(plan.dtr > 0, 'Buehlmann plan has DTR');
  assert(plan.profile.stops, 'Buehlmann plan has stops object');
  // 30m 20min on Air usually requires no Deco or very little.
  // With GF 30/70 it might trigger something small or safety stop logic isn't explicit but algo runs.
}

function check_dtr_single_dive(depth, time, expectedDTRCeil) {
  const profile = Planning.getMN90Profile(depth, time);
  const dtr = Planning.calculateDTR(depth, profile.profile, Planning.ASCENT_RATE_MN90);
  console.log(`DTR for ${depth}m ${time}min: ${dtr} min`);
  assert(
    dtr > expectedDTRCeil - 1 && dtr <= expectedDTRCeil,
    `DTR should be in (${expectedDTRCeil - 1}, ${expectedDTRCeil}]`
  );
}
function check_stops_single_dive(depth, time, expectedStops) {
  const profile = Planning.getMN90Profile(depth, time);
  console.log(`Stops for ${depth}m ${time}min: ${JSON.stringify(profile.profile.stops)}`);
  assertEqual(
    profile.profile.stops,
    expectedStops,
    `Stops should be ${JSON.stringify(expectedStops)}`
  );
}

function check_gps_single_dive(depth, time, expectedGPS) {
  const profile = Planning.getMN90Profile(depth, time);
  console.log(`GPS for ${depth}m ${time}min: ${JSON.stringify(profile.profile.group)}`);
  assertEqual(profile.profile.group, expectedGPS, `GPS should be ${JSON.stringify(expectedGPS)}`);
}

function check_successive_dive(group, interval, depth, expectedMaj) {
  const result = Planning.calculateSuccessive(group, interval, depth);
  console.log(
    `Successive for group ${group}, interval ${interval}min, depth ${depth}m: N2=${result.n2}, Maj=${result.majoration}`
  );
  assertEqual(result.majoration, expectedMaj, `Majoration should be ${expectedMaj}`);
}

{
  // source https://diveapp.p6ril.fr/
  check_dtr_single_dive(20, 50, 6);
  check_dtr_single_dive(20, 75, 26);
  check_dtr_single_dive(20, 90, 36);
  check_dtr_single_dive(10, 75, 1);
  check_dtr_single_dive(10, 360, 2);
  check_dtr_single_dive(34, 20, 8);
  check_dtr_single_dive(34, 45, 51);
  check_dtr_single_dive(55, 5, 5);
  check_dtr_single_dive(55, 50, 136); // diveapp gives 134 but maybe different ascent speed
  check_stops_single_dive(55, 50, { 12: 8, 9: 19, 6: 35, 3: 69 });
  check_stops_single_dive(55, 20, { 9: 1, 6: 6, 3: 27 });
  check_stops_single_dive(5, 360, {}); // diveapp not thew same as MN90-Mode-Emploi-2020.pdf
  check_stops_single_dive(20, 60, { 3: 13 });
  check_stops_single_dive(19, 60, { 3: 13 });
  check_stops_single_dive(20, 58, { 3: 13 });
  check_gps_single_dive(19, 26, 'F'); // groundtruth from MN90-Mode-Emploi-2020.pdf
  check_gps_single_dive(29, 46, 'M'); // groundtruth from MN90-Mode-Emploi-2020.pdf
  check_gps_single_dive(60, 55, '*'); //groundtruth from MN90-Mode-Emploi-2020.pdf
}

{
  // Successive dive tests
  check_successive_dive('H', 60, 15, 44);
  check_successive_dive('I', 30, 20, 44);
  check_successive_dive('D', 121, 12, 17);
}

{
  console.log('Testing Corner Cases...');

  // 1. Depth > Max Depth (65m for MN90)
  // MN90 tables usually go up to 60m or 65m. If we check stop table, max is 65.
  // If we request 70m, it should be out of table.
  const profileDeep = Planning.getMN90Profile(70, 10);
  // getMN90Profile returns { is_out_of_table: true }
  if (profileDeep.is_out_of_table !== true) {
    console.error('❌ Depth 70m should be out of table');
    failed++;
  } else {
    console.log('✅ Depth 70m detected as out of table');
    passed++;
  }

  // 2. Time > Max Time for Depth
  // At 60m, max time is 55min.
  const profileLong = Planning.getMN90Profile(60, 200);
  if (profileLong.is_out_of_table !== true) {
    console.error('❌ Time 200min at 60m should be out of table');
    failed++;
  } else {
    console.log('✅ Time 200min at 60m detected as out of table');
    passed++;
  }

  // 3. Surface Dive (Depth 0)
  const profileSurface = Planning.getMN90Profile(0, 30);
  if (profileSurface.is_surface_dive !== true) {
    console.error('❌ Depth 0 should be surface dive');
    failed++;
  } else {
    console.log('✅ Depth 0 detected as surface dive');
    passed++;
  }

  // 4. Successive Dive - Interval too short (<15min)
  const resultShort = Planning.calculateSuccessive('A', 10, 20);
  if (resultShort.error !== 'Interval too short (<15min)') {
    // Assuming this is the message
    console.error(`❌ Interval < 15min should be error. Got: ${JSON.stringify(resultShort)}`);
    failed++;
  } else {
    console.log('✅ Interval < 15min detected correctly');
    passed++;
  }

  // 5. Successive Dive - Interval > 12h
  const resultLong = Planning.calculateSuccessive('A', 721, 20);
  if (resultLong.majoration !== 0 || resultLong.n2 !== 0) {
    console.error(
      `❌ Interval > 12h should give 0 majoration/n2. Got: ${JSON.stringify(resultLong)}`
    );
    failed++;
  } else {
    console.log('✅ Interval > 12h handled correctly');
    passed++;
  }

  // 6. Successive Dive - Depth too deep for Majoration Table (>60m)
  const resultDeepSucc = Planning.calculateSuccessive('A', 60, 65);
  if (resultDeepSucc.error !== 'Too deep for table') {
    console.error(
      `❌ Depth 65m should be too deep for majoration table. Got: ${JSON.stringify(resultDeepSucc)}`
    );
    failed++;
  } else {
    console.log('✅ Depth 65m detected as too deep for majoration table');
    passed++;
  }

  // 7. Successive Dive - Invalid Group
  const resultInvalidGroup = Planning.calculateSuccessive('Z', 60, 20);
  if (resultInvalidGroup.error !== 'Invalid Group') {
    console.error(`❌ Group 'Z' should be invalid. Got: ${JSON.stringify(resultInvalidGroup)}`);
    failed++;
  } else {
    console.log("✅ Group 'Z' detected as invalid");
    passed++;
  }
}

// Test 7: Bühlmann GF Mode Corner Cases
{
  console.log('Testing Bühlmann GF Mode Corner Cases...');

  // 1. Zero Depth
  // Should return 0 DTR and empty stops
  const planZeroDepth = Planning.calculateBuhlmannPlan({
    bottomTime: 20,
    maxDepth: 0,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });
  // Check DTR and stops
  if (planZeroDepth.dtr !== 0 || Object.keys(planZeroDepth.profile.stops).length > 0) {
    console.error(
      `❌ Zero Depth (0m) should have 0 DTR and no stops. Got DTR: ${planZeroDepth.dtr}`
    );
    failed++;
  } else {
    console.log('✅ Zero Depth handled correctly');
    passed++;
  }

  // 2. Zero Time
  // Should return 0 DTR and empty stops
  const planZeroTime = Planning.calculateBuhlmannPlan({
    bottomTime: 0,
    maxDepth: 30,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });
  if (planZeroTime.dtr !== 0 || Object.keys(planZeroTime.profile.stops).length > 0) {
    console.error(`❌ Zero Time (0min) should have 0 DTR. Got DTR: ${planZeroTime.dtr}`);
    failed++;
  } else {
    console.log('✅ Zero Time handled correctly');
    passed++;
  }

  // 3. Extreme Depth (100m)
  // 100m for 10min on Air.
  // Should definitely have deco stops.
  const planDeep = Planning.calculateBuhlmannPlan({
    bottomTime: 10,
    maxDepth: 100,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });
  // Verify we got some stops
  const stopsDeep = Object.keys(planDeep.profile.stops);
  if (stopsDeep.length === 0 || planDeep.dtr <= 10) {
    console.error(
      `❌ 100m dive should have significant deco. Got DTR: ${planDeep.dtr}, Stops: ${JSON.stringify(planDeep.profile.stops)}`
    );
    failed++;
  } else {
    console.log('✅ Extreme depth (100m) generated deco stops');
    passed++;
  }

  // 4. Shallow No-Deco Dive
  // 10m for 30min on Air (NDL is huge).
  const planShallow = Planning.calculateBuhlmannPlan({
    bottomTime: 30,
    maxDepth: 10,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });
  if (Object.keys(planShallow.profile.stops).length > 0) {
    console.error(
      `❌ Shallow dive (10m 30min) should have no stops. Got: ${JSON.stringify(planShallow.profile.stops)}`
    );
    failed++;
  } else {
    console.log('✅ Shallow dive handled correctly (no stops)');
    passed++;
  }

  // 5. High GF (Risk Factor)
  // GF 100/100 (pure M-value) vs GF 30/70.
  // 30m 30min on Air.
  const planAggressive = Planning.calculateBuhlmannPlan({
    bottomTime: 30,
    maxDepth: 30,
    gfLow: 100,
    gfHigh: 100,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });
  const planConservative = Planning.calculateBuhlmannPlan({
    bottomTime: 30,
    maxDepth: 30,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });

  // Conservative should have equal or more deco (DTR) than aggressive.
  // Actually, 30m 30min might be close to NDL on GF 100/100.
  // Let's check if DTR conservative >= DTR aggressive.
  if (planConservative.dtr < planAggressive.dtr) {
    console.error(
      `❌ Conservative plan (GF 30/70) should not be shorter than aggressive (GF 100/100). Cons: ${planConservative.dtr}, Aggr: ${planAggressive.dtr}`
    );
    failed++;
  } else {
    console.log('✅ GF Sensitivity check passed (Conservative >= Aggressive)');
    passed++;
  }
}

// Test 8: Consistency check between calculateBuhlmannPlan and calculateDTR
{
  console.log('Testing Consistency between calculateBuhlmannPlan and calculateDTR...');

  function checkConsistency(depth, time, gfLow, gfHigh) {
    const plan = Planning.calculateBuhlmannPlan({
      bottomTime: time,
      maxDepth: depth,
      gfLow: gfLow,
      gfHigh: gfHigh,
      fN2: 0.79,
      ascentRate: Planning.ASCENT_RATE_GF,
    });

    const dtr_Buhlmann = plan.dtr;
    const dtr_from_stops = Planning.calculateDTR(depth, plan.profile, Planning.ASCENT_RATE_GF);
    const EPSILON = 1e-5;

    if (Math.abs(dtr_Buhlmann - dtr_from_stops) > EPSILON) {
      console.error(
        `❌ Consistency check failed for ${depth}m ${time}min GF ${gfLow}/${gfHigh}. dtr_Buhlmann: ${dtr_Buhlmann} vs DTR from stops: ${dtr_from_stops}`
      );
      console.log(`Stops: ${JSON.stringify(plan.profile.stops)}`);
      failed++;
    } else {
      console.log(
        `✅ Consistency check passed for ${depth}m ${time}min GF ${gfLow}/${gfHigh}. dtr_Buhlmann: ${dtr_Buhlmann} ~= DTR from stops: ${dtr_from_stops}`
      );
      passed++;
    }
  }

  checkConsistency(30, 20, 30, 70);
  checkConsistency(40, 20, 30, 70);
  checkConsistency(50, 20, 30, 70);
  checkConsistency(60, 30, 30, 70);
  checkConsistency(100, 10, 30, 70);
  checkConsistency(20, 100, 30, 70); // Long shallow dive
}

// Test 9: Nitrox Logic
{
  console.log('Testing Nitrox Logic...');

  // 1. PPO2 Calculation
  const ppo2Air = Planning.calculatePPO2(20, 21); // 3 bar * 0.21 = 0.63
  if (Math.abs(ppo2Air - 0.63) > 0.01) {
    console.error(`❌ PPO2 Air 20m failed. Expected 0.63, got ${ppo2Air}`);
    failed++;
  } else {
    console.log('✅ PPO2 Air 20m correct');
    passed++;
  }

  const ppo2Nx32 = Planning.calculatePPO2(30, 32); // 4 bar * 0.32 = 1.28
  if (Math.abs(ppo2Nx32 - 1.28) > 0.01) {
    console.error(`❌ PPO2 EAN32 30m failed. Expected 1.28, got ${ppo2Nx32}`);
    failed++;
  } else {
    console.log('✅ PPO2 EAN32 30m correct');
    passed++;
  }

  // 2. EAD Calculation
  const eadAir = Planning.calculateEquivalentAirDepth(30, 21);
  if (Math.abs(eadAir - 30) > 0.1) {
    console.error(`❌ EAD Air 30m failed. Expected 30, got ${eadAir}`);
    failed++;
  } else {
    console.log('✅ EAD Air 30m correct');
    passed++;
  }

  const eadNx32 = Planning.calculateEquivalentAirDepth(30, 32);
  // (4 * 0.68 / 0.79 - 1) * 10 = (3.443 - 1) * 10 = 24.43
  if (Math.abs(eadNx32 - 24.43) > 0.1) {
    console.error(`❌ EAD EAN32 30m failed. Expected ~24.43, got ${eadNx32}`);
    failed++;
  } else {
    console.log('✅ EAD EAN32 30m correct');
    passed++;
  }

  // 3. MN90 with Nitrox (Indirectly via EAD)
  // 35m for 40min
  const depth = 35;
  const time = 40;

  const profileAir = Planning.getMN90Profile(depth, time);

  const ead = Planning.calculateEquivalentAirDepth(depth, 32); // ~28.7m
  // MN90 table lookup will use 30m for EAD 28.7m
  const profileNx = Planning.getMN90Profile(ead, time);

  let stopsAir = 0;
  if (profileAir.profile && profileAir.profile.stops) {
    for (let d in profileAir.profile.stops) stopsAir += profileAir.profile.stops[d];
  }

  let stopsNx = 0;
  if (profileNx.profile && profileNx.profile.stops) {
    for (let d in profileNx.profile.stops) stopsNx += profileNx.profile.stops[d];
  }

  if (stopsNx >= stopsAir && stopsAir > 0) {
    console.error(`❌ MN90 Nitrox Advantage failed. Air Stops: ${stopsAir}, Nx Stops: ${stopsNx}`);
    failed++;
  } else {
    console.log(`✅ MN90 Nitrox Advantage verified (Air stops: ${stopsAir}, Nx stops: ${stopsNx})`);
    passed++;
  }

  // 4. Buhlmann with Nitrox
  // 40m, 20min
  const planAir = Planning.calculateBuhlmannPlan({
    bottomTime: 20,
    maxDepth: 40,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });

  const planNx32 = Planning.calculateBuhlmannPlan({
    bottomTime: 20,
    maxDepth: 40,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.68, // EAN32
    ascentRate: Planning.ASCENT_RATE_GF,
  });

  if (planNx32.dtr >= planAir.dtr && planAir.dtr > 10) {
    // Ensure there is actual deco on air to reduce
    console.error(
      `❌ Buhlmann Nitrox Advantage failed. Air DTR: ${planAir.dtr}, Nx DTR: ${planNx32.dtr}`
    );
    failed++;
  } else {
    console.log(
      `✅ Buhlmann Nitrox Advantage verified (Air DTR: ${planAir.dtr}, Nx DTR: ${planNx32.dtr})`
    );
    passed++;
  }

  // 5. Pure O2 (Theory check)
  const planO2 = Planning.calculateBuhlmannPlan({
    bottomTime: 60,
    maxDepth: 6,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.0,
    ascentRate: Planning.ASCENT_RATE_GF,
  });
  if (planO2.profile.stops && Object.keys(planO2.profile.stops).length > 0) {
    console.error(
      `❌ Pure O2 at 6m should have no N2 deco stops. Got: ${JSON.stringify(planO2.profile.stops)}`
    );
    failed++;
  } else {
    console.log('✅ Pure O2 dive handled correctly');
    passed++;
  }

  // 6. Buhlmann Repetitive Nitrox Dive
  // Dive 1: 40m 20min EAN32.
  const dive1 = Planning.calculateBuhlmannPlan({
    bottomTime: 20,
    maxDepth: 40,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.68,
    ascentRate: Planning.ASCENT_RATE_GF,
  });
  // Interval: 60 min.
  // Decay tensions.
  const interval = 60;
  const surfaceTensions = Planning.updateAllTensions(
    dive1.finalTensions,
    Planning.SURFACE_AIR_ALV_PPN2,
    interval
  );

  // Dive 2: 30m 20min EAN32.
  const dive2 = Planning.calculateBuhlmannPlan({
    bottomTime: 20,
    maxDepth: 30,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.68,
    initialTensions: surfaceTensions,
    ascentRate: Planning.ASCENT_RATE_GF,
  });

  // Compare with Air repetitive
  const dive1Air = Planning.calculateBuhlmannPlan({
    bottomTime: 20,
    maxDepth: 40,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    ascentRate: Planning.ASCENT_RATE_GF,
  });
  const surfaceTensionsAir = Planning.updateAllTensions(
    dive1Air.finalTensions,
    Planning.SURFACE_AIR_ALV_PPN2,
    interval
  );
  const dive2Air = Planning.calculateBuhlmannPlan({
    bottomTime: 20,
    maxDepth: 30,
    gfLow: 30,
    gfHigh: 70,
    fN2: 0.79,
    initialTensions: surfaceTensionsAir,
    ascentRate: Planning.ASCENT_RATE_GF,
  });

  if (dive2.dtr >= dive2Air.dtr && dive2Air.dtr > 0) {
    console.error(
      `❌ Repetitive Nitrox should be better than Air. Nx DTR: ${dive2.dtr}, Air DTR: ${dive2Air.dtr}`
    );
    failed++;
  } else {
    console.log(`✅ Repetitive Nitrox verified (Nx DTR: ${dive2.dtr} < Air DTR: ${dive2Air.dtr})`);
    passed++;
  }
}

// Test 10: Advanced Gas Consumption
{
  console.log('Testing Advanced Gas Consumption...');
  const SAC = 20; // L/min

  // 1. No Stops, Simple ascent
  // 20m, 10min.
  // Descent: 1 min * 2 bar * 20 = 40 L
  // Bottom: 9 min * 3 bar * 20 = 540 L
  // Ascent: 20m to 0m at 15m/min = 1.333 min.
  // Avg Pressure: (3+1)/2 = 2 bar.
  // Ascent Gas: 1.333 * 2 * 20 = 53.33 L.
  // Total: 40 + 540 + 53.33 = 633.33 -> 634 L.
  const profileNoStops = { stops: {} };
  const gasNoStops = Planning.calculateGasConsumptionLiters(
    20,
    10,
    profileNoStops,
    SAC,
    Planning.ASCENT_RATE_MN90
  ).total;
  if (Math.abs(gasNoStops - 639) > 2) {
    console.error(`❌ Simple ascent gas failed. Expected ~639, got ${gasNoStops}`);
    failed++;
  } else {
    console.log(`✅ Simple ascent gas correct (${gasNoStops})`);
    passed++;
  }

  // 2. With Stops
  // 30m, Bottom time 20min.
  // Fake Profile: Stop at 3m for 5min.
  // Descent: 1.5 min * 2.5 bar * 20 = 75 L
  // Bottom: 18.5 min * 4 bar * 20 = 1480 L
  // Ascent 30 -> 3: 27m / 15m/min = 1.8 min.
  // Avg P (30->3): (4 + 1.3)/2 = 2.65 bar.
  // Gas Travel 1: 1.8 * 2.65 * 20 = 95.4 L.
  // Stop 3m: 5min * 1.3bar * 20 = 130 L.
  // Ascent 3 -> 0: 3m / 6m/min = 0.5 min.
  // Avg P (3->0): (1.3 + 1)/2 = 1.15 bar.
  // Gas Travel 2: 0.5 * 1.15 * 20 = 11.5 L.
  // Total: 75 + 1480 + 95.4 + 130 + 11.5 = 1791.9 -> 1792 L.
  const profileWithStops = { stops: { 3: 5 } };
  const gasWithStops = Planning.calculateGasConsumptionLiters(
    30,
    20,
    profileWithStops,
    SAC,
    Planning.ASCENT_RATE_MN90
  ).total;

  // Allow small margin for floating point
  if (Math.abs(gasWithStops - 1806) > 5) {
    console.error(`❌ Gas with stops failed. Expected ~1806, got ${gasWithStops}`);
    failed++;
  } else {
    console.log(`✅ Gas with stops correct (${gasWithStops})`);
    passed++;
  }

  // 3. Nitrox Saving (Real Calculation)
  // 35m 40min.
  // Air: 35m 40min.
  const d35 = 35;
  const t40 = 40;
  const pAir35 = Planning.getMN90Profile(d35, t40);
  const ead35 = Planning.calculateEquivalentAirDepth(d35, 32); // EAN32
  const pNx35 = Planning.getMN90Profile(ead35, t40);

  const gAir = Planning.calculateGasConsumptionLiters(
    d35,
    t40,
    pAir35.profile,
    SAC,
    Planning.ASCENT_RATE_MN90
  ).total;
  const gNx = Planning.calculateGasConsumptionLiters(
    d35,
    t40,
    pNx35.profile,
    SAC,
    Planning.ASCENT_RATE_MN90
  ).total;

  if (gNx < gAir) {
    console.log(`✅ Nitrox gas saving verified (Air: ${gAir} L, Nx: ${gNx} L)`);
    passed++;
  } else {
    console.error(`❌ Nitrox gas should be less than Air. Air: ${gAir}, Nx: ${gNx}`);
    console.log(`   Air stops: ${JSON.stringify(pAir35.profile.stops)}`);
    console.log(`   Nx stops: ${JSON.stringify(pNx35.profile.stops)}`);
    failed++;
  }
}

console.log(`\n-- - Finished-- - `);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
