# Game data tool

The Windows desktop app embeds the reusable capture core from the standalone
[Irminsul multi-account fork](https://github.com/iilegendarypokemonii/irminsul).
Open it from **Home -> Game data -> Open Game data** or **Tools -> Game data**.
Capture requires **Windows 11 24H2 or newer**. Other optimizer features retain
their existing Windows requirements.

**Account data:** start capture, allow Windows capture permission, then enter an
account through the game door. Keep capture running while switching through the
title menu. Completed snapshots are listed by their captured UID and timestamp.
Choose artifacts, characters, weapons, materials, or a combination, then export
GOOD JSON. Snapshots reflect inventory
at login; capture again after inventory changes.

**Wishes:** use the separate Wishes tab for the existing Wish Tracker, with its
wish-cache authkey check and per-UID wish history. The wish key is not used to
identify the account whose inventory is being captured.

Optimizer imports support artifacts, characters, and weapons. The captured UID
must match exactly one optimizer database's UID in Settings. Preview the changes,
then confirm the destination. Existing items absent from the scan are preserved;
the preceding account export is saved as `irminsul_backup_<UID>` in local storage
before the import is applied. Materials are available in the exported file.
Use **Download previous account backup** to save that GOOD file; it can be
restored with the optimizer's normal account import in Settings. Failed saves
restore the previous account storage before reporting an error.

**Import settings** opens the category selection and minimum filters for characters
(level, ascension, constellation), artifacts (level, rarity), and weapons
(level, refinement, ascension, rarity). Preferences persist across restarts and
apply to single imports, batch imports, and exports. Equipment keeps its assignment
when the character is already in the destination or included in the import. Otherwise
it is imported unequipped, with a preview warning, so excluded characters are not
recreated. Captures and exports keep the original assignments. New imported characters
receive optimizer defaults for any omitted equipment. Captured snapshots retain
the complete original data. The optional fake fourth-stat level-up defaults off;
this optimizer supports unactivated stats. Enabling it simulates eligible
5-star artifacts below level 4 at level 4, after filtering by their actual level.

**Import multiple accounts:** start capture before playing, log into each account,
then select the accounts to review together. The review shows each destination,
login timestamp, filtered counts, and compatibility omissions. Every selected
UID must have one unique optimizer destination before any import can start.
Each account has its own backup. If a save fails, the failed account is restored
and remaining imports stop; completed imports remain saved. If recovery itself
fails, the error instructs you to download the previous backup.
Loot and upgrades after login are not included; log in again to refresh them.

The **Account data / Wishes** tabs are shared by the home card and both tool
shortcuts. Older Irminsul and Wish Tracker URLs redirect to this Game data page.

The import preview lists data this optimizer does not support: 1- and 2-star
artifacts and the Miliastra Wonderland avatars Manekin and Manekina. Those
records stay in the capture and selected GOOD export. Supported equipment on
those avatars is imported as unequipped, with its original assignment preserved
in the export. Other invalid or unknown character records still block the
selected import and identify the affected field; deselect that category to
import the others.

Materials without bundled names produce a warning. Their item IDs and quantities
are retained in the selected export's `irminsul.unmappedMaterials` metadata.

Capture remains native and local. The elevated child captures only Genshin's UDP
ports; the ordinary app decodes and reviews data without administrator privileges.
Private capture sessions leave global Packet Monitor filters and captures alone.
Capture stops automatically after four hours; start it again for another login.
Completed snapshots stay available while the app remains open.
An update stops capture before installing. The browser route explains how to use
the standalone Windows application.

The core is version-pinned with the desktop build so a fork update must pass
the replay and import tests before it changes optimizer behavior. Raw capture
fixtures and personal inventories are excluded from both repositories.
