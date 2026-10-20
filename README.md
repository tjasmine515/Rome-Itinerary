# Booked & Busy — group trip planners

*Everyone on the same page.*

One shared app, one folder per city. Each city builds to its own single-file site in `dist/<city>/`, ready to drag onto Netlify.

| City  | Live site                          | Firebase project          |
|-------|------------------------------------|---------------------------|
| Rome  | bookedandbusyrome.netlify.app      | `booked-and-busy-d265f`   |
| Paris | bookedandbusyparis.netlify.app     | its own project (see `cities/paris/city.json` → `firebase`) |

## Layout

```
src/app.js          the app: tabs, sync, budget, voting… (no city content)
src/styles.css      shared styles
src/template.html   page skeleton
src/fonts/          Fraunces, Playfair Display, DM Sans, Caveat (SIL OFL 1.1)
cities/<city>/
  city.json         everything city-specific: ideas, bookings, packing, sample trip,
                    wording, Firebase config, closures, tourist tax, pocket guide…
  theme.css         colors, fonts, pattern
  head.html         page title + description
  hero.svg          cover illustration
  icons/            optional icon files (copied next to index.html)
  firestore.rules   security rules to paste into that city's Firebase project
build.py            python3 build.py [city]  →  dist/<city>/
tests/compare.mjs   renders two builds screen by screen and checks they match
tests/paris.mjs     clicks through Paris: sharing, simultaneous edits, tax, tips, closures
```

## Adding a city

Copy `cities/paris/` to `cities/<new>/`, edit `city.json`, `theme.css`, `head.html` and `hero.svg`, then `python3 build.py <new>`.
Optional extras switch on only when `city.json` has them: `pocket` (pocket guide tab), `closures`, `bookFirst`, `gettingAround`, `budget.tipping`, `budget.touristTax`, `budget.prices`, `tabIcons`.
Bookings with a `lead` (days before the trip) move their book-by date when the trip dates change.

## Icons (Paris)

`cities/paris/icons/` holds placeholder line art: eiffel-tower, key, lamp, wine-glass, metro-sign, croissant, cafe-table, fan, phrasebook, macaron, postcard. To use a licensed pack, drop in files with the same names (`.png` wins over `.svg`). Which icon goes on which tab is set in `city.json` → `tabIcons`.

## Testing

- `index.html?today=2026-11-11` pretends it's another day.
- With no Firebase config, `?mock` turns on a test backend that syncs tabs within one browser (access code = `mockCode` in `city.json`).
- `node tests/compare.mjs tests/fixtures/rome-live.html dist/rome/index.html` proves Rome still matches the live site.
