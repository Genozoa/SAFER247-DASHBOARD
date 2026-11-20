# SAFER 247 — Project Context

## Project Title

SAFER 247: A Radio Frequency-Based Emergency Messaging System

## Project Purpose

SAFER 247 is an emergency communication system designed for Disaster
Risk Reduction and Management Offices (DRRMOs).

The system is intended to enable the transmission and reception of
structured emergency information through radio frequency communication,
particularly when cellular or internet connectivity is unavailable.

The system consists of two major components:

1. Field Responder Android Application
2. Command Center Web Application

This project focuses on the Command Center Web Application.

## Command Center Purpose

The Command Center is a centralized web-based platform used by
command center operators to receive, organize, monitor, and visualize
emergency information transmitted by field responders.

The Command Center should support situational awareness through:

- Emergency broadcast messaging
- Incident report management
- Incident visualization
- Statistical monitoring
- Geographic mapping
- Heatmap visualization
- Responder location tracking
- Incident report records
- Received image viewing
- Image enhancement

## Important System Constraint

The overall SAFER 247 system is designed to operate through RF
communication when cellular or internet connectivity is unavailable.

The Command Center web application itself is designed to run in the
command center environment and interfaces with the system's received
RF data.

Do not assume that the system relies on cloud-based communication
between field responders and the Command Center.

## Command Center User

The primary web application user is:

Command Center Operator

The operator monitors and manages emergency information received
from field responders.

## Main Command Center Modules

1. Dashboard
2. Messaging
3. Map View
4. Reports
5. Settings

## Dashboard

The dashboard provides monitoring and situational awareness.

It should display:

- Recent incident reports
- Incident timeline
- Hourly incident frequency
- Daily incident frequency
- Monthly incident frequency
- Incident type distribution
- Incident density/distribution by barangay

Dashboard visualizations should be based on incident report data.

## Messaging

The Command Center has a shared broadcast messaging channel.

The messaging interface should allow the operator to:

- View received messages
- View sent messages
- Send quick messages
- Receive incident reports
- Search messages
- Filter messages by incident type
- Filter messages by date
- View incident reports in a dedicated incident-report area
- Resend failed outgoing messages

Messages may contain:

- Text
- Geolocation
- Images
- Sender identification
- Timestamp
- Incident type where applicable

## Map View

The Map View provides geographic visualization of emergency information.

It supports three primary map modes:

1. Markers
2. Tracking
3. Heatmap

### Markers

Incident reports are represented as map markers.

Selecting a marker should allow the operator to view incident information,
including:

- Report ID
- Sender/call sign
- Incident type
- Location
- Time/timestamp
- Relevant incident details

### Tracking

Tracking displays the latest known locations of field responders.

Responder locations are transmitted periodically through the system's
location beaconing functionality.

### Heatmap

The heatmap visualizes geographic concentration of incident reports.

Areas with greater concentrations of reports should have greater visual
intensity.

Selecting a region/barangay should allow the operator to view related
reports.

## Reports

The Reports page contains all received incident report records.

It should support:

- Viewing incident records
- Filtering by date
- Filtering by incident type
- Filtering by location/barangay
- Viewing incident details
- Viewing an incident on the map
- Exporting filtered incident records

Supported export formats:

- CSV
- XLSX
- PDF

## Image Enhancement

The Command Center can receive images transmitted through RF/SSTV.

The operator should be able to:

1. View the original received image
2. Select an image for enhancement
3. Manually perform image enhancement
4. View the original image
5. View the enhanced image
6. Preserve/store the enhanced output

Image enhancement is performed only on the Command Center side.

## Technology Requirements

The documented technology requirements include:

- Python-based web application
- PostgreSQL
- PostGIS
- Python
- OpenCV
- Pillow
- Visual Studio Code

The Command Center backend is intended to use Python.

PostgreSQL/PostGIS is intended for database and geospatial data handling.

## UI Design Source of Truth

The provided wireframes are the primary visual reference for the
Command Center interface.

The implementation should closely reproduce the wireframes in:

- Layout
- Navigation
- Component placement
- Spacing
- Typography hierarchy
- Colors
- Buttons
- Filters
- Cards
- Tables
- Maps
- Panels
- Modals
- Charts

Do not redesign the application without explicit approval.

## Development Principle

The implementation must be based on the capstone documentation and
provided wireframes.

Do not invent functionality that is not supported by the documentation
or wireframes.

If a requirement is unclear or the documentation and wireframes appear
to conflict:

1. Identify the conflict.
2. Explain it.
3. Ask for clarification.
4. Do not silently invent a solution.

## Current Development Status

The repository currently contains a React/Vite Command Center front end under
`frontend/`. It provides Dashboard, Messaging, Map View, Reports, and Settings
screens. A FastAPI backend and PostgreSQL/PostGIS persistence layer are
implemented under `backend/`.

### Run the dashboard locally

From the repository root, start the Vite development server:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in a browser. By default, Vite development mode
uses demo data and local demo sign-in/sign-out behavior, so the dashboard can
be viewed without starting the backend or database. Demo sign-in does not
verify credentials or persist accounts. To use real authentication and
database-backed operational data, configure and start the backend and database
as described in `backend/database/README.md`.

The default development operational data source is a set of fictional
front-end demo records in `frontend/src/data/demoData.js`, exposed through
`frontend/src/data/operationalData.js`. The application prominently labels this
content as **DEMO DATA — NOT LIVE DRRMO DATA**. Demo records are for interface
demonstration only and are not official, current, or representative San
Fernando DRRMO incident data. In API mode, the application uses the backend
operational endpoints; this is not a connection to a live DRRMO source.

### Implemented in the front end

- Dashboard metrics and visualizations calculated from the selected incident
  records.
- Incident search and filters on the map and reports screens.
- Map markers and a KDE heatmap built from filtered incident records that have
  valid latitude and longitude coordinates. Every mapped record contributes
  one point. Barangay counts in the heatmap panel are calculated from those
  same mappable records; no fixed hotspot counts or locations are added.
- Report downloads in CSV, XLSX, and PDF formats from the filtered report
  records. Exported rows include a data-source field so demo records remain
  identifiable outside the application.
- A notice that image enhancement is under development. Image processing and
  storage are not implemented.
- Demo messaging is local UI behavior; in API mode, broadcast text is queued
  for APRS processing. Jobs remain queued unless radio processing is enabled
  and the API-managed background worker is running. WAV generation or audio
  output does not verify RF delivery; live RF and Android interoperability
  remain unverified.
- Officer tracking has no live location feed.

### Database and backend status

`backend/database/schema.sql` defines a PostgreSQL/PostGIS schema, and
`backend/database/README.md` documents how to create it. The schema contains no
demo seed records. The backend exposes authentication and operational APIs and
can connect to PostgreSQL/PostGIS when configured. The frontend defaults to
demo data in Vite development mode; API mode requires the backend and database.

### Authentication and access control

The backend provides operator registration, login, session management, and
server-side logout. These features require the backend and a configured
database. In the default Vite development demo mode, sign-in/sign-out only
change local UI state and do not verify credentials or persist accounts.
Production use still requires deployment security review and an approved
identity and access-control policy.

### Planned or blocked integrations

- Live incident and message data from the San Fernando DRRMO.
- Production deployment and review of backend authentication and authorization.
- RF message sending/receiving and responder location telemetry.
- Image enhancement and durable storage of original/enhanced images.
- Offline map imagery, which requires locally available/cached map tiles.