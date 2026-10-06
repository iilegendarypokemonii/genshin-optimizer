#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEvidence } from './lib/evidence.mjs'

export const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const usage = `Usage:
  yarn verify app [scenario...] [--exe PATH] [--build] [--profile NAME] [--keep-profile] [--no-trace] [--recover]
  yarn verify release [--stage tag,pre,post] [--tag desktop-vX.Y.Z] [--skip CHECK,...]
  yarn verify installed [--runtime] [--baseline REPORT]
  yarn verify patch [--offline]

Exit codes: 0 pass, 1 product/check failure, 2 environment error, 3 patch attention, 64 invalid usage.`
const commands = new Set(['app', 'release', 'installed', 'patch'])
const boolOptions = new Set([
  'build',
  'keep-profile',
  'no-trace',
  'runtime',
  'offline',
  'recover',
])
const valueOptions = new Set([
  'exe',
  'profile',
  'stage',
  'tag',
  'baseline',
  'skip',
])

export function parseArgs(argv) {
  const [command, ...rest] = argv
  if (!commands.has(command)) throw usageError('Unknown command.')
  const options = {}
  const args = []
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith('--')) {
      args.push(token)
      continue
    }
    const name = token.slice(2)
    if (boolOptions.has(name)) {
      if (name in options) throw usageError(`Duplicate option --${name}.`)
      options[name] = true
      continue
    }
    if (
      !valueOptions.has(name) ||
      name in options ||
      index + 1 >= rest.length ||
      rest[index + 1].startsWith('--')
    ) {
      throw usageError(`Invalid option ${token}.`)
    }
    options[name] = rest[++index]
  }
  validateOptions(command, options, args)
  return { command, options, args }
}

function usageError(message) {
  return Object.assign(new Error(`${message}\n${usage}`), { exitCode: 64 })
}

function validateOptions(command, options, args) {
  const allowed = {
    app: new Set([
      'exe',
      'build',
      'profile',
      'keep-profile',
      'no-trace',
      'recover',
    ]),
    release: new Set(['stage', 'tag', 'skip']),
    installed: new Set(['runtime', 'baseline']),
    patch: new Set(['offline']),
  }[command]
  if ([...Object.keys(options)].some((name) => !allowed.has(name)))
    throw usageError(`Option is not valid for ${command}.`)
  validateProfileOptions(options)
  validateStages(options.stage)
  if (command !== 'app' && args.length)
    throw usageError('Positional scenarios are valid only for app.')
}

function validateProfileOptions(options) {
  if (options.recover && !options.profile)
    throw usageError('--recover requires an explicit --profile.')
  if (options.profile && !/^[a-z0-9][a-z0-9-]{0,31}$/.test(options.profile))
    throw usageError(
      'Invalid profile name; use 1-32 lowercase letters, digits or hyphens, starting with a letter or digit.'
    )
}

function validateStages(stages) {
  if (!stages) return
  const selected = stages.split(',')
  if (!selected.every((stage) => ['tag', 'pre', 'post'].includes(stage)))
    throw usageError('Invalid release stage.')
  if (new Set(selected).size !== selected.length)
    throw usageError('Duplicate release stage.')
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.some((arg) => ['-h', '--help'].includes(arg))) {
    console.log(usage)
    return 0
  }
  let parsed
  try {
    parsed = parseArgs(argv)
  } catch (error) {
    console.error(error.message)
    return error.exitCode ?? 64
  }
  const evidence = await createEvidence(root, parsed.command)
  let exitCode = 2
  try {
    const module = await import(`./commands/${parsed.command}.mjs`)
    exitCode = await module.run({
      root,
      options: parsed.options,
      args: parsed.args,
      evidence,
    })
  } catch (error) {
    console.error(error.stack ?? error)
    exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 2
    await evidence.write('logs/cli-error.txt', error.stack ?? String(error))
  } finally {
    await evidence.finish(exitCode)
  }
  return exitCode
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = await main()
