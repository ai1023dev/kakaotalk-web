# kakaotalk-web

https://kakaotalk-web.siliod.com

## 프로젝트 소개

**KakaoTalk**을 웹에서 사용할 수 있도록 구현한 웹 버전
Xpra, Bottles 등을 활용하여 로컬 앱 환경과 비슷하게 동작하도록 구성

주요 기능:
- 브라우저에서 카톡 실행 가능
- 세션 관리 및 사용자별 접근 제한
- 클라우드플레어 터널 기반 외부 접속 가능

한계:
- 개발자가 보안에는 젬병이라 IP 기반 세션 관리, Bottles 권한제한 등의 노력을 했으나 미처 생각 못한 취약점 존재할 가능성 높음
- 가정집 실사용 컴퓨터로 구동중이라 서버 불안정 및 해킹 위험 높음
- 한글 키보드 입력 안됨
- 카카오 사측 허락 안 받음

## 기술 개요
1. Bottles (리눅스에서 윈도우 EXE 파일을 실행하게 해주는 프로그램) 에서 카카오톡 PC버전 실행
2. xpra (웹에서 GUI 원격조작을 가능하게하는 오픈소스) 로 카카오톡 화면을 공유
3. 보안을 위해 위 과정을 IP기반 세션으로 제어

## 버전
##### (고급 기능을 사용하는건 아니라 딱히 상관 없을 듯 하다.)
- Xpra / v5.1.4-r0
- Bottles / v60
- Node.js / v20.19.6
- Nginx / v1.18.0
- Ubuntu / v22.04.5 LTS


## 기술 스택

- **프론트엔드**: HTML5, CSS3, JavaScript, jQuery
- **백엔드 / 서버**: Node.js, Xpra, Nginx
- **배포 / 터널링**: Cloudflare Tunnel
- **OS**: Ubuntu 서버 환경 기반


## 개발 폴더 외 설정

### CloudFlare 터널 & Nginx
##### 8080 포트 메인 서버 -> 메인 도메인(kakaotalk-web.siliod.com 사실 서브 도메인)으로 터널링
##### 14401~14410 xpra 서버 -> Nginx(IP 차단용) -> 서브 도메인(kweb${1~10}.siliod.com)으로 터널링 (iframe kakaotalk-web.siliod.com에서 허용용)

### Nginx conf 파일
server {
    listen 14501;
    server_name _;

    include /etc/nginx/xpra_ip_rules/allow_xpra_1.conf;

    set_real_ip_from 127.0.0.1;
    real_ip_header CF-Connecting-IP;
    real_ip_recursive on;

    location / {
        proxy_pass http://127.0.0.1:14401/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;가
        real_ip_header CF-Connecting-IP;
        real_ip_recursive on;
    }
}

1~10 까지 다 적기

### Visudo (sudo 비번 프리 패싱)
kweb ALL=(root) NOPASSWD: /home/kweb/Desktop/kakaotalk-web/start_nginx.sh
kweb ALL=(root) NOPASSWD: /home/kweb/Desktop/kakaotalk-web/stop_nginx.sh

추가

### Bottles
kweb-1~10 이름으로 카카오톡 미리 설치 + C드라이브 제외한 권한 및 스토리지 삭제
