ABK Credit Management Online

This is the full-feature static web app for GitHub Pages.

Privacy:
- Your credit report is processed locally in this browser.
- The app does not upload your report to a server.
- Do not upload credit reports anywhere except by selecting them inside the app after the site is open in your browser.
- Saved disputes, tracker records, letters, and backups are stored in browser localStorage on your device.

Files required at the top of the GitHub repository:
- index.html
- libs/pdf.min.js
- libs/pdf.worker.min.js
- manifest.json
- sw.js
- icons/icon.svg

GitHub Pages setup:
1. Go to https://github.com and sign in.
2. Create a new public repository named abk-credit-management.
3. Upload every file and folder from ABK Credit Management Online into the repository.
4. Commit the upload to the main branch.
5. Open repository Settings.
6. Open Pages.
7. Under Build and deployment, choose Deploy from a branch.
8. Choose branch main and folder /root.
9. Save.
10. Open the GitHub Pages https:// link after GitHub finishes publishing.

Expected live link:
https://YOUR-GITHUB-USERNAME.github.io/abk-credit-management/

PDF upload:
- Test PDF upload only from the GitHub Pages https:// link.
- If the address starts with file://, you are still opening the local version and PDF upload may fail.
- If the Worker path starts with file:///Users/..., you are opening a local file, not the hosted GitHub Pages site.
- Do not test PDF upload by double-clicking index.html in Finder.

Update later:
1. Open the current live app.
2. Click Export Backup and save the JSON backup somewhere safe.
3. Upload the updated ABK Credit Management Online files to the same GitHub repository.
4. Commit the changes.
5. Reopen the GitHub Pages https:// link after GitHub finishes publishing.
6. If needed, use Import Backup and choose your saved JSON backup.

Important:
- Keep pdf.min.js and pdf.worker.min.js inside the libs folder.
- Keep index.html at the top level of the repository.
- PDF analysis is designed for the hosted https:// version.
- The offline backup file is ABK Credit Management Offline.html.
