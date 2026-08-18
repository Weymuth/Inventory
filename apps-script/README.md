# Robotics Inventory Apps Script backend

This folder is the authenticated write-back backend for the GitHub Pages inventory site.

## What it does

- Reads the signed-in Google Workspace user.
- Looks that email up in the `USERS` sheet.
- Allows `TEACHER` and `ADMIN` users to move inventory between states.
- Uses `LockService.getScriptLock()` around balance-changing operations.
- Appends every change to `TRANSACTIONS` as a `TRANSFER`.
- Sends updated live balances back to the GitHub Pages window with `postMessage`.

## First deployment

1. Create a standalone Google Apps Script project while signed in with the Mercersburg account that owns/controls the inventory Sheet.
2. Add `Code.gs`, `Inventory.gs`, and `Users.gs` from this folder.
3. Show the manifest file in Apps Script Project Settings and replace it with `appsscript.json` from this folder.
4. Deploy as a **Web app**.
5. Run the web app as the deploying user and restrict access to the Mercersburg Google Workspace domain.
6. Authorize the requested Sheets and user-email scopes.
7. Copy the production `/exec` deployment URL.
8. Put that URL into the `BACKEND_URL` constant in the GitHub Pages `index.html`.

## Test

Open the deployment URL with `?action=status` while signed in as a user listed in the `USERS` sheet. The page should identify the user and role.

The first supported migration actions are:

- `UNCLASSIFIED` -> `STORAGE`
- `UNCLASSIFIED` -> `AVAILABLE`
- `STORAGE` -> `AVAILABLE`

These first actions classify state only. Physical room/cabinet/drawer/bin assignment is intentionally the next layer because `LOCATIONS` is still empty.
