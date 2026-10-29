# Forecast

A responsive weather app powered by live forecasts from [Open-Meteo](https://open-meteo.com/). No API key or build step is required.

## Run locally

Serve this directory over HTTP, for example with Python:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. Serving the app locally also enables browser geolocation on supported browsers.

## Features

- Search for cities with Open-Meteo's geocoding API.
- View current conditions, an hourly forecast, and a seven-day outlook.
- Use the browser's current location when permission is granted.
- Save favorite cities for quick access.
- Switch between Celsius and Fahrenheit and choose a persistent dark theme.
- Search for cities as you type, and restore your last selected city after reload.
- Browse the hourly forecast in six-hour increments and refresh on demand.
- Use the custom weather favicon.

The app uses the Open-Meteo [forecast API](https://open-meteo.com/en/docs) and [geocoding API](https://open-meteo.com/en/docs/geocoding-api); no credentials are needed.
