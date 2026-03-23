const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser environment
const sandbox = {
  console: console,
  dataManager: {
    getMN90: () => ({}),
    getTable2: () => ({}),
    getTable3: () => ({}),
  },
};
sandbox.window = sandbox;

// Load planning.js
const planningPath = path.join(__dirname, '../planning.js');
const planningCode = fs.readFileSync(planningPath, 'utf8');

try {
  vm.createContext(sandbox);
  vm.runInContext(planningCode, sandbox);
} catch (e) {
  console.error('Error executing planning.js:', e);
  process.exit(1);
}

const Planning = sandbox.Planning;
if (!Planning) {
  console.error('Planning object not found in sandbox');
  process.exit(1);
}

// Grid values matching C++ subsurface generator
const depth_grid = [15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 65];
const bt_grid = [10, 15, 20, 30, 35, 40, 50, 60, 120];
const o2_grid = [21, 32, 45];
const gf_low_grid = [20, 30, 50, 70, 85, 90, 95, 99];
const gf_high_grid = [50, 60, 70, 80, 85, 90, 95];

// Build column headers: 12 fixed + up to 15 stop pairs
const MAX_STOPS = 15;
const stopHeaders = [];
for (let i = 1; i <= MAX_STOPS; i++) {
  stopHeaders.push(`stop${i}_depth_m`, `stop${i}_time_min`);
}
const headers = [
  'dive_id',
  'depth_m',
  'bottom_time_min',
  'o2_pct',
  'gf_low',
  'gf_high',
  'total_runtime_min',
  'total_runtime_sec',
  'tts_min',
  'has_deco',
  'num_deco_stops',
  ...stopHeaders,
];
const rows = [headers.join(',')];

const total =
  depth_grid.length * bt_grid.length * o2_grid.length * gf_low_grid.length * gf_high_grid.length;
const logInterval = Math.max(1, Math.floor(total / 200));
let dive_id = 0;
const startTime = Date.now();

console.log(`Generating ${total} dive plans...`);

for (const depth of depth_grid) {
  for (const bt of bt_grid) {
    for (const o2 of o2_grid) {
      for (const gfLow of gf_low_grid) {
        for (const gfHigh of gf_high_grid) {
          dive_id++;

          const result = Planning.calculateBuhlmannPlan({
            bottomTime: bt,
            maxDepth: depth,
            gfLow,
            gfHigh,
            fN2: (100 - o2) / 100,
            surfacePressure: 1.01325,
            ascentRate: Planning.ASCENT_RATE_GF,
          });

          const stopsObj = result.profile.stops || {};
          const dtr = result.dtr;

          // Sort stops deepest first
          const stopEntries = Object.keys(stopsObj)
            .map(Number)
            .sort((a, b) => b - a)
            .map((d) => ({ depth: d, time: stopsObj[d] }));

          const hasDeco = stopEntries.length > 0 ? 'yes' : 'no';
          const numDecoStops = stopEntries.length;

          const totalRuntime = bt + dtr;
          const total_runtime_min = Math.floor(totalRuntime);
          const total_runtime_sec = Math.round(totalRuntime * 60);
          const tts_min = +dtr.toFixed(5);

          // Build stop columns (up to MAX_STOPS, pad empty with '')
          const stopCols = [];
          for (let i = 0; i < MAX_STOPS; i++) {
            if (i < stopEntries.length) {
              stopCols.push(+stopEntries[i].depth.toFixed(5), +stopEntries[i].time.toFixed(5));
            } else {
              stopCols.push('', '');
            }
          }

          const row = [
            dive_id,
            depth,
            bt,
            o2,
            gfLow,
            gfHigh,
            total_runtime_min,
            total_runtime_sec,
            tts_min,
            hasDeco,
            numDecoStops,
            ...stopCols,
          ];
          rows.push(row.join(','));

          if (dive_id % logInterval === 0 || dive_id === total) {
            const elapsed = (Date.now() - startTime) / 1000;
            const pct = ((dive_id / total) * 100).toFixed(1);
            const rate = dive_id / (elapsed || 1);
            const eta = ((total - dive_id) / (rate || 1)).toFixed(1);
            console.log(
              `[${pct}%] ${dive_id}/${total} — D:${depth} BT:${bt} O2:${o2} GF:${gfLow}/${gfHigh} — elapsed:${elapsed.toFixed(1)}s ETA:${eta}s`
            );
          }
        }
      }
    }
  }
}

const outPath = path.join(__dirname, '../../data/tables_plans.csv');
fs.writeFileSync(outPath, rows.join('\n'));
console.log(`Generated ${dive_id} dive plans → ${outPath}`);
