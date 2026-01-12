const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, 'public');
const EXTS = ['.js', '.css', '.html', '.svg'];

function walk(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (EXTS.includes(path.extname(full))) {
      const data = fs.readFileSync(full);
      const br = zlib.brotliCompressSync(data, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
        }
      });
      fs.writeFileSync(full + '.br', br);
      console.log('✔', full + '.br');
    }
  }
}

walk(ROOT);
