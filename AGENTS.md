# Coding agents instructions for repo `Planif`

First read `./README.md` file. Remember that your are most likely developing in a devcontainer.

## Development Skills & Patterns Learned

### 1. Progressive Web App (PWA) Implementation

- **Manifest Configuration**: Creating `manifest.json` for standalone mobile experience (icons, theme colors, display modes).
- **Service Worker**: Implementing `sw.js` for offline asset caching and version management (`caches.open`, `event.respondWith`).
  - **Aggressive Updates**: Using `cache: 'reload'` in `install` event to force network fetch of updated assets, avoiding stale browser caches.
- **Mobile Meta Tags**: Configuring `viewport` for non-scalable mobile interfaces and iOS-specific tags (`apple-mobile-web-app-capable`).

### 2. Vanilla Web Development (No Framework)

- **Interactive SVG Gauges**:
  - Using SVG `<path>` with `stroke-dasharray` and `stroke-dashoffset` to create fillable ring gauges.
  - **Advanced Input Handling**: Implementing a custom gesture system using **Pointer Events API** to distinguish between:
    - **Drag**: Continuous value adjustment (`pointermove`).
    - **Single Tap**: Opens a custom DOM-based dropdown for precise selection (debounced).
    - **Double Tap**: Resets value to default (detected via timestamp deltas).
  - **Custom UI Controls**: Dynamically creating/removing DOM elements for the value selection dropdown overlay (`document.createElement`, `scrollIntoView`).
- **State Management & Persistence**:
  - Managing app state in global variables with centralized `updateUI()`.
  - Using `localStorage` to persist user preferences (language) and onboarding state (first-visit modal).
- **Component Communication**: Exposing internal module data (like Dive Tables) via getter functions on the `window` object to maintain encapsulation while allowing cross-script access.
- **Glassmorphism & High-Contrast UI**:
  - Using `backdrop-filter: blur()` and semi-transparent backgrounds.
  - Implementing "Result Boxes" with dynamic border colors that change based on safety thresholds (e.g., low gas reserve or high ppO2).

### 3. Data Processing & Visualization

- **MN90 Logic**: Implementing complex lookups (Dive Tables) and algorithms (Air Consumption, DTR) in pure JavaScript.
- **Bühlmann ZHL-16C**: Implementing Gradient Factors algorithm for custom desaturation planning, including residual nitrogen calculation for repetitive dives.
- **Dynamic Graphing**: Visualizing desaturation stops as a depth-proportional vertical chart using CSS heights and Flexbox alignment.
- **Internationalization (i18n)**: Implementing a custom translation system that handles both text content and HTML-rich segments (like safety disclaimers).

### 4. Testing & Debugging

- **Live Reload**: Using `npm run dev` (via `live-server`) for real-time UI updates.
- **Run All Tests**: `npm run test` executes both unit tests (`test:unit`) and E2E tests (`test:e2e`).
- **Service Worker Cache Bypass**: The `sw.js` is configured to bypass the cache on `localhost`/`127.0.0.1` to ensure `live-server` refreshes show the latest code changes.
- **Playwright E2E**:
  - Writing tests to verify UI element visibility and initial state.
  - Simulating user interactions (mouse drag/move) to test gauge responsiveness.
  - Capturing browser console errors within tests to ensure application stability.
  - **Bypassing State**: Using `page.addInitScript` to mock `localStorage` values (like `hasVisited`) to ensure tests start in a clean, predictable state.
- **Robustness**: Adding null checks for DOM elements to prevent initialization errors.

### 5. Deployments

See `./README.md` for instructions.

### 6. Agent Permissions & Workflow

- **Autonomy**: You are authorized to push autonomously to any branch **except `main`**.
- **Main Branch**: Changes to `main` must be done via Pull Request or user confirmation (unless explicitly instructed otherwise). You need to run tests `npm test` before any commit to `main` branch.
