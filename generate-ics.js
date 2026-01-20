// ICS file generator with specified requirements
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectCodes = [
  'CHUKRA', 'GUSTO', 'ARTSY', 'PONYTAIL', 'PSYGO', 'Z',
  'ALPHA', 'BETA', 'GAMMA', 'DELTA', 'ECHO', 'FOXTROT',
  'GOLF', 'HOTEL', 'INDIA'
];

const projectOrganizers = {
  CHUKRA: ['amira.shield@libc.org'],
  GUSTO: ['gustavo.ops@libc.org', 'gustavo.billing@libc.org'],
  ARTSY: ['artsy.lab@libc.org', 'artsy.ops@libc.org', 'artsy.coord@libc.org'],
  PONYTAIL: ['ponytail.scheduler@libc.org'],
  PSYGO: ['psygo.coord@libc.org', 'psygo.backup@libc.org'],
  Z: ['scanner.pool@libc.org'],
  ALPHA: ['alpha.coord@libc.org', 'alpha.backfill@libc.org'],
  BETA: ['beta.coord@libc.org', 'beta.qc@libc.org'],
  GAMMA: ['gamma.lead@libc.org'],
  DELTA: ['delta.lead@libc.org'],
  ECHO: ['echo.lead@libc.org'],
  FOXTROT: ['foxtrot.lead@libc.org'],
  GOLF: ['golf.lead@libc.org'],
  HOTEL: ['hotel.lead@libc.org'],
  INDIA: ['india.lead@libc.org'],
};

const specificTitles = {
  'CHUKRA': 'A. Dole',
  'GUSTO': 'Simi Dice', 
  'ARTSY': 'Jonh Doe',
  'PONYTAIL': 'Kid Waddle',
  'PSYGO': 'Chris Drump',
  'Z': 'available - for all LIBC projects'
};

const cancelWords = [
  'canceled', 'cancelled', 'geannuleerd', 'abgesagt', 'annulé', 'cancelado',
  'annullato', 'avbokad', 'peruttu', 'avlyst', 'aflyst', '已取消'
];

const durations = [1, 1.5, 2, 2, 2, 2.5, 3, 4]; // Weighted towards 2 hours
const SAMPLE_START_DATE = new Date('2025-04-01T00:00:00Z');
const SAMPLE_END_DATE = new Date('2025-06-30T23:59:59Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CREATED = new Date('2025-03-01T00:00:00Z');
const DEFAULT_ORGANIZER = 'scheduling@libc.org';

function formatDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function generateRandomTitle(projectCode) {
  if (specificTitles[projectCode]) {
    return '[' + projectCode + '] ' + specificTitles[projectCode];
  }
  
  const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'Alex', 'Emma', 'Chris', 'Lisa'];
  const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
  
  return '[' + projectCode + '] ' + firstNames[Math.floor(Math.random() * firstNames.length)] + 
         ' ' + lastNames[Math.floor(Math.random() * lastNames.length)];
}

function pickOrganizer(projectCode) {
  if (!projectCode) {
    return DEFAULT_ORGANIZER;
  }
  const normalized = projectCode.toUpperCase();
  const candidates = projectOrganizers[normalized];
  if (candidates && candidates.length) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return DEFAULT_ORGANIZER;
}

function dateUtc(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

function createManualEvent({ uid, summary, start, end, projectCode, isCancelled, modified }) {
  const effectiveModified = modified ?? new Date(start.getTime() - 2 * DAY_MS);
  const isLateCancellation = Boolean(
    isCancelled && start.getTime() - effectiveModified.getTime() < 7 * DAY_MS,
  );

  return {
    uid,
    title: summary,
    start,
    end,
    created: DEFAULT_CREATED,
    modified: effectiveModified,
    appointmentSequenceTime: effectiveModified,
    projectCode,
    isCancelled,
    isLateCancellation,
    organizer: pickOrganizer(projectCode),
  };
}

function injectOverlapSamples(events) {
  const scenarios = [
    () => {
      const start = dateUtc(2025, 5, 15, 13, 0);
      const end = new Date(start.getTime() + 2 * HOUR_MS);
      const late = createManualEvent({
        uid: 'manual-late-001@example.com',
        summary: 'Cancelled: [CHUKRA] Replacement overlap demo',
        start,
        end,
        projectCode: 'CHUKRA',
        isCancelled: true,
      });
      const replacement = createManualEvent({
        uid: 'manual-active-001@example.com',
        summary: '[GOLF] Replacement booking for cancelled slot',
        start,
        end,
        projectCode: 'GOLF',
        isCancelled: false,
        modified: new Date(start.getTime() - 20 * DAY_MS),
      });
      events.push(late, replacement);
    },
    () => {
      const start = dateUtc(2025, 6, 3, 9, 0);
      const end = new Date(start.getTime() + 4 * HOUR_MS);
      const late = createManualEvent({
        uid: 'manual-late-002@example.com',
        summary: 'Cancelled: [PSYGO] Partial overlap scenario',
        start,
        end,
        projectCode: 'PSYGO',
        isCancelled: true,
      });
      const firstReplacement = createManualEvent({
        uid: 'manual-active-002@example.com',
        summary: '[ALPHA] Backfill session A',
        start: new Date(start.getTime() + 30 * 60 * 1000),
        end: new Date(start.getTime() + 2 * HOUR_MS + 30 * 60 * 1000),
        projectCode: 'ALPHA',
        isCancelled: false,
        modified: new Date(start.getTime() - 15 * DAY_MS),
      });
      const secondReplacement = createManualEvent({
        uid: 'manual-active-003@example.com',
        summary: '[BETA] Backfill session B',
        start: new Date(start.getTime() + 2 * HOUR_MS + 15 * 60 * 1000),
        end: new Date(start.getTime() + 3 * HOUR_MS + 15 * 60 * 1000),
        projectCode: 'BETA',
        isCancelled: false,
        modified: new Date(start.getTime() - 10 * DAY_MS),
      });
      events.push(late, firstReplacement, secondReplacement);
    },
  ];

  scenarios.forEach((buildScenario) => buildScenario());
}

function generateEvents() {
  const events = [];
  const startDate = new Date(SAMPLE_START_DATE.getTime());
  const endDate = new Date(SAMPLE_END_DATE.getTime());
  
  const occupiedSlots = new Set(); // Track occupied time slots
  
  // Generate about 300 events
  let eventCount = 0;
  const targetEvents = 300;
  
  while (eventCount < targetEvents) {
    // Random date between start and end
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    const eventDate = new Date(randomTime);
    
    // Skip weekends sometimes (mostly weekdays)
    const dayOfWeek = eventDate.getDay();
    if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() > 0.3) {
      continue;
    }
    
    // Random hour between 8 and 22
    const startHour = 8 + Math.floor(Math.random() * 14);
    eventDate.setHours(startHour, 0, 0, 0);
    
    // Random duration
    const duration = durations[Math.floor(Math.random() * durations.length)];
    const endTime = new Date(eventDate.getTime() + duration * HOUR_MS);
    
    // Check if this slot overlaps with existing events
    const slotKey = eventDate.toISOString().split('T')[0] + '-' + startHour;
    if (occupiedSlots.has(slotKey)) {
      continue;
    }
    
    occupiedSlots.add(slotKey);
    
    // Generate event
    let title;
    let projectCode = null;
    
    // 90% with project codes, 10% without
    if (Math.random() < 0.9) {
      if (Math.random() < 0.1) {
        // Unknown events
        const unknownTitles = ['Schoonmaak MRI LIBC', 'Maintenance check', 'Equipment calibration'];
        title = unknownTitles[Math.floor(Math.random() * unknownTitles.length)];
      } else {
        projectCode = projectCodes[Math.floor(Math.random() * projectCodes.length)];
        title = generateRandomTitle(projectCode);
      }
    } else {
      title = 'Random meeting ' + Math.floor(Math.random() * 1000);
    }
    
    // 15% cancellations
    let isCancelled = Math.random() < 0.15;
    let isLateCancellation = false;
    let modificationDate = new Date(eventDate.getTime() - 10 * DAY_MS); // Default 10 days before

    if (isCancelled) {
      const cancelWord = cancelWords[Math.floor(Math.random() * cancelWords.length)];
      title = cancelWord.charAt(0).toUpperCase() + cancelWord.slice(1) + ': ' + title;
      
      // Half of cancellations are late (within 7 days)
      if (Math.random() < 0.5) {
        isLateCancellation = true;
        // Modification date within 7 days of event
        const daysBeforeEvent = Math.random() * 7;
        modificationDate = new Date(eventDate.getTime() - daysBeforeEvent * DAY_MS);
      } else {
        // On-time cancellation (more than 7 days before)
        const daysBeforeEvent = 7 + Math.random() * 30;
        modificationDate = new Date(eventDate.getTime() - daysBeforeEvent * DAY_MS);
      }
    }
    
    const uid = 'event-' + eventCount + '-' + Date.now() + '@example.com';
    
    events.push({
      uid,
      title,
      start: eventDate,
      end: endTime,
      created: new Date('2025-06-01'),
      modified: modificationDate,
      appointmentSequenceTime: modificationDate,
      projectCode,
      isCancelled,
      isLateCancellation,
      organizer: pickOrganizer(projectCode),
    });
    
    eventCount++;
  }
  
  injectOverlapSamples(events);

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function createICSFile(events) {
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//Test//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ].join('\r\n') + '\r\n';
  
  events.forEach(event => {
    const busyStatus = event.isCancelled ? 'FREE' : 'BUSY';
    const statusValue = event.isCancelled ? 'CANCELLED' : 'CONFIRMED';
    const apptSeqTime = event.appointmentSequenceTime ? 'X-MS-OLK-APPTSEQTIME:' + formatDate(event.appointmentSequenceTime) : null;
    icsContent += [
      'BEGIN:VEVENT',
      'UID:' + event.uid,
      'DTSTART:' + formatDate(event.start),
      'DTEND:' + formatDate(event.end),
      'DTSTAMP:' + formatDate(new Date()),
      'CREATED:' + formatDate(event.created),
      'LAST-MODIFIED:' + formatDate(event.modified),
      apptSeqTime,
      'SUMMARY:' + event.title,
      'ORGANIZER:mailto:' + event.organizer,
      'X-MICROSOFT-CDO-BUSYSTATUS:' + busyStatus,
      'TRANSP:OPAQUE',
      'STATUS:' + statusValue,
      'END:VEVENT'
    ].filter(Boolean).join('\r\n') + '\r\n';
  });
  
  icsContent += 'END:VCALENDAR\r\n';
  return icsContent;
}

// Generate events and create ICS file
console.log('Generating events...');
const events = generateEvents();

// Statistics
const totalEvents = events.length;
const cancelledEvents = events.filter(e => e.isCancelled).length;
const lateCancellations = events.filter(e => e.isLateCancellation).length;
const onTimeCancellations = cancelledEvents - lateCancellations;

const projectStats = {};
events.forEach(event => {
  const code = event.projectCode || 'UNKNOWN';
  if (!projectStats[code]) projectStats[code] = 0;
  projectStats[code]++;
});

console.log('\nEvent Statistics:');
console.log('Total Events:', totalEvents);
console.log('Cancelled Events:', cancelledEvents, '(' + (cancelledEvents/totalEvents*100).toFixed(1) + '%)');
console.log('Late Cancellations:', lateCancellations);
console.log('On-time Cancellations:', onTimeCancellations);
console.log('\nProject Distribution:');
Object.entries(projectStats).sort((a,b) => b[1] - a[1]).forEach(([code, count]) => {
  console.log(code + ':', count);
});

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const icsContent = createICSFile(events);
const samplePath = path.join(publicDir, 'sample.ics');
fs.writeFileSync(samplePath, icsContent);

console.log('\nGenerated public/sample.ics with', totalEvents, 'events.');