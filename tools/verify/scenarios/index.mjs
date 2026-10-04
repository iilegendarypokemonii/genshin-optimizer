import smoke from './smoke.mjs'
import goodUpload from './good-upload.mjs'
import irminsulImport from './irminsul-import.mjs'
import irminsulError from './irminsul-error.mjs'

async function irminsulMismatch(ctx) {
  await irminsulImport({
    ...ctx,
    fixture: async (file) => {
      const wrapper = await ctx.fixture(file)
      wrapper.expect.counts.characters++
      return wrapper
    },
  })
}

async function interruptRestart(ctx) {
  await ctx.step('interrupt-restart', async () => {
    const restarting = ctx.restart()
    process.emit('SIGINT')
    await restarting
  })
}

export const scenarios = {
  smoke,
  'good-upload': goodUpload,
  'irminsul-import': irminsulImport,
  'irminsul-error': irminsulError,
  'irminsul-mismatch': irminsulMismatch,
  'interrupt-restart': interruptRestart,
}
export { smoke, goodUpload, irminsulImport, irminsulError }
