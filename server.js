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
app.use(cookieParser('fZ0rh0fg1h9a'))


const nginx_sh_dir = '/home/kweb/Desktop/kakaotalk-web/'

let session_list = [
    { num: 1, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 2, active: false, user_ip: null, dead_line: null, upload_volume: 0 },
    { num: 3, active: false, user_ip: null, dead_line: null, upload_volume: 0 }
]

// 라우트

app.get('/start_xpra', (req, res) => {
    for (let i = 0; i < session_list.length; i++) {
        if (session_list[i].user_ip === req.ip) {
            res.send({num: session_list[i].num, dead_line: session_list[i].dead_line});
            return;
        }
    }

    let can_use

    for (let i = 0; i < session_list.length; i++) {
        if (!session_list[i].active) {
            can_use = session_list[i].num
            session_list[i].active = true
            session_list[i].user_ip = req.ip
            const now = new Date();
            const after30m = new Date(now.getTime() + 30 * 60 * 1000);
            session_list[i].dead_line = after30m
            break;
        }
    }

    const cmd = `./start.sh ${can_use} &`
    console.log(cmd)
    exec(cmd);

    const cmd_nginx = `sudo ${nginx_sh_dir}start_nginx.sh ${can_use} ${req.ip}`
    console.log(cmd_nginx)
    exec(cmd_nginx);

    console.log(session_list)
    res.send({num: can_use, dead_line: false})
});

setInterval(() => {
    console.log('검사')
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





app.get('/stop_xpra', (req, res) => {
    for (let i = 0; i < session_list.length; i++) {
        if (session_list[i].user_ip === req.ip) {
            stop_xpra(session_list[i].num)
            break;
        }
    }

    res.send(true)
});

function stop_xpra(session) {
    session_list[session - 1].user_ip = null
    session_list[session - 1].dead_line = null
    session_list[session - 1].upload_volume = 0
    
    const cmd = `./stop.sh ${session}`
    console.log(cmd)
    exec(cmd, (error, stdout, stderr) => {
        session_list[session - 1].active = false
    });

    const cmd_nginx = `sudo ${nginx_sh_dir}stop_nginx.sh ${session}`
    console.log(cmd_nginx)
    exec(cmd_nginx);

    console.log(session_list)
}




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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let session
        for (let i = 0; i < session_list.length; i++) {
            if (session_list[i].user_ip === req.ip) {
                session = session_list[i].num
                break;
            }
        }

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

        let session
        for (let i = 0; i < session_list.length; i++) {
            if (session_list[i].user_ip === req.ip) {
                session = session_list[i].num
                break;
            }
        }

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

