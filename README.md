# SAFER 247 — Command Center Desktop Application

**Radio Frequency-Based Emergency Messaging and Situational Awareness System**  
*Municipal Disaster Risk Reduction and Management Office (MDRRMO) — San Fernando, Bukidnon*

---

## Executive Summary

SAFER 247 is an off-grid, radio frequency-based emergency telecommunications and disaster management system. During major disaster events—such as severe typhoons, flash floods, landslides, or earthquakes—commercial telecommunication infrastructure including cellular towers, fiber networks, and internet backbones frequently suffer extensive physical damage or overwhelming network congestion.

SAFER 247 provides a reliable communication bridge by transmitting and receiving structured emergency messages, incident reports, GPS responder coordinates, and disaster imagery over VHF and UHF radio frequencies. By utilizing packet radio protocols, APRS, and SSTV over RF channels, the system ensures unbroken situational awareness for disaster managers when conventional networks are down.

The broader SAFER 247 architecture consists of two interconnected parts:
1. **Field Responder Mobile Application (Android)**: Handheld unit utilized by search-and-rescue teams, medical volunteers, and Barangay Disaster Risk Reduction and Management Committees (BDRRMCs).
2. **Command Center Desktop Application (This System)**: A centralized operator console deployed at the Emergency Operations Center (EOC) to monitor, triage, visualize, map, and coordinate incident responses across the municipality.

---

## Purpose and Operational Objectives

The primary mission of the SAFER 247 Command Center is to provide EOC dispatchers and disaster response coordinators with immediate, reliable situational awareness without dependency on third-party cloud platforms or commercial internet service providers.

### Core Objectives
* **Off-Grid Telecommunications Resilience**: Directly interfaces with base-station transceivers and Terminal Node Controllers (TNC) to decode incoming RF data packets.
* **Rapid Incident Triaging**: Collects structured incident reports (hazard category, severity, casualty counts, barangay location, and geographic coordinates) for fast dispatch decision-making.
* **Geographic Situational Awareness**: Real-time GIS mapping of hazards, evacuation points, river basins, and active emergency responder positions.
* **Forensic Image Processing**: Receives and enhances low-bandwidth emergency field photographs transmitted via RF/SSTV to assess damage to bridges, lifelines, and roadway networks.
* **Standardized DRRMO Reporting**: Maintains an accurate chronological audit log of all disaster events and exports consolidated evaluation reports for municipal, provincial (PDRRMO), and national agencies (OCD / NDRRMC).

---

## Operational Geography: San Fernando, Bukidnon

The Command Center is calibrated specifically for the terrain, risks, and administrative divisions of the Municipality of San Fernando, Province of Bukidnon (Region X — Northern Mindanao, Philippines):

* **Geographic Center**: 7.8100° N, 125.3500° E
* **Municipal Poblacion and EOC**: Halapitan (7.9137° N, 125.3362° E)
* **PSGC Code**: 1001318000
* **Coverage Area**: 705.06 km² encompassing complex mountainous terrain, river systems (Tigwa and Salug Rivers), and boundary corridors adjacent to Valencia City, Malaybalay City, Quezon, and Davao Region.
* **All 24 Official Barangays**:
  * **Northern and Northwestern Sector**: Tugop, Nacabuklad, Malayanan, Little Baguio, Candelaria, Sacramento Valley, Bulalang, Kibongcog
  * **Central and Poblacion Sector**: Halapitan (Poblacion / EOC), Kawayan, Mabuhay, Magkalungay, Namnam, Iglugsad, Palacpacan, Dao
  * **Southern and Border Corridor**: Bonacao, Santo Domingo, San Jose, Cayaga, Kalagangan, Cabuling, Durian, Matupe (Davao border)

---

## Core Application Modules

### 1. Executive Situational Dashboard
* **Key Operational Metrics**: Active incidents count, critical casualties, deployed rescue personnel, and average RF dispatch response times.
* **Temporal Trend Analytics**: Hourly incident frequency histograms, daily progression charts, and monthly cumulative distributions.
* **Categorical Distribution**: Visual breakdown of incoming emergencies (Landslide, Flash Flood, Medical Emergency, Vehicular Accident, Fire, Structural Damage, Search and Rescue).
* **Barangay Risk Profiler**: Geographic concentration breakdown identifying the most vulnerable barangays during ongoing meteorological events.

### 2. Real-Time RF Messaging and Dispatch Console
* **Shared Broadcast Channel**: Live stream of incoming and outgoing RF telemetry packets (standard VHF 144.390 MHz).
* **Transmission Metadata**: Displays sender callsign (such as ALPHA-01, BRAVO-02), signal strength indicator, frequency band, battery level, and packet integrity.
* **Quick Dispatch Presets**: Pre-formatted emergency broadcasts including Evacuation Warnings, Weather Bulletins, All-Clear Signals, and EOC Roll Calls.
* **Outbox and Retry Queue**: Visual queue for pending or failed transmissions with instant resend capability.
* **Filtering and Search**: Filtering by incident class, sender unit, priority rating, and date/time range.

### 3. Geographic Information System (GIS) Map View
* **Multi-Layer Cartography**:
  * **Default / Roadmap**: Clean, high-contrast topological vector cartography.
  * **Satellite**: High-resolution aerial imagery with optional hybrid boundary and road labels.
  * **Terrain**: Topographic elevation contours critical for identifying landslide slopes and river runoff corridors.
* **Official Administrative Boundaries**:
  * Accurate San Fernando Lungsod boundary rendered with Google Maps administrative red-and-white dashed styling.
  * Official GeoJSON boundary polygons and centroid markers for all 24 barangays.
  * Interactive hover highlights and one-click filtering to isolate incidents by barangay.
* **Three Operational Map Modes**:
  * **Incident Markers**: Color-coded pins for active distress calls with interactive detail popups.
  * **APRS Responder Tracking**: Live positions of field units, movement direction vectors, altitude, travel speed, and historic breadcrumb trails.
  * **Disaster Heatmap**: Kernel density visualization of reported hazard clusters (such as Tigwa river overflow or Little Baguio road slips).
* **Navigation Controls**: One-click "Fit Entire Lungsod" (auto-frames all 24 barangays) and "Recenter Poblacion" (zooms directly to the MDRRMO EOC).

### 4. Incident Reports and Archival Registry
* **Structured Data Grid**: Full historical log of all incidents received with unique tracking IDs (such as RPT-2026-001244).
* **Multi-Parameter Search**: Query records by report ID, reporting party, barangay, incident type, and lifecycle status (Active, Under Response, Resolved, Archived).
* **Incident Detail Drawer**: Deep-dive timeline view displaying initial distress packet, responder field updates, coordinate verification, and assigned response assets.
* **Export Engine**: Exporting of formatted incident documentation into standard formats:
  * **CSV**: For database ingestion and external statistical software.
  * **XLSX**: Formatted multi-tab spreadsheet for municipal administrative records.
  * **PDF**: Printable formal report with municipal header and summary tables.

### 5. RF and SSTV Image Enhancement Workbench
* **RF Image Reception**: Displays disaster photographs received over radio frequency channels via Slow-Scan Television (SSTV) or digital packet framing.
* **Forensic Enhancement Tools**:
  * **Contrast and Brightness Adjustment**: Brings out details in underexposed night photographs or overcast weather conditions.
  * **Digital Denoising and Despeckling**: Filters out RF static noise, burst interference, and transmission dropouts.
  * **Laplacian Edge Sharpening**: Clarifies damaged bridge beams, roadway fractures, and submerged landmarks.
  * **Interactive Comparison**: Split-screen slider comparing raw RF payload against the enhanced forensic image.
  * **Output Preservation**: Saves enhanced artifacts directly to the incident's permanent case file.

### 6. System Settings and Station Configuration
* **EOC Station Identifier**: Configurable Call Sign (DX8SF-EOC), Maidenhead Grid Locator, and Tactical Name.
* **Hardware and Modem Settings**: TNC port binding, AFSK baud rates (1200 bps / 9600 bps), audio squelch levels, and beacon intervals.
* **Audible and Visual Alerts**: Customizable alarm thresholds for high-severity casualty and flash flood warnings.
* **Data Backup and Management**: Local storage cache management and manual database sync tools.

---

## Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 | Declarative, component-driven UI architecture |
| **Build Tool** | Vite 8 | Build pipeline and development server |
| **Routing** | React Router v7 | Client-side routing across Command Center modules |
| **Geospatial and Mapping** | Leaflet 1.9 + GeoJSON | GIS mapping engine with custom administrative boundary layers |
| **Data Visualization** | Recharts 3 | Responsive charts for emergency frequency and risk metrics |
| **Icons and Typography** | Lucide React + Custom CSS | Standard emergency management iconography and design tokens |
| **Data Utilities** | es-toolkit | Collection and formatting utilities |
| **RF Protocols Supported** | APRS / AX.25 / SSTV | Radio frequency packet framing and image transmission standards |

---

## Installation and Setup

### Prerequisites
* **Node.js**: Version 18.0.0 or higher
* **npm** (or bun / yarn / pnpm)
* Modern web browser: Google Chrome, Mozilla Firefox, Microsoft Edge, or a Chromium-based desktop wrapper (such as Electron)

### Installation Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-org/safer-247-command-center.git
   cd safer-247-command-center
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The application will run locally at: `http://localhost:3000`.

4. **Build for Production**:
   ```bash
   npm run build
   ```
   The compiled static bundle will be generated in the `dist/` directory.

5. **Preview Production Build**:
   ```bash
   npm run preview
   ```

---

## Project Structure

```text
├── index.html                   # Application entry HTML
├── metadata.json                # Project configuration manifest
├── package.json                 # Node dependencies and scripts
├── vite.config.js               # Vite bundler configuration
├── public/                      # Static assets and public resources
└── src/
    ├── main.jsx                 # React root bootstrap
    ├── App.jsx                  # Main router and shell layout
    ├── styles.css               # Global application styles and Leaflet theme overrides
    ├── components/
    │   ├── app-shell/           # Desktop sidebar, header, and alert banner
    │   ├── common/              # Buttons, badges, modal wrappers, and data tables
    │   ├── layout/              # Page container layouts and viewports
    │   ├── map/                 # Leaflet map container, custom markers, and layer controls
    │   └── shared/              # Reusable metric cards, drawers, and form elements
    ├── data/
    │   ├── mockData.js          # APRS telemetry stations, incidents, and municipal constants
    │   └── sanFernandoBoundary.js # Official San Fernando Lungsod border and 24 barangay GeoJSON boundaries
    ├── pages/
    │   ├── Dashboard/           # Executive monitoring dashboard and analytics
    │   ├── MapView/             # Fullscreen GIS map (Markers, Tracking, Heatmap)
    │   ├── Messaging/           # RF broadcast and incident reception console
    │   ├── Reports/             # Tabular report registry, export engine, and SSTV image enhancer
    │   └── Settings/            # EOC radio station and interface configuration
    ├── styles/
    │   ├── app-shell.css        # Desktop application shell styling
    │   └── tokens.css           # Color variables and typography tokens
    └── utils/                   # Coordinate converters, date formatters, and export helpers
```

---

## Emergency Operator Protocol

When an emergency transmission arrives at the Command Center:
1. **Acknowledge**: Check the Messaging module to verify packet checksum and acknowledge receipt to the field sender.
2. **Locate**: Switch to Map View or click the location badge on the report to center on the affected barangay.
3. **Analyze**: Assess incoming SSTV images using the Image Enhancement tool if visual validation of structural damage or flash flooding is required.
4. **Dispatch**: Deploy nearest available response units via the APRS Tracking view.
5. **Log and Export**: Keep the incident status updated through resolution and export the final report package for executive review.

---

## Project Context and Academic Reference

This system was conceptualized and developed as part of the **SAFER 247 Capstone Project**:  
*Title: "SAFER 247: A Radio Frequency-Based Emergency Messaging System for Disaster Risk Reduction and Management Offices"*

For detailed technical specifications and hardware interface designs (TNC, VHF radio transceivers, antenna mast topology), refer to:
* `PROJECT_CONTEXT.md`
* `docs/Capstone Documentation.pdf`

---

## Security and Offline Deployment Architecture

* The Command Center application is engineered for **local, air-gapped, or local area network (LAN) deployment** within municipal EOC facilities.
* It does not transmit operational incident data or responder coordinates to external public servers.
* In full field deployment, tile caching or local tile servers (such as MBTiles or offline OpenStreetMap tiles) can be coupled to provide complete offline mapping capability without active internet.

---

## Acknowledgments and Credits

* **MDRRMO San Fernando, Bukidnon** — Disaster management domain expertise, spatial data validation, and operational workflow requirements.
* **SAFER 247 Development Team** — System architecture, RF protocol integration, and desktop command center application implementation.
