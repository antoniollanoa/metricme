# MetricMe

MetricMe is a lightweight personal weight-tracking dashboard. It runs as a static website with no build step, backend, or package dependencies. Weight entries and your goal are saved in your browser's local storage; they are not sent to a server or included in this repository.

## Run locally

Open `index.html` in a modern browser. An internet connection is needed to load Chart.js from its CDN; measurements and the rest of the dashboard continue to work if the chart library is unavailable.

## Features

- Five at-a-glance metrics: current, starting, and goal weights, total change, and remaining to goal.
- Add measurements in kilograms, edit or delete entries, and replace an entry by saving another measurement for the same date.
- Interactive weight history chart with a goal reference line and 7-day, 30-day, 90-day, and all-time filters.
- Newest-first measurement history with change from the previous measurement.
- CSV export, browser-local persistence, responsive layout, and a light/dark theme toggle.
- Mobile-friendly entry controls and compact measurement cards, with responsive chart sizing for phone, tablet, and desktop screens.
- Input checks for valid weights and dates; no sample or personal measurements are preloaded.

## Data and privacy

MetricMe stores your measurements and goal in the browser's `localStorage` on the device where you use it. Clearing browser storage or switching browsers/devices removes or does not transfer this data. CSV exports are downloaded to your device; keep them private. Do not enter sensitive measurements on a shared browser.

## Deploy to GitHub Pages

1. Add `index.html`, `style.css`, `script.js`, and `README.md` to the repository.
2. Push the files to GitHub.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select the branch containing the files and the `/ (root)` folder, then save.
5. Open the published Pages URL. No build command or server-side configuration is needed.

Chart.js is loaded from jsDelivr at runtime. The page itself is static and has no server-side data storage.

The layout was checked at 375px, 390px, 430px, 768px, and 1440px viewport widths.
