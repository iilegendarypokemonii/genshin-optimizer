export async function run({ root, options, args, evidence }) {
  const { runApp } = await import('../lib/app.mjs')
  return runApp({ root, options, args, evidence })
}
