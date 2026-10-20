# Interactive Barangay Polygon Focus & Incident Filtering

Upgrade the San Fernando barangay boundaries on the DRRMO map so clicking any barangay polygon smoothly pans, zooms into that barangay's exact boundaries, and filters incident reports and map markers to that area.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The polygon interaction behavior has been updated based on your clarified choice:
> - **Confirmed Action on Click**: Clicking a barangay polygon will smoothly **pan and zoom** the map to frame that barangay's boundaries and simultaneously **filter incident reports** to only show incidents occurring in that barangay.
> - **Selection Toggle & Reset**: Clicking an already-selected barangay (or using the filter reset control / dropdown) returns to "All Barangays" and zooms back to the full municipal view.

---

### 1. Overview & Core Concept

- **What It Does**: Transforms the 24 official San Fernando barangay boundaries into responsive, clickable spatial filters. Clicking a polygon smoothly zooms the viewport to that barangay and updates the active incident list and markers to match.
- **Target Audience / Persona**: Municipal emergency dispatchers, DRRMO operations officers, and analysts evaluating localized incidents across specific barangays (e.g., Halapitan, Poblacion, Kalagangan).
- **Key Value**: Replaces manual dropdown navigation with direct, intuitive spatial selection on the map canvas.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Map Exploration**: User browses the San Fernando map with subtle, non-intrusive boundary outlines (`#64748b`, weight 1.5, transparent fill) preserving full visibility of streets, pins, and terrain.
  2. **Hover Feedback**: Hovering over any barangay polygon changes the cursor to an interactive pointer, highlights the boundary with an energetic stroke (`#3b82f6`, weight 2), and displays a clean tooltip (`Brgy. [Name] · Click to focus & filter`).
  3. **Click Interaction**: Clicking the polygon triggers a smooth, cinematic camera transition (`map.flyToBounds`) framing the barangay geometry with comfortable edge padding.
  4. **Active Selection & Filtering**: The selected barangay border transitions to an active focus outline (`#2563eb`, weight 2.5), the global barangay dropdown updates, and the incident list/pins instantly filter to that barangay.
  5. **Deselection / Reset**: Clicking the active polygon again or selecting "All Barangays" resets the filter and restores the full municipal viewport.

- **Visual Identity & Theme**:
  - **Default Boundaries**: Slate outline (`#64748b`), 1.5px stroke, no fill (`fill: false`) to prevent obscuring underlying satellite or road details.
  - **Hover State**: Cobalt blue outline (`#3b82f6`), 2px stroke, subtle translucent wash (`rgba(59, 130, 246, 0.08)`).
  - **Active Selected State**: Deep royal blue outline (`#2563eb`), 2.5px stroke, soft translucent tint (`rgba(37, 99, 235, 0.12)`).
  - **Typography & Tooltip**: Compact label in clean sans-serif with tabular figures for PSGC and land area.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Bounds Zooming (`flyToBounds`) vs Centroid Zooming (`flyTo`)**:
  - *Chosen Approach*: Calculate the precise bounding box of the GeoJSON polygon via `layer.getBounds()` and animate using `map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 14, duration: 0.75 })`.
  - *Why*: Accommodates both compact urban barangays (like Halapitan) and vast rural highland barangays (like Namnam or Matupe) at their optimal framing without manual zoom adjustments.
  - *Alternatives Considered*: Centroid-based `flyTo` with fixed zoom, which either cuts off large barangays or zooms insufficiently on smaller ones.

- **Decision 2: Event Propagation Management**:
  - *Chosen Approach*: Use `L.DomEvent.stopPropagation(e)` within the polygon click handler so clicking a polygon does not trigger generic map click events or close active incident cards unintentionally.
  - *Why*: Ensures crisp, deterministic interaction without event bubbling conflicts.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                      MapViewPage                       │
│  State: selectedBarangay, selectedType, dateRange      │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│        LeafletMap         │ │    Filtered Incident      │
│  - GeoJSON Layer (24 Bgys)│ │    List & Summary Stats   │
│  - Incident Markers Layer │ └───────────────────────────┘
│  - Layer Controls Panel   │
└────────────┬──────────────┘
             │
     User Clicks Polygon
             │
             ├──► polygon.getBounds() ──► map.flyToBounds(...)
             │
             └──► onSelectBarangay(bgyName) ──► updates state in MapViewPage
```

- **Component State Mapping**:
  - `LeafletMap.jsx`:
    - Add click listener on each GeoJSON feature polygon.
    - Extract canonical name via `normalizeBarangay(feature.properties.adm4_en)`.
    - Invoke `onSelectBarangay(canonicalName)` and zoom via `map.flyToBounds(polygon.getBounds())`.
    - Provide interactive cursor (`cursor: pointer`) on hover.
  - `MapViewPage.jsx`:
    - Receives `onSelectBarangay` update, syncs `selectedBarangay` state.
    - Reactively narrows `filteredIncidents` to matching incidents.
    - Synchronizes top filter dropdown and reset actions.
