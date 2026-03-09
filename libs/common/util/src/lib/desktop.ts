export function isTauri() {
  return (
    typeof window !== 'undefined' &&
    typeof (window as typeof window & { __TAURI_INTERNALS__?: unknown })
      .__TAURI_INTERNALS__ !== 'undefined'
  )
}

export async function openTextFileWithDialog() {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const selected = await open({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false,
    })
    if (!selected || Array.isArray(selected)) return
    return {
      content: await readTextFile(selected),
      name: selected.split(/[\\/]/).pop() ?? selected,
    }
  }

  return new Promise<{ content: string; name: string } | undefined>(
    (resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) {
          resolve(undefined)
          return
        }
        const reader = new FileReader()
        reader.onload = () =>
          resolve({
            content: reader.result as string,
            name: file.name,
          })
        reader.onerror = () => resolve(undefined)
        reader.readAsText(file)
      }
      input.click()
    }
  )
}

export async function saveTextFileWithDialog(
  defaultPath: string,
  content: string
) {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const selected = await save({
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!selected) return false
    await writeTextFile(selected, content)
    return true
  }

  const contentType = 'application/json;charset=utf-8'
  const a = document.createElement('a')
  a.download = defaultPath
  a.href = `data:${contentType},${encodeURIComponent(content)}`
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  return true
}
