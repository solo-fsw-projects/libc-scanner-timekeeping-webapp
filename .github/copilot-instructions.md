# Copilot Instructions — libc-scanner-timekeeping/webApp

## Purpose
The purpose of the webapp is to allow administrators of a MRI scanner to tabulate who used the
scanner and when, so that they can be charged accordingly. The app must take in an ICS calendar file
exported from the scanner's scheduling software, parse it, and display the relevant information in a
user-friendly manner. Parsing includes grouping entries by project (specified by a a project code
in the event title) and calculating total usage time per project. Late cancellations should charged;
on-time cancellations, should not.

Late cancellations are defined as cancellations made less than 7 days before the scheduled event.

## Requirements

Calendar File Input:
- The webapp must accept an ICS calendar file upload from the user (an Outlook export).
- Projects are identified by a project code in the event title, formatted as: `[CODE] Description`.
- The `CODE` is an alphanumeric string that uniquely identifies each project, and can be passed using
  the regex pattern: `\[([0-9a-zA-Z]*?)\]`.
- The app must handle recurring events correctly, ensuring that each occurrence is treated as a separate entry.
- Each event must be checked for cancellation status, which is determined by the presence of a cancellation indicator
  in the event data. All possible indicators should be considered, see cancelled words below.
- Each event must be classified into: ACTIVE, CANCELLED_ON_TIME and CANCELLED_LATE using the rules specified above.

## Cancellation Detection: 
It is suggested to use the following list of cancellation words to identify cancelled events:
` cancel_words = [
    "canceled", "cancelled", "geannuleerd", "abgesagt", "annulé", "cancelado",
    "annullato", "avbokad", "peruttu", "avlyst", "aflyst",  "已取消"  
]`
As different programs may use different words to indicate cancellations, the app should be designed to allow easy addition of more cancellation words in the future. Additionally, the app should be case-insensitive when checking for these words, and should work if the words may appear in different parts of the event title.

Processing Logic:
- The project must group events using the extracted project codes. Events that do not contain a valid project code
  should be grouped under "UNKNOWN".
- The app must calculate the total usage time per project, excluding events that were cancelled on time.
- The app must determine whether a cancellation is late or on-time based on the event's start date,
and the modification date (the date the event was last updated). If the modification date is less than 7 days
before the start date, it is considered a late cancellation.

User Interface:
- The webapp should provide a clean and intuitive interface for uploading the ICS file.
- The webapp show a list of all detected project-codes and a calendar view of the uploaded events, color-coded by project.
- The webapp should also show a list of all events with their details (title, start time, end time, cancellation status and project-code).
- The webapp should also summarize the events, per project, showing:
  - Project Code
  - Total Usage Time (in hours)
  - Total Usage Time (in minutes)
  - Number of Active Events
  - Number of On-Time Cancellations
  - Number of Late Cancellations
- The webapp should provide an option to download the summarized data as a TSV file.
- The webapp should be as simple as possible, avoiding unnecessary features or complexity.
- The webapp should be clean, using tabs for the different views (Calendar, Event List, Summary).
- The webapp is to be used on a desktop by a mere handful of users, so mobile responsiveness is not a priority. Simplicity and clarity are.

Hosting and Deployment:
- The webapp should be hosted on GitHub Pages.
- The deployment process should be automated using GitHub Actions.
- The logic for parsing and processing the ICS file should be implemented in JavaScript (or TypeScript).
- The webapp should not require a backend server; all processing should be done client-side. All processing must respect user privacy, so no data should be sent to any server.
- The webapp should use only open-source libraries for ICS parsing and UI components.
- Write a README.md file that includes instructions for setting up the development environment, building the project, and deploying the webapp to GitHub Pages.


