/**
 * Process baseline data from the web-features package to create
 * data tables for visualization purpose.
 *
 * Some notes:
 * - Timeline stats do not include features that have not shipped anywhere
 * because these aren't associated with any date in web-features (32 features
 * as of January 2025).
 * - Process drops occurrences of '≤' in dates, because it's hard to deal with
 * uncertainties in stats.
 */

import { browsers, features, groups, snapshots } from 'web-features';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import util from 'node:util';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const csvFolder = path.join(__dirname, 'csv');
const pngFolder = path.join(__dirname, 'graphs');


console.log(`Drop ≤, we're Sith and only deal in absolutes...`);
let approx = 0;
for (const [name, feature] of Object.entries(features)) {
  let updated = false;
  if (feature.status.baseline_low_date &&
      feature.status.baseline_low_date.startsWith('≤')) {
    feature.status.baseline_low_date = feature.status.baseline_low_date.slice(1);
    updated = true;
  }
  if (feature.status.baseline_high_date &&
      feature.status.baseline_high_date.startsWith('≤')) {
    feature.status.baseline_high_date = feature.status.baseline_high_date.slice(1);
    updated = true;
  }
  for (const [browser, version] of Object.entries(feature.status.support)) {
    if (version.startsWith('≤')) {
      feature.status.support[browser] = version.slice(1);
      updated = true;
    }
  }
  if (updated) {
    approx += 1;
  }
}
console.log(`- ${approx} features found with a ≤ somewhere`)
console.log(`Drop ≤, we're Sith and only deal in absolutes... done`);


console.log(`Compute first implementation dates...`);
let dates = new Set();
for (const [name, feature] of Object.entries(features)) {
  feature.status.first_implementation_date =
    Object.entries(feature.status.support)
      .map(([browser, version]) =>
        browsers[browser].releases.find(r => r.version === version))
      .map(release => release.date)
      .sort()
      .reverse()
      .pop();
  if (feature.status.baseline_high_date) {
    dates.add(feature.status.baseline_high_date);
  }
  if (feature.status.baseline_low_date) {
    dates.add(feature.status.baseline_low_date);
  }
  if (feature.status.first_implementation_date) {
    dates.add(feature.status.first_implementation_date);
  }
}
dates = [...dates].sort();
const years = [...new Set(dates.map(d => d.slice(0, 4)))].sort();
console.log(`- ${dates.length} dates from ${dates[0]} to ${dates[dates.length - 1]}`);
console.log(`Compute first implementation dates... done`);


console.log(`Prepare the list of groups...`);
groups.ungrouped = { name: 'Ungrouped features' };
groups.all = { name: 'All features' };
for (const [id, group] of Object.entries(groups)) {
  // Flat list of feature names that are in the group
  group.features = [];

  // Feature names per status and per release date
  group.timeline = dates.map(d => Object.assign({
    date: d,
    high: [],
    low: [],
    first: []
  }));

  // Feature names per status
  group.baseline = {
    high: [],
    low: [],
    limited: [],
    discouraged: []
  };

  // Compute full name
  group.fullname = `${group.name}`;
  let parentGroup = groups[group.parent];
  while (parentGroup) {
    if (!parentGroup.subgroups) {
      parentGroup.subgroups = [];
    }
    parentGroup.subgroups.push(group);
    group.fullname = `${parentGroup.name} > ${group.fullname}`;
    parentGroup = groups[parentGroup.parent];
  }
}
console.log(`Prepare the list of groups... done`);


console.log(`Compile stats...`);
for (const [name, feature] of Object.entries(features)) {
  let status = feature.status.baseline;
  if (feature.discouraged) {
    status = 'discouraged';
  }
  else if (feature.status.baseline === undefined) {
    throw new Error(`${name} still has an undefined baseline status!`);
  }
  else if (!feature.status.baseline) {
    status = 'limited';
  }
  if (feature.group) {
    const egroups = (typeof feature.group === 'string') ?
      [feature.group] : feature.group;
    for (const egroup of egroups) {
      const group = groups[egroup];
      addToGroup(name, feature, group, status);
    }
  }
  else {
    addToGroup(name, feature, groups.ungrouped, status);
  }
  addToGroup(name, feature, groups.all, status);
}

// Compile numbers for each group.
for (const [id, group] of Object.entries(groups)) {
  group.specific = {
    timeline: group.timeline.map((d, idx) => getCumul(d.date, idx, group.timeline)),
    baseline: {
      high: group.baseline.high.length,
      low: group.baseline.low.length,
      limited: group.baseline.limited.length,
      discouraged: group.baseline.discouraged.length
    }
  };
  group.specific.baseline.total =
    group.specific.baseline.high +
    group.specific.baseline.low +
    group.specific.baseline.limited +
    group.specific.baseline.discouraged;

  group.specific.durations = compileDurations(group);
}

// Compute merged stats
for (const [id, group] of Object.entries(groups)) {
  group.merged = {
    timeline: group.specific.timeline.map(d => Object.assign({
      date: d.date,
      high: mergeStats(group, 'timeline', 'high', d.date),
      low: mergeStats(group, 'timeline', 'low', d.date),
      first: mergeStats(group, 'timeline', 'first', d.date),
      total: mergeStats(group, 'timeline', 'total', d.date),
    })),
    baseline: {
      high: mergeStats(group, 'baseline', 'high'),
      low: mergeStats(group, 'baseline', 'low'),
      limited: mergeStats(group, 'baseline', 'limited'),
      discouraged: mergeStats(group, 'baseline', 'discouraged'),
      total: mergeStats(group, 'baseline', 'total')
    },
    durations: group.specific.durations.map(y => Object.assign({
      year: y.year,
      first2low: mergeStats(group, 'durations', 'first2low', y.year),
      low2high: mergeStats(group, 'durations', 'low2high', y.year)
    }))
  };
}
console.log(`- ${groups.all.merged.baseline.total} features in total`);
console.log(`- ${groups.all.merged.baseline.high} widely available`);
console.log(`- ${groups.all.merged.baseline.low} newly available`);
console.log(`- ${groups.all.merged.baseline.limited} with limited availability`);
console.log(`- ${groups.all.merged.baseline.discouraged} discouraged`);
console.log(`Compile stats... done`);


const graphs = [
  {
    title: 'Evolution of the number of web features',
    id: 'timeline-number',
    data: 'timeline-number.csv',
    datawrapperId: 'iIjGw',
    headers: ['Date', 'Widely available', 'Newly available',
              'Implemented somewhere'],
    content: groups => groups.all.specific.timeline
      .map(d => [d.date, d.high, d.low - d.high, d.first - d.low])
  },
  {
    title: 'Evolution of the number of web features (%)',
    id: 'timeline-percent',
    data: 'timeline-number.csv',
    datawrapperId: '8UXj2'
  },
  {
    title: 'Evolution of the duration from first implementation to newly available',
    id: 'timeline-durations',
    data: 'timeline-durations.csv',
    datawrapperId: 'NSz5R',
    headers: ['Year', 'Maximum duration', 'Average duration', 'Median duration',
              'Minimum duration', 'Number of features'],
    content: groups => groups.all.specific.durations
      .filter(y => y.first2low.length > 0)
      .map(y => [
        y.year,
        y.first2low[y.first2low.length - 1],
        getAverage(y.first2low),
        getMedian(y.first2low),
        y.first2low[0],
        y.first2low.length
      ])
  },
  {
    title: 'Groups sorted by total number of features',
    id: 'groups-features',
    data: 'groups-features.csv',
    datawrapperId: 'JRT5t',
    headers: ['Group', 'Widely available', 'Newly available',
              'Limited availability', 'Discouraged'],
    content: groups => Object.values(groups)
      .filter(group => !group.fullname.match(/ > /))
      .filter(group => group.fullname !== 'All features')
      .sort((g1, g2) => g2.merged.baseline.total - g1.merged.baseline.total)
      .map(group => [
        group.fullname,
        group.merged.baseline.high,
        group.merged.baseline.low,
        group.merged.baseline.limited,
        group.merged.baseline.discouraged
      ])
  },
  {
    title: 'Groups sorted by percentage of widely available features',
    id: 'groups-percent',
    data: 'groups-percent.csv',
    datawrapperId: 'IPoM6',
    headers: ['Group', 'Widely available', 'Newly available',
              'Limited availability', 'Discouraged'],
    content: groups => Object.values(groups)
      .filter(group => !group.fullname.match(/ > /))
      .sort((g1, g2) => {
        const res = 
          Math.round(g2.merged.baseline.high / g2.merged.baseline.total * 100) -
          Math.round(g1.merged.baseline.high / g1.merged.baseline.total * 100);
        if (res === 0) {
          return g2.merged.baseline.total - g1.merged.baseline.total;
        }
        else {
          return res;
        }
      })
      .map(group => [
        group.fullname === 'All features' ? `<b>${group.fullname}</b>` : group.fullname,
        group.merged.baseline.high,
        group.merged.baseline.low,
        group.merged.baseline.limited,
        group.merged.baseline.discouraged
      ])
  },
  {
    title: 'Groups sorted by number of features that are newly available',
    id: 'groups-low',
    data: 'groups-low.csv',
    datawrapperId: 'vTw7q',
    headers: ['Group', 'Widely available', 'Newly available',
              'Limited availability', 'Discouraged'],
    content: groups => Object.values(groups)
      .filter(group => !group.fullname.match(/ > /))
      .filter(group => group.fullname !== 'All features')
      .sort((g1, g2) => g2.merged.baseline.low - g1.merged.baseline.low)
      .map(group => [
        group.fullname,
        group.merged.baseline.high,
        group.merged.baseline.low,
        group.merged.baseline.limited,
        group.merged.baseline.discouraged
      ])
  },
  {
    title: 'Groups sorted by number of features with limited availability',
    id: 'groups-limited',
    data: 'groups-limited.csv',
    datawrapperId: 'O00YF',
    headers: ['Group', 'Widely available', 'Newly available',
              'Limited availability', 'Discouraged'],
    content: groups => Object.values(groups)
      .filter(group => !group.fullname.match(/ > /))
      .filter(group => group.fullname !== 'All features')
      .sort((g1, g2) => g2.merged.baseline.limited - g1.merged.baseline.limited)
      .map(group => [
        group.fullname,
        group.merged.baseline.high,
        group.merged.baseline.low,
        group.merged.baseline.limited,
        group.merged.baseline.discouraged
      ])
  }
];


for (const graph of graphs) {
  if (!graph.headers) {
    // Percentage graphs may reuse data from another CSV file
    continue;
  }
  console.log(`${graph.title}...`);
  const content = [graph.headers]
    .concat(graph.content(groups))
    .map(a => a.join(';'))
    .join('\n');
  await fs.writeFile(path.join(csvFolder, graph.data), content, 'utf8');
  console.log(`- wrote ${graph.data}`);
  console.log(`${graph.title}... done`);
}


// Consider update Datawrapper graphs and PNG files if requested and possible
if (process.argv[2] !== '--graphs') {
  process.exit(0);
}
let DATAWRAPPER_TOKEN = null;
try {
  const configFileUrl = 'file:///' +
    path.join(process.cwd(), 'config.json').replace(/\\/g, '/');
  const { default: env } = await import(
    configFileUrl,
    { with: { type: 'json' } }
  );
  DATAWRAPPER_TOKEN = env.DATAWRAPPER_TOKEN
}
catch {
}
if (!DATAWRAPPER_TOKEN) {
  console.warn(`No Datawrapper API token found... cannot update graphs`);
  process.exit(0);
}

console.log(`Update Datawrapper graphs...`);
for (const graph of graphs) {
  await run(`curl --request PUT \
    --url "https://api.datawrapper.de/v3/charts/${graph.datawrapperId}/data" \
    --upload-file "${path.join(csvFolder, graph.data)}" \
    --header "Authorization: Bearer ${DATAWRAPPER_TOKEN}" \
    --silent`);
  console.log(`- updated graph ${graph.id} with ${graph.data}`);
  await run(`curl --request POST \
    --url "https://api.datawrapper.de/v3/charts/${graph.datawrapperId}/publish" \
    --header "Authorization: Bearer ${DATAWRAPPER_TOKEN}" \
    --silent`);
  console.log(`- re-published graph ${graph.id} with ${graph.data}`);
}
console.log(`Update Datawrapper graphs... done`);

console.log(`Export Datawrapper graphs...`);
for (const graph of graphs) {
  await run(`curl --request GET \
    --url "https://api.datawrapper.de/v3/charts/${graph.datawrapperId}/export/png?unit=px&mode=rgb&plain=true&zoom=2&borderWidth=20" \
    --header "accept: */*" \
    --output "${path.join(pngFolder, graph.id)}.png" \
    --header "Authorization: Bearer ${DATAWRAPPER_TOKEN}" \
    --silent`);
  console.log(`- wrote ${graph.id}.png`);
}
console.log(`Export Datawrapper graphs... done`);


/**********************************************************
 * A few helper functions
 **********************************************************/
function getCumul(date, idx, list) {
  const cumul = {
    date,
    high: list.slice(0, idx + 1).reduce((tot, d) => tot + d.high.length, 0),
    low: list.slice(0, idx + 1).reduce((tot, d) => tot + d.low.length, 0),
    first: list.slice(0, idx + 1).reduce((tot, d) => tot + d.first.length, 0)
  };
  cumul.total = cumul.high + cumul.low + cumul.first;
  return cumul;
}

function mergeStats(group, type, subtype, date) {
  if (type === 'timeline') {
    return group.specific[type].find(d => d.date === date)[subtype] +
      (group.subgroups ?? []).reduce((tot, g) => tot + mergeStats(g, type, subtype, date), 0);
  }
  else if (type === 'durations') {
    return group.specific[type].find(d => d.year === date)[subtype] +
      (group.subgroups ?? []).reduce((tot, g) => tot + mergeStats(g, type, subtype, date), 0);
  }
  else {
    return group.specific[type][subtype] +
      (group.subgroups ?? []).reduce((tot, g) => tot + mergeStats(g, type, subtype), 0);
  }
}

function addToGroup(name, feature, group, status) {
  group.features.push(name);
  group.baseline[status].push(name);
  if (feature.status.baseline_high_date) {
    group.timeline
      .find(d => d.date === feature.status.baseline_high_date)
      .high
      .push(name);
  }
  if (feature.status.baseline_low_date) {
    group.timeline
      .find(d => d.date === feature.status.baseline_low_date)
      .low
      .push(name);
  }
  if (feature.status.first_implementation_date) {
    group.timeline
      .find(d => d.date === feature.status.first_implementation_date)
      .first
      .push(name);
  }
}

function compileDurations(group) {
  const durations = years.map(y => Object.assign({
    year: y,
    first2low: [],
    low2high: []
  }));
  for (const name of group.features) {
    const feature = features[name];
    if (feature.status.baseline_low_date) {
      const year = feature.status.baseline_low_date.slice(0, 4);
      const duration = Math.floor(
        (new Date(feature.status.baseline_low_date) - new Date(feature.status.first_implementation_date)) / 86400000
      );
      durations.find(y => y.year === year).first2low.push(duration);
    }
    if (feature.status.baseline_high_date) {
      const year = feature.status.baseline_high_date.slice(0, 4);
      const duration = Math.floor(
        (new Date(feature.status.baseline_high_date) - new Date(feature.status.baseline_low_date)) / 86400000
      );
      durations.find(y => y.year === year).low2high.push(duration);
    }
  }

  for (const year of durations) {
    year.first2low.sort((d1, d2) => d1 - d2);
    year.low2high.sort((d1, d2) => d1 - d2);
  }
  return durations;
}

function getMedian(arr) {
  const middle = Math.floor(arr.length / 2);
  return arr[middle];
}

function getAverage(arr) {
  const sum = arr.reduce((tot, curr) => tot + curr, 0);
  return Math.floor(sum / arr.length);
}

async function run(cmd, options) {
  try {
    const { stdout, stderr } = await util.promisify(exec)(cmd, options);
    if (stderr && !options?.ignoreErrors) {
      console.error(`Could not run command: ${cmd}`);
      console.error(stderr);
      process.exit(1);
    }
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }
  catch (err) {
    if (options?.ignoreErrors) {
      return { stdout: '', stderr: err.toString().trim() };
    }
    else {
      console.error(`Could not run command: ${cmd}`);
      console.error(err.toString());
      process.exit(1);
    }
  }
}