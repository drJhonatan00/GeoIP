<img width="480" height="519" alt="1000032692" src="https://github.com/user-attachments/assets/c4596f0d-6b01-4c5e-80c0-b8d79ef42a98" />


# GeoIP

> A focused, browser-based geospatial intelligence interface for IP reconnaissance and global phone-number analysis.

GeoIP is a standalone front-end application that combines **IP geolocation**, **device GPS**, **Google Street View**, and **international phone-number parsing** in one operational dashboard. Its phone module recognizes numbering plans from around the world and updates the associated reference map automatically as the user types.

The interface is intentionally designed for investigation, verification, and research workflows. It does **not** claim to reveal the live location of a phone from its number alone.

---

## Contents

- [Highlights](#highlights)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Phone reconnaissance](#phone-reconnaissance)
- [IP reconnaissance](#ip-reconnaissance)
- [Data sources](#data-sources)
- [Privacy and responsible use](#privacy-and-responsible-use)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Limitations](#limitations)
- [License](#license)

---

## Highlights

| Capability | Description |
|---|---|
| **Global phone parsing** | Accepts international numbers with `+country code` or `00 + country code` and parses them with `libphonenumber-js`. |
| **Live map updates** | Debounces input for 420 ms, then refreshes the phone result and map while the user types. |
| **Country-level coverage** | Bundles reference coordinates for 245 supported phone countries and territories. |
| **Brazilian area-code detail** | Uses representative city coordinates for Brazilian DDD codes when regional data is available. |
| **IP geolocation** | Queries `ipwho.is` for address, region, city, postal code, coordinates, ISP, organization, ASN, and security metadata. |
| **Device GPS** | Can request the browser's high-accuracy location permission and reverse-geocode the result through OpenStreetMap Nominatim. |
| **Street View context** | Optionally searches for nearby outdoor Street View imagery within a 100-meter radius. |
| **Privacy-aware defaults** | The phone workflow uses the country code locally and does not send the full number to a third-party phone API unless an authorized endpoint is explicitly configured. |
| **Standalone delivery** | Runs as a static site with no build step, backend, or package installation required. |

---

## How it works

The application has two independent investigation surfaces.

---

### Phone reconnaissance flow

1. The input is normalized from international notation into an E.164-compatible value.
2. `libphonenumber-js` identifies the country, calling code, possible validity, and line type.
3. Brazilian DDD data is checked first when the number belongs to Brazil.
4. Otherwise, the application uses a bundled country-reference coordinate.
5. The result panel and OpenStreetMap reference map update automatically after the input settles.
6. If configured, an authorized external phone endpoint may supply additional metadata such as carrier, city, state, postal code, timezone, or coordinates.

---

### IP reconnaissance flow

1. The user submits an IPv4 or IPv6 address, or leaves the field empty to inspect the current public IP.
2. The browser queries `ipwho.is` directly.
3. The response populates the target evidence panel and moves the Google map when the Maps API is available.
4. The browser can independently request device GPS permission for a higher-confidence local fix.

> **Important distinction:** phone-number analysis describes a numbering region or plan. It is not mobile-device tracking, subscriber identification, or real-time location intelligence.

---

## Quick start

Open [http://localhost:8080](http://localhost:8080) in a modern browser.

Opening `index.html` directly may work for the phone module, but serving the directory over HTTP is recommended for consistent browser permissions, external requests, and local development behavior.

---

## Configuration

The optional Google Maps key is defined in `config.js`:

```js
window.GEOIP_CONFIG = {
  GOOGLE_MAPS_API_KEY: "YOUR_RESTRICTED_GOOGLE_MAPS_KEY",
  PHONE_LOOKUP_API_URL: ""
};
```

`GOOGLE_MAPS_API_KEY` enables the IP map and Street View context. The phone module uses its own OpenStreetMap reference embed and does not require a second Google Maps instance.

`PHONE_LOOKUP_API_URL` is optional. If present, the application calls it only after a number is valid and sends the normalized number as the `number` query parameter. Use this field only with an endpoint that you own or are explicitly authorized to use.

---

### Key-management checklist

- Do not commit unrestricted Google Maps keys.
- Restrict browser keys by HTTP referrer and enabled API.
- Keep secrets out of `index.html`, screenshots, issue comments, and public logs.
- If a key has already been exposed in a public repository, revoke or rotate it before publishing.

---

## Phone reconnaissance

Use complete international notation whenever possible:

```text
+55 11 99999-9999
+1 202 555 0123
+44 20 7946 0958
```

The module displays the normalized number, country and calling code, line type, extension, regional reference, timezone, coordinates, precision, carrier data, and source. The displayed precision communicates the origin of the result:

| Precision label | Meaning |
|---|---|
| **Approximate · area-code region** | A representative coordinate for a Brazilian DDD region. |
| **Approximate · country reference center** | A representative coordinate for a country or territory. |
| **External API** | Coordinates returned by an explicitly configured authorized endpoint. |
| **No coordinates** | The numbering plan has no bundled geographic reference. |

The automatic lookup is intentionally debounced so that the interface remains responsive while typing. Each new result replaces the previous map viewport and marker reference.

---

## IP reconnaissance

The IP panel can show:

- Country and country code.
- Region, city, and postal code.
- Time zone.
- ISP, organization, and ASN.
- Proxy or security indicators returned by the provider.
- Approximate map position.
- Nearby Street View imagery when Google Maps is configured and imagery exists.

IP geolocation is inherently approximate. VPNs, proxies, mobile networks, corporate gateways, privacy relays, and database age can all affect the result.

---

## Data sources

| Source | Used for | Network request |
|---|---|---|
| [`libphonenumber-js`][1] | Phone parsing, formatting, country recognition, possible/valid checks, and line-type detection. | CDN-loaded in the browser. |
| Bundled country reference | Country and territory reference coordinates. | No runtime request. |
| `ipwho.is` | Public IP geolocation and network metadata. | Direct browser request during an IP lookup. |
| OpenStreetMap Nominatim | Reverse geocoding for browser GPS results. | Direct browser request after GPS permission. |
| OpenStreetMap embed | Phone numbering-region reference map. | Map iframe loads after a phone result is available. |
| Google Maps Platform | Optional IP map and Street View context. | Loaded only when a key is configured. |

Please review each provider's current terms, attribution requirements, rate limits, and acceptable-use policy before deploying this project publicly.

---

## Privacy and responsible use

This tool is intended for **authorized research, defensive security, OSINT education, and legitimate verification**. Do not use it to stalk, harass, deanonymize, or target individuals.

A phone number does not provide a live device position. A country or area-code reference can identify a numbering region, but it cannot establish where the handset is now. Exact device location requires a separate, lawful, consent-based location service.

The IP workflow sends the queried address to `ipwho.is`. The GPS workflow requires explicit browser permission and sends coordinates to the configured reverse-geocoding service. Review your jurisdiction's privacy and data-protection requirements before processing personal data.

---

## Project structure

```text
geoip/
├── index.html              # Application shell and interface markup
├── app.js                  # IP workflow, phone parsing, live updates, and map logic
├── styles.css              # Signal Noir visual system and responsive layout
├── config.js               # Optional Google Maps and authorized phone API settings
└── country-reference.js    # Bundled country/territory reference coordinates
```

---

## Deployment

The project can be deployed to any static hosting provider, including GitHub Pages, Netlify, Vercel static hosting, Cloudflare Pages, or an ordinary web server.

---

## Limitations

- Phone-number metadata is derived from numbering plans and optional authorized APIs, not from telecom-network access.
- Country-level reference points are intentionally approximate.
- Brazilian area-code coordinates represent the primary region or city, not a subscriber's address.
- Carrier, postal-code, and timezone fields may remain unavailable without a configured external endpoint.
- IP geolocation cannot guarantee a user's physical location.
- Street View availability depends on Google coverage, API status, billing, and project restrictions.
- Public map and geocoding services may impose usage limits and attribution requirements.

---

## References
- https://github.com/catamphetamine/libphonenumber-js "libphonenumber-js documentation and source repository"
- https://ipwho.is/ "ipwho.is API documentation and service"
- https://operations.osmfoundation.org/policies/nominatim/ "Nominatim usage policy"
- https://developers.google.com/maps/documentation/javascript/overview "Google Maps JavaScript API documentation"
- https://www.openstreetmap.org/copyright "OpenStreetMap copyright and attribution"
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API "MDN Geolocation API reference"
