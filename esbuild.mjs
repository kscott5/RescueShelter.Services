
import * as esbuild from 'esbuild'

let nodeInspect = {
    name: 'node inspect',
    setup(build) {
      build.onEnd(result => {
        console.log(`build ended with ${result.errors.length} errors`)
      })
    },
  }

let ctx = await esbuild.context({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node21',
  outdir: './dist',
  plugins: [nodeInspect]
})

ctx.watch();
