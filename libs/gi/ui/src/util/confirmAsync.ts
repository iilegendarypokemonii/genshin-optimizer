/**
 * window.confirm does not block in the Tauri webview — the dialog renders,
 * but the call returns immediately, so confirmed actions would run before
 * the user answers. Use the native async dialog there; plain confirm
 * elsewhere.
 */
export async function confirmAsync(message: string): Promise<boolean> {
  if ('__TAURI_INTERNALS__' in window) {
    const { confirm } = await import('@tauri-apps/plugin-dialog')
    return await confirm(message)
  }
  return window.confirm(message)
}
