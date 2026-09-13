# Irminsul tool

The Windows desktop app embeds the reusable capture core from the standalone
[Irminsul multi-account fork](https://github.com/iilegendarypokemonii/irminsul).
Open it from **Home -> Game data -> Open Irminsul** or **Tools -> Irminsul**.
Capture requires **Windows 11 24H2 or newer**. Other optimizer features retain
their existing Windows requirements.

**Account data:** start capture, allow Windows capture permission, then enter an
account through the game door. Keep capture running while switching through the
title menu. Completed snapshots are listed by their captured UID and timestamp.
Choose artifacts, characters, weapons, materials, or a combination, then export
GOOD JSON. Materials can also be viewed in the tool. Snapshots reflect inventory
at login; capture again after inventory changes.

**Wishes:** use the separate Wishes tab for the existing Wish Tracker, with its
wish-cache authkey check and per-UID wish history. The wish key is not used to
identify the account whose inventory is being captured.

Optimizer imports support artifacts, characters, and weapons. The captured UID
must match exactly one optimizer database's UID in Settings. Preview the changes,
then confirm the destination. Existing items absent from the scan are preserved;
the preceding account export is saved as `irminsul_backup_<UID>` in local storage
before the import is applied. Materials remain available through export and the
tool's viewer rather than being silently treated as optimizer records.
Use **Download previous account backup** to save that GOOD file; it can be
restored with the optimizer's normal account import in Settings. Failed saves
restore the previous account storage before reporting an error.

Materials without bundled names produce a warning. Their item IDs and quantities
are retained in the selected export's `irminsul.unmappedMaterials` metadata.

Capture remains native and local. The elevated child captures only Genshin's UDP
ports; the ordinary app decodes and reviews data without administrator privileges.
Private capture sessions leave global Packet Monitor filters and captures alone.
Capture stops automatically after 20 minutes; start it again for another login.
An update stops capture before installing. The browser route explains how to use
the standalone Windows application.

The core is version-pinned with the desktop build so a fork update must pass
the replay and import tests before it changes optimizer behavior. Raw capture
fixtures and personal inventories are excluded from both repositories.
