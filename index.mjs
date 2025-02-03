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


let content = '';
console.log(`Evolution of the number of web features...`);
content =
  [['Date', 'Widely available', 'Newly available', 'Implemented somewhere']]
  .concat(
    groups.all.specific.timeline
      .map(d => [d.date, d.high, d.low - d.high, d.first - d.low])
  )
  .map(a => a.join(';'))
  .join('\n');
await fs.writeFile('timeline-number.csv', content, 'utf8');
console.log(`- wrote timeline-number.csv`);
console.log(`Evolution of the number of web features... done`);


console.log(`Evolution of the duration from first implementation to newly available...`);
content =
  [['Year', 'Maximum duration', 'Average duration', 'Median duration',
    'Minimum duration', 'Number of features']]
  .concat(
    groups.all.specific.durations
      .filter(y => y.first2low.length > 0)
      .map(y => [
        y.year,
        y.first2low[y.first2low.length - 1],
        getAverage(y.first2low),
        getMedian(y.first2low),
        y.first2low[0],
        y.first2low.length
      ])
  )
  .map(a => a.join(';'))
  .join('\n');
await fs.writeFile('timeline-durations.csv', content, 'utf8');
console.log(`- wrote timeline-durations.csv`);
console.log(`Evolution of the duration from first implementation to newly available... done`);


console.log(`Groups sorted by total number of features...`);
content =
  [['Group', 'Widely available', 'Newly available',
    'Limited availability', 'Discouraged']]
  .concat(
    Object.values(groups)
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
  )
  .map(a => a.join(';'))
  .join('\n');
await fs.writeFile('groups-features.csv', content, 'utf8');
console.log(`- wrote groups-features.csv`);
console.log(`Groups sorted by total number of features... done`);


console.log(`Groups sorted by percentage of widely available features...`);
content =
  [['Group', 'Widely available', 'Newly available',
    'Limited availability', 'Discouraged']]
  .concat(
    Object.values(groups)
      .filter(group => !group.fullname.match(/ > /))
      .filter(group => group.fullname !== 'All features')
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
        group.fullname,
        group.merged.baseline.high,
        group.merged.baseline.low,
        group.merged.baseline.limited,
        group.merged.baseline.discouraged
      ])
  )
  .map(a => a.join(';'))
  .join('\n');
await fs.writeFile('groups-percent.csv', content, 'utf8');
console.log(`- wrote groups-percent.csv`);
console.log(`Groups sorted by percentage of widely available features... done`);


console.log(`Groups sorted by number of features that are newly available...`);
content =
  [['Group', 'Widely available', 'Newly available',
    'Limited availability', 'Discouraged']]
  .concat(
    Object.values(groups)
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
  )
  .map(a => a.join(';'))
  .join('\n');
await fs.writeFile('groups-low.csv', content, 'utf8');
console.log(`- wrote groups-low.csv`);
console.log(`Groups sorted by number of features that are newly available... done`);


console.log(`Groups sorted by number of features with limited availability...`);
content =
  [['Group', 'Widely available', 'Newly available',
    'Limited availability', 'Discouraged']]
  .concat(
    Object.values(groups)
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
  )
  .map(a => a.join(';'))
  .join('\n');
await fs.writeFile('groups-limited.csv', content, 'utf8');
console.log(`- wrote groups-limited.csv`);
console.log(`Groups sorted by number of features with limited availability... done`);


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