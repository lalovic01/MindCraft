const STORAGE_KEY_THEME = "mindcraft_theme";
const STORAGE_KEY_MAP = "mindcraft_map_data";

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  } catch (e) {
    console.error("Error saving theme to localStorage:", e);
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY_THEME) || "light";
  } catch (e) {
    console.error("Error loading theme from localStorage:", e);
    return "light";
  }
}

function saveMapData(mapData) {
  try {
    localStorage.setItem(STORAGE_KEY_MAP, JSON.stringify(mapData));
    console.log("Map data saved.");
  } catch (e) {
    console.error("Error saving map data to localStorage:", e);
  }
}

function loadMapData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_MAP);
    if (data) {
      console.log("Map data loaded.");
      return JSON.parse(data);
    }
    return null;
  } catch (e) {
    console.error("Error loading map data from localStorage:", e);
    return null;
  }
}

function clearMapData() {
  try {
    localStorage.removeItem(STORAGE_KEY_MAP);
    console.log("Map data cleared.");
  } catch (e) {
    console.error("Error clearing map data from localStorage:", e);
  }
}
