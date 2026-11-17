process.env.NODE_ENV = 'production'
const pkg = import.meta.resolve('@rspack/cli/package.json')
await import(new URL('./bin/rspack.js', pkg).href)
