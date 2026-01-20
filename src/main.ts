import { Calendar, type EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import './style.css'
import { UNKNOWN_PROJECT_LABEL, APP_VERSION, LATE_CANCELLATION_DAYS, DEFAULT_UNBILLABLE_PROJECT_CODES } from './constants'
import { colorForProject } from './colors'
import { buildDatasetStats, buildProjectSummaries } from './aggregations'
import { classifyOccurrences } from './classifier'
import { parseIcs } from './ics'
import { normalizeOrganizerEmail } from './organizers'
import type { DatasetStats, Occurrence, ProjectSummary } from './types'
import { downloadWorkbook } from './workbook'
import { buildProjectWorkbookSheets } from './projectExport.ts'

const template = `
  <div class="app-shell">
    <section class="hero">
      <h1>LIBC MRI Scanner Timekeeping</h1>
      <p>Upload the Outlook-exported ICS calendar to classify sessions, cancellations, and billable time per project.</p>
      <div class="upload-bar">
        <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload ICS file">
          <div>
            <strong>Drop an ICS file or browse</strong>
            <small>Files stay on this device. Recurring events and cancellations are expanded automatically.</small>
          </div>
          <div class="drop-actions">
            <button class="cta" type="button" id="browseBtn">Choose .ics file</button>
            <button class="pill-btn" type="button" id="sampleBtn">Use sample calendar</button>
            <input type="file" id="icsInput" accept=".ics,text/calendar" aria-label="Calendar file" />
          </div>
        </div>
        <div class="status-line" id="statusLine"><span>Waiting for a calendar…</span></div>
        <div class="stats" id="statsGrid"></div>
        <h3 class="legend-heading">Projects</h3>
        <div class="legend" id="projectLegend" aria-live="polite" aria-label="Projects"></div>
      </div>
    </section>
    <section id="rulesSection" class="collapsible-section"></section>
    <section class="tabs">
      <div class="tablist" role="tablist">
        <button role="tab" aria-selected="true" id="tab-summary" data-target="panel-summary" aria-controls="panel-summary">Summary</button>
        <button role="tab" aria-selected="false" id="tab-projects" data-target="panel-projects" aria-controls="panel-projects">Projects</button>
        <button role="tab" aria-selected="false" id="tab-calendar" data-target="panel-calendar" aria-controls="panel-calendar">Calendar</button>
        <button role="tab" aria-selected="false" id="tab-events" data-target="panel-events" aria-controls="panel-events">Event List</button>
      </div>
      <div id="panel-summary" class="tabpanel panel-surface active" role="tabpanel" tabindex="0" aria-labelledby="tab-summary">
        <div class="download-row">
          <span>Billable totals per project (on-time cancellations excluded).</span>
          <button class="pill-btn" type="button" id="downloadSummary" disabled>Export Projects</button>
        </div>
        <div class="summary-highlights" id="summaryHighlights"></div>
        <div id="summaryEmpty" class="empty-state">No projects yet — load a calendar to view totals.</div>
        <div class="table-wrap" id="summaryTableWrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Total billable hours</th>
                <th>Total duration (hours)</th>
                <th>Active</th>
                <th>On-Time Cancels</th>
                <th>Late Cancels</th>
                <th>Billable</th>
              </tr>
            </thead>
            <tbody id="summaryTableBody"></tbody>
          </table>
        </div>
      </div>
      <div id="panel-projects" class="tabpanel panel-surface" role="tabpanel" tabindex="0" aria-labelledby="tab-projects" hidden>
        <div class="download-row">
          <span>Per-project event breakdown.</span>
          <button class="pill-btn" type="button" id="downloadProjects" disabled>Export Projects</button>
        </div>
        <div id="projectsEmpty" class="empty-state">No project breakdown available yet.</div>
        <div id="projectsContainer" class="projects-container"></div>
      </div>
      <div id="panel-calendar" class="tabpanel panel-surface calendar-shell" role="tabpanel" tabindex="0" aria-labelledby="tab-calendar" hidden>
        <div id="calendar"></div>
      </div>
      <div id="panel-events" class="tabpanel panel-surface" role="tabpanel" tabindex="0" aria-labelledby="tab-events" hidden>
        <div class="download-row">
          <span>Every scanner reservation with computed classification and project.</span>
          <button class="pill-btn" type="button" id="downloadEvents" disabled>Export</button>
        </div>
        <div id="eventsEmpty" class="empty-state">Upload a calendar to populate the event list.</div>
        <div class="table-wrap" id="eventsTableWrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Title</th>
                <th>Start</th>
                <th>End</th>
                <th>Cancelled</th>
                <th>Created</th>
                <th>Organizer(s)</th>
                <th>Status</th>
                <th>Duration (hours)</th>
                <th>Billable hours</th>
              </tr>
            </thead>
            <tbody id="eventsTableBody"></tbody>
          </table>
        </div>
      </div>
  
    </section>
    <footer class="app-footer">
      <p class="app-version">Version ${APP_VERSION}</p>
      <p class="app-attribution">Built for the LIBC by the SOLO Research Support Team (Louise, Elio and Agentic AI ✨).</p>
      <p class="app-attribution">Faculty of Social and Behavioral Sciences, Leiden University</p>
      <p class="app-date"> January 2026.</p>
      <p class="app-date">Source-code on <a href="https://github.com/solo-fsw/libc-scanner-timekeeping-webapp">GitHub</a></p>
    </footer>
  </div>
`

type PanelId = 'panel-calendar' | 'panel-events' | 'panel-summary' | 'panel-projects'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App container missing')
app.innerHTML = template

const elements = {
  dropzone: document.getElementById('dropzone') as HTMLDivElement,
  fileInput: document.getElementById('icsInput') as HTMLInputElement,
  browseBtn: document.getElementById('browseBtn') as HTMLButtonElement,
  sampleBtn: document.getElementById('sampleBtn') as HTMLButtonElement,
  statusLine: document.getElementById('statusLine') as HTMLDivElement,
  statsGrid: document.getElementById('statsGrid') as HTMLDivElement,
  legend: document.getElementById('projectLegend') as HTMLDivElement,
  eventsEmpty: document.getElementById('eventsEmpty') as HTMLDivElement,
  eventsTableWrap: document.getElementById('eventsTableWrap') as HTMLDivElement,
  eventsTableBody: document.getElementById('eventsTableBody') as HTMLTableSectionElement,
  eventsDownload: document.getElementById('downloadEvents') as HTMLButtonElement,
  summaryEmpty: document.getElementById('summaryEmpty') as HTMLDivElement,
  summaryTableWrap: document.getElementById('summaryTableWrap') as HTMLDivElement,
  summaryTableBody: document.getElementById('summaryTableBody') as HTMLTableSectionElement,
  summaryDownload: document.getElementById('downloadSummary') as HTMLButtonElement,
  projectsDownload: document.getElementById('downloadProjects') as HTMLButtonElement,
  summaryHighlights: document.getElementById('summaryHighlights') as HTMLDivElement,
  projectsEmpty: document.getElementById('projectsEmpty') as HTMLDivElement,
  projectsContainer: document.getElementById('projectsContainer') as HTMLDivElement,
  rulesSection: document.getElementById('rulesSection') as HTMLDivElement,
}

const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))

const calendarElement = document.getElementById('calendar') as HTMLElement
const calendar = new Calendar(calendarElement, {
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
  initialView: 'dayGridMonth',
  height: 'auto',
  fixedWeekCount: false,
  displayEventTime: true,
  eventDisplay: 'block',
  headerToolbar: {
    left: 'title',
    center: '',
    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek today prev,next',
  },
  buttonText: {
    today: 'Today',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    list: 'List',
  },
  eventTimeFormat: {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
  slotLabelFormat: {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
  eventClick(info) {
    info.jsEvent?.preventDefault()
    const projectCode = (info.event.extendedProps?.projectCode as string | undefined) ?? null
    focusEventInProjects(info.event.id, projectCode)
  },
})
calendar.render()

window.addEventListener('resize', () => {
  const calendarPanel = document.getElementById('panel-calendar')
  if (calendarPanel && calendarPanel.classList.contains('active')) {
    refreshCalendarLayout()
  }
})

let currentEvents: Occurrence[] = []
let currentSummaries: ProjectSummary[] = []
let currentStats: DatasetStats | null = null
let currentDateSpan: { start: Date; end: Date } | null = null
let currentSourceFileName = 'calendar.ics'
const billableProjects = new Map<string, boolean>()

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

elements.browseBtn.addEventListener('click', () => elements.fileInput.click())
elements.fileInput.addEventListener('change', async (event) => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0]
  if (!file) return
  await loadFile(file)
  elements.fileInput.value = ''
})

elements.sampleBtn.addEventListener('click', async () => {
  try {
    setStatus('Loading sample calendar…')
    const res = await fetch(`${import.meta.env.BASE_URL ?? '/'}sample.ics`)
    if (!res.ok) {
      throw new Error('Unable to fetch sample calendar')
    }
    const text = await res.text()
    await hydrateFromIcs(text, 'Sample calendar', 'sample.ics')
    setStatus('Sample calendar loaded', 'success')
  } catch (error) {
    setStatus('Unable to load the sample calendar.', 'error', formatErrorDetail(error))
  }
})

setupDropzone(elements.dropzone, async (file) => {
  await loadFile(file)
})

elements.eventsDownload.addEventListener('click', () => {
  if (!currentEvents.length) return
  const header = [
    'Project',
    'Title',
    'Description',
    'Location',
    'Status (raw)',
    'Organizer (raw)',
    'Organizer(s) (normalized)',
    'Sequence',
    'Start',
    'End',
    'All day',
    'TZID',
    'Cancelled at (X-MS-OLK-APPTSEQTIME > LAST-MODIFIED > DTSTAMP)',
    'X-MS-OLK-APPTSEQTIME (raw)',
    'Created (CREATED > DTSTAMP)',
    'Last modified',
    'DTSTAMP',
    'Busy status',
    'Recurrence ID',
    'Source type',
    'Classification',
    'Duration (minutes)',
    'Duration (hours)',
    'Billable (minutes)',
    'Billable (hours)',
  ]
  const exportRows = getEventsWithBillableOverrides().map((event) => {
    const projectLabel = getEventProjectLabel(event)
    const organizer = formatOrganizerEmail(event.organizer)
    const statusLabel = formatClassificationLabel(event.classification)
    const cancelDate = event.appointmentSequenceTime ?? event.lastModified ?? event.dtstamp
    const createdDate = event.created ?? event.dtstamp
    return [
      projectLabel,
      event.summary,
      nullableText(event.description),
      nullableText(event.location),
      nullableText(event.status),
      nullableText(event.organizer),
      organizer,
      event.sequence ?? '—',
      formatDate(event.start),
      formatDate(event.end),
      event.allDay ? 'true' : 'false',
      event.tzid ?? '—',
      formatNullableDate(cancelDate),
      formatNullableDate(event.appointmentSequenceTime),
      formatNullableDate(createdDate),
      formatNullableDate(event.lastModified),
      formatNullableDate(event.dtstamp),
      nullableText(event.busyStatus),
      event.recurrenceId ?? '—',
      event.sourceType,
      statusLabel,
      event.durationMinutes,
      formatHours(event.durationMinutes),
      event.billableMinutes,
      formatHours(event.billableMinutes),
    ]
  })
  const data = [header, ...exportRows]
  downloadWorkbook(formatExportFilename('event-details', 'xlsx'), [{ name: 'Events', data }])
})

elements.summaryDownload.addEventListener('click', exportProjectsWorkbook)
elements.projectsDownload.addEventListener('click', exportProjectsWorkbook)

setupTabs()
renderStats()
renderLegend()
renderSummaryHighlights()
toggleTables()
renderRulesSection()

async function loadFile(file: File): Promise<void> {
  if (!isIcsFile(file)) {
    setStatus('Please choose a file with the .ics extension.', 'error')
    return
  }

  setStatus(`Processing ${file.name}…`)

  let text: string
  try {
    text = await readCalendarFile(file)
  } catch (error) {
    setStatus('Unable to read that file.', 'error', formatErrorDetail(error))
    return
  }

  try {
    await hydrateFromIcs(text, file.name, file.name)
    setStatus(`Loaded ${currentEvents.length} events from ${file.name}`, 'success')
  } catch (error) {
    setStatus('The calendar file appears to be invalid. Please export a fresh ICS file.', 'error', formatErrorDetail(error))
  }
}

async function hydrateFromIcs(text: string, label: string, fileName: string): Promise<void> {
  const sanitized = sanitizeIcs(text)
  const raw = parseIcs(sanitized).filter((event) => !event.allDay)
  const enriched = classifyOccurrences(raw)
  currentEvents = enriched.sort((a, b) => a.start.getTime() - b.start.getTime())
  currentSummaries = buildProjectSummaries(currentEvents)
  syncBillableProjects(currentSummaries)
  currentStats = buildDatasetStats(currentEvents, currentSummaries)
  currentDateSpan = computeDateSpan(currentEvents)
  currentSourceFileName = fileName?.trim() || 'calendar.ics'
  renderAll(label)
}

function renderAll(label?: string) {
  renderCalendar()
  positionCalendarAtFirstEvent()
  renderEventsTable()
  renderSummaryTable()
  renderSummaryHighlights()
  renderProjectsSection()
  renderStats()
  renderLegend()
  renderRulesSection()
  if (label) {
    document.title = `MRI Timekeeping · ${label}`
  }
}

function renderCalendar() {
  calendar.removeAllEvents()
  const inputs: EventInput[] = currentEvents.map((event) => {
    const projectLabel = event.projectCode ?? UNKNOWN_PROJECT_LABEL
    const baseColor = colorForProject(projectLabel)
    const classification = event.classification
    const titlePrefixMap: Record<Occurrence['classification'], string> = {
      ACTIVE: '',
      CANCELLED_ON_TIME: '✖️ ',
      CANCELLED_LATE: '❌ ',
    }
    const isCancelled = classification !== 'ACTIVE'
    const color = isCancelled ? lightenColor(baseColor, classification === 'CANCELLED_LATE' ? 0.45 : 0.3) : baseColor
    const classNames = isCancelled
      ? ['fc-event-cancelled', classification === 'CANCELLED_LATE' ? 'fc-event-cancelled-late' : 'fc-event-cancelled-on-time']
      : []
    const titlePrefix = titlePrefixMap[classification] ?? ''
    return {
      id: event.id,
      title: `${titlePrefix}${event.summary}`,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      backgroundColor: color,
      borderColor: color,
      display: 'block',
      extendedProps: {
        projectCode: projectLabel,
        classification: event.classification,
      },
      classNames,
    }
  })

  inputs.forEach((input) => calendar.addEvent(input))
}

function renderEventsTable() {
  const hasEvents = currentEvents.length > 0
  elements.eventsEmpty.style.display = hasEvents ? 'none' : 'block'
  elements.eventsTableWrap.style.display = hasEvents ? 'block' : 'none'
  elements.eventsDownload.disabled = !hasEvents

  if (!hasEvents) {
    elements.eventsTableBody.innerHTML = ''
    return
  }

  const rows = currentEvents.map((event) => {
    const projectLabel = getEventProjectLabel(event)
    const billable = isProjectBillable(projectLabel)
    const billableMinutes = billable ? event.billableMinutes : 0
    const organizerDisplay = formatOrganizerEmail(event.organizer)
    return `
      <tr data-event-id="${event.id}" data-billable="${billable}">
            <td>${projectLabel}</td>
            <td>${escapeHtml(event.summary)}</td>
        <td>${formatDate(event.start)}</td>
        <td>${formatDate(event.end)}</td>
        <td>${formatCancellationDate(event)}</td>
        <td>${formatCreationDate(event)}</td>
        <td>${escapeHtml(organizerDisplay)}</td>
        <td>${renderTag(event.classification)}</td>
        <td>${formatHours(event.durationMinutes)}</td>
        <td>${formatHours(billableMinutes)}</td>
      </tr>
    `
  })

  elements.eventsTableBody.innerHTML = rows.join('')
  wireEventRowLinks(elements.eventsTableBody)
}

function renderSummaryTable() {
  const hasProjects = currentSummaries.length > 0
  elements.summaryEmpty.style.display = hasProjects ? 'none' : 'block'
  elements.summaryTableWrap.style.display = hasProjects ? 'block' : 'none'
  elements.summaryDownload.disabled = !hasProjects
  elements.projectsDownload.disabled = !hasProjects

  if (!hasProjects) {
    elements.summaryTableBody.innerHTML = ''
    return
  }

  const rows = currentSummaries.map((summary) => {
    const billable = isProjectBillable(summary.projectCode)
    const checkboxId = `billable-${slugifyProject(summary.projectCode)}`
    const billableHoursDisplay = (billable ? summary.totalHours : 0).toFixed(2)
    const durationDisplay = summary.totalDurationHours.toFixed(2)
    const organizerList = formatOrganizerList(summary.organizers)
    const organizerBlock = `
      <div class="organizer-note">
        <span>Organizer(s):</span>
        <span>${escapeHtml(organizerList)}</span>
      </div>
    `
    return `
      <tr data-billable="${billable}" data-project-code="${summary.projectCode}" data-project-link="true">
        <td>
          <div class="project-name">${summary.projectCode}</div>
          ${organizerBlock}
        </td>
        <td>${billableHoursDisplay}</td>
        <td>${durationDisplay}</td>
        <td>${summary.activeCount}</td>
        <td>${summary.cancelledOnTimeCount}</td>
        <td>${summary.cancelledLateCount}</td>
        <td>
          <label class="billable-toggle" for="${checkboxId}">
            <input type="checkbox" id="${checkboxId}" data-project="${summary.projectCode}" ${billable ? 'checked' : ''} />
            <span>Billable</span>
          </label>
        </td>
      </tr>
    `
  })

  elements.summaryTableBody.innerHTML = rows.join('')
  wireBillableToggles()
  wireSummaryRowLinks()
}

function renderSummaryHighlights() {
  if (!currentSummaries.length) {
    elements.summaryHighlights.style.display = 'none'
    elements.summaryHighlights.innerHTML = ''
    return
  }

  const billableSummaries = getBillableSummaries()
  const billableMinutes = billableSummaries.reduce((acc, summary) => acc + summary.totalMinutes, 0)
  const billableHours = (billableMinutes / 60).toFixed(2)
  const billableLateCancels = currentEvents.filter((event) => {
    const label = event.projectCode ?? UNKNOWN_PROJECT_LABEL
    return event.classification === 'CANCELLED_LATE' && isProjectBillable(label)
  }).length

  elements.summaryHighlights.style.display = 'grid'
  const items = [
    { label: 'Billable hours', value: billableHours },
    { label: 'Late cancellations', value: billableLateCancels.toString() },
  ]

  elements.summaryHighlights.innerHTML = items
    .map(
      (item) => `
        <dl class="stat-card compact">
          <dt>${item.label}</dt>
          <dd>${item.value}</dd>
        </dl>
      `,
    )
    .join('')
}

function renderRulesSection() {
  if (!elements.rulesSection) return

  const defaultUnbillable = formatCodeList(DEFAULT_UNBILLABLE_PROJECT_CODES)

  const content = `
    <div class="rules-body">
      <h4>Usage Guidelines:</h4>
      <ol class="rules-steps">
        <li>Export the LIBC calendar from Outlook. Select the desired date range.</li>
        <li>Import the downloaded ICS file into this page. See above.</li>
        <li>Review the Summary, Projects, Calendar and Event List tabs below. Double-check everything to confirm accuracy.</li>
        <li>Export the summary TSV from the Summary tab, or the event details TSV from the Event List tab.</li>
      </ol>
      <h4>Rules:</h4>
      <ul class="rules-list">
        <li><strong>Active event billing:</strong> Events not cancelled on time (active events) are considered billable. They are billed for the scheduled duration.</li>
        <li><strong>On-time cancellations:</strong> Cancellations made ${LATE_CANCELLATION_DAYS} full days before the scheduled start are not billed.</li>
        <li><strong>Late cancellations:</strong> When a reservation is freed less than ${LATE_CANCELLATION_DAYS} days ahead, it will be billed in full unless backfilled.</li>
        <li><strong>Cancelled date:</strong> The cancellation date is inferred as the last modification date of a cancelled event. As such, do not modify events after their cancellation.</li>
        <li><strong>Substitution:</strong> If a late cancellation is substituted by another billable event, the overlapping time is not billed.</li>
        <li><strong>Overlapping active events:</strong> If two active events overlap, they will both be charged for their complete duration.</li>
        <li><strong>Project codes:</strong> Event titles must include an alphanumeric tag such as <code>[ALPHA] John Doe</code>. Items without a compliant tag are grouped under UNKNOWN.</li>
        <li><strong>Default unbillable projects:</strong> Projects ${defaultUnbillable} set to unbillable by default.</li>
      </ul>
      <h4>Summary Metrics Explained:</h4>
      <ul class="rules-list">
        <li><strong>Total billable hours:</strong> Sum of billable minutes for billable projects (with late cancellation substitution overlaps waived).</li>
        <li><strong>Total duration (hours):</strong> Sum of full scheduled duration for all events in the project (active + cancelled).</li>
        <li><strong>Billable percentage:</strong> Billable minutes divided by total scheduled minutes for the project.</li>
        <li><strong>Active:</strong> Count of events that are not cancelled.</li>
        <li><strong>On-time cancels:</strong> Cancellations made at least ${LATE_CANCELLATION_DAYS} days before start; these contribute duration but no billable time.</li>
        <li><strong>On-time cancel percentage:</strong> On-time cancellation minutes divided by total scheduled minutes for the project.</li>
        <li><strong>Late cancels:</strong> Cancellations made under ${LATE_CANCELLATION_DAYS} days before start; billed after subtracting any overlapping billable replacements.</li>
        <li><strong>Late cancel percentage:</strong> Late cancellation minutes divided by total scheduled minutes for the project.</li>
        <li><strong>Billable toggle:</strong> Per-project override to include/exclude its billable minutes.</li>
        <li><strong>Totals rows in export:</strong> The Summary workbook includes a totals row; and a special second totals row which considers all projects except ${UNKNOWN_PROJECT_LABEL} billable.</li>
      </ul>
    </div>
  `

  elements.rulesSection.innerHTML = buildAccordion('Rules and Guidelines', content, false)
}

function buildAccordion(title: string, innerHtml: string, open = true): string {
  const openAttr = open ? ' open' : ''
  return `
    <details class="accordion"${openAttr}>
      <summary>${title}</summary>
      <div class="accordion-body">
        ${innerHtml}
      </div>
    </details>
  `
}

function renderProjectsSection() {
  const hasProjects = currentSummaries.length > 0
  elements.projectsEmpty.style.display = hasProjects ? 'none' : 'block'
  elements.projectsContainer.style.display = hasProjects ? 'flex' : 'none'

  if (!hasProjects) {
    elements.projectsContainer.innerHTML = ''
    return
  }

  const blocks = currentSummaries.map((summary) => {
    const projectCode = summary.projectCode
    const anchor = projectAnchorId(projectCode)
    const projectEvents = currentEvents.filter(
      (event) => (event.projectCode ?? UNKNOWN_PROJECT_LABEL) === projectCode,
    )
    const isBillableProject = isProjectBillable(projectCode)
    const billableHoursDisplay = (isBillableProject ? summary.totalHours : 0).toFixed(2)
    const totalDurationDisplay = summary.totalDurationHours.toFixed(2)
    const billableLabel = isBillableProject ? 'Billable' : 'Not billable'
    const billableFlagClass = isBillableProject ? 'is-billable' : 'is-unbillable'
    const eventRows = projectEvents
      .map((event) => {
        const eventBillableMinutes = isBillableProject ? event.billableMinutes : 0
        const organizerDisplay = formatOrganizerEmail(event.organizer)
        return `
        <tr data-event-id="${event.id}">
          <td>
            ${escapeHtml(event.summary)}
            <div class="event-organizer-note"><span>Organizer(s):</span><span>${escapeHtml(organizerDisplay)}</span></div>
          </td>
          <td>${formatDate(event.start)}</td>
          <td>${formatDate(event.end)}</td>
          <td>${formatCancellationDate(event)}</td>
          <td>${formatCreationDate(event)}</td>
          <td>${renderTag(event.classification)}</td>
          <td>${formatHours(event.durationMinutes)}</td>
          <td>${formatHours(eventBillableMinutes)}</td>
        </tr>
      `
      })
      .join('')

    const tableBody = eventRows || `<tr><td colspan="8">No individual events found for this project.</td></tr>`

    return `
      <section class="project-group" id="${anchor}">
        <div class="project-summary">
          <div>
            <h3>${projectCode}</h3>
            <p>${projectEvents.length} event${projectEvents.length === 1 ? '' : 's'}</p>
            <span class="project-billable-flag ${billableFlagClass}">${billableLabel}</span>
          </div>
          <dl>
            <div>
              <dt>Total billable hours</dt>
              <dd>${billableHoursDisplay} h</dd>
            </div>
            <div>
              <dt>Total duration</dt>
              <dd>${totalDurationDisplay} h</dd>
            </div>
            <div>
              <dt>Active</dt>
              <dd>${summary.activeCount}</dd>
            </div>
            <div>
              <dt>On-time cancels</dt>
              <dd>${summary.cancelledOnTimeCount}</dd>
            </div>
            <div>
              <dt>Late cancels</dt>
              <dd>${summary.cancelledLateCount}</dd>
            </div>
          </dl>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Start</th>
                <th>End</th>
                <th>Cancelled</th>
                <th>Created</th>
                <th>Status</th>
                <th>Duration (hours)</th>
                <th>Billable hours</th>
              </tr>
            </thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
      </section>
    `
  })

  elements.projectsContainer.innerHTML = blocks.join('')
  wireEventRowLinks(elements.projectsContainer)
}

function renderStats() {
  if (!currentStats) {
    elements.statsGrid.innerHTML = buildStatCards({
      eventCount: 0,
      projectCount: 0,
      billableHours: 0,
      lateCancellationCount: 0,
    }, null)
    return
  }

  elements.statsGrid.innerHTML = buildStatCards(currentStats, currentDateSpan)
}

function renderLegend() {
  if (!currentSummaries.length) {
    elements.legend.innerHTML = '<span>No projects detected yet.</span>'
    return
  }

  const chips = currentSummaries
    .map((summary) => {
      const color = colorForProject(summary.projectCode)
      return `<button type="button" class="legend-chip" data-project="${summary.projectCode}"><i style="background:${color}"></i>${summary.projectCode}</button>`
    })
    .join('')

  elements.legend.innerHTML = chips
  elements.legend.querySelectorAll<HTMLButtonElement>('button[data-project]').forEach((button) => {
    button.addEventListener('click', () => focusProject(button.dataset.project ?? UNKNOWN_PROJECT_LABEL))
  })
}

function toggleTables() {
  elements.eventsEmpty.style.display = 'block'
  elements.eventsTableWrap.style.display = 'none'
  elements.summaryEmpty.style.display = 'block'
  elements.summaryTableWrap.style.display = 'none'
}

function formatDate(value: Date): string {
  return dateTimeFormatter.format(value)
}

function formatCancellationDate(event: Occurrence): string {
  if (event.classification === 'ACTIVE') {
    return '—'
  }
  const cancellationDate = event.appointmentSequenceTime ?? event.lastModified ?? event.dtstamp
  if (!cancellationDate) {
    return '—'
  }
  return formatDate(cancellationDate)
}

function formatCreationDate(event: Occurrence): string {
  const createdDate = event.created ?? event.dtstamp
  if (!createdDate) {
    return '—'
  }
  return formatDate(createdDate)
}

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(2)} h`
}

function formatOrganizerEmail(value: string | null): string {
  return normalizeOrganizerEmail(value) ?? '—'
}

function formatNullableDate(value: Date | null | undefined): string {
  return value ? formatDate(value) : '—'
}

function nullableText(value: string | null | undefined): string {
  return value?.trim().length ? value : '—'
}

function formatOrganizerList(emails: string[]): string {
  return emails.length ? emails.join('; ') : '—'
}

function formatCodeList(codes: string[]): string {
  if (!codes.length) return '—'
  const quoted = codes.map((code) => `<code>${code}</code>`)
  if (quoted.length === 1) return quoted[0]
  if (quoted.length === 2) return `${quoted[0]} and ${quoted[1]}`
  const leading = quoted.slice(0, -1).join(', ')
  const last = quoted[quoted.length - 1]
  return `${leading} and ${last}`
}

function getEventProjectLabel(event: Occurrence): string {
  return event.projectCode ?? UNKNOWN_PROJECT_LABEL
}

function getBillableMinutesForEvent(event: Occurrence): number {
  const projectLabel = getEventProjectLabel(event)
  return isProjectBillable(projectLabel) ? event.billableMinutes : 0
}

function getEventsWithBillableOverrides(): Occurrence[] {
  return currentEvents.map((event) => {
    const adjustedMinutes = getBillableMinutesForEvent(event)
    if (adjustedMinutes === event.billableMinutes) {
      return event
    }
    return { ...event, billableMinutes: adjustedMinutes }
  })
}

function exportProjectsWorkbook(): void {
  if (!currentSummaries.length) return
  const sheets = buildProjectWorkbookSheets(currentEvents, currentSummaries, {
    formatDate,
    formatHours,
    formatCancellationDate,
    formatCreationDate,
    formatOrganizerEmail,
    formatOrganizerList,
    formatClassificationLabel,
    getEventProjectLabel,
    isProjectBillable,
  })
  downloadWorkbook(formatExportFilename('project-summary', 'xlsx'), sheets)
}

function lightenColor(hexColor: string, intensity = 0.4): string {
  const normalized = hexColor.trim()
  if (!normalized.startsWith('#') || (normalized.length !== 7 && normalized.length !== 4)) {
    return hexColor
  }

  const expand = (value: string) =>
    value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value

  const hex = expand(normalized).slice(1)
  const num = parseInt(hex, 16)
  if (Number.isNaN(num)) {
    return hexColor
  }

  const mixChannel = (channel: number) => {
    const value = (num >> channel) & 0xff
    const mixed = Math.min(255, Math.round(value + (255 - value) * intensity))
    const shiftedChannel = channel === 16 ? mixed << 16 : channel === 8 ? mixed << 8 : mixed
    return shiftedChannel
  }

  const r = mixChannel(16)
  const g = mixChannel(8)
  const b = mixChannel(0)
  const combined = (1 << 24) | r | g | b
  return `#${combined.toString(16).slice(1)}`
}

function renderTag(classification: Occurrence['classification']): string {
  const cls = classification.toLowerCase()
  const label = formatClassificationLabel(classification)
  return `<span class="tag ${cls}">${label}</span>`
}

function formatClassificationLabel(classification: Occurrence['classification']): string {
  const labelMap: Record<Occurrence['classification'], string> = {
    ACTIVE: 'Active',
    CANCELLED_ON_TIME: 'Cancelled · On time',
    CANCELLED_LATE: 'Cancelled · Late',
  }
  return labelMap[classification]
}

function setStatus(message: string, variant: 'error' | 'success' | 'info' = 'info', detail?: string) {
  elements.statusLine.classList.remove('error', 'success')
  if (variant === 'error') {
    elements.statusLine.classList.add('error')
  } else if (variant === 'success') {
    elements.statusLine.classList.add('success')
  }

  elements.statusLine.innerHTML = ''
  const messageSpan = document.createElement('span')
  messageSpan.textContent = message
  elements.statusLine.appendChild(messageSpan)

  if (variant === 'error' && detail) {
    const detailBox = document.createElement('details')
    detailBox.className = 'status-detail'
    const summary = document.createElement('summary')
    summary.textContent = 'Show error details'
    const pre = document.createElement('pre')
    pre.textContent = detail.trim()
    detailBox.append(summary, pre)
    elements.statusLine.appendChild(detailBox)
  }
}

function formatExportFilename(prefix: string, extension = 'xlsx'): string {
  const normalizedSource = currentSourceFileName?.trim().length ? currentSourceFileName.trim() : 'calendar.ics'
  const timestamp = new Date().toISOString().split('.')[0]
  return `${normalizedSource} ${prefix} ${timestamp}.${extension}`
}

function setupDropzone(zone: HTMLDivElement, onFile: (file: File) => Promise<void>) {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault()
    zone.classList.add('is-dragging')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'))
  zone.addEventListener('drop', async (event) => {
    event.preventDefault()
    zone.classList.remove('is-dragging')
    const file = event.dataTransfer?.files?.[0]
    if (file) {
      await onFile(file)
    }
  })
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      elements.fileInput.click()
    }
  })
}

function setupTabs() {
  tabButtons.forEach((tab) =>
    tab.addEventListener('click', () => {
      const target = tab.dataset.target as PanelId
      setActiveTab(target)
    }),
  )
}

function setActiveTab(panelId: PanelId) {
  const panels = Array.from(document.querySelectorAll<HTMLDivElement>('.tabpanel'))
  panels.forEach((panel) => {
    if (panel.id === panelId) {
      panel.classList.add('active')
      panel.removeAttribute('hidden')
    } else {
      panel.classList.remove('active')
      panel.setAttribute('hidden', 'true')
    }
  })

  tabButtons.forEach((button) => {
    const target = button.dataset.target as PanelId | undefined
    button.setAttribute('aria-selected', String(target === panelId))
  })

  if (panelId === 'panel-calendar') {
    refreshCalendarLayout()
  }
}

function buildStatCards(stats: DatasetStats, dateSpan: { start: Date; end: Date } | null): string {
  const items: Array<{ label: string; value: string }> = [
    { label: 'Total events', value: stats.eventCount.toString() },
    { label: 'Projects', value: stats.projectCount.toString() },
    { label: 'Date span', value: formatDateRangeDisplay(dateSpan) },
  ]

  return items
    .map(
      (item) => `
        <dl class="stat-card">
          <dt>${item.label}</dt>
          <dd>${item.value}</dd>
        </dl>
      `,
    )
    .join('')
}

function escapeHtml(value: string): string {
  const div = document.createElement('div')
  div.textContent = value
  return div.innerHTML
}

function focusProject(projectCode: string) {
  setActiveTab('panel-projects')
  const anchorId = projectAnchorId(projectCode)
  const section = document.getElementById(anchorId)
  if (!section) return
  requestAnimationFrame(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    section.classList.add('project-highlight')
    window.setTimeout(() => section.classList.remove('project-highlight'), 1500)
  })
}

function projectAnchorId(projectCode: string): string {
  return `project-${slugifyProject(projectCode)}`
}

function slugifyProject(projectCode: string): string {
  return (
    projectCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-') || 'project'
  )
}

function computeDateSpan(events: Occurrence[]): { start: Date; end: Date } | null {
  if (!events.length) return null
  let start = events[0].start
  let end = events[0].end
  events.forEach((event) => {
    if (event.start.getTime() < start.getTime()) start = event.start
    if (event.end.getTime() > end.getTime()) end = event.end
  })
  return { start, end }
}

function formatDateRangeDisplay(span: { start: Date; end: Date } | null): string {
  if (!span) return '—'
  try {
    const rangeFormatter = dateFormatter as Intl.DateTimeFormat & {
      formatRange?: (start: Date, end: Date) => string
    }
    if (typeof rangeFormatter.formatRange === 'function') {
      return rangeFormatter.formatRange(span.start, span.end)
    }
  } catch (error) {
    console.warn('Unable to format range', error)
  }
  return `${formatDateOnly(span.start)} - ${formatDateOnly(span.end)}`
}

function formatDateOnly(date: Date): string {
  return dateFormatter.format(date)
}

function positionCalendarAtFirstEvent() {
  if (!currentEvents.length) return
  calendar.gotoDate(currentEvents[0].start)
}

function refreshCalendarLayout() {
  requestAnimationFrame(() => {
    calendar.updateSize()
  })
}

async function readCalendarFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const { encoding, offset } = detectEncoding(bytes)
  const decoder = new TextDecoder(encoding)
  return decoder.decode(offset ? bytes.subarray(offset) : bytes)
}

function detectEncoding(bytes: Uint8Array): { encoding: 'utf-8' | 'utf-16le' | 'utf-16be'; offset: number } {
  if (bytes.length >= 2) {
    const first = bytes[0]
    const second = bytes[1]
    if (first === 0xff && second === 0xfe) {
      return { encoding: 'utf-16le', offset: 2 }
    }
    if (first === 0xfe && second === 0xff) {
      return { encoding: 'utf-16be', offset: 2 }
    }
  }

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: 'utf-8', offset: 3 }
  }

  const sampleLength = Math.min(bytes.length, 512)
  let evenZeroPairs = 0
  let oddZeroPairs = 0
  let pairs = 0
  for (let i = 0; i + 1 < sampleLength; i += 2) {
    pairs += 1
    if (bytes[i] === 0 && bytes[i + 1] !== 0) {
      evenZeroPairs += 1
    } else if (bytes[i] !== 0 && bytes[i + 1] === 0) {
      oddZeroPairs += 1
    }
  }

  if (pairs) {
    const evenRatio = evenZeroPairs / pairs
    const oddRatio = oddZeroPairs / pairs
    if (evenRatio > 0.6 && oddRatio < 0.2) {
      return { encoding: 'utf-16be', offset: 0 }
    }
    if (oddRatio > 0.6 && evenRatio < 0.2) {
      return { encoding: 'utf-16le', offset: 0 }
    }
  }

  return { encoding: 'utf-8', offset: 0 }
}

function sanitizeIcs(input: string): string {
  return input.replace(/\u0000/g, '')
}

function isIcsFile(file: File): boolean {
  const name = file.name.toLowerCase()
  if (name.endsWith('.ics')) return true
  const type = (file.type || '').toLowerCase()
  return type.includes('text/calendar') || type.includes('application/ics')
}

function formatErrorDetail(error: unknown): string {
  if (!error) return 'Unknown error.'
  if (error instanceof Error) {
    return error.stack ?? error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch (jsonError) {
    return String(error ?? jsonError)
  }
}

function wireBillableToggles() {
  const inputs = elements.summaryTableBody.querySelectorAll<HTMLInputElement>('input[data-project]')
  inputs.forEach((input) => {
    input.addEventListener('change', () => {
      const project = input.dataset.project
      if (!project) return
      handleBillableToggle(project, input.checked)
    })
  })
}

function wireSummaryRowLinks() {
  const rows = elements.summaryTableBody.querySelectorAll<HTMLTableRowElement>('tr[data-project-code]')
  rows.forEach((row) => {
    row.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      if (target.closest('input, label')) {
        return
      }
      const projectCode = row.dataset.projectCode
      if (projectCode) {
        focusProject(projectCode)
      }
    })
  })
}

function wireEventRowLinks(container: Element | DocumentFragment) {
  container.querySelectorAll<HTMLTableRowElement>('tr[data-event-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const eventId = row.dataset.eventId
      if (eventId) {
        jumpToEventOnCalendar(eventId)
      }
    })
  })
}

function jumpToEventOnCalendar(eventId: string) {
  const targetEvent = currentEvents.find((event) => event.id === eventId)
  if (!targetEvent) return
  setActiveTab('panel-calendar')
  calendar.changeView('timeGridDay', targetEvent.start)
}

function focusEventInProjects(eventId: string, projectCode: string | null) {
  if (!eventId) return
  const targetProject = projectCode ?? UNKNOWN_PROJECT_LABEL
  focusProject(targetProject)
  setActiveTab('panel-projects')
  requestAnimationFrame(() => {
    const selector = `tr[data-event-id="${eventId}"]`
    const targetRow = elements.projectsContainer.querySelector<HTMLTableRowElement>(selector)
    if (!targetRow) return
    targetRow.classList.add('event-highlight')
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => targetRow.classList.remove('event-highlight'), 1800)
  })
}

function handleBillableToggle(projectCode: string, checked: boolean) {
  billableProjects.set(projectCode, checked)
  refreshBillableDependentViews()
}

function refreshBillableDependentViews() {
  renderSummaryTable()
  renderSummaryHighlights()
  renderProjectsSection()
  renderEventsTable()
}

function syncBillableProjects(summaries: ProjectSummary[]) {
  const previous = new Map(billableProjects)
  billableProjects.clear()
  summaries.forEach((summary) => {
    const code = summary.projectCode
    const existing = previous.has(code) ? previous.get(code)! : getDefaultBillableState(code)
    billableProjects.set(code, existing)
  })
}

function getBillableSummaries(): ProjectSummary[] {
  return currentSummaries.filter((summary) => isProjectBillable(summary.projectCode))
}

function isProjectBillable(projectCode: string): boolean {
  if (billableProjects.has(projectCode)) {
    return billableProjects.get(projectCode) as boolean
  }
  return getDefaultBillableState(projectCode)
}

function getDefaultBillableState(projectCode: string): boolean {
  const normalized = normalizeProjectCode(projectCode)
  return !DEFAULT_UNBILLABLE_PROJECT_CODES.some((code) => code.toUpperCase() === normalized)
}

function normalizeProjectCode(projectCode: string): string {
  return projectCode.trim().toUpperCase()
}

