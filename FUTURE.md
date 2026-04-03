# Future Ideas

## APOD — Astronomy Picture of the Day

NASA publishes one space photo every day (since 1995) with an explanation written by a professional astronomer.

**Endpoint:** `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`

- `?count=5` — get 5 random APODs
- `?date=2024-01-01` — get a specific date
- `?start_date=2024-01-01&end_date=2024-01-07` — get a range

Returns: image URL (or video), title, explanation, date, copyright info.

**Ideas:**

- Daily wallpaper mode — show today's APOD as a fullscreen background
- "This day in space" — show what the APOD was on your birthday, or on today's date across different years
- Space photo timeline — scroll through a week/month of APODs as a gallery
- Combine with the Mars transmission viewer — toggle between Mars rover photos and APOD

## NEO — Near Earth Objects

Tracks asteroids and comets passing near Earth with orbital data, size, velocity, and hazard classification.

**Endpoints:**

- `https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=DEMO_KEY` — browse all tracked objects
- `https://api.nasa.gov/neo/rest/v1/feed?start_date=2024-01-01&end_date=2024-01-07&api_key=DEMO_KEY` — objects passing near Earth in a date range

Returns: name, estimated diameter (min/max), close approach date, miss distance (km/miles/lunar), relative velocity, whether it's potentially hazardous.

**Ideas:**

- "What just flew past us?" — show the most recent close approaches with size comparisons (car-sized, building-sized, etc.)
- Asteroid threat dashboard — live feed of upcoming close approaches, color-coded by distance and size
- Space dodge visualizer — animate near-miss trajectories relative to Earth/Moon
- Hazardous object tracker — filter to only potentially hazardous asteroids, show a running count
