const fs = require('fs');
const path = require('path');
const vm = require('vm');

////////////// PARAMETERS //////////////
const num_samples = 5;
////////////// PARAMETERS //////////////

// Mock browser environment
const sandbox = {
  console: console,
  dataManager: {
    getMN90: () => ({}),
    getTable2: () => ({}),
    getTable3: () => ({}),
  },
};
sandbox.window = sandbox; // Circular reference so 'window' refers to the global object

// Load planning.js
const planningPath = path.join(__dirname, 'planning.js');
const planningCode = fs.readFileSync(planningPath, 'utf8');

// Create context and run script
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

// Parameters
const scriptPath = path.join(__dirname, 'script.js');
const scriptCode = fs.readFileSync(scriptPath, 'utf8');

function getConst(name) {
  const match = scriptCode.match(new RegExp(`const\\s+${name}\\s*=\\s*([^;]+);`));
  if (!match) throw new Error(`Constant ${name} not found in script.js`);
  return eval(match[1]);
}

const MIN_DEPTH = getConst('MIN_DEPTH');
const MAX_DEPTH = getConst('MAX_DEPTH');
const MIN_TIME = getConst('MIN_TIME');
const MAX_TIME = getConst('MAX_TIME');
const MIN_O2 = getConst('MIN_O2_pct');
const MAX_O2 = getConst('MAX_O2_pct');
const MIN_GF = getConst('MIN_GF_pct');
const MAX_GF = getConst('MAX_GF_pct');

function linspace(start, end, num) {
  if (!num) {
    const arr = [];
    for (let i = start; i <= end; i++) {
      arr.push(i);
    }
    return arr;
  }
  const step = (end - start) / (num - 1);
  const arr = [];
  for (let i = 0; i < num; i++) {
    arr.push(Math.round(start + step * i));
  }
  return arr;
}

const depths = linspace(MIN_DEPTH, MAX_DEPTH, num_samples);
const durations = linspace(MIN_TIME, MAX_TIME, num_samples);
const o2s = linspace(MIN_O2, MAX_O2, num_samples);
const gfLows = linspace(MIN_GF, MAX_GF, num_samples);
const gfHighs = linspace(MIN_GF, MAX_GF, num_samples);

const headers = [
  'mode',
  'GF low',
  'GF high',
  'O2',
  'depth',
  'duration',
  'TTS',
  '3m',
  '6m',
  '9m',
  '12m',
  '15m',
  'deeperstops',
];
const rows = [headers.join(',')];

const total = gfLows.length * gfHighs.length * o2s.length * depths.length * durations.length;
const logInterval = Math.max(1, Math.floor(total / 10000)); // log ~100 times
let count = 0;
const startTime = Date.now();

console.log(`Generating ${total} dive plans...`);
for (const gfLow of gfLows) {
  for (const gfHigh of gfHighs) {
    for (const o2 of o2s) {
      for (const depth of depths) {
        for (const duration of durations) {
          const diveParams = {
            bottomTime: duration,
            maxDepth: depth,
            gfLow: gfLow,
            gfHigh: gfHigh,
            fN2: (100 - o2) / 100,
            surfacePressure: 1.01325,
          };

          const result = Planning.calculateBuhlmannPlan(diveParams);
          const stops = result.profile.stops || {};
          const dtr = result.dtr;

          const stop3m = stops[3] || 0;
          const stop6m = stops[6] || 0;
          const stop9m = stops[9] || 0;
          const stop12m = stops[12] || 0;
          const stop15m = stops[15] || 0;

          let deeperStops = 0;
          Object.keys(stops).forEach((d) => {
            const depthNum = Number(d);
            if (depthNum > 15) {
              deeperStops += stops[d];
            }
          });

          const row = [
            'GF',
            gfLow,
            gfHigh,
            o2,
            depth,
            duration,
            dtr,
            stop3m,
            stop6m,
            stop9m,
            stop12m,
            stop15m,
            deeperStops,
          ];
          rows.push(row.join(','));
          count++;

          if (count % logInterval === 0 || count === total) {
            const elapsed = (Date.now() - startTime) / 1000;
            const pct = ((count / total) * 100).toFixed(1);
            const rate = count / (elapsed || 1);
            const eta = ((total - count) / (rate || 1)).toFixed(1);
            console.log(
              `[${pct}%] ${count}/${total} — GF ${gfLow}/${gfHigh} O2:${o2} D:${depth} T:${duration} — elapsed:${elapsed.toFixed(1)}s ETA:${eta}s`
            );
          }
        }
      }
    }
  }
}

fs.writeFileSync('./data/gf_dive_plans.csv', rows.join('\n'));
console.log(`Generated ${count} dive plans in gf_dive_plans.csv`);
