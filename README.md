# Expense Tracker

Cross-platform expense tracking for **Android** and **iOS** using [Expo](https://expo.dev) and React Native. Data stays on-device in SQLite; the Overview tab summarizes totals, category breakdown (pie chart), and recent daily spending (bar chart).

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- For device testing: [Expo Go](https://expo.dev/go) on your phone, or Android Studio / Xcode for emulator builds

## Run the app

```bash
npm install
npx expo start
```

Then scan the QR code (Expo Go), press `a` for Android emulator, or `i` for iOS simulator (macOS only).

## Project layout

| Path | Purpose |
|------|--------|
| `app/` | Screens and navigation ([Expo Router](https://docs.expo.dev/router/introduction/)) |
| `src/db/` | SQLite setup and queries |
| `src/context/` | Expense data provider |
| `src/lib/` | Totals, charts data helpers, formatting |

## Tabs

- **Overview** — Total spend, pie chart by category, 7-day bar chart  
- **Entries** — List and delete expenses  
- **Add** — Amount, category, optional tag (e.g. business / trip), date (`YYYY-MM-DD`), note  

## Native builds

For store-ready binaries you’ll use [EAS Build](https://docs.expo.dev/build/introduction/) or `npx expo run:android` / `npx expo run:ios` with local toolchains.

## Extending

The schema supports **tags** and **notes** for extra dimensions (projects, clients, trips). You can add income tables, budgets, or cloud sync in `src/db` without changing the core navigation.
