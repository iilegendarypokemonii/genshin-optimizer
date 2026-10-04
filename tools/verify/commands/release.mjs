import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { runProcess } from '../lib/proc.mjs'

const stages = {
  tag: [
    [
      'release-version',
      'node',
      ['tools/scripts/generate-update-json.mjs', '$TAG', '--validate-only'],
      120000,
    ],
  ],
  pre: [
    [
      'frontend-types',
      'node',
      [
        'node_modules/typescript/bin/tsc',
        '--noEmit',
        '-p',
        'apps/frontend/tsconfig.app.json',
      ],
      600000,
    ],
    [
      'updater-storage-tests',
      'node',
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        '--config',
        'apps/frontend/vite.config.mts',
        'src/app/DesktopUpdates.spec.tsx',
        'src/desktopWriteBarrier.spec.ts',
        'src/persistentStorage.spec.ts',
        'src/app/WishTracker/storage.spec.ts',
        '--maxWorkers=1',
        '--minWorkers=1',
      ],
      600000,
    ],
    [
      'game-data-tests',
      'node',
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        '--config',
        'apps/frontend/vite.config.mts',
        'src/app/Irminsul/importSnapshot.spec.ts',
        'src/app/Irminsul/settings.spec.ts',
        'src/app/Irminsul/batchImport.spec.ts',
        '--maxWorkers=1',
        '--minWorkers=1',
      ],
      600000,
    ],
    [
      'release-packaging-tests',
      'node',
      ['--test', 'tools/scripts/generate-update-json.test.mjs'],
      120000,
    ],
    [
      'native-tests',
      'cargo',
      ['test', '--locked', '--manifest-path', 'src-tauri/Cargo.toml', '--lib'],
      900000,
    ],
    ['verify-cli-tests', 'node', ['--test', 'tools/verify/*.test.mjs'], 120000],
  ],
  post: [
    ['web-smoke', 'node', ['tools/scripts/desktop-web-smoke.mjs'], 300000],
    [
      'desktop-app',
      'node',
      [
        'tools/verify/cli.mjs',
        'app',
        'smoke',
        'good-upload',
        'irminsul-import',
        'irminsul-error',
      ],
      300000,
    ],
  ],
}

async function tagValue(root, options) {
  const supplied =
    options.tag ??
    process.env.DESKTOP_RELEASE_TAG ??
    process.env.GITHUB_REF_NAME
  if (supplied) return supplied
  try {
    const config = JSON.parse(
      await readFile(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8')
    )
    return `desktop-v${config.version}`
  } catch {
    return ''
  }
}

export async function run({ root, options, evidence }) {
  const requested = (options.stage ?? 'tag,pre,post').split(',')
  let exitCode = 0
  for (const stage of requested) {
    const tag = await tagValue(root, options)
    for (const [id, command, rawArgs, timeoutMs] of stages[stage]) {
      const args = rawArgs.map((arg) => (arg === '$TAG' ? tag : arg))
      await evidence
        .check(`${stage}-${id}`, async () => {
          const outputDir = join(evidence.dir, 'smoke')
          const result = await runProcess(command, args, {
            cwd: root,
            timeoutMs,
            env: { ...process.env, VERIFY_EVIDENCE_DIR: outputDir },
            logPath: join(evidence.dir, 'logs', `${stage}-${id}.log`),
          })
          if (result.timedOut)
            throw Object.assign(
              new Error(`${id} timed out after ${timeoutMs}ms`),
              { exitCode: 2 }
            )
          if (result.code !== 0)
            throw Object.assign(new Error(`${id} exited with ${result.code}`), {
              exitCode: id === 'desktop-app' ? result.code : 1,
            })
          return { message: id, data: { durationMs: result.durationMs } }
        })
        .catch((error) => {
          exitCode = Math.max(exitCode, error.exitCode ?? (error.code ? 2 : 1))
        })
      if (stage === 'tag' && exitCode) return exitCode
    }
  }
  return exitCode
}
