let session_num;

// 기존 시작하기 버튼 로직 유지
$(document).on('click', '#show-iframe', function () {
    $.ajax({
        method: 'GET',
        url: '/start_xpra',
        success: function (data) {
            if (data === 'already') {
                alert('이미 세션을 사용중입니다.')
            } else {
                $('.header-right').css('opacity', '1');
                $('.header-right-no-click').css('z-index', '-100');
                $('.start-page > *:not(.loading)').css('opacity', '0');
                setTimeout(() => {
                    $('.start-page').html('<img class="loading" src="./img/loading.gif" style="display:none"/><span class="warning">페이지 로딩 후 카카오톡 창이 표시될 때까지 잠시 기다려 주세요</span>');
                    $('.loading').fadeIn(300);
                }, 300);

                session_num = data;
                setTimeout(function () {
                    $('main').append(`<iframe src="/${session_num}?floating_menu=0" frameborder="0"></iframe>`);
                    $('.start-page').css('opacity', 0);
                    setTimeout(() => {
                        $('.start-page').css('z-index', '-100');
                    }, 300);
                }, 5000);
            }
        },
        error: function (xhr, status, error) {
            alert('서버 측 에러');
        }
    });
});

// disconnect 기존 로직
const startPageOriginalHTML = '<div class="start-page"><img class="start-page-logo" src="./img/start-page-logo.svg" alt="logo"><span class="warning">※ 주의 ※</span><span class="warning-text">본 서비스는 카카오톡의 공식 서비스가 아닌 비공식 웹버전입니다.<br>현재 베타 단계로 운영 중이며, 보안이 완전히 검증되지 않아<br>해킹등 보안 문제가 발생할 수 있어 사용을 권장드리지 않습니다.<br>그럼에도 이용을 원하시는 경우, 아래 [시작하기] 버튼을 눌러주시기 바랍니다.</span><button id="show-iframe" class="start-btn">시작하기</button></div>';
function disconnect() {
    $('.header-right').css('opacity', '0.5');
    $('.header-right-no-click').css('z-index', '10000');
    $('.start-page').html(startPageOriginalHTML);
    $('.start-page').css('z-index', '10000');
    $('.start-page').css('opacity', '1');
    setTimeout(() => {
        $('iframe').remove();
    }, 300);

    setTimeout(() => {
        try {
            $('.header-right').css('opacity', '0.5');
            $('.header-right-no-click').css('z-index', '10000');
            $('.start-page').css('z-index', '10000');
            $('.start-page').css('opacity', '1');
            $('iframe').remove();
        } catch (error) { }
    }, 5000);

    $.ajax({
        method: 'GET',
        url: '/stop_xpra',
        success: function (data) { },
        error: function (xhr, status, error) {
            alert('서버 측 에러');
        }
    });
}

$('#disconnect').click(function () {
    disconnect();
});

/* ------------------ 모달 공통 유틸 ------------------ */
function showModal(selector) {
    $('#modal-overlay').removeClass('hidden').addClass('show');
    $(selector).removeClass('hidden').addClass('show');
}
function hideModal(selector) {
    $('#modal-overlay').removeClass('show').addClass('hidden');
    $(selector).removeClass('show').addClass('hidden');
}

// 오버레이 클릭으로 닫기
$('#modal-overlay').on('click', function () {
    // 모든 모달 닫기
    hideModal('#upload-modal');
    hideModal('#download-modal');
});

// 모달 내부 close/cancel 버튼
$(document).on('click', '.modal-close, .modal-cancel', function (e) {
    e.preventDefault();
    const tgt = $(this).data('target');
    if (tgt) hideModal(tgt);
});

/* ------------------ 업로드 모달 로직 ------------------ */
const $fileInput = $('#file-input');
const $dropzone = $('#dropzone');
const $selectedFiles = $('#selected-files');

function renderSelectedFiles(fileList) {
    $selectedFiles.empty();
    if (!fileList || fileList.length === 0) {
        $selectedFiles.append('<li class="small-muted">선택된 파일 없음</li>');
        return;
    }
    for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const li = $(`<li></li>`);
        li.text(f.name);
        $selectedFiles.append(li);
    }
}

// 업로드 버튼 클릭 -> 모달 오픈
$('#upload').on('click', function () {
    renderSelectedFiles([]);
    $fileInput.val('');
    showModal('#upload-modal');
});

// 드래그 앤 드롭 이벤트
$dropzone.on('dragover', function (e) {
    e.preventDefault();
    e.originalEvent.dataTransfer.dropEffect = 'copy';
    $(this).addClass('dragover');
});
$dropzone.on('dragleave drop', function (e) {
    e.preventDefault();
    $(this).removeClass('dragover');
});
$dropzone.on('drop', function (e) {
    e.preventDefault();
    const files = e.originalEvent.dataTransfer.files;
    // 파일 목록 렌더
    renderSelectedFiles(files);
    // 파일 input에 연결 (DataTransfer 사용)
    try {
        const dt = new DataTransfer();
        for (let i = 0; i < files.length; i++) dt.items.add(files[i]);
        $fileInput[0].files = dt.files;
    } catch (err) {
        // 일부 브라우저에서 제한될 수 있음 -> 이 경우 폼 전송 시 직접 파일 사용
        console.warn('DataTransfer not supported for assigning files programmatically', err);
    }
});

// 클릭해서 파일 선택
$dropzone.on('click', function () {
    $fileInput.trigger('click');
});
$fileInput.on('change', function () {
    renderSelectedFiles(this.files);
});

// 실제 업로드 처리
$('#do-upload').on('click', function () {
    const files = $fileInput[0].files;
    if (!files || files.length === 0) {
        alert('업로드할 파일을 선택해 주세요.');
        return;
    }

    const ALLOWED_EXT = new Set([
        'jpg', 'jpeg', 'gif', 'bmp', 'png', 'tif', 'tiff', 'tga', 'psd', 'ai',
        'mp4', 'm4v', 'avi', 'asf', 'wmv', 'mkv', 'ts', 'mpg', 'mpeg', 'mov', 'flv', 'ogv',
        'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a',
        'doc', 'docx', 'hwp', 'txt', 'rtf', 'pdf', 'md', 'csv', 'xls', 'xlsx', 'ppt', 'pptx',
        'zip', 'rar', '7z'
    ]);

    const formData = new FormData();
    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
            alert(`허용되지 않은 확장자: .${ext}`);
            return;
        }
        formData.append('files', file);
    }

    $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: res => {
            alert('업로드 완료');
            hideModal('#upload-modal');
        },
        error: err => {
            alert(err.responseJSON?.message || '업로드 실패');
        }
    });
});

/* ------------------ 다운로드(트리) 모달 로직 ------------------ */
function initTree() {
    $('#tree-container').empty();
    $('#tree-loading').show();
    fetch('/show_tree')
        .then(r => {
            if (!r.ok) throw new Error('트리 데이터 로드 실패');
            return r.json();
        })
        .then(data => {
            $('#tree-loading').hide();
            // Treeview 초기화
            new Treeview({
                containerId: "tree-container",
                data: data,
                searchEnabled: false,
                initiallyExpanded: false,
                onRenderNode: (nodeData, nodeEl) => {
                    nodeEl.innerHTML = "";
                    const icon = document.createElement("span");
                    icon.textContent = nodeData.type === "folder" ? "📁 " : "📄 ";
                    nodeEl.appendChild(icon);

                    const label = document.createElement("span");
                    label.textContent = nodeData.name;
                    if (nodeData.type === "file") {
                        label.classList.add("file-node");
                        label.style.cursor = 'pointer';
                        label.onclick = () => {
                            const href = `/download?file=${encodeURIComponent(nodeData.id)}`;
                            $.ajax({
                                url: href,
                                method: 'GET',
                                xhrFields: { responseType: 'blob' },
                                success: function (data, status, xhr) {
                                    const disp = xhr.getResponseHeader('Content-Disposition') || '';
                                    let filename = nodeData.name;
                                    const matches = /filename\*?=.*''([^;]+)/i.exec(disp);
                                    if (matches && matches[1]) {
                                        try { filename = decodeURIComponent(matches[1]); } catch (e) { }
                                    }
                                    const url = URL.createObjectURL(data);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    URL.revokeObjectURL(url);
                                },
                                error: function () { alert('다운로드 실패'); }
                            });
                        };
                    }
                    nodeEl.appendChild(label);
                }
            });
        })
        .catch(err => {
            $('#tree-loading').text('트리 로드 실패: ' + err.message);
        });
}

// 다운로드 버튼 클릭 -> 모달 오픈 + 트리 로드
$('#show-tree').on('click', function () {
    showModal('#download-modal');
    initTree();
});

$('#refresh-tree').on('click', function () {
    initTree();
});

// 모달에서 키보드 ESC로 닫기
$(document).on('keydown', function (e) {
    if (e.key === 'Escape') {
        hideModal('#upload-modal');
        hideModal('#download-modal');
    }
});
