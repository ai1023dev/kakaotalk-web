  const ua = navigator.userAgent;

  // 주요 검색엔진 봇
  const isBot = /Googlebot|Google-InspectionTool|NaverBot|DaumBot|Bingbot|Slurp|YandexBot|DuckDuckBot/i.test(ua);

  // 모바일 기기
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

  // 모바일 + 일반 사용자만 리다이렉트
  if (isMobile && !isBot) {
    location.replace('/mobile.html');
  }

!function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);
posthog.init('phc_NjxjcEZjI7odSJgsoo2gdpjrE5hdDFjmXmNVCqHiTXy', { api_host: 'https://us.i.posthog.com' })


let session_num;

// 기존 시작하기 버튼 로직 유지
$(document).on('click', '#show-iframe', function () {
    $('.header-right').css('opacity', '1');
    $('.header-right-no-click').css('z-index', '-100');
    $('.start-page > *:not(.loading)').css('opacity', '0');
    setTimeout(() => {
        $('.start-page').html('<img class="loading" src="./img/loading.gif" style="display:none"/><span class="warning">페이지 로딩 후 카카오톡 창이 표시될 때까지 잠시 기다려 주세요</span>');
        $('.loading').fadeIn(300);
    }, 300);
    $.ajax({
        method: 'GET',
        url: '/start_xpra',
        success: function (data) {console.log(data)
            timer(data.dead_line)
            session_num = data.num;
            setTimeout(function () {
                $('main').append(`<iframe src="https://kweb${session_num}.siliod.com/?floating_menu=0" frameborder="0"></iframe>`);
            }, 4000);
            setTimeout(function () {
                $('.start-page').css('opacity', 0);
                setTimeout(() => {
                    $('.start-page').css('z-index', '-100');
                }, 300);
            }, 6000);

        },
        error: function (xhr, status, error) {
            alert('서버 측 에러');
        }
    });
});

let timer_interval
function timer(dead_line) {
    let totalSeconds;

    // 1️⃣ deadline이 없으면 30분
    if (!dead_line) {
        totalSeconds = 30 * 60;
    } 
    // 2️⃣ deadline이 있으면 현재 시간 ~ 종료 시간 차이
    else {
        const endTime = new Date(dead_line).getTime();
        const nowTime = Date.now();

        totalSeconds = Math.floor((endTime - nowTime) / 1000);

        // 이미 지난 시간이면 0 처리
        if (totalSeconds < 0) totalSeconds = 0;
    }

    function updateTimer() {
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;

        minutes = String(minutes).padStart(2, '0');
        seconds = String(seconds).padStart(2, '0');

        $('#time').text(`${minutes}:${seconds}`);

        if (totalSeconds > 0) {
            totalSeconds--;
        } else {
            clearInterval(timer_interval);
            disconnect()
        }
    }

    updateTimer(); // 초기 표시
    timer_interval = setInterval(updateTimer, 1000);
}



// disconnect 기존 로직
const startPageOriginalHTML = '<div class="start-page"><img class="start-page-logo" src="./img/start-page-logo.svg" alt="logo"><span class="warning">※ 주의 ※</span><span class="warning-text">본 서비스는 카카오톡의 공식 서비스가 아닌 비공식 웹버전입니다.<br>현재 베타 단계로 운영 중이며, 보안이 완전히 검증되지 않아<br>해킹등 보안 문제가 발생할 수 있어 사용을 권장드리지 않습니다.<br>그럼에도 이용을 원하시는 경우, 아래 [시작하기] 버튼을 눌러주시기 바랍니다.</span><button id="show-iframe" class="start-btn">시작하기</button></div>';
function disconnect() {
    $('.header-right').css('opacity', '0.5');
    $('.header-right-no-click').css('z-index', '10000');
    $('.start-page').html(startPageOriginalHTML);
    $('.start-page').css('z-index', '10000');
    $('.start-page').css('opacity', '1');
    $('iframe').remove();

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
    clearInterval(timer_interval);
    $('#time').text('30:00');
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
        success: function (data) {
            console.log(data)
            if (data === 'ok') {
                alert('업로드 완료');
            }
            if (data === 'max') {
                alert('한 세션당 500M 까지 업로드 가능합니다.');
            }
            hideModal('#upload-modal');
        },
        error: err => {
            alert('한번에 20개가 초과되는 업로드나 100M가 넘는 업로드는 불가능 합니다.');
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
