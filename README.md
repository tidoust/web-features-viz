# Exploring visualizations of web-features

This repository contains a Node.js script that processes data in web-features to compute statistics and produce CSV files (that use `;` as separator) that can be used to produce graphs.

## Installation

Clone the repository and install dependency through

```
git clone https://github.com/tidoust/web-features-viz.git
cd web-features-viz
npm ci
```

## Usage

Run:

```
node index.mjs
```

This should produce the CSV files described below, ready to be injected in your favorite graph rendering library. Graphs presented here were produced using [Datawrapper](https://www.datawrapper.de/) but any graph library should be able to ingest the resulting CSV files and render a graph.


## Generated CSV files

### Timelines

#### Evolution of the number of web features

The `timeline-number.csv` file contains the evolution of the number of web features over time per Baseline type.

Columns:
- `Date`: The date in format `YYYY-MM-DD`. Dates that appear in the file are typically dates at which a new version of some browser was released.
- `Widely available`: The number of widely available features at that date
- `Newly available`: The number of newly available (but not widely available) features at that date
- `Implemented somewhere`: The number of features that were implemented in at least one browser (but not available in all browsers) at that date.

**Note:** Features that have not shipped anywhere are not associated with any date in web-features and cannot be put on the timeline. As of January 2025, 32 features are in that category.

Resulting graph: https://datawrapper.dwcdn.net/iIjGw/1/
And in percentages: https://datawrapper.dwcdn.net/8UXj2/2/

#### Evolution of the duration from first implementation to newly available

The `timeline-durations.csv` file contains the evolution of the duration needed for a feature to go from first implementation available to newly available.

Resulting graph: https://datawrapper.dwcdn.net/NSz5R/2/

### Per feature group

All other files list feature groups. Only groups that don't have a parent group are listed (so `CSS` but not `CSS > Layout`).

Columns are the same in all files:
- `Group`: The group name. Only groups that don't have parents are listed.
- `Widely available`: Number of widely available features in the group.
- `Newly available`: Number of newly available features in the group.
- `Limited availability`: Number of features with limited availability in the group.
- `Discouraged`: Number of discouraged features in the group.

**Note:** That's rare but a feature may appear in more than one group. As such, it may be counted twice.

Main difference between the files is how lines get sorted.

#### Groups sorted by total number of features

The `groups-features.csv` file contains the list of groups sorted by the total number of features they contribute to the web platform (from most to least).

https://datawrapper.dwcdn.net/JRT5t/2/

#### Groups sorted by percentage of widely available features

The `groups-percent.csv` file contains the list of groups sorted by the percentage of widely available features they contain (from most to least). This view is meant to capture the most stable - or possibly ossified - parts of the web platform.

https://datawrapper.dwcdn.net/IPoM6/2/

#### Groups sorted by number of newly available features

The `groups-new.csv` file contains the list of groups sorted by the number of newly available features they contain (from most to least). This view is meant to capture the areas where the web platform currently grows (in an interoperable manner).

https://datawrapper.dwcdn.net/vTw7q/2/

#### Groups sorted by number of features with limited availability

The `groups-limited.csv` file contains the list of groups sorted by the number of features that have limited availability they contain (from most to least). This view is meant to capture the parts of the web platform that are still in flux because they contain features that are either still being worked upon or for which there is disagreement among core browser vendors.

https://datawrapper.dwcdn.net/O00YF/2/
