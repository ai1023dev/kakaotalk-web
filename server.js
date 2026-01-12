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

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            "default-src": ["'self'"],

            "script-src": [
                "'self'",
                "https://code.jquery.com",
                "https://cdn.jsdelivr.net"
            ],

            "connect-src": ["'self'"],

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
                "https://kweb10.siliod.com"
            ],

            "style-src": [
                "'self'",
                "https://cdn.jsdelivr.net"
            ],

            "font-src": [
                "'self'",
                "https://cdn.jsdelivr.net",
                "data:"
            ],

            "img-src": ["'self'"]
        }
    }
}));

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true);


//////////////////// 기본 세팅 값 //////////////////////

const PORT = 8080;

const nginx_sh_dir = '/home/kweb/Desktop/kakaotalk-web/'

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





app.get('/start_xpra', (req, res) => {
    // 이미 같은 IP로 실행중인 세션이 있으면 그 세션 주고 리턴
    for (let i = 0; i < session_list.length; i++) {
        if (session_list[i].user_ip === req.ip) {
            res.send({ num: session_list[i].num, dead_line: session_list[i].dead_line });
            return;
        }
    }

    let session
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

    // Xpra 실행
    const cmd = `./start.sh ${session} &`
    console.log(cmd)
    exec(cmd);

    // Nginx로 req.ip만 접속 가능하게 설정
    const cmd_nginx = `sudo ${nginx_sh_dir}start_nginx.sh ${session} ${req.ip}`
    console.log(cmd_nginx)
    exec(cmd_nginx);

    console.log(session_list)
    res.send({ num: session, dead_line: false })
});


app.get('/stop_xpra', (req, res) => {
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
    console.log(cmd)
    exec(cmd, (error, stdout, stderr) => {
        // 혹시 모르니 비활성화는 모든 작업 끝난후
        session_list[session - 1].active = false
    });

    // 접근 허용 가능 IP 없애기
    const cmd_nginx = `sudo ${nginx_sh_dir}stop_nginx.sh ${session}`
    console.log(cmd_nginx)
    exec(cmd_nginx);

    console.log(session_list)
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

const SHARE_DIR = '/home/kweb/.var/app/com.usebottles.bottles/data/bottles/bottles';
const max_volume = 500 * 1024 * 1024; // 500MB

// 메모리 저장
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (!ALLOWED_EXT.has(ext)) {
            return cb(new Error('허용되지 않은 파일 확장자'));
        }
        cb(null, true);
    }
});

// 업로드 API (업로드 저장 후 .gz 복사본 생성)
app.post('/upload', upload.array('files', 20), (req, res) => {
    try {
        let sessionObj = session_list.find(s => s.user_ip === req.ip);
        if (!sessionObj) return res.status(400).send('Invalid session');

        let totalUpload = req.files.reduce((acc, file) => acc + file.size, 0);

        // 누적 용량 초과 체크
        if (sessionObj.upload_volume + totalUpload > max_volume) {
            return res.send('max');
        }

        // 저장 처리
        req.files.forEach(file => {
            // 세션 디렉토리
            const dir = path.join(
                SHARE_DIR,
                `kweb-${sessionObj.num}`,
                'drive_c/users/steamuser/Desktop'
            );

            // 파일 이름 충돌 처리
            const ext = path.extname(file.originalname);
            const base = path.basename(file.originalname, ext);

            let filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
            let counter = 1;

            while (fs.existsSync(path.join(dir, filename))) {
                filename = `${base}(${counter})${ext}`;
                counter++;
            }

            const destPath = path.join(dir, filename);

            // 디스크에 원본 쓰기
            fs.writeFileSync(destPath, file.buffer);
        });

        // 누적 용량 증가
        sessionObj.upload_volume += totalUpload;

        res.send('ok');
    } catch (err) {
        console.error(err);
        res.status(500).send('upload error');
    }
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
    let session
    for (let i = 0; i < session_list.length; i++) {
        if (session_list[i].user_ip === req.ip) {
            session = session_list[i].num
            break;
        }
    }

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
    let session
    for (let i = 0; i < session_list.length; i++) {
        if (session_list[i].user_ip === req.ip) {
            session = session_list[i].num
            break;
        }
    }

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

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server listening on http://0.0.0.0:${PORT}`);
});

