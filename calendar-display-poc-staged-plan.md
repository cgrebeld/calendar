# Calendar Display POC — Staged Docker Plan

## Goal

Validate the calendar-display software stack and wall-mounted touchscreen UX on a MacBook or Windows desktop before moving to the Raspberry Pi 5 + ASUS VT229H production setup.

The POC should answer two main questions:

1. Does the family-calendar UX work well on a 21.5-inch, 1920×1080 wall display?
2. Can the app be packaged and deployed in a way that closely matches the eventual Raspberry Pi installation?

The recommended architecture is:

```text
Mac / Windows host
│
├── Native Chrome / Edge / Chromium
│       └── http://localhost:8080
│
└── Docker
        ├── calendar-web
        └── calendar-api   [only if needed]
```

For the final Pi installation:

```text
Raspberry Pi OS
│
├── Native Chromium kiosk
│       └── http://localhost:8080
│
└── Docker
        ├── calendar-web
        └── calendar-api   [only if needed]
```

The browser remains native so touch, HDMI, GPU acceleration, audio, on-screen keyboard behavior, and display-management behavior stay close to the real hardware.

---

# Stage 0 — Repository and Runtime Foundation

## Objective

Create the project structure and containerized runtime before building much UI.

## Tasks

- Create a Git repository for the project.
- Create the frontend with:
  - React
  - TypeScript
  - Vite
- Create a production Docker image using a multi-stage build:
  - Node.js build stage
  - nginx or Caddy runtime stage
- Expose the app locally on a fixed port such as:
  - `http://localhost:8080`
- Add a `compose.yaml`.
- Add environment-variable support for configuration.
- Add Docker health checks.
- Configure container restart behavior.
- Build for both:
  - `linux/amd64`
  - `linux/arm64`

## Initial project structure

```text
calendar-display/
├── app/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile
├── compose.yaml
├── .env.example
├── README.md
└── docs/
```

## Exit criteria

- `docker compose up` launches the app.
- The app is reachable at `http://localhost:8080`.
- The production image can be built for both AMD64 and ARM64.
- No Raspberry Pi-specific code exists yet.

---

# Stage 1 — Static 1920×1080 UX Prototype

## Objective

Validate the wall-calendar layout before integrating APIs.

## Scope

Use fake data only.

## Build

Create a full-screen dashboard optimized for a 1920×1080 display.

The first prototype should include:

- prominent Today section
- next 5–7 days
- large event text
- per-family-member colors
- all-day event treatment
- previous / next navigation
- event detail view
- weather placeholder
- idle/photo mode
- touch-sized controls

Avoid building every possible calendar feature at this stage.

## Recommended first UX

Focus on a glanceable family agenda rather than cloning Google Calendar.

Example:

```text
┌─────────────────────────────────────────────────────────────┐
│ TODAY                                      Weather           │
├─────────────────────────────────────────────────────────────┤
│ Alex       8:00 AM  Dentist                                  │
│ Sam        3:30 PM  Soccer                                   │
│ Family     6:00 PM  Dinner with grandparents                 │
├─────────────────────────────────────────────────────────────┤
│ SATURDAY                                                    │
│ ...                                                         │
├─────────────────────────────────────────────────────────────┤
│ SUNDAY                                                      │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

## Test method

Run the Docker stack locally and open the app in a native browser.

Use:

- Chrome
- Edge
- Chromium

Set the browser to full screen.

Test at 1920×1080.

If available, connect the ASUS VT229H directly to the laptop or desktop and use it as the display.

## Questions to answer

- Can events be read from several feet away?
- Is the amount of information appropriate?
- Are the family colors immediately understandable?
- Are touch targets large enough?
- Is a 5-day, 7-day, agenda, or hybrid view best?
- Does photo mode feel useful or distracting?
- Does touching the screen immediately restore the calendar?

## Exit criteria

- Household users can understand the display at a glance.
- Core navigation is comfortable by touch.
- Typography is readable at wall-viewing distance.
- Layout direction is stable enough to justify API integration.

---

# Stage 2 — Touchscreen Validation

## Objective

Validate the actual wall-touch interaction model.

## Setup

Connect the ASUS VT229H to the Mac or Windows machine:

- HDMI for video
- USB for touch

Run the app from Docker.

Run the browser natively.

## Test

Validate:

- single tap
- scroll
- swipe
- long lists
- event selection
- modal dialogs
- date selection
- time selection
- on-screen keyboard behavior
- form entry
- closing dialogs
- returning from photo mode
- accidental-touch resistance

## Focus areas

Desktop UI controls often work poorly on a wall touchscreen.

Pay particular attention to:

- tiny date pickers
- small close buttons
- hover-only interactions
- compact dropdown menus
- drag-and-drop dependencies
- right-click assumptions

Replace desktop-style interaction patterns with large, explicit touch controls where needed.

## Exit criteria

- Common actions can be completed standing at the display.
- No required action depends on hover or right-click.
- Text entry is acceptable.
- Navigation feels natural without a mouse or keyboard.

---

# Stage 3 — Google Calendar Read-Only Integration

## Objective

Replace fake data with real calendar data while keeping the app read-only.

## Recommended approach

Create test calendars first rather than using live family calendars.

Example test calendars:

- Parent A
- Parent B
- Kid 1
- Kid 2
- Family

## Populate deliberately difficult test cases

Include:

- overlapping events
- all-day events
- recurring events
- multi-day events
- long titles
- early-morning events
- late-night events
- days with many events
- events across multiple calendars

## Integrate

Add:

- Google OAuth 2.0
- Google Calendar API
- calendar-to-family-member mapping
- color assignment
- event refresh

Retrieve only the fields actually needed by the display.

Likely fields:

- title
- start
- end
- all-day state
- calendar ID
- location
- description, if later required

## Exit criteria

- Real Google Calendar events render correctly.
- Calendar colors map correctly.
- Busy days remain understandable.
- Recurring and all-day events behave correctly.
- Refreshing does not noticeably disrupt the interface.

---

# Stage 4 — Calendar Editing

## Objective

Prove that the display can safely create, edit, and delete Google Calendar events.

## Scope

Add:

- Create
- Edit
- Delete

Keep Google Calendar as the source of truth.

Avoid building a separate calendar database.

## Recommended event-entry flow

Keep the wall UI simple:

```text
Who?
↓
What?
↓
When?
↓
Save
```

Put less-common fields behind an Advanced or More option.

## Validation loop

Test:

1. Create an event on the wall display.
2. Confirm it appears in Google Calendar on a phone or desktop.
3. Edit it elsewhere.
4. Confirm the wall display updates.
5. Edit it on the wall display.
6. Confirm the change appears elsewhere.
7. Delete it from the wall display.
8. Confirm deletion everywhere.

## Exit criteria

- Create/edit/delete operations reliably sync.
- There are no duplicate events.
- Failures produce understandable messages.
- The wall display never becomes a competing source of truth.

---

# Stage 5 — Optional Local API Service

## Objective

Add a backend container only if the frontend alone is insufficient.

## Use a backend if needed for

- secure OAuth token handling
- API proxying
- weather requests
- local cache
- photo management
- configuration storage
- device-specific operations
- future chores/reminders functionality

## Suggested architecture

```text
Docker Compose
│
├── calendar-web
│      └── React production bundle
│
└── calendar-api
       ├── Google Calendar integration
       ├── weather integration
       ├── local cache
       └── configuration
```

Keep this backend small.

A lightweight Node.js or Python service is sufficient.

Do not introduce:

- a full database unless required
- Kubernetes
- multiple microservices
- Electron
- a second browser runtime

## Exit criteria

- The backend has a clear reason to exist.
- Configuration is externalized.
- Persistent data is limited and deliberate.
- Restarting containers does not lose required state.

---

# Stage 6 — Failure and Recovery Testing

## Objective

Make the POC behave like an appliance rather than a development website.

## Tests

### Network failure

Disconnect Wi-Fi.

Expected behavior:

- last known calendar remains visible
- UI indicates sync is unavailable
- app does not become a blank error page
- automatic recovery occurs when connectivity returns

### Container failure

Stop the app container.

Expected behavior:

- restart policy restores service
- browser reconnects or can be automatically refreshed

### API failure

Simulate Google Calendar or weather API failure.

Expected behavior:

- calendar remains usable where possible
- stale data is clearly distinguished if necessary
- weather failure does not break the main calendar

### Host reboot

Reboot the Mac or Windows test machine.

Validate the intended startup sequence conceptually:

```text
OS boot
→ Docker starts
→ calendar containers start
→ browser launches
→ full-screen calendar appears
```

The desktop machine may require manual setup for browser auto-launch, but the workflow should approximate the final Pi behavior.

## Exit criteria

- Temporary failures are recoverable.
- The display never requires technical intervention for normal outages.
- The app fails gracefully.

---

# Stage 7 — Idle / Photo Mode

## Objective

Validate the secondary idle-display experience.

## Behavior

After a configurable inactivity period:

```text
Calendar
↓
Idle timeout
↓
Photo display
↓
Any touch
↓
Calendar
```

## Test

Experiment with idle periods such as:

- 5 minutes
- 10 minutes
- 15 minutes
- 30 minutes

Evaluate:

- how quickly photos should rotate
- whether calendar alerts should interrupt photo mode
- whether the clock/weather remain visible
- whether all touch should immediately restore the calendar

## Exit criteria

- Idle mode does not hide useful information at the wrong time.
- Return to calendar is instant and obvious.
- Photo mode adds value instead of clutter.

---

# Stage 8 — Household Trial

## Objective

Run the system long enough to discover real usage problems.

## Duration

Leave the POC running for several days.

Preferably run it in a location where household members naturally pass it.

## Observe

Look for signs that:

- event text is too small
- too much information is displayed
- events are easy to miss
- colors are confusing
- people expect swipe navigation
- people want a different default date range
- adding events takes too many taps
- photo mode activates too soon
- weather is useful or unnecessary
- the current day's events need stronger emphasis

Do not rely only on verbal feedback.

Observe how people actually interact with it.

## Exit criteria

- Default view is selected.
- Event density is acceptable.
- Family-member color strategy is stable.
- Navigation model is stable.
- Idle behavior is stable.
- Major UX issues are resolved before Pi deployment.

---

# Stage 9 — ARM64 Build Validation

## Objective

Prove the container stack is portable to the Raspberry Pi architecture.

## Build

Build production images for:

```text
linux/amd64
linux/arm64
```

Use Docker Buildx or equivalent multi-platform tooling.

## Validate

Confirm that all dependencies support ARM64.

Pay special attention to any packages that use:

- native binaries
- image-processing libraries
- database drivers
- browser automation
- compiled Node modules

Do not use emulated ARM performance as a measure of Raspberry Pi performance.

The purpose here is compatibility testing.

## Exit criteria

- ARM64 images build successfully.
- No critical dependency is AMD64-only.
- Container manifests support the Pi deployment target.

---

# Stage 10 — Raspberry Pi Deployment

## Objective

Run the same application stack on the selected Raspberry Pi 5 2GB hardware.

## Target architecture

```text
Raspberry Pi OS 64-bit
│
├── Chromium kiosk
│       └── localhost:8080
│
└── Docker Engine
        ├── calendar-web
        └── calendar-api   [if retained]
```

## Pi responsibilities

Raspberry Pi OS should own:

- HDMI output
- USB touch
- Wi-Fi
- audio
- Chromium
- screen power management
- boot
- system updates
- hardware drivers

Docker should own:

- calendar application
- local API service
- app configuration
- app updates

## Configure

- Docker Engine startup at boot
- Docker Compose stack startup
- Chromium kiosk launch
- screen blanking behavior
- cursor hiding
- auto-recovery after power loss
- automatic app reload if needed
- SSH administration
- logging limits

## Exit criteria

- Power-on leads to the calendar without manual intervention.
- Touch works reliably.
- Calendar loads automatically.
- Memory usage is acceptable on the 2GB Pi.
- Reboot and power-loss recovery are reliable.

---

# Stage 11 — Pi Reliability Soak Test

## Objective

Prove the Pi-based system can operate continuously.

## Duration

Run continuously for at least several days, preferably one to two weeks.

## Monitor

- RAM usage
- CPU utilization
- temperature
- disk usage
- Chromium stability
- container restarts
- API refresh
- Wi-Fi reconnect behavior
- touch reliability

## Test deliberate failures

- unplug/replug power
- reboot router
- lose Internet access
- stop containers
- restart Chromium
- restart Docker
- update the application image

## Exit criteria

- No memory-growth issue.
- No repeated manual intervention.
- Recovery behavior is reliable.
- Pi thermals remain acceptable.
- 2GB RAM remains sufficient.

---

# Stage 12 — Production Installation

## Objective

Move the validated hardware/software stack into the pillar installation.

## Before mounting

Confirm:

- display framing
- bezel coverage
- cable routing
- VESA mounting
- power arrangement
- Pi access
- service opening
- ventilation
- removal procedure

## Final software setup

Freeze a known-good release, for example:

```text
calendar-display:1.0.0
```

Document:

- Docker image version
- compose file version
- Raspberry Pi OS version
- environment configuration
- Google API configuration
- recovery procedure
- update procedure
- rollback procedure

## Production update model

Preferred:

```text
Build new image
↓
Tag release
↓
Deploy to Pi
↓
Restart Compose stack
↓
Verify
```

If needed, rollback should be:

```text
calendar-display:1.0.1
↓ rollback
calendar-display:1.0.0
```

---

# Recommended Milestone Sequence

## Milestone 1 — UX

```text
Dockerized React app
→ fake calendar data
→ native browser
→ 1920×1080
→ VT229H touch test
```

Decision: Is the wall-calendar UX good?

## Milestone 2 — Integration

```text
Google Calendar read-only
→ real test calendars
→ event synchronization
```

Decision: Does the real data model work?

## Milestone 3 — Editing

```text
Create
→ Edit
→ Delete
→ cross-device synchronization
```

Decision: Can the display safely become an input device?

## Milestone 4 — Appliance Behavior

```text
offline cache
→ automatic recovery
→ idle/photo mode
→ reboot tests
```

Decision: Does it behave like a household appliance?

## Milestone 5 — Pi Compatibility

```text
ARM64 image
→ Pi 5 deployment
→ Chromium kiosk
→ VT229H
```

Decision: Is the selected 2GB Pi sufficient?

## Milestone 6 — Production

```text
soak test
→ freeze release
→ install in pillar
```

---

# What Not to Build Yet

Until the base calendar is validated, defer:

- chores
- meal planning
- video calling
- camera-based presence detection
- voice assistant features
- complex notifications
- custom databases
- multiple backend services
- remote-device management
- elaborate home-automation integration

These can be added later without changing the core architecture.

---

# Recommended Immediate Next Step

Build **POC 1**:

```text
React + TypeScript + Vite
→ Docker
→ fake family events
→ 1920×1080 agenda
→ touch navigation
→ photo idle mode
→ native browser
```

Run it on the ASUS VT229H from a MacBook or Windows desktop.

Do not integrate Google Calendar until the basic wall UX feels right.

That gives the fastest path to validating the highest-risk part of the project: whether the interface is actually useful as a permanent family wall display.
