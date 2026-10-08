import goodUpload from './good-upload.mjs'
import irminsulError from './irminsul-error.mjs'
import irminsulImport from './irminsul-import.mjs'
import multiTargetEditor from './multi-target-editor.mjs'
import smoke from './smoke.mjs'
import toolWindowIsolation from './tool-window-isolation.mjs'

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
  'tool-window-isolation': toolWindowIsolation,
  'multi-target-editor': multiTargetEditor,
}
export { goodUpload, irminsulError, irminsulImport, smoke }
