const EMPTY_DATA = { 
  query: "—", status: "idle", country: "—", countryCode: "—", 
  regionName: "—", region: "—", city: "—", zip: "—", 
  lat: 0, lon: 0, timezone: "—", isp: "—", org: "—", as: "—" 
};

let data = { ...EMPTY_DATA };
let map = null;
let panorama = null;
let mapReady = false;
let streetReady = false;

const $ = (selector) => document.querySelector(selector);
const statusDot = (active = false) => `<span class="status-dot ${active ? "active" : ""}" aria-hidden="true"></span>`;

function normalizeIpWho(result) {
  return { 
    ...EMPTY_DATA, 
    status: "success", 
    query: result.ip || "—", 
    country: result.country || "—", 
    countryCode: result.country_code || "—", 
    regionName: result.region || "—", 
    region: result.region_code || "—", 
    city: result.city || "—", 
    zip: result.postal || "—", 
    lat: Number(result.latitude) || 0, 
    lon: Number(result.longitude) || 0, 
    timezone: result.timezone?.id || "—", 
    isp: result.connection?.isp || "—", 
    org: result.connection?.org || "—", 
    as: result.connection?.asn ? `AS${result.connection.asn}` : "—", 
    proxy: Boolean(result.security?.proxy) 
  };
}

function renderRow(label, value, mono = false) {
  return `<div class="data-row"><span>${label}</span><strong class="${mono ? "mono" : ""}">${value || "—"}</strong></div>`;
}

function renderData() {
  $("#target-coordinates").textContent = data.lat ? `${Number(data.lat).toFixed(4)}°, ${Number(data.lon).toFixed(4)}°` : "NO SIGNAL";
  $("#target-ip").textContent = data.query || "—";
  $("#target-location").innerHTML = `<span class="location-pin">⌖</span> ${data.city !== "—" ? `${data.city}, ${data.regionName}, ${data.country}` : "No target queried"}`;
  $("#geo-data").innerHTML = [
    renderRow("Country / code", `${data.country} · ${data.countryCode}`), 
    renderRow("Region", `${data.regionName} (${data.region})`), 
    renderRow("Postal code", data.zip, true), 
    renderRow("Time zone", data.timezone, true)
  ].join("");
  $("#network-data").innerHTML = [
    renderRow("ISP", data.isp), 
    renderRow("Organization", data.org), 
    renderRow("ASN", data.as, true)
  ].join("");
  $("#confidence").textContent = data.status === "success" ? "OK" : "—";
}

function setStatus(text) {
  $("#searched-at").textContent = text;
}

function notify(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast visible ${isError ? "error" : ""}`;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => { toast.className = "toast"; }, 3000);
}

async function copyTarget() {
  if (!data.query || data.query === "—") return;
  try { 
    await navigator.clipboard.writeText(data.query); 
    notify("IP copied to clipboard"); 
  } catch { 
    notify("Unable to copy the IP", true); 
  }
}

function moveMap(lat, lon) {
  if (map) map.panTo({ lat: Number(lat), lng: Number(lon) });
}

function findStreetView(lat, lon) {
  if (!window.google || !panorama) return;
  const service = new google.maps.StreetViewService();
  service.getPanorama({ location: { lat: Number(lat), lng: Number(lon) }, radius: 100, source: google.maps.StreetViewSource.OUTDOOR }, (pano, status) => {
    if (status === google.maps.StreetViewStatus.OK && pano?.location?.pano) {
      panorama.setPano(pano.location.pano);
      panorama.setPov({ heading: 270, pitch: 0 });
      panorama.setVisible(true);
      streetReady = true;
      $("#pano-empty").classList.add("hidden");
      $("#street-availability").innerHTML = `${statusDot(true)} AVAILABLE`;
      $("#street-availability").classList.add("ready");
    } else {
      panorama.setVisible(false);
      streetReady = false;
      $("#pano-empty").classList.remove("hidden");
      $("#street-availability").innerHTML = `${statusDot(false)} NO NEARBY STREET VIEW`;
      $("#street-availability").classList.remove("ready");
    }
  });
}

// CAPTURE LOCATION VIA GPS
function getUserLocation() {
  if (!navigator.geolocation) {
    notify("Geolocation is not supported by this browser.", true);
    return;
  }

  setStatus("Obtaining GPS precision...");
  notify("Requesting location permission...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      data.lat = lat;
      data.lon = lon;
      data.status = "success";

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const geoData = await response.json();
        
        const address = geoData.address || {};
        data.city = address.city || address.town || address.village || "Located";
        data.regionName = address.state || "—";
        data.country = address.country || "—";
        data.countryCode = address.country_code ? address.country_code.toUpperCase() : "—";
        data.zip = address.postcode || data.zip;
      } catch (err) {
        data.city = "GPS Local Fix";
      }

      renderData();
      moveMap(lat, lon);
      findStreetView(lat, lon);
      setStatus(`GPS ativado · ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
      notify(`Coordinates obtained! (${data.city})`);
    },
    (error) => {
      let msg = "Unable to obtain location.";
      if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied.";
      else if (error.code === error.POSITION_UNAVAILABLE) msg = "GPS signal unavailable.";
      setStatus("GPS failure");
      notify(msg, true);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function initGoogleMaps() {
  if (!window.google) {
    $("#map-status").innerHTML = `${statusDot(false)} MAP IN VISUAL MODE`;
    return;
  }
  map = new google.maps.Map($("#map"), { center: { lat: -22.9575, lng: -45.5494 }, zoom: 14, mapTypeControl: true, fullscreenControl: true, zoomControl: true, streetViewControl: true, mapId: "DEMO_MAP_ID" });
  panorama = new google.maps.StreetViewPanorama($("#pano"), { position: { lat: -22.9575, lng: -45.5494 }, pov: { heading: 34, pitch: 4 }, zoom: 0, visible: false, addressControl: false, fullscreenControl: true, linksControl: true, motionTrackingControl: false, panControl: false });
  map.setStreetView(panorama);
  mapReady = true;
  $("#map-status").innerHTML = `${statusDot(true)} MAP ACTIVE`;
}

window.initGoogleMaps = initGoogleMaps;

async function runLookup() {
  const input = $("#ip-input");
  const button = $("#lookup-button");
  const ip = input.value.trim();
  button.disabled = true;
  button.innerHTML = "READING… <span>↗</span>";
  setStatus("Querying public source…");
  try {
    const endpoint = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : "https://ipwho.is/";
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`GeoIP source unavailable (${response.status})`);
    const raw = await response.json();
    if (!raw.success || !raw.ip) throw new Error(raw.message || "Invalid or unlocated IP");
    data = normalizeIpWho(raw);
    input.value = data.query;
    renderData();
    setStatus(`Reading complete · ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
    moveMap(data.lat, data.lon);
    findStreetView(data.lat, data.lon);
    notify(`Signal updated: ${data.city || "estimated location"}, ${data.country || ""}`);
  } catch (error) {
    setStatus("Reading failed · check the IP");
    notify(error.message || "Unable to query the IP", true);
  } finally {
    button.disabled = false;
    button.innerHTML = "RUN READING <span>↗</span>";
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("geoip-theme", isDark ? "dark" : "light");
  $("#theme-button").innerHTML = isDark ? "☼" : "☾";
}

// Switch UI tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.rail-button').forEach(btn => btn.classList.remove('active'));
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}

function setup() {
  const savedTheme = localStorage.getItem("geoip-theme");
  if (savedTheme === "light") document.documentElement.classList.remove("dark");
  
  $("#theme-button").innerHTML = document.documentElement.classList.contains("dark") ? "☼" : "☾";
  $("#lookup-form").addEventListener("submit", (event) => { event.preventDefault(); runLookup(); });
  $("#copy-button").addEventListener("click", copyTarget);
  $("#copy-ip-button").addEventListener("click", copyTarget);
  $("#theme-button").addEventListener("click", toggleTheme);

  const phoneButton = $("#btn-search-phone");
  if (phoneButton) phoneButton.addEventListener("click", analyzePhoneNumber);
  const phoneInput = $("#phone-input");
  if (phoneInput) phoneInput.addEventListener("input", queuePhoneAnalysis);
  if (phoneInput) phoneInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); analyzePhoneNumber(); }
  });
  const copyPhoneButton = $("#copy-phone-button");
  if (copyPhoneButton) copyPhoneButton.addEventListener("click", copyPhoneNumber);
  
  const gpsBtn = $("#gps-button");
  if (gpsBtn) gpsBtn.addEventListener("click", getUserLocation);

  renderData();

  if (window.GEOIP_CONFIG?.GOOGLE_MAPS_API_KEY) {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(window.GEOIP_CONFIG.GOOGLE_MAPS_API_KEY)}&callback=initGoogleMaps`;
    script.async = true; 
    script.defer = true;
    document.head.appendChild(script);
  } else {
    $("#map-status").innerHTML = `${statusDot(false)} CONFIGURE MAP`;
    $("#pano-empty").textContent = "Add a Google Maps key in config.js to enable the map and Street View";
  }

  getUserLocation();
}

document.addEventListener("DOMContentLoaded", setup);

// ================================================================
// PHONE NUMBER ANALYSIS
// Requires libphonenumber-js (loaded in index.html).
//
// IMPORTANT:
// - The library validates/formats numbers and identifies country/type.
// - An area code does not reveal the phone's current position.
// - The coordinates below are approximate numbering-region references.
// - Exact device location requires an authorized carrier/location API.
// ================================================================

const PHONE_REGION_DATA = {
  // Brazilian area codes. Coordinates represent the primary area/city,
  // not the device.
  "11": { state: "São Paulo", city: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333, tz: "America/Sao_Paulo" },
  "12": { state: "São Paulo", city: "São José dos Campos", country: "Brazil", lat: -23.1896, lon: -45.8841, tz: "America/Sao_Paulo" },
  "13": { state: "São Paulo", city: "Santos", country: "Brazil", lat: -23.9608, lon: -46.3336, tz: "America/Sao_Paulo" },
  "14": { state: "São Paulo", city: "Bauru", country: "Brazil", lat: -22.3246, lon: -49.0871, tz: "America/Sao_Paulo" },
  "15": { state: "São Paulo", city: "Sorocaba", country: "Brazil", lat: -23.5015, lon: -47.4526, tz: "America/Sao_Paulo" },
  "16": { state: "São Paulo", city: "Ribeirão Preto", country: "Brazil", lat: -21.1704, lon: -47.8103, tz: "America/Sao_Paulo" },
  "17": { state: "São Paulo", city: "São José do Rio Preto", country: "Brazil", lat: -20.8113, lon: -49.3758, tz: "America/Sao_Paulo" },
  "18": { state: "São Paulo", city: "Presidente Prudente", country: "Brazil", lat: -22.1207, lon: -51.3925, tz: "America/Sao_Paulo" },
  "19": { state: "São Paulo", city: "Campinas", country: "Brazil", lat: -22.9099, lon: -47.0626, tz: "America/Sao_Paulo" },
  "21": { state: "Rio de Janeiro", city: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lon: -43.1729, tz: "America/Sao_Paulo" },
  "22": { state: "Rio de Janeiro", city: "Campos dos Goytacazes", country: "Brazil", lat: -21.7622, lon: -41.3181, tz: "America/Sao_Paulo" },
  "24": { state: "Rio de Janeiro", city: "Volta Redonda", country: "Brazil", lat: -22.5231, lon: -44.1042, tz: "America/Sao_Paulo" },
  "27": { state: "Espírito Santo", city: "Vitória", country: "Brazil", lat: -20.3155, lon: -40.3128, tz: "America/Sao_Paulo" },
  "28": { state: "Espírito Santo", city: "Cachoeiro de Itapemirim", country: "Brazil", lat: -20.8489, lon: -41.1128, tz: "America/Sao_Paulo" },
  "31": { state: "Minas Gerais", city: "Belo Horizonte", country: "Brazil", lat: -19.9167, lon: -43.9345, tz: "America/Sao_Paulo" },
  "32": { state: "Minas Gerais", city: "Juiz de Fora", country: "Brazil", lat: -21.7642, lon: -43.3503, tz: "America/Sao_Paulo" },
  "33": { state: "Minas Gerais", city: "Governador Valadares", country: "Brazil", lat: -18.8549, lon: -41.9559, tz: "America/Sao_Paulo" },
  "34": { state: "Minas Gerais", city: "Uberlândia", country: "Brazil", lat: -18.9146, lon: -48.2754, tz: "America/Sao_Paulo" },
  "35": { state: "Minas Gerais", city: "Poços de Caldas", country: "Brazil", lat: -21.7878, lon: -46.5614, tz: "America/Sao_Paulo" },
  "37": { state: "Minas Gerais", city: "Divinópolis", country: "Brazil", lat: -20.1436, lon: -44.8906, tz: "America/Sao_Paulo" },
  "38": { state: "Minas Gerais", city: "Montes Claros", country: "Brazil", lat: -16.7282, lon: -43.8578, tz: "America/Sao_Paulo" },
  "41": { state: "Paraná", city: "Curitiba", country: "Brazil", lat: -25.4284, lon: -49.2733, tz: "America/Sao_Paulo" },
  "42": { state: "Paraná", city: "Ponta Grossa", country: "Brazil", lat: -25.0950, lon: -50.1619, tz: "America/Sao_Paulo" },
  "43": { state: "Paraná", city: "Londrina", country: "Brazil", lat: -23.3045, lon: -51.1696, tz: "America/Sao_Paulo" },
  "44": { state: "Paraná", city: "Maringá", country: "Brazil", lat: -23.4205, lon: -51.9333, tz: "America/Sao_Paulo" },
  "45": { state: "Paraná", city: "Foz do Iguaçu", country: "Brazil", lat: -25.5163, lon: -54.5854, tz: "America/Sao_Paulo" },
  "46": { state: "Paraná", city: "Francisco Beltrão", country: "Brazil", lat: -26.0811, lon: -53.0550, tz: "America/Sao_Paulo" },
  "47": { state: "Santa Catarina", city: "Joinville", country: "Brazil", lat: -26.3044, lon: -48.8487, tz: "America/Sao_Paulo" },
  "48": { state: "Santa Catarina", city: "Florianópolis", country: "Brazil", lat: -27.5954, lon: -48.5480, tz: "America/Sao_Paulo" },
  "49": { state: "Santa Catarina", city: "Lages", country: "Brazil", lat: -27.8150, lon: -50.3260, tz: "America/Sao_Paulo" },
  "51": { state: "Rio Grande do Sul", city: "Porto Alegre", country: "Brazil", lat: -30.0346, lon: -51.2177, tz: "America/Sao_Paulo" },
  "53": { state: "Rio Grande do Sul", city: "Pelotas", country: "Brazil", lat: -31.7719, lon: -52.3425, tz: "America/Sao_Paulo" },
  "54": { state: "Rio Grande do Sul", city: "Caxias do Sul", country: "Brazil", lat: -29.1678, lon: -51.1794, tz: "America/Sao_Paulo" },
  "55": { state: "Rio Grande do Sul", city: "Santa Maria", country: "Brazil", lat: -29.6868, lon: -53.8149, tz: "America/Sao_Paulo" },
  "61": { state: "Distrito Federal", city: "Brasília", country: "Brazil", lat: -15.7939, lon: -47.8828, tz: "America/Sao_Paulo" },
  "62": { state: "Goiás", city: "Goiânia", country: "Brazil", lat: -16.6869, lon: -49.2648, tz: "America/Sao_Paulo" },
  "63": { state: "Tocantins", city: "Palmas", country: "Brazil", lat: -10.1840, lon: -48.3336, tz: "America/Araguaina" },
  "64": { state: "Goiás", city: "Rio Verde", country: "Brazil", lat: -17.7923, lon: -50.9190, tz: "America/Sao_Paulo" },
  "65": { state: "Mato Grosso", city: "Cuiabá", country: "Brazil", lat: -15.6014, lon: -56.0979, tz: "America/Cuiaba" },
  "66": { state: "Mato Grosso", city: "Rondonópolis", country: "Brazil", lat: -16.4673, lon: -54.6372, tz: "America/Cuiaba" },
  "67": { state: "Mato Grosso do Sul", city: "Campo Grande", country: "Brazil", lat: -20.4697, lon: -54.6201, tz: "America/Campo_Grande" },
  "68": { state: "Acre", city: "Rio Branco", country: "Brazil", lat: -9.9754, lon: -67.8249, tz: "America/Rio_Branco" },
  "69": { state: "Rondônia", city: "Porto Velho", country: "Brazil", lat: -8.7608, lon: -63.8999, tz: "America/Porto_Velho" },
  "71": { state: "Bahia", city: "Salvador", country: "Brazil", lat: -12.9777, lon: -38.5016, tz: "America/Bahia" },
  "73": { state: "Bahia", city: "Ilhéus", country: "Brazil", lat: -14.7936, lon: -39.0460, tz: "America/Bahia" },
  "74": { state: "Bahia", city: "Juazeiro", country: "Brazil", lat: -9.4118, lon: -40.4986, tz: "America/Bahia" },
  "75": { state: "Bahia", city: "Feira de Santana", country: "Brazil", lat: -12.2664, lon: -38.9663, tz: "America/Bahia" },
  "77": { state: "Bahia", city: "Vitória da Conquista", country: "Brazil", lat: -14.8619, lon: -40.8445, tz: "America/Bahia" },
  "79": { state: "Sergipe", city: "Aracaju", country: "Brazil", lat: -10.9472, lon: -37.0731, tz: "America/Maceio" },
  "81": { state: "Pernambuco", city: "Recife", country: "Brazil", lat: -8.0476, lon: -34.8770, tz: "America/Recife" },
  "82": { state: "Alagoas", city: "Maceió", country: "Brazil", lat: -9.6498, lon: -35.7089, tz: "America/Maceio" },
  "83": { state: "Paraíba", city: "João Pessoa", country: "Brazil", lat: -7.1195, lon: -34.8450, tz: "America/Fortaleza" },
  "84": { state: "Rio Grande do Norte", city: "Natal", country: "Brazil", lat: -5.7945, lon: -35.2110, tz: "America/Fortaleza" },
  "85": { state: "Ceará", city: "Fortaleza", country: "Brazil", lat: -3.7319, lon: -38.5267, tz: "America/Fortaleza" },
  "86": { state: "Piauí", city: "Teresina", country: "Brazil", lat: -5.0919, lon: -42.8034, tz: "America/Fortaleza" },
  "87": { state: "Pernambuco", city: "Petrolina", country: "Brazil", lat: -9.3891, lon: -40.5033, tz: "America/Recife" },
  "88": { state: "Ceará", city: "Juazeiro do Norte", country: "Brazil", lat: -7.2131, lon: -39.3157, tz: "America/Fortaleza" },
  "89": { state: "Piauí", city: "Picos", country: "Brazil", lat: -7.0767, lon: -41.4669, tz: "America/Fortaleza" },
  "91": { state: "Pará", city: "Belém", country: "Brazil", lat: -1.4558, lon: -48.4902, tz: "America/Belem" },
  "92": { state: "Amazonas", city: "Manaus", country: "Brazil", lat: -3.1190, lon: -60.0217, tz: "America/Manaus" },
  "93": { state: "Pará", city: "Santarém", country: "Brazil", lat: -2.4430, lon: -54.7081, tz: "America/Santarem" },
  "94": { state: "Pará", city: "Marabá", country: "Brazil", lat: -5.3686, lon: -49.1178, tz: "America/Belem" },
  "95": { state: "Roraima", city: "Boa Vista", country: "Brazil", lat: 2.8235, lon: -60.6758, tz: "America/Boa_Vista" },
  "96": { state: "Amapá", city: "Macapá", country: "Brazil", lat: 0.0349, lon: -51.0694, tz: "America/Belem" },
  "97": { state: "Amazonas", city: "Coari", country: "Brazil", lat: -4.0850, lon: -63.1414, tz: "America/Manaus" },
  "98": { state: "Maranhão", city: "São Luís", country: "Brazil", lat: -2.5297, lon: -44.2825, tz: "America/Fortaleza" },
  "99": { state: "Maranhão", city: "Imperatriz", country: "Brazil", lat: -5.5185, lon: -47.4788, tz: "America/Fortaleza" }
};

const PHONE_COUNTRY_NAMES = (() => {
  try {
    return new Intl.DisplayNames(["en-US"], { type: "region" });
  } catch {
    return null;
  }
})();

const PHONE_LOOKUP_DEBOUNCE = 420;
let phoneMapFallback = null;
let phoneSearchTimer = null;
let phoneLookupSequence = 0;
let lastPhoneMapLocation = null;

function countryName(code) {
  if (!code) return "Non-geographic plan";
  try {
    return PHONE_COUNTRY_NAMES?.of(code) || code;
  } catch {
    return code;
  }
}

function parsePhoneInput(value) {
  const raw = String(value || "")
    .trim()
    .replace(/^tel:\s*/i, "")
    .replace(/[\u00A0]/g, " ");
  const extensionMatch = raw.match(/(?:ext\.?|x|ramal)\s*#?\s*(\d+)$/i);
  const withoutExtension = raw.replace(/(?:ext\.?|x|ramal)\s*#?\s*\d+$/i, "").trim();
  const hasInternationalPrefix = /^(?:\+|00)/.test(withoutExtension);
  const digits = withoutExtension.replace(/\D/g, "");

  return {
    value: hasInternationalPrefix ? `+${digits.replace(/^00/, "")}` : digits,
    defaultCountry: hasInternationalPrefix ? undefined : "BR",
    extension: extensionMatch?.[1] || ""
  };
}

function formatPhoneType(type) {
  const labels = {
    FIXED_LINE: "LANDLINE",
    MOBILE: "MOBILE",
    FIXED_LINE_OR_MOBILE: "LANDLINE / MOBILE",
    TOLL_FREE: "TOLL-FREE / 0800",
    PREMIUM_RATE: "PREMIUM RATE",
    SHARED_COST: "SHARED COST",
    VOIP: "VOIP",
    PERSONAL_NUMBER: "PERSONAL NUMBER",
    PAGER: "PAGER",
    UAN: "UAN",
    VOICEMAIL: "VOICEMAIL",
    UNKNOWN: "UNKNOWN"
  };
  return labels[type] || "UNKNOWN";
}

function getBrazilDdd(phoneNumber) {
  if (!phoneNumber || phoneNumber.country !== "BR") return null;
  const national = phoneNumber.nationalNumber || "";
  const ddd = national.slice(0, 2);
  return PHONE_REGION_DATA[ddd] ? { ddd, ...PHONE_REGION_DATA[ddd] } : null;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function isCoordinate(value) {
  return Number.isFinite(Number(value));
}

function getPhoneCountry(countryCode) {
  const coordinates = window.PHONE_COUNTRY_REFERENCE?.[countryCode];
  if (!Array.isArray(coordinates) || !isCoordinate(coordinates[0]) || !isCoordinate(coordinates[1])) return null;
  return { code: countryCode, lat: Number(coordinates[0]), lon: Number(coordinates[1]) };
}

function refreshPhoneMap() {
  if (!lastPhoneMapLocation) return;
  const { lat, lon, zoom, label } = lastPhoneMapLocation;
  if (!phoneMapFallback) return;
  phoneMapFallback.src = phoneFallbackUrl(lat, lon, zoom);
  phoneMapFallback.title = `Numbering reference map: ${label || "estimated coordinates"}`;
}

function updatePhoneMap(lat, lon, locationText, zoom = 4) {
  if (!isCoordinate(lat) || !isCoordinate(lon)) {
    setText("phone-map-status", "NO COORDINATES");
    return;
  }

  const normalizedLat = Number(lat);
  const normalizedLon = Number(lon);
  lastPhoneMapLocation = { lat: normalizedLat, lon: normalizedLon, zoom, label: locationText };
  setText("res-coordinates", `${normalizedLat.toFixed(5)}°, ${normalizedLon.toFixed(5)}°`);
  setText("res-lat", normalizedLat.toFixed(6));
  setText("res-lon", normalizedLon.toFixed(6));

  if (phoneMapFallback) {
    refreshPhoneMap();
    setText("phone-map-status", "MAP UPDATED");
  } else {
    setText("phone-map-status", "COORDINATES READY");
  }
}

function initPhoneMap() {
  const mapElement = document.getElementById("phone-map");
  if (phoneMapFallback || !mapElement) return;
  mapElement.replaceChildren();
  phoneMapFallback = document.createElement("iframe");
  phoneMapFallback.className = "phone-map-fallback";
  phoneMapFallback.loading = "lazy";
  phoneMapFallback.referrerPolicy = "no-referrer";
  phoneMapFallback.setAttribute("aria-label", "Numbering region map");
  mapElement.appendChild(phoneMapFallback);
  refreshPhoneMap();
  setText("phone-map-status", "MAP UPDATED");
}

function phoneFallbackUrl(lat, lon, zoom) {
  // A public OpenStreetMap embed provides a dependable country/DDD reference
  // without requiring a second Google Maps instance or sending the phone number.
  const horizontalSpan = zoom >= 9 ? 0.72 : (zoom >= 5 ? 8 : 45);
  const verticalSpan = horizontalSpan * 0.58;
  const minLon = Math.max(-180, lon - horizontalSpan);
  const maxLon = Math.min(180, lon + horizontalSpan);
  const minLat = Math.max(-85, lat - verticalSpan);
  const maxLat = Math.min(85, lat + verticalSpan);
  const bbox = [minLon, minLat, maxLon, maxLat].map((value) => value.toFixed(5)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lon.toFixed(5)}`;
}

function revealPhoneMap() {
  // Let the browser calculate the newly revealed panel dimensions before the
  // embedded map receives its first viewport and marker.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      initPhoneMap();
      refreshPhoneMap();
    });
  });
}

async function lookupPhoneExternal(formattedE164) {
  // Optional: use your own authorized API. The default global flow only uses the
  // country code and never sends the full number to third-party services.
  const url = window.GEOIP_CONFIG?.PHONE_LOOKUP_API_URL;
  if (!url) return null;

  try {
    const separator = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${separator}number=${encodeURIComponent(formattedE164)}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("External phone API unavailable:", error);
    return null;
  }
}

function resetPhoneResults() {
  phoneLookupSequence += 1;
  window.clearTimeout(phoneSearchTimer);
  document.getElementById("phone-results").hidden = true;
  setText("phone-map-status", "AWAITING NUMBER");
}

function queuePhoneAnalysis() {
  const input = document.getElementById("phone-input");
  window.clearTimeout(phoneSearchTimer);
  if (!input?.value.trim()) {
    resetPhoneResults();
    return;
  }

  phoneSearchTimer = window.setTimeout(() => analyzePhoneNumber({ automatic: true }), PHONE_LOOKUP_DEBOUNCE);
}

async function analyzePhoneNumber({ automatic = false } = {}) {
  const input = document.getElementById("phone-input");
  const button = document.getElementById("btn-search-phone");
  const resultsPanel = document.getElementById("phone-results");
  const rawInput = input?.value?.trim();
  const requestId = ++phoneLookupSequence;

  if (!rawInput) {
    if (!automatic) notify("Enter a phone number.", true);
    return;
  }

  if (!window.libphonenumber && typeof window.parsePhoneNumberFromString !== "function") {
    if (!automatic) notify("The phone library did not load.", true);
    return;
  }

  if (!automatic) {
    button.disabled = true;
    button.innerHTML = "READING… <span>↗</span>";
  }

  try {
    const prepared = parsePhoneInput(rawInput);
    if (prepared.value.replace(/\D/g, "").length < 3) {
      if (!automatic) throw new Error("Enter a number with a country code, for example +55 11 99999-9999.");
      return;
    }

    const parse = typeof window.libphonenumber?.parsePhoneNumberFromString === "function"
      ? window.libphonenumber.parsePhoneNumberFromString
      : (typeof window.parsePhoneNumberFromString === "function" ? window.parsePhoneNumberFromString : null);
    if (!parse) throw new Error("Phone parser unavailable.");

    const number = parse(prepared.value, prepared.defaultCountry);
    if (!number) {
      if (!automatic) throw new Error("Unable to interpret the number. Use +country code or 00 + country code.");
      return;
    }

    const valid = number.isValid();
    const possible = number.isPossible();
    if (!possible && !automatic) throw new Error("Number is impossible for the specified numbering plan.");
    if (!possible) return;

    const country = number.country || "";
    const callingCode = number.countryCallingCode || "";
    const type = typeof number.getType === "function" ? number.getType() : "UNKNOWN";
    const dddData = getBrazilDdd(number);
    const countryReference = getPhoneCountry(country);
    const external = valid ? await lookupPhoneExternal(number.number) : null;
    if (requestId !== phoneLookupSequence) return;

    const externalLat = Number(external?.lat);
    const externalLon = Number(external?.lon);
    const hasExternalCoords = isCoordinate(externalLat) && isCoordinate(externalLon);
    const hasCountryCoords = isCoordinate(countryReference?.lat) && isCoordinate(countryReference?.lon);
    const lat = hasExternalCoords ? externalLat : (dddData?.lat ?? countryReference?.lat);
    const lon = hasExternalCoords ? externalLon : (dddData?.lon ?? countryReference?.lon);
    const city = external?.city || dddData?.city || "National reference";
    const state = external?.state || dddData?.state || (countryReference ? "National coverage" : "Not available");
    const carrier = external?.carrier || "Not available";
    const timezone = external?.timezone || dddData?.tz || "Not available for national reference";
    const resolvedCountry = country || countryReference?.code || "";

    let precision = "No coordinates";
    let mapZoom = 4;
    if (hasExternalCoords) {
      precision = external?.precision || "External API (verify precision)";
      mapZoom = 10;
    } else if (dddData) {
      precision = "Approximate · area-code region";
      mapZoom = 10;
    } else if (hasCountryCoords) {
      precision = "Approximate · country reference center";
    }

    const countryLabel = resolvedCountry
      ? `${countryName(resolvedCountry)}${callingCode ? ` (+${callingCode})` : ""}`
      : (callingCode ? `DDI +${callingCode} · shared area` : "Non-geographic plan");
    const locationLabel = dddData
      ? `${city}, ${state}, Brazil · DDD ${dddData.ddd}`
      : (countryReference ? `${countryName(resolvedCountry)} · national reference` : "Non-geographic or shared numbering area");

    setText("res-e164", number.number);
    setText("res-international", number.formatInternational());
    setText("res-country", countryLabel);
    setText("res-type", formatPhoneType(type));
    setText("res-extension", number.ext || prepared.extension || "—");
    setText("res-state", state);
    setText("res-city", city);
    setText("res-phone-zip", external?.zip || "Not available");
    setText("res-tz", timezone);
    setText("res-carrier", carrier);
    setText("res-source", external ? "Authorized API + numbering plan" : (dddData ? "Numbering plan / area code" : "Global plan + country reference"));
    setText("res-location", locationLabel);
    setText("res-precision", precision);
    setText("phone-status-badge", valid ? "VALID" : "POSSIBLE, UNCONFIRMED");

    resultsPanel.hidden = false;
    if (!phoneMapFallback) revealPhoneMap();
    if (isCoordinate(lat) && isCoordinate(lon)) updatePhoneMap(lat, lon, locationLabel, mapZoom);
    else {
      setText("res-coordinates", "NO DATA");
      setText("res-lat", "—");
      setText("res-lon", "—");
      setText("phone-map-status", "NO COORDINATES");
    }
    window.requestAnimationFrame(refreshPhoneMap);

    if (!automatic) {
      input.value = number.formatInternational();
      notify(valid
        ? `Valid phone number: ${countryName(resolvedCountry)}`
        : "Number is possible; the map shows only the numbering region."
      );
    }
  } catch (err) {
    if (!automatic) {
      console.error("Phone processing error:", err);
      notify(err.message || "Failed to validate number.", true);
    }
  } finally {
    if (!automatic) {
      button.disabled = false;
      button.innerHTML = "RUN READING <span>↗</span>";
    }
  }
}

function copyPhoneNumber() {
  const value = document.getElementById("res-e164")?.textContent;
  if (!value || value === "—") return;

  navigator.clipboard?.writeText(value)
    .then(() => notify("Number copied to clipboard"))
    .catch(() => notify("Unable to copy the number.", true));
}
