import { isTauri } from './db'

// Returns the Update object if a newer published release is available, else null.
export async function checkForUpdate() {
  if (!isTauri()) return null
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    return await check()
  } catch {
    return null
  }
}

export async function installUpdate(update, onProgress) {
  await update.downloadAndInstall((event) => {
    if (onProgress) onProgress(event)
  })
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
