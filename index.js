const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const child = require('child_process')
const download = require('download')
const program = require('commander')
const fg = require('fast-glob')
program
  .option('-h, --home <path>', 'project dir.')
  .option('-f, --files <items>', 'include files.', (val) => val.split(','))
  .option('-o, --dist <path>', 'output target')
  .parse(process.argv)

let files = program.files
let home = program.home || process.cwd()
let dist = program.dist || path.join(process.cwd(), 'dist')
let version = process.version
let runtime = path.join(os.platform() !== 'win32' ? process.env.HOME : '', '.standalone_node')

if (!fs.pathExistsSync(runtime)) {
  fs.ensureDirSync(runtime)
}
let name = `node-${version}-${os.type().toLowerCase()}-${os.arch()}`

new Promise((resolve, reject) => {
  if (fs.pathExistsSync(path.join(runtime, name))) {
    return resolve()
  }

  let suffix = os.platform() === 'win32' ? 'zip' : 'tar.gz'
  let url = `https://nodejs.org/dist/${version}/${name}.${suffix}`

  resolve(download(url, runtime, {
    extract: true
  }))
})
.then((data) => {
  if (data) {
    switch (os.platform()) {
      case 'win32':
        break
      default:
        fs.copyFileSync(path.join(runtime, name, 'bin', 'node'), path.join(runtime, name, 'node'))
    }

    fs.readdirSync(path.join(runtime, name))
        .filter((item) => item !== 'node')
        .forEach((file) => fs.removeSync(path.join(runtime, name, file)))
  }

  if (fs.pathExistsSync(dist)) {
    fs.removeSync(dist)
  }

  fs.ensureDirSync(dist)
  fs.copyFileSync(path.join(home, 'package.json'), path.join(dist, 'package.json'))

  child.execFileSync('npm', [
    'install',
    '--production',
    '--prefix', dist
  ])

  let info = fs.readJSONSync(path.join(dist, 'package.json'))
  fs.unlinkSync(path.join(dist, 'package.json'))
  fs.unlinkSync(path.join(dist, 'package-lock.json'))

  if (!fs.pathExistsSync(path.join(dist, 'bin'))) {
    fs.ensureDirSync(path.join(dist, 'bin'))
  }

  fs.copyFileSync(path.join(runtime, name, 'node'), path.join(dist, 'bin', 'node'))

  fg.sync(files).forEach((file) => {
    let target = path.join(dist, file)
    if (!fs.pathExistsSync(path.parse(target).dir)) {
      fs.ensureDirSync(path.parse(target).dir)
    }
    fs.copyFileSync(path.join(process.cwd(), file), path.join(dist, file))
  })

  if (os.platform() !== 'win32') {
    fs.writeFileSync(path.join(dist, info.name), `#!/bin/bash\n$(dirname "\${BASH_SOURCE[0]}")/bin/node ${info.main}`)

    fs.chmodSync(path.join(dist, info.name), '0755')
  }
})
