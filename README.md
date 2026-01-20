# MRI Scanner Timekeeping Webapp
A client-side dashboard for MRI scanner administrators to upload Outlook-exported ICS calendars, classify cancellations (on-time vs. late), and total usage per project for billing.

Find the website [here](https://solo-fsw-projects.github.io/libc-scanner-timekeeping-webapp/).

Test data can be found in: `J:\departments\fsw\FAC\SOLO\Lab-support\015 GitHub Data\solo-fsw\libc-scanner-timekeeping-webapp.data`.

## Tech Stack
- [Vite](https://vitejs.dev/) + TypeScript
- [ical.js](https://github.com/mozilla-comm/ical.js) and [ical-expander](https://github.com/mifi/ical-expander)
- [FullCalendar](https://fullcalendar.io/) (core + daygrid/timegrid/list plugins)

## Getting Started

### Prerequisites
- Node.js 18+ (LTS recommended) and npm.

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
