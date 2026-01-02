let session_num


$.ajax({
    method: 'GET',
    url: '/start_xpra',
    success: function (data) {
        session_num = data
    	setTimeout(function() {
 	    $('#main').html('<iframe src="/' + session_num +
 	        '" width="900px" height="800px" frameborder="0"></iframe>')
	}, 5000);
    },
    error: function (xhr, status, error) {
        alert('서버 측 에러')
    }
});

$('#disconnect').click(function () {
    $.ajax({
        method: 'GET',
        url: '/stop_xpra',
        success: function (data) {
            $('#main').html('<h1>disconnected</h1>');
        },
        error: function (xhr, status, error) {
            alert('서버 측 에러');
        }
    });
});




/* ===== 허용 확장자 ===== */
const ALLOWED_EXT = new Set([
  'jpg','jpeg','gif','bmp','png','tif','tiff','tga','psd','ai',
  'mp4','m4v','avi','asf','wmv','mkv','ts','mpg','mpeg','mov','flv','ogv',
  'mp3','wav','flac','tta','tak','aac','wma','ogg','m4a',
  'doc','docx','hwp','txt','rtf','xml','pdf','wks','wps','xps','md',
  'odf','odt','ods','odp','csv','tsv','xls','xlsx','ppt','pptx',
  'pages','key','numbers','show','ce',
  'zip','gz','bz2','rar','7z','lzh','alz'
]);

$('#upload').on('click', function () {
  const files = $('#file')[0].files;
  if (!files.length) {
    alert('파일 선택');
    return;
  }

  const formData = new FormData();

  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      alert(`허용되지 않은 확장자: ${ext}`);
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
      console.log(res.files);
    },
    error: err => {
      alert(err.responseJSON?.message || '업로드 실패');
    }
  });
});




async function initTree() {
      const res = await fetch("/show_tree");
      const data = await res.json();
      console.log(data)

      const tree = new Treeview({
        containerId: "tree-container",
        data: data,
        searchEnabled: true,
        initiallyExpanded: true,
        onRenderNode: (nodeData, nodeEl) => {
          nodeEl.innerHTML = ""; // 기본 텍스트 제거

          const icon = document.createElement("span");
          icon.textContent = nodeData.type === "folder" ? "📁 " : "📄 ";
          nodeEl.appendChild(icon);

          const label = document.createElement("span");
          label.textContent = nodeData.name;
          if (nodeData.type === "file") {
            label.classList.add("file-node");
            label.onclick = () => {
            
              href = `/download?file=${encodeURIComponent(nodeData.id)}`;
              
              $.ajax({
              url: href,
              method: 'GET',
              xhrFields: { responseType: 'blob' },
              success: function (data, status, xhr) {
                // 서버가 보낸 파일명 추출 (Content-Disposition)
                const disp = xhr.getResponseHeader('Content-Disposition') || '';
                let filename = rel;
                const matches = /filename\*?=.*''([^;]+)/i.exec(disp);
                if (matches && matches[1]) {
                  try { filename = decodeURIComponent(matches[1]); } catch (e) {}
                }

                // Blob을 받아서 임시 링크로 저장
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
    }


$('#show_tree').click(function () {
    initTree();
});
    
    
   

