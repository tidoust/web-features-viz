# Exploring visualizations of web-features

This repository contains CSV files with statistics computed from [web-features](https://github.com/web-platform-dx/web-features), PNG exports of corresponding graphs generated through [Datawrapper](https://www.datawrapper.de/), and the Node.js script used to produce the CSV files and graphs.

The goal with the CSV files is to explore possible visualizations of the catalog of features in web-features and assess whether these visualizations tell us something useful about the web platform.

**Note:** CSV files use `;` as separator.

**Note:** The files are not automatically updated and may well be out of sync with the web-features catalog when you read this! Check last modification dates.


## How to run the script

### Clone the repository and install dependencies:

```
git clone https://github.com/tidoust/web-features-viz.git
cd web-features-viz
npm install
```

### Run the script

```
node index.mjs
```

This should update the CSV files in the `csv` folder, ready to be injected in some graph rendering library or service.

The script attempts to update and re-publish Datawrapper graphs if it gets run with a `--graphs` argument, updating the PNG exports in the `graphs` folder. This requires a Datawrapper API token set in a local `config.json` file and, more importantly, this **will not work** on your machine because the Datawrapper graphs are under my account (the graph IDs are hardcoded in the script).

You should be able to generate graphs yourself from the CSV files using Datawrapper or your favorite graph library or service.

## Generated CSV files

### Timelines

#### Evolution of the number of web features

The `timeline-number.csv` file contains the evolution of the number of web features over time per Baseline type.

Columns:
- `Date`: The date in format `YYYY-MM-DD`. Dates that appear in the file are typically dates at which a new version of some browser was released.
- `Widely available`: The number of widely available features at that date.
- `Newly available`: The number of newly available (but not widely available) features at that date
- `Implemented somewhere`: The number of features that were implemented in at least one browser (but not available in all browsers) at that date.

**Note:** Features that have not shipped anywhere are not associated with any date in web-features and do not appear in the CSV file. As of January 2025, 32 features (out of >1000 features) are in that category.

Resulting Datawrapper graph: https://datawrapper.dwcdn.net/iIjGw/1/

The percentage version shows the evolution of the relative distribution between the different types of features: https://datawrapper.dwcdn.net/8UXj2/2/

#### Evolution of the duration from first implementation to newly available

The `timeline-durations.csv` file contains the evolution of the duration needed for a feature to go from first implementation available to newly available from year to year.

Columns:
- `Year`: The year being considered.
- `Maximum duration`: The maximum duration (in days) for a feature that became newly available during the year to go from first implementation to newly available.
- `Average duration`: The average duration (in days) for all features that became newly available during the year to go from first implementation to newly available.
- `Median duration`: The median duration (in days) for all features that became newly available during the year to go from first implementation to newly available. The median is slightly lower than the average (exceptional cases skew the distribution towards longer durations).
- `Minimum duration`: The minimum duration (in days) for a feature that became newly available during the year to go from first implementation to newly available.
- `Number of features`: The number of features that became newly available during the year.

**Note:** What about going from first implementation to widely available? The data is mostly uninteresting there: given the [current definition of widely available](https://github.com/web-platform-dx/web-features/blob/main/docs/baseline.md#wider-support-high-status), in 99.9% of all cases, you just need to add 910 days (30 months) to the durations reported in `timeline-durations.csv`.

Resulting graph: https://datawrapper.dwcdn.net/NSz5R/2/

### Per feature group

All other files list feature groups. Only groups that don't have a parent group are listed (so `CSS` but not `CSS > Layout`).

**Note:** Resulting data and graphs need to be read with care because comparing groups is sometimes awkward: some groups are very large (>100 features) while others are very small (<5 features), and features themselves vary in granularity. For example, WebRTC is a small group composed of a handful of features, and yet it's a large set of technologies. Also, about one fifth of features are not part of any group for now.

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

The `groups-low.csv` file contains the list of groups sorted by the number of newly available features they contain (from most to least). This view is meant to capture the areas where the web platform currently grows (in an interoperable manner).

https://datawrapper.dwcdn.net/vTw7q/2/

#### Groups sorted by number of features with limited availability

The `groups-limited.csv` file contains the list of groups sorted by the number of features that have limited availability they contain (from most to least). This view is meant to capture the parts of the web platform that are still in flux because they contain features that are either still being worked upon or for which there is disagreement among core browser vendors.

https://datawrapper.dwcdn.net/O00YF/2/
