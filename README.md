# Booked & Busy — Rome edition

*Your travels, collected.*

A trip command center for a Rome group trip, built as **one self-contained file: `index.html`**. There's no server, account or internet connection involved. Everything saves to the browser it's opened in (`localStorage`).

## For buyers

1. Open `index.html` in any modern browser: phone, tablet or laptop.
2. The app opens with a sample trip so you can see how it works. Rename the trip, set your dates and add your crew on **Guest List**. Or use **Start over… → Blank trip**, which keeps the Rome ideas and booking tips.
3. **Save a backup** downloads a `.json` file. Use **Load a backup** on another device (or send the file to the group) to pick up where you left off.

Tabs: Home · Guest List · Trip Dashboard · Vibe Vote · Itinerary · Budget & Split · Booking Tracker · Packing List · Dream Board · Memories.

### Optional custom art
Put images next to `index.html` and the app uses them automatically. Anything missing falls back to emoji or a built-in illustration, so you never see a broken image:

```
images/hero.jpg                  Home hero banner
icons/home.png  guests.png  dashboard.png  vote.png  itinerary.png
icons/budget.png  bookings.png  packing.png  dream.png  memories.png
icons/doodle-1.png  doodle-2.png  doodle-3.png   accent doodles
```
Buyers can also upload their own cover photo, dream-board photos and journal photos inside the app. These are resized so they fit in browser storage.

## For development

The shipped file is generated from `src/`:

```
src/template.html   page skeleton
src/styles.css      all styles
src/app.js          state, views, interactions (vanilla JS, no dependencies)
src/fonts/          Fraunces, DM Sans, Caveat (SIL OFL 1.1), embedded as base64
build.py            python3 build.py  →  index.html
```

Handy for testing: `index.html?today=2026-11-11` pretends it's another day, which previews the in-trip "Today" card and shifts the booking urgency colors.
