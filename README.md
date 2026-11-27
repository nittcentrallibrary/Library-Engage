# Library Engage - Central Library, NIT Tiruchirappalli

## What's new in version 2 (November 2026)
Changes made in response to peer-review comments on privacy, data integrity and evaluation:

- **Privacy notice and consent.** The registration form explains what is collected, why, where it is stored,
  who can see it, how long it is kept and whom to contact for correction or deletion. Participants must tick
  a consent box before they play. The consent time is recorded.
- **Leaderboard privacy.** The public leaderboard shows a shortened name (first name and initial) and any
  participant can choose to appear as "Anonymous participant". With the Google Sheet connected, full names
  are no longer sent to the public page at all.
- **Cleaner data.** Roll numbers are checked against a pattern (letters and digits, 4-15 characters),
  names must contain letters, and departments are chosen from a list (with an "Other" option).
- **Review flags.** The admin table flags attempts that need checking: finished implausibly fast, roll number
  in the wrong format, or one roll number used with different names. Flagged records can be hidden from
  the counts with one click.
- **Anonymised admin view.** "Anonymise names" replaces names and roll numbers with participant IDs
  (P-001, P-002 ...) in the table, the summary and both CSV downloads - suitable for screenshots in reports.
- **Evaluation instruments (all optional for participants).**
  - Knowledge check: 8 questions offered before the first challenge and again after the certificate,
    giving paired pre/post scores.
  - System Usability Scale (10 standard statements, scored 0-100), offered after two challenges.
  - Quick feedback after each challenge (three 1-5 ratings and an optional comment).
  The admin dashboard summarises reach, completion rate, performance by challenge, pre/post gain,
  SUS score and feedback ratings, and "Download evaluation CSV" exports the responses.
- **Participant controls.** "Not you? Start as a new participant" on the form and "Forget me on this device"
  in the journey panel. Optional kiosk mode (`kioskIdleMinutes`) forgets the participant after inactivity.
- **No plain-text password in the page.** In local mode the admin password is stored only as a SHA-256 hash,
  with a lock-out after five wrong attempts. Use Admin > "Change the local admin password" to make a new hash.

### Upgrading the live site (already connected to the Google Sheet)
1. Open the Google Sheet (nittcentrallibrary@gmail.com) > Extensions > Apps Script. Replace all the code with the new
   `SETUP-GOOGLE-SHEET.gs`, Save, then **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy**.
   The Web app URL stays the same. Existing rows are kept; the script adds two columns and an "Evaluation" tab itself.
2. In the new `index.html`, paste your existing Web app URL into `sheetEndpoint: ''` (it is blank in this copy).
3. Check the settings near the top of the `<script>` section: `departments`, `rollPattern`,
   `privacy.retention`, `privacy.contact`, `leaderboardNames`, `kioskIdleMinutes`.
4. Upload `index.html` to the GitHub repository as before.

---

## Files in this zip
- `index.html` - the whole site (logo, styles and scripts are inside; nothing else to upload)
- `SETUP-GOOGLE-SHEET.gs` - the central database + admin-only access (paste into Google Apps Script)
- `LibraryEngage-Database-Template.xlsx` - a preview of the database layout, importable into Google Sheets

## IMPORTANT: why the Admin page may look empty or out of date
A site hosted on GitHub Pages (or any college web folder) has no server of its own.
Until you complete Part 2 below, every visitor's results are saved only inside
THAT visitor's own browser, so the Admin page can only show records made in the
browser you are logged in from. The admin dashboard shows a red notice saying so.
To collect everyone's results in one place you MUST connect the Google Sheet (Part 2).

---

## Part 1 - Put the site on GitHub Pages

1. **Create a GitHub account** (skip if you have one) at github.com.
2. **Create a new repository.** Click the `+` top-right > *New repository*.
   Name it anything, e.g. `library-engage`. Keep it **Public**. Do not add a README. Click *Create repository*.
3. **Upload the file.** On the new repository's page, click *uploading an existing file*,
   drag in `index.html` from this zip, and click *Commit changes*.
   (You can upload `LibraryEngage-Database-Template.xlsx` and the `.gs` file too, so everything
   lives in one place, but only `index.html` needs to be there for the site to work.)
4. **Turn on Pages.** Repository > *Settings* tab > *Pages* (left sidebar) > under *Build and
   deployment*, set Source to **Deploy from a branch** > Branch: **main**, folder **/(root)** > *Save*.
5. **Wait about a minute**, then reload the Pages settings page. A green box shows your live
   link: `https://<your-username>.github.io/<repository-name>/`. That is the link to share.
6. **Test it** by opening the link, playing one game, and confirming the certificate opens.

To update the site later (new games, colours, a pasted Sheet URL): edit `index.html` on your
computer, go back to the repository, click on `index.html` > the pencil (Edit) icon, paste the
new content, and *Commit changes*. The live link updates within a minute, no re-upload needed.

## Part 2 - Connect the central database (do this before sharing the link widely)

This makes every visitor's attempt land in one place, viewable only by the Admin.

1. Go to **sheets.google.com** and create a **blank spreadsheet**. Keep it private (do not
   share it). Optionally, rename it "Library Engage Database".
2. *(Optional preview)* File > Import > Upload > choose `LibraryEngage-Database-Template.xlsx`
   from this zip > Import location: **Insert new sheet(s)**. This shows you the exact column
   layout and a live Dashboard tab. You can skip this step - the Apps Script below creates the
   same "Participation" tab automatically the first time someone plays.
3. In the Sheet, open **Extensions > Apps Script**. Delete the sample code in the editor and
   paste in the entire contents of `SETUP-GOOGLE-SHEET.gs`. Save (Ctrl/Cmd+S).
4. Click the gear icon **Project Settings** (left sidebar) > scroll to **Script properties** >
   *Add script property* > Property: `ADMIN_KEY`, Value: a strong password you choose. Save.
5. Click **Deploy > New deployment**. Click the gear next to "Select type" > **Web app**.
   Set *Execute as*: **Me**, *Who has access*: **Anyone**. Click **Deploy**.
6. Google will ask you to authorise the script (it's yours, so this is safe) - click through
   the "Google hasn't verified this app" warning via *Advanced > Go to (project name)*.
7. Copy the **Web app URL** shown (it ends with `/exec`).
8. Back in `index.html`, find this line near the top of the `<script>` section:
   ```
   sheetEndpoint: '',
   ```
   and paste your URL between the quotes:
   ```
   sheetEndpoint: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
9. Save the file, then update it on GitHub (Part 1's "update the site later" steps).
10. **Test it**: play one game on the live link, then open the Sheet - a new row should appear
    on the "Participation" tab within a few seconds. Then open Admin Login on the site and log
    in with your `ADMIN_KEY` to confirm the record shows there too.

Whenever you edit the script later, use **Deploy > Manage deployments > Edit (pencil) >
Version: New version > Deploy** - the same URL keeps working, so you don't touch `index.html` again.

### How data is protected and recorded (once Part 2 is done)
- Participants see a privacy notice and must agree before playing; the consent time is stored.
- Every attempt and evaluation response is saved on the student's device, queued, and sent to the Sheet.
  If the network drops, it stays queued and is re-sent automatically (on reload, when back online, and every 30 s).
  The Sheet ignores duplicates, so nothing is lost or double counted.
- The server cleans every field (control characters removed, lengths limited, numbers range-checked, incomplete
  records rejected) and stores text as plain text so nothing typed can act as a spreadsheet formula.
- The public page can read only the leaderboard: shortened name or "Anonymous participant", department,
  challenge and score. Full names and roll numbers are never sent to the public.
- The full records, evaluation data and the CSV downloads are available only after the Admin logs in.
  The password is checked by the server, not by the web page. 10 wrong attempts pause admin login for 10 minutes.
- The Google Sheet itself is also viewable/downloadable by you (as its owner) at any time. Do not share the Sheet publicly.

### Honest limits
- Scores are calculated in the student's browser and there is no institute login, so a technically determined
  person could send a fake record. This is fine for an engagement activity, not for graded exams. The review
  flags help staff spot such rows; integrating the institute's single sign-on would close the gap.
- Anyone who knows the Web app URL can submit records; they cannot read private data without `ADMIN_KEY`.

## Embedding in the college website
- Best: link to it or open it in its own page. If you use an `<iframe>`, allow popups
  (the certificate opens in a new tab) and keep the page on `https`.
- The certificate QR code loads from cdnjs.cloudflare.com, so it needs internet.

## Certificates
Students/faculty: all five student challenges. Research scholars: the Research Resource Challenge.
Certificate uses the NITT logo and the navy/gold template; set `certificateWatermark: false` in
`CONFIG` to remove the faint logo watermark.

## Customising
Colours (`:root` in the CSS), games (`GAMES` array, see "GAME 07 GOES HERE"), facts (`FACTS` array),
knowledge-check questions (`KNOWLEDGE_CHECK` array), departments and privacy text (`CONFIG`).
