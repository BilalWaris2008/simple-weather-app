const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_CODES = new Map([
  [0, ["Clear sky", "sun"]],
  [1, ["Mainly clear", "sun"]],
  [2, ["Partly cloudy", "partly"]],
  [3, ["Overcast", "cloud"]],
  [45, ["Foggy", "fog"]],
  [48, ["Rime fog", "fog"]],
  [51, ["Light drizzle", "rain"]],
  [53, ["Drizzle", "rain"]],
  [55, ["Dense drizzle", "rain"]],
  [56, ["Freezing drizzle", "snow"]],
  [57, ["Heavy freezing drizzle", "snow"]],
  [61, ["Light rain", "rain"]],
  [63, ["Rain", "rain"]],
  [65, ["Heavy rain", "rain"]],
  [66, ["Freezing rain", "snow"]],
  [67, ["Heavy freezing rain", "snow"]],
  [71, ["Light snow", "snow"]],
  [73, ["Snow", "snow"]],
  [75, ["Heavy snow", "snow"]],
  [77, ["Snow grains", "snow"]],
  [80, ["Light showers", "rain"]],
  [81, ["Rain showers", "rain"]],
  [82, ["Heavy showers", "rain"]],
  [85, ["Snow showers", "snow"]],
  [86, ["Heavy snow showers", "snow"]],
  [95, ["Thunderstorm", "storm"]],
  [96, ["Thunderstorm & hail", "storm"]],
  [99, ["Severe thunderstorm", "storm"]],
]);

const elements = {
  searchForm: document.querySelector("#search-form"),
  citySearch: document.querySelector("#city-search"),
  searchResults: document.querySelector("#search-results"),
  locationButton: document.querySelector("#location-button"),
  unitToggle: document.querySelector("#unit-toggle"),
  themeToggle: document.querySelector("#theme-toggle"),
  favoriteButton: document.querySelector("#favorite-button"),
  refreshButton: document.querySelector("#refresh-button"),
  savedPlaces: document.querySelector("#saved-places"),
  savedPlacesCount: document.querySelector("#saved-places-count"),
  savedPlacesList: document.querySelector("#saved-places-list"),
  status: document.querySelector("#status-message"),
  currentCard: document.querySelector("#current-card"),
  locationName: document.querySelector("#location-name"),
  currentDate: document.querySelector("#current-date"),
  weatherDescription: document.querySelector("#weather-description"),
  currentTemperature: document.querySelector("#current-temperature"),
  feelsLike: document.querySelector("#feels-like"),
  heroWeatherIcon: document.querySelector("#hero-weather-icon"),
  dayHighLow: document.querySelector("#day-high-low"),
  currentHumidity: document.querySelector("#current-humidity"),
  currentWind: document.querySelector("#current-wind"),
  detailHumidity: document.querySelector("#detail-humidity"),
  humidityNote: document.querySelector("#humidity-note"),
  detailWind: document.querySelector("#detail-wind"),
  windNote: document.querySelector("#wind-note"),
  detailUv: document.querySelector("#detail-uv"),
  uvNote: document.querySelector("#uv-note"),
  sunrise: document.querySelector("#detail-sunrise"),
  sunsetNote: document.querySelector("#sunset-note"),
  hourlyList: document.querySelector("#hourly-list"),
  hourlyPrevious: document.querySelector("#hourly-previous"),
  hourlyNext: document.querySelector("#hourly-next"),
  hourlyRangeLabel: document.querySelector("#hourly-range-label"),
  weeklyList: document.querySelector("#weekly-list"),
};

let unit = localStorage.getItem("forecast-unit") === "f" ? "f" : "c";
let currentWeather = null;
let activeRequest = 0;
let activeSearch = 0;
let searchDebounceTimer = null;
let hourlyStartIndex = 0;
let displayedHourlyData = null;
let savedPlaces = readSavedPlaces();
let preferredTheme = localStorage.getItem("forecast-theme");
const savedCurrentPlace = JSON.parse(localStorage.getItem("forecast-current-place") || "null");

function readSavedPlaces() {
  const stored = JSON.parse(localStorage.getItem("forecast-saved-places") || "[]");
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (place) =>
      typeof place.name === "string" &&
      Number.isFinite(place.latitude) &&
      Number.isFinite(place.longitude),
  );
}

function getPlaceKey(place) {
  return `${Number(place.latitude).toFixed(3)},${Number(place.longitude).toFixed(3)}`;
}

function getTimeBasedTheme() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

function applyTheme(theme) {
  preferredTheme = theme;
  document.documentElement.dataset.theme = theme;
  elements.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  elements.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
  elements.themeToggle.querySelector("use").setAttribute(
    "href",
    theme === "dark" ? "#icon-sun" : "#icon-moon",
  );
  elements.themeToggle.querySelector("span").textContent =
    theme === "dark" ? "Day mode" : "Night mode";
}

function isCurrentPlaceSaved() {
  return (
    currentWeather &&
    savedPlaces.some((place) => getPlaceKey(place) === getPlaceKey(currentWeather.place))
  );
}

function renderSavedPlaces() {
  elements.savedPlaces.hidden = savedPlaces.length === 0;
  elements.savedPlacesCount.textContent = savedPlaces.length
    ? `${savedPlaces.length} ${savedPlaces.length === 1 ? "place" : "places"}`
    : "";

  const chips = savedPlaces.map((place) => {
    const chip = document.createElement("div");
    chip.className = `saved-place${currentWeather && getPlaceKey(currentWeather.place) === getPlaceKey(place) ? " is-current" : ""}`;

    const select = document.createElement("button");
    select.className = "saved-place-select";
    select.type = "button";
    select.textContent = place.name;
    select.setAttribute("aria-label", `Show weather for ${place.name}`);
    select.addEventListener("click", () => loadWeather(place, place.name));

    const remove = document.createElement("button");
    remove.className = "saved-place-remove";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${place.name} from saved places`);
    remove.addEventListener("click", () => {
      savedPlaces = savedPlaces.filter(
        (savedPlace) => getPlaceKey(savedPlace) !== getPlaceKey(place),
      );
      persistSavedPlaces();
    });

    chip.append(select, remove);
    return chip;
  });

  elements.savedPlacesList.replaceChildren(...chips);
  elements.favoriteButton.disabled = !currentWeather || currentWeather.label === "Your location";
  elements.favoriteButton.classList.toggle("is-saved", isCurrentPlaceSaved());
  elements.favoriteButton.setAttribute("aria-pressed", String(isCurrentPlaceSaved()));
  elements.favoriteButton.setAttribute(
    "aria-label",
    isCurrentPlaceSaved() ? "Remove this location from saved places" : "Save this location",
  );
  elements.favoriteButton.querySelector("span").textContent = isCurrentPlaceSaved()
    ? "Saved"
    : "Save";
}

function persistSavedPlaces() {
  localStorage.setItem("forecast-saved-places", JSON.stringify(savedPlaces));
  renderSavedPlaces();
}

function getWeather(code) {
  return WEATHER_CODES.get(code) || ["Conditions unavailable", "cloud"];
}

function weatherIcon(name, className = "") {
  const symbol = name === "moon" ? "moon" : name;
  return `<svg class="${className}" aria-hidden="true"><use href="#icon-${symbol}"></use></svg>`;
}

function formatTemperature(value) {
  const converted = unit === "c" ? value : (value * 9) / 5 + 32;
  return `${Math.round(converted)}°`;
}

function formatWind(speed) {
  return Math.round(speed);
}

function formatClock(localDateTime) {
  const [date, time] = localDateTime.split("T");
  const utcDate = new Date(`${date}T${time}:00Z`);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    timeZone: "UTC",
  }).format(utcDate);
}

function formatDay(date, timeZone) {
  const utcNoon = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    timeZone,
  }).format(utcNoon);
}

function getWindDirection(degrees) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % directions.length];
}

function setStatus(message = "", isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-error", isError);
}

function closeSearchResults() {
  elements.searchResults.hidden = true;
  elements.citySearch.setAttribute("aria-expanded", "false");
}

function showSearchResults(places) {
  elements.searchResults.replaceChildren();

  places.forEach((place) => {
    const button = document.createElement("button");
    button.className = "search-result";
    button.type = "button";
    button.setAttribute("role", "option");

    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = place.name;

    const region = document.createElement("span");
    region.className = "result-region";
    region.textContent = [place.admin1, place.country].filter(Boolean).join(", ");

    button.append(name, region);
    button.addEventListener("click", () => {
      elements.citySearch.value = place.name;
      closeSearchResults();
      loadWeather(place, `${place.name}${place.country ? `, ${place.country}` : ""}`);
    });
    elements.searchResults.append(button);
  });

  elements.searchResults.hidden = false;
  elements.citySearch.setAttribute("aria-expanded", "true");
}

async function searchCity(query) {
  const searchId = ++activeSearch;

  try {
    const url = new URL(GEOCODING_BASE);
    url.search = new URLSearchParams({
      name: query,
      count: "5",
      language: "en",
      format: "json",
    });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Location search failed (${response.status}).`);
    }

    const data = await response.json();
    if (searchId !== activeSearch || elements.citySearch.value.trim() !== query) return;
    const places = data.results || [];
    if (places.length === 0) {
      closeSearchResults();
      setStatus(`No cities found for “${query}”. Try another spelling or city name.`, true);
      return;
    }
    setStatus("");

    if (places.length === 1) {
      showSearchResults(places);
      return;
    }
    showSearchResults(places);
  } catch (error) {
    if (searchId !== activeSearch) return;
    setStatus(error.message || "Couldn't search for that city. Please try again.", true);
  }
}

async function loadWeather(place, label) {
  const requestId = ++activeRequest;
  localStorage.setItem(
    "forecast-current-place",
    JSON.stringify({
      latitude: place.latitude,
      longitude: place.longitude,
      label,
    }),
  );
  elements.currentCard.classList.add("is-loading");
  elements.currentCard.setAttribute("aria-busy", "true");
  elements.refreshButton.disabled = true;
  elements.locationName.textContent = label;
  setStatus("Loading the latest forecast...");

  try {
    const url = new URL(API_BASE);
    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
      hourly: "temperature_2m,precipitation_probability,weather_code",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      timezone: "auto",
      forecast_days: "7",
    });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather request failed (${response.status}).`);
    }

    const data = await response.json();
    if (!data.current || !data.hourly || !data.daily) {
      throw new Error("The weather service returned incomplete forecast data.");
    }
    if (requestId !== activeRequest) return;

    currentWeather = {
      data,
      label,
      place: { latitude: place.latitude, longitude: place.longitude },
    };
    renderWeather();
    elements.refreshButton.disabled = false;
    elements.currentCard.classList.remove("is-loading");
    renderSavedPlaces();
    setStatus("");
  } catch (error) {
    if (requestId !== activeRequest) return;
    elements.currentCard.classList.remove("is-loading");
    elements.refreshButton.disabled = !currentWeather;
    setStatus(error.message || "Couldn't load the forecast. Please try again.", true);
  } finally {
    if (requestId === activeRequest) {
      elements.currentCard.setAttribute("aria-busy", "false");
    }
  }
}

function renderWeather() {
  const { data, label } = currentWeather;
  const { current, daily, hourly } = data;
  const [description, icon] = getWeather(current.weather_code);
  const dateLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: data.timezone,
  }).format(new Date());

  elements.locationName.textContent = label;
  elements.currentDate.textContent = dateLabel;
  elements.weatherDescription.textContent =
    current.is_day === 0 && (current.weather_code === 0 || current.weather_code === 1)
      ? "Clear night"
      : description;
  elements.currentTemperature.innerHTML = `${formatTemperature(current.temperature_2m).slice(0, -1)}<span>°</span>`;
  elements.feelsLike.textContent = formatTemperature(current.apparent_temperature);
  elements.heroWeatherIcon.className = `hero-weather-icon icon-${icon}`;
  elements.heroWeatherIcon.innerHTML = weatherIcon(
    current.is_day === 0 && icon === "sun" ? "moon" : icon,
  );
  elements.dayHighLow.textContent = `H: ${formatTemperature(daily.temperature_2m_max[0])}  L: ${formatTemperature(daily.temperature_2m_min[0])}`;
  elements.currentHumidity.textContent = current.relative_humidity_2m;
  elements.currentWind.textContent = formatWind(current.wind_speed_10m);

  elements.detailHumidity.innerHTML = `${current.relative_humidity_2m}<span>%</span>`;
  elements.humidityNote.textContent =
    current.relative_humidity_2m >= 65
      ? "A little on the humid side"
      : current.relative_humidity_2m <= 35
        ? "On the drier side"
        : "Relative humidity";
  elements.detailWind.innerHTML = `${formatWind(current.wind_speed_10m)}<span> km/h</span>`;
  elements.windNote.textContent = `${getWindDirection(current.wind_direction_10m)} direction`;
  elements.detailUv.textContent = daily.uv_index_max[0].toFixed(1);
  elements.uvNote.textContent = `Today's ${uvDescription(daily.uv_index_max[0])}`;
  elements.sunrise.innerHTML = `${formatClock(daily.sunrise[0])}<span> / ${formatClock(daily.sunset[0])}</span>`;
  elements.sunsetNote.textContent = `Sunrise / sunset · ${data.timezone_abbreviation || data.timezone}`;

  if (hourly !== displayedHourlyData) {
    hourlyStartIndex = getNextHourIndex(hourly, current.time);
    displayedHourlyData = hourly;
  }
  renderHourly(hourly);
  renderWeekly(daily);
}

function uvDescription(value) {
  if (value < 3) return "low UV";
  if (value < 6) return "moderate UV";
  if (value < 8) return "high UV";
  if (value < 11) return "very high UV";
  return "extreme UV";
}

function getNextHourIndex(hourly, currentTime) {
  const nextIndex = hourly.time.findIndex((time) => time > currentTime);
  return nextIndex === -1 ? Math.max(hourly.time.length - 6, 0) : nextIndex;
}

function renderHourly(hourly) {
  const end = Math.min(hourly.time.length, hourlyStartIndex + 6);
  const items = hourly.time.slice(hourlyStartIndex, end).map((time, offset) => {
    const index = hourlyStartIndex + offset;
    const [, icon] = getWeather(hourly.weather_code[index]);
    const probability = hourly.precipitation_probability[index];
    const item = document.createElement("div");
    item.className = "hour-item";
    item.setAttribute("aria-label", `${formatClock(time)}, ${formatTemperature(hourly.temperature_2m[index])}, ${getWeather(hourly.weather_code[index])[0]}${probability ? `, ${probability}% chance of precipitation` : ""}`);
    item.innerHTML = `
      <span class="hour-time">${formatClock(time)}</span>
      ${weatherIcon(icon, `hour-icon icon-${icon}`)}
      <span class="hour-temp">${formatTemperature(hourly.temperature_2m[index])}</span>
      <span class="hour-rain">${probability > 0 ? `${probability}%` : "&nbsp;"}</span>
    `;
    return item;
  });
  elements.hourlyList.replaceChildren(...items);
  elements.hourlyPrevious.disabled = hourlyStartIndex === 0;
  elements.hourlyNext.disabled = end >= hourly.time.length;
  elements.hourlyRangeLabel.textContent =
    hourlyStartIndex === getNextHourIndex(hourly, currentWeather.data.current.time)
      ? "Next 6 hours"
      : `${formatClock(hourly.time[hourlyStartIndex])} – ${formatClock(hourly.time[end - 1])}`;
}

function renderWeekly(daily) {
  const lowest = Math.min(...daily.temperature_2m_min);
  const highest = Math.max(...daily.temperature_2m_max);
  const spread = Math.max(highest - lowest, 1);
  const rows = daily.time.map((date, index) => {
    const [, icon] = getWeather(daily.weather_code[index]);
    const min = daily.temperature_2m_min[index];
    const max = daily.temperature_2m_max[index];
    const left = ((min - lowest) / spread) * 100;
    const width = Math.max(((max - min) / spread) * 100, 8);
    const row = document.createElement("div");
    row.className = "day-row";
    row.setAttribute("aria-label", `${index === 0 ? "Today" : formatDay(date, currentWeather.data.timezone)}: ${getWeather(daily.weather_code[index])[0]}, high ${formatTemperature(max)}, low ${formatTemperature(min)}`);
    row.innerHTML = `
      <span class="day-name">${index === 0 ? "Today" : formatDay(date, currentWeather.data.timezone)}</span>
      ${weatherIcon(icon, `day-icon icon-${icon}`)}
      <span class="day-min">${formatTemperature(min)}</span>
      <span class="temperature-range" aria-hidden="true"><span class="temperature-range-fill" style="left:${left}%;width:${width}%"></span></span>
      <span class="day-max">${formatTemperature(max)}</span>
    `;
    return row;
  });
  elements.weeklyList.replaceChildren(...rows);
}

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = elements.citySearch.value.trim();
  if (query.length < 2) {
    setStatus("Enter at least two letters to search for a city.", true);
    elements.citySearch.focus();
    return;
  }
  clearTimeout(searchDebounceTimer);
  searchCity(query);
});

elements.citySearch.addEventListener("input", () => {
  const query = elements.citySearch.value.trim();
  ++activeSearch;
  clearTimeout(searchDebounceTimer);
  closeSearchResults();
  setStatus("");

  if (query.length < 2) return;
  searchDebounceTimer = setTimeout(() => searchCity(query), 250);
});

elements.citySearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSearchResults();
    return;
  }

  if (event.key === "ArrowDown" && !elements.searchResults.hidden) {
    event.preventDefault();
    elements.searchResults.querySelector("button")?.focus();
  }
});

elements.searchResults.addEventListener("keydown", (event) => {
  const options = [...elements.searchResults.querySelectorAll("button")];
  const currentIndex = options.indexOf(document.activeElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    options[(currentIndex + direction + options.length) % options.length]?.focus();
  } else if (event.key === "Escape") {
    closeSearchResults();
    elements.citySearch.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!elements.searchResults.contains(event.target) && !elements.searchForm.contains(event.target)) {
    closeSearchResults();
  }
});

elements.locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Your browser doesn't support location. Search for a city instead.", true);
    return;
  }

  elements.locationButton.disabled = true;
  setStatus("Finding your location...");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      elements.locationButton.disabled = false;
      elements.citySearch.value = "";
      loadWeather(
        { latitude: coords.latitude, longitude: coords.longitude },
        "Your location",
      );
    },
    (error) => {
      elements.locationButton.disabled = false;
      const message =
        error.code === error.PERMISSION_DENIED
          ? "Location access was denied. Allow it in your browser or search for a city."
          : error.code === error.TIMEOUT
            ? "Finding your location took too long. Please try again."
            : "Couldn't determine your location. Search for a city instead.";
      setStatus(message, true);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
});

elements.unitToggle.addEventListener("click", () => {
  unit = unit === "c" ? "f" : "c";
  localStorage.setItem("forecast-unit", unit);
  elements.unitToggle.setAttribute("aria-pressed", String(unit === "f"));
  elements.unitToggle.querySelector('[data-unit="c"]').classList.toggle("is-active", unit === "c");
  elements.unitToggle.querySelector('[data-unit="f"]').classList.toggle("is-active", unit === "f");
  if (currentWeather) renderWeather();
});

elements.hourlyPrevious.addEventListener("click", () => {
  if (!currentWeather) return;
  hourlyStartIndex = Math.max(0, hourlyStartIndex - 6);
  renderHourly(currentWeather.data.hourly);
});

elements.hourlyNext.addEventListener("click", () => {
  if (!currentWeather) return;
  const lastStart = Math.max(currentWeather.data.hourly.time.length - 6, 0);
  hourlyStartIndex = Math.min(lastStart, hourlyStartIndex + 6);
  renderHourly(currentWeather.data.hourly);
});

elements.themeToggle.addEventListener("click", () => {
  const nextTheme = preferredTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("forecast-theme", nextTheme);
});

elements.favoriteButton.addEventListener("click", () => {
  if (!currentWeather || currentWeather.label === "Your location") return;

  const currentKey = getPlaceKey(currentWeather.place);
  if (isCurrentPlaceSaved()) {
    savedPlaces = savedPlaces.filter((place) => getPlaceKey(place) !== currentKey);
  } else {
    savedPlaces = [
      {
        ...currentWeather.place,
        name: currentWeather.label,
      },
      ...savedPlaces.filter((place) => getPlaceKey(place) !== currentKey),
    ].slice(0, 5);
  }
  persistSavedPlaces();
});

elements.refreshButton.addEventListener("click", () => {
  if (!currentWeather) return;
  loadWeather(currentWeather.place, currentWeather.label);
});

if (preferredTheme !== "light" && preferredTheme !== "dark") {
  preferredTheme = getTimeBasedTheme();
}
applyTheme(preferredTheme);
elements.unitToggle.setAttribute("aria-pressed", String(unit === "f"));
elements.unitToggle.querySelector('[data-unit="c"]').classList.toggle("is-active", unit === "c");
elements.unitToggle.querySelector('[data-unit="f"]').classList.toggle("is-active", unit === "f");
renderSavedPlaces();

const initialPlace =
  savedCurrentPlace &&
  Number.isFinite(savedCurrentPlace.latitude) &&
  Number.isFinite(savedCurrentPlace.longitude)
    ? savedCurrentPlace
    : { latitude: 51.5072, longitude: -0.1276, label: "London, United Kingdom" };

loadWeather(
  { latitude: initialPlace.latitude, longitude: initialPlace.longitude },
  initialPlace.label,
);