const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser')
const { exec } = require('child_process');
const multer = require('multer');
const mime = require('mime-types');

// 포트 8080
const PORT = 8080;

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true);
app.use(cookieParser('fZTRgsg1srg1s45eh10strhhj0uyolio0l54dh1r561y9yu1uj0hstr1u9yu1k0rh0fg1h9a'))


const can_use = '2'
const nginx_sh_dir = '/home/kweb/Desktop/kakaotalk-web/'


// 라우트

app.get('/start_xpra', (req, res) => {
    console.log(req.ip);
    
    const cmd = `./start.sh ${can_use} &`
    console.log(cmd)
    exec(cmd);
    
    const cmd_nginx = `sudo ${nginx_sh_dir}start_nginx.sh ${can_use} ${req.ip}`
    console.log(cmd_nginx)
    exec(cmd_nginx);
    
    res.cookie('session', can_use, {
        signed: true,
        httpOnly: true,
        // secure: true,        // https 환경에서
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60
    })
    
    res.send(can_use)
});

app.get('/stop_xpra', (req, res) => {
    const session = req.signedCookies.session

    if (!session) {
        return res.status(401).send('위조되었거나 없음')
    } else {
        res.clearCookie('session', {
	    signed: true,
	    httpOnly: true,
	    sameSite: 'strict'
	    // secure: true,   // production에서 사용했다면 여기에도 동일하게
	})

        const cmd = `./stop.sh ${session}`
        console.log(cmd)
        exec(cmd, (err, stdout, stderr) => {
            res.send(true)
        })
    
        const cmd_nginx = `sudo ${nginx_sh_dir}stop_nginx.sh ${session}`
        console.log(cmd_nginx)
        exec(cmd_nginx);
    }
});




/* ===== 허용 확장자 ===== */
const ALLOWED_EXT = new Set([
  // 이미지
  'jpg','jpeg','gif','bmp','png','tif','tiff','tga','psd','ai',

  // 동영상
  'mp4','m4v','avi','asf','wmv','mkv','ts','mpg','mpeg','mov','flv','ogv',

  // 음성
  'mp3','wav','flac','tta','tak','aac','wma','ogg','m4a',

  // 문서
  'doc','docx','hwp','txt','rtf','xml','pdf','wks','wps','xps','md',
  'odf','odt','ods','odp','csv','tsv','xls','xlsx','ppt','pptx',
  'pages','key','numbers','show','ce',

  // 압축
  'zip','gz','bz2','rar','7z','lzh','alz'
]);

const SHARE_DIR = '/home/kweb/.var/app/com.usebottles.bottles/data/bottles/bottles';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const session = req.signedCookies?.session;

    if (!session || !/^[a-zA-Z0-9_-]+$/.test(session)) {
      return cb(new Error('Invalid session'));
    }

    const dir = path.join(
      SHARE_DIR,
      `kweb-${session}`,
      'drive_c/users/steamuser/Desktop'
    );

    if (!fs.existsSync(dir)) {
      return cb(new Error('Target directory does not exist'));
    }

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const originalName = Buffer
      .from(file.originalname, 'latin1')
      .toString('utf8');

    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);

    const session = req.signedCookies.session;
    const dir = path.join(
      SHARE_DIR,
      `kweb-${session}`,
      'drive_c/users/steamuser/Desktop'
    );

    let filename = originalName;
    let counter = 1;

    while (fs.existsSync(path.join(dir, filename))) {
      filename = `${base}(${counter})${ext}`;
      counter++;
    }

    cb(null, filename);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname)
      .toLowerCase()
      .replace('.', '');

    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error('허용되지 않은 파일 확장자'));
    }
    cb(null, true);
  }
});

/* ===== 업로드 API ===== */
app.post('/upload', upload.array('files', 20), (req, res) => {
  res.send(true);
});

/* ===== 파일 트리 ===== */
function buildTree(dir, relative = "") {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  return items.map(item => {
    const itemPath = path.join(relative, item.name);
    if (item.isDirectory()) {
      return {
        id: itemPath,
        name: item.name,
        type: "folder",
        children: buildTree(path.join(dir, item.name), itemPath),
      };
    } else {
      return {
        id: itemPath,
        name: item.name,
        type: "file",
      };
    }
  });
}

app.get("/show_tree", (req, res) => {
const session = req.signedCookies?.session;

    if (!session || !/^[a-zA-Z0-9_-]+$/.test(session)) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const dir = path.join(
      SHARE_DIR,
      `kweb-${session}`,
      'drive_c/users/steamuser/'
    );
    
  const tree = buildTree(dir);
  const filtered_tree = tree.filter(item => item.id !== 'AppData' && item.id !== 'Temp')
  res.json(filtered_tree);
});


// 유틸: 안전하게 경로 검사
function resolveSafe(relPath, session) {
  // 금지: 절대경로, .. 등의 공격 시도 막기
  if (!relPath) return null;
  // decodeURIComponent로 인코딩된 값이 넘어올 수 있음
  try { relPath = decodeURIComponent(relPath); } catch (e) { /* ignore */ }

const dir = path.join(
      SHARE_DIR,
      `kweb-${session}`,
      'drive_c/users/steamuser/'
    );
    
  // 절대 경로로 변환
  const fullPath = path.resolve(path.join(dir, relPath));
  console.log(fullPath)
  // 파일 존재 여부
  if (!fs.existsSync(fullPath)) return null;
  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) return null;
  // 확장자 체크
  const ext = path.extname(fullPath).slice(1).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;
  return { fullPath, stat };
}


app.get('/download', (req, res) => {
  const rel = req.query.file;
  const session = req.signedCookies?.session;

    if (!session || !/^[a-zA-Z0-9_-]+$/.test(session)) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
  const safe = resolveSafe(rel, session);
  if (!safe) {
    return res.status(400).send('Invalid file');
  }

  const { fullPath, stat } = safe;
  const filename = path.basename(fullPath);
  const mimeType = mime.lookup(fullPath) || 'application/octet-stream';

  // 헤더 설정: 다운로드로 강제
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', stat.size);
  // 파일명을 한글 등으로 안전하게 전송하려면 encodeURIComponent 처리
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

  // 스트리밍 전송 (메모리 절약)
  const stream = fs.createReadStream(fullPath);
  stream.on('error', (err) => {
    console.error(err);
    if (!res.headersSent) res.status(500).end('File read error');
  });
  stream.pipe(res);
});


// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server listening on http://0.0.0.0:${PORT}`);
});

