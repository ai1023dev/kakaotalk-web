const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const multer = require('multer');
const mime = require('mime-types');
const helmet = require('helmet');
const dotenv = require("dotenv");
const zlib = require('zlib');
dotenv.config();

const PORT = 8080;
const nginx_sh_dir = '/home/kweb/Desktop/kakaotalk-web/';
const SHARE_DIR = '/home/kweb/.var/app/com.usebottles.bottles/data/bottles/bottles';
const TMP_UPLOAD_DIR = path.join(__dirname, '.tmp-uploads');
const max_volume = 500 * 1024 * 1024; // 500MB

fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": [
                "'self'",
                "https://code.jquery.com",
                "https://cdn.jsdelivr.net",
                "https://us.i.posthog.com",
                "https://us.posthog.com",
                "https://us-assets.i.posthog.com",
                "https://internal-j.posthog.com",
                "https://static.cloudflareinsights.com",
                "https://www.youtube.com",
                "https://www.youtube-nocookie.com",
                "https://www.gstatic.com"
            ],
            "connect-src": [
                "'self'",
                "https://us.i.posthog.com",
                "https://us.posthog.com",
                "https://us-assets.i.posthog.com",
                "https://www.youtube.com",
                "https://www.youtube-nocookie.com",
                "https://www.googleapis.com"
            ],
            "frame-src": [
                "https://kweb1.siliod.com",
                "https://kweb2.siliod.com",
                "https://kweb3.siliod.com",
                "https://kweb4.siliod.com",
                "https://kweb5.siliod.com",
                "https://kweb6.siliod.com",
                "https://kweb7.siliod.com",
                "https://kweb8.siliod.com",
                "https://kweb9.siliod.com",
                "https://kweb10.siliod.com",
                "https://www.youtube.com",
                "https://www.youtube-nocookie.com"
            ],
            "style-src": [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://us.posthog.com"
            ],
            "font-src": [
                "'self'",
                "https://cdn.jsdelivr.net",
                "data:"
            ],
            "img-src": [
                "'self'",
                "data:",
                "https://i.ytimg.com",
                "https://yt3.ggpht.com"
            ],
            "frame-ancestors": ["'self'"]
        }
    }
}));

// ======= Brotli 정적 우선 서빙 미들웨어 =======
// public 폴더에 미리 생성된 .br 파일이 있으면 Accept-Encoding: br인 경우 .br을 우선 서빙
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const acceptEnc = req.headers['accept-encoding'] || '';
    if (!acceptEnc.includes('br')) return next();

    // 요청 경로 디코드하여 실제 파일 경로 계산
    let reqPath = req.path;
    try { reqPath = decodeURIComponent(reqPath); } catch (e) { /* ignore */ }

    // 보안: 요청 경로가 루트 밖으로 나가지 않도록 처리
    const filePath = path.join(__dirname, 'public', reqPath);
    const brPath = filePath + '.br';

    try {
        if (fs.existsSync(brPath) && fs.statSync(brPath).isFile()) {
            // Content-Type은 원래 확장자 기반으로 설정
            res.setHeader('Content-Encoding', 'br');
            res.setHeader('Vary', 'Accept-Encoding');
            res.type(path.extname(filePath) || 'application/octet-stream');
            return res.sendFile(brPath);
        }
    } catch (err) {
        console.error('brotli serve error:', err);
        // 에러가 나도 기본 static으로 넘김
    }
    return next();
});

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 'loopback');

let session_list = [
    { num: 1, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 2, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 3, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 4, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 5, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 6, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 7, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 8, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 9, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 10, active: false, user_ip: null, dead_line: null, upload_volume: 0 }
]

////////////////////////////////////////////////////////

const rateLimits = new Map();

function makeRateLimiter(key, limit, windowMs) {
    return (req, res, next) => {
        const bucketKey = `${key}:${req.ip}`;
        const now = Date.now();
        const windowStart = now - windowMs;
        const timestamps = rateLimits.get(bucketKey) || [];
        const recent = timestamps.filter(ts => ts > windowStart);

        if (recent.length >= limit) {
            return res.status(429).send('too_many_requests');
        }

        recent.push(now);
        rateLimits.set(bucketKey, recent);
        next();
    };
}

function requireSameOrigin(req, res, next) {
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite && ['same-origin', 'same-site', 'none'].includes(fetchSite)) {
        return next();
    }

    const expectedOrigin = `${req.protocol}://${req.get('host')}`;
    const origin = req.get('origin');
    if (origin) {
        return origin === expectedOrigin ? next() : res.status(403).send('forbidden_origin');
    }

    const referer = req.get('referer');
    if (referer) {
        return referer.startsWith(`${expectedOrigin}/`) || referer === expectedOrigin
            ? next()
            : res.status(403).send('forbidden_origin');
    }

    return res.status(403).send('forbidden_origin');
}

function getSessionByIp(ip) {
    return session_list.find(session => session.user_ip === ip) || null;
}

function getSessionRoot(session) {
    return path.join(
        SHARE_DIR,
        `kweb-${session}`,
        'drive_c/users/steamuser'
    );
}

function getDesktopDir(session) {
    return path.join(getSessionRoot(session), 'Desktop');
}

function sanitizeFilename(originalName) {
    const decoded = Buffer.from(String(originalName || ''), 'latin1').toString('utf8');
    const basename = path.basename(decoded);
    const sanitized = basename
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/[\\/]/g, '')
        .trim();

    if (!sanitized || sanitized === '.' || sanitized === '..') {
        return null;
    }

    return sanitized;
}

function safeUnlink(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('cleanup error:', err);
        }
    }
}

function cleanupUploadedFiles(files = []) {
    files.forEach(file => {
        if (file && file.path) {
            safeUnlink(file.path);
        }
    });
}

function cleanupMovedFiles(paths = []) {
    paths.forEach(filePath => safeUnlink(filePath));
}

function getUniqueDestination(dir, filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let candidate = filename;
    let counter = 1;

    while (fs.existsSync(path.join(dir, candidate))) {
        candidate = `${base}(${counter})${ext}`;
        counter++;
    }

    return path.join(dir, candidate);
}

function isSafeShellArg(ip) {
    if (typeof ip !== 'string') return false
    return /^[0-9a-fA-F:.\-]+$/.test(ip)
}

const startMiddlewares = [
    requireSameOrigin,
    makeRateLimiter('start-xpra', 5, 10 * 60 * 1000)
];

const stopMiddlewares = [
    requireSameOrigin,
    makeRateLimiter('stop-xpra', 10, 10 * 60 * 1000)
];

app.all('/start_xpra', ...startMiddlewares, (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).send('method_not_allowed');
    }

    const client = String(req.ip)
    if (!isSafeShellArg(client)) {
        return res.status(400).send({ num: false });
    }

    // 이미 같은 IP로 실행중인 세션이 있으면 그 세션 주고 리턴
    for (let i = 0; i < session_list.length; i++) {
        if (session_list[i].user_ip === req.ip) {
            res.send({ num: session_list[i].num, dead_line: session_list[i].dead_line });
            return;
        }
    }

    let session = null
    // 꺼진 세션이 있는지 찾고 찾으면 " 켜짐 표시, IP, 타이머 " 설정
    for (let i = 0; i < session_list.length; i++) {
        if (!session_list[i].active) {
            session = session_list[i].num
            session_list[i].active = true
            session_list[i].user_ip = req.ip
            const now = new Date();
            const after30m = new Date(now.getTime() + 30 * 60 * 1000);
            session_list[i].dead_line = after30m
            break;
        }
    }

    if (session) {
        // Xpra 실행
        const cmd = `./start.sh ${session} &`
        exec(cmd);

        // Nginx로 req.ip만 접속 가능하게 설정
        const cmd_nginx = `sudo ${nginx_sh_dir}start_nginx.sh ${session} ${req.ip}`
        exec(cmd_nginx);

        console.log(session_list)
        console.log('----------------------------------------')
        session_list
            .filter(s => s.active === true)
            .forEach(s => {
                console.log(`num: ${s.num}, ip: ${s.user_ip}`)
            })
        console.log('----------------------------------------')
        console.log(cmd)
        console.log(cmd_nginx)
        const now = new Date();
        console.log(now.toLocaleString('ko-KR'));

        res.send({ num: session, dead_line: false })
    } else {
        res.send({ num: false })
    }
});


app.all('/stop_xpra', ...stopMiddlewares, (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).send('method_not_allowed');
    }

    const client = String(req.ip)
    if (!isSafeShellArg(client)) {
        return res.status(400).send(false);
    }

    // 유저의 IP로 등록되어 실행중인 세션을 찾아 stop_xpra()
    for (let i = 0; i < session_list.length; i++) {
        if (session_list[i].user_ip === req.ip) {
            stop_xpra(session_list[i].num)
            break;
        }
    }

    res.send(true)
});

function stop_xpra(session) {
    // IP, 타이머, 업로드 누적용량 초기화
    session_list[session - 1].user_ip = null
    session_list[session - 1].dead_line = null
    session_list[session - 1].upload_volume = 0

    // Xpra 끄기
    const cmd = `./stop.sh ${session}`
    exec(cmd, (error, stdout, stderr) => {
        // 혹시 모르니 비활성화는 모든 작업 끝난후
        session_list[session - 1].active = false
    });

    // 접근 허용 가능 IP 없애기
    const cmd_nginx = `sudo ${nginx_sh_dir}stop_nginx.sh ${session}`
    exec(cmd_nginx);

    console.log(session_list)
    console.log('----------------------------------------')
    session_list
        .filter(s => s.active === true)
        .forEach(s => {
            console.log(`num: ${s.num}, ip: ${s.user_ip}`)
        })
    console.log('----------------------------------------')
    console.log(cmd)
    console.log(cmd_nginx)
    const now = new Date();
    console.log(now.toLocaleString('ko-KR'));
}

// 30초 마다 30분의 이용시간 타이머가 지난 세션을 검사후 종료
setInterval(() => {
    const now = new Date();

    for (let i = 0; i < session_list.length; i++) {
        const session = session_list[i];

        if (session.dead_line) {
            if (now >= session.dead_line) {
                console.log(`세션 ${session.num} 만료`);

                stop_xpra(session.num);
            }
        }
    }
}, 30 * 1000);




// 안타깝게도 아래 파일 업/다운로드 코드는 GPT가 다짜서 잘모르겠으나
// const SHARE_DIR = '/home/kweb/.var/app/com.usebottles.bottles/data/bottles/bottles';
//const dir = path.join(
//     SHARE_DIR,
//     `kweb-${sessionObj.num}`,
//     'drive_c/users/steamuser/Desktop'
// );
// 이 경로를 공유 폴더처럼 이용해 파일을 웹 클라이언트와 서버간 공유한다. 는게 메인 아이디어다.

// app.get("/show_tree"... 요청시 ...drive_c/users/steamuser/ 경로 아래 파일구조를 보내주는거 말고는 지극히 평범한 파일 업/다운로드 코드


/* ===== 허용 확장자 ===== */
const ALLOWED_EXT = new Set([
    // 이미지
    'jpg', 'jpeg', 'gif', 'bmp', 'png', 'tif', 'tiff', 'tga', 'psd', 'ai',

    // 동영상
    'mp4', 'm4v', 'avi', 'asf', 'wmv', 'mkv', 'ts', 'mpg', 'mpeg', 'mov', 'flv', 'ogv',

    // 음성
    'mp3', 'wav', 'flac', 'tta', 'tak', 'aac', 'wma', 'ogg', 'm4a',

    // 문서
    'doc', 'docx', 'hwp', 'txt', 'rtf', 'xml', 'pdf', 'wks', 'wps', 'xps', 'md',
    'odf', 'odt', 'ods', 'odp', 'csv', 'tsv', 'xls', 'xlsx', 'ppt', 'pptx',
    'pages', 'key', 'numbers', 'show', 'ce',

    // 압축
    'zip', 'gz', 'bz2', 'rar', '7z', 'lzh', 'alz'
]);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TMP_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage,
    limits: {
        files: 20,
        fileSize: 100 * 1024 * 1024,
        parts: 30
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (!ALLOWED_EXT.has(ext)) {
            const error = new Error('허용되지 않은 파일 확장자');
            error.code = 'INVALID_EXTENSION';
            return cb(error);
        }
        cb(null, true);
    }
});

// 업로드 API (업로드 저장 후 .gz 복사본 생성)
app.post(
    '/upload',
    requireSameOrigin,
    makeRateLimiter('upload', 20, 10 * 60 * 1000),
    upload.array('files', 20),
    (req, res) => {
    const movedPaths = [];
    try {
        let sessionObj = getSessionByIp(req.ip);
        if (!sessionObj) return res.status(400).send('Invalid session');
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('upload error');
        }

        let totalUpload = req.files.reduce((acc, file) => acc + file.size, 0);

        // 누적 용량 초과 체크
        if (sessionObj.upload_volume + totalUpload > max_volume) {
            cleanupUploadedFiles(req.files);
            return res.send('max');
        }

        const dir = getDesktopDir(sessionObj.num);
        fs.mkdirSync(dir, { recursive: true });
        const preparedFiles = req.files.map(file => {
            const filename = sanitizeFilename(file.originalname);
            if (!filename) {
                const error = new Error('허용되지 않은 파일 이름');
                error.code = 'INVALID_FILENAME';
                throw error;
            }

            return {
                tempPath: file.path,
                destPath: getUniqueDestination(dir, filename)
            };
        });
        // 저장 처리
        preparedFiles.forEach(file => {
            fs.renameSync(file.tempPath, file.destPath);
            movedPaths.push(file.destPath);
        });

        // 누적 용량 증가
        sessionObj.upload_volume += totalUpload;

        res.send('ok');
    } catch (err) {
        cleanupUploadedFiles(req.files);
        cleanupMovedFiles(movedPaths);
        console.error(err);
        if (err.code === 'INVALID_FILENAME') {
            return res.status(400).send('upload error');
        }
        res.status(500).send('upload error');
    }
    }
);


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

app.get("/show_tree", makeRateLimiter('show-tree', 60, 10 * 60 * 1000), (req, res) => {
    const sessionObj = getSessionByIp(req.ip);
    const session = sessionObj && sessionObj.num;

    if (!session || !/^[a-zA-Z0-9_-]+$/.test(session)) {
        return res.status(401).json({ error: 'Invalid session' });
    }

    const dir = getSessionRoot(session);

    const tree = buildTree(dir);
    const filtered_tree = tree.filter(item => item.id !== 'AppData' && item.id !== 'Temp')
    res.json(filtered_tree);
});


// 유틸: 안전하게 경로 검사
function resolveSafe(relPath, session) {
    if (!relPath) return null;

    try { relPath = decodeURIComponent(relPath); } catch (e) { /* ignore */ }
    if (relPath.includes('\0')) return null;
    if (path.isAbsolute(relPath)) return null;

    const normalizedRelPath = path.normalize(relPath);
    if (normalizedRelPath.startsWith('..') || normalizedRelPath.includes(`${path.sep}..${path.sep}`)) {
        return null;
    }

    const rootPath = fs.realpathSync(getSessionRoot(session));
    const candidatePath = path.resolve(rootPath, normalizedRelPath);
    if (!(candidatePath === rootPath || candidatePath.startsWith(rootPath + path.sep))) {
        return null;
    }

    if (!fs.existsSync(candidatePath)) return null;

    let fullPath;
    try {
        fullPath = fs.realpathSync(candidatePath);
    } catch (err) {
        return null;
    }

    if (!(fullPath === rootPath || fullPath.startsWith(rootPath + path.sep))) {
        return null;
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) return null;

    const ext = path.extname(fullPath).slice(1).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return null;
    return { fullPath, stat };
}


app.get('/download', makeRateLimiter('download', 120, 10 * 60 * 1000), (req, res) => {
    const rel = req.query.file;
    const sessionObj = getSessionByIp(req.ip);
    const session = sessionObj && sessionObj.num;

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

    // 브라우저가 gzip 허용하면 gzip으로 스트리밍 (Content-Length 제거)
    const acceptEnc = req.headers['accept-encoding'] || '';
    const wantsGzip = acceptEnc.includes('gzip');

    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Content-Type', mimeType);
    // 파일명을 한글 등으로 안전하게 전송하려면 encodeURIComponent 처리
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    if (wantsGzip) {
        // gzip 압축 스트리밍 전송
        res.setHeader('Content-Encoding', 'gzip');
        const readStream = fs.createReadStream(fullPath);
        const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
        readStream.on('error', (err) => {
            console.error(err);
            if (!res.headersSent) res.status(500).end('File read error');
        });
        // Content-Length는 알 수 없으므로 제거/미설정
        // 스트림 파이프
        readStream.pipe(gzip).pipe(res);
    } else {
        // 원본 그대로 스트리밍 (Content-Length 설정)
        res.setHeader('Content-Length', stat.size);
        const stream = fs.createReadStream(fullPath);
        stream.on('error', (err) => {
            console.error(err);
            if (!res.headersSent) res.status(500).end('File read error');
        });
        stream.pipe(res);
    }
});

app.use((err, req, res, next) => {
    if (req.files) {
        cleanupUploadedFiles(req.files);
    }

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).send('upload error');
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_PART_COUNT') {
            return res.status(400).send('upload error');
        }
        return res.status(400).send('upload error');
    }

    if (err && err.code === 'INVALID_EXTENSION') {
        return res.status(400).send('upload error');
    }

    if (err) {
        console.error(err);
        return res.status(500).send('server error');
    }

    next();
});


// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server listening on http://0.0.0.0:${PORT}`);
});
