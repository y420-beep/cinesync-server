const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = createServer(app);

// Создаём папку public и index.html
if (!fs.existsSync('public')) fs.mkdirSync('public');

const htmlContent = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0a0a0f">
<title>CineSync</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#fff;height:100dvh;overflow:hidden}
.hidden{display:none!important}

/* Экран подключения */
#connect{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#0a0a0f 0%,#1a1a2e 100%)}
.logo{font-size:48px;font-weight:800;background:linear-gradient(135deg,#e50914,#ff6b6b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;letter-spacing:-1px}
.sub{color:#888;font-size:14px;margin-bottom:40px;text-align:center}
input{width:100%;max-width:320px;padding:16px 20px;border:2px solid #1a1a2e;border-radius:16px;background:#1a1a2e;color:#fff;font-size:16px;margin-bottom:12px;outline:none;-webkit-appearance:none;transition:.3s}
input:focus{border-color:#e50914;background:#252542}
.btn{width:100%;max-width:320px;padding:18px;border:none;border-radius:16px;font-size:16px;font-weight:600;cursor:pointer;-webkit-appearance:none;transition:.3s;display:flex;align-items:center;justify-content:center;gap:8px}
.btn-red{background:linear-gradient(135deg,#e50914,#b20710);color:#fff;box-shadow:0 4px 20px rgba(229,9,20,.3)}
.btn-red:active{transform:scale(.98)}
.btn-dark{background:#1a1a2e;color:#fff;margin-top:8px}
.btn-dark:active{background:#252542}
.divider{width:100%;max-width:320px;display:flex;align-items:center;gap:16px;margin:20px 0;color:#555;font-size:12px}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:#1a1a2e}
.status{margin-top:16px;padding:12px 20px;border-radius:12px;font-size:14px;max-width:320px;width:100%;text-align:center;transition:.3s}
.ok{background:rgba(0,255,136,.1);color:#00ff88;border:1px solid rgba(0,255,136,.2)}
.wait{background:rgba(0,212,255,.1);color:#00d4ff;border:1px solid rgba(0,212,255,.2)}
.err{background:rgba(229,9,20,.1);color:#e50914;border:1px solid rgba(229,9,20,.2)}
.info{background:rgba(255,170,0,.1);color:#ffaa00;border:1px solid rgba(255,170,0,.2)}

/* Основной интерфейс */
#main{flex:1;display:flex;flex-direction:column;position:relative}
#video-box{flex:1;background:#000;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
video{width:100%;height:100%;object-fit:contain}
#placeholder{text-align:center;padding:20px;color:#666}
#placeholder .icon{font-size:64px;margin-bottom:16px;display:block}

/* URL панель */
#url-bar{position:absolute;top:0;left:0;right:0;background:rgba(10,10,15,.95);backdrop-filter:blur(20px);padding:16px;padding-top:max(16px,env(safe-area-inset-top));transform:translateY(-100%);transition:.3s;z-index:100;display:flex;gap:8px;border-bottom:1px solid #1a1a2e}
#url-bar.show{transform:translateY(0)}
#url-bar input{flex:1;margin:0}

/* Индикаторы */
#badge{position:absolute;top:max(16px,env(safe-area-inset-top));right:16px;display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(0,0,0,.6);backdrop-filter:blur(10px);border-radius:20px;font-size:12px;z-index:50;transition:.3s}
.dot{width:8px;height:8px;border-radius:50%;background:#00ff88;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
#peers{position:absolute;top:max(60px,env(safe-area-inset-top)+44px);right:16px;display:flex;flex-direction:column;gap:8px;z-index:50}
.peer{display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(0,0,0,.6);backdrop-filter:blur(10px);border-radius:20px;font-size:12px;transition:.3s}
.peer.talk{background:rgba(0,255,136,.2);border:1px solid #00ff88;transform:scale(1.05)}
.pv{width:40px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden}
.pvf{height:100%;background:#00ff88;width:0%;transition:.1s}

/* Настройки звука */
#audio-set{position:absolute;bottom:120px;left:50%;transform:translateX(-50%) translateY(20px);background:rgba(10,10,15,.95);backdrop-filter:blur(20px);padding:20px;border-radius:20px;width:90%;max-width:300px;opacity:0;pointer-events:none;transition:.3s;z-index:60;border:1px solid #1a1a2e}
#audio-set.show{opacity:1;pointer-events:all;transform:translateX(-50%) translateY(0)}
.sl{margin-bottom:16px}
.sl label{display:flex;justify-content:space-between;font-size:13px;color:#888;margin-bottom:8px}
.sl label span{color:#fff;font-weight:600}
input[type=range]{width:100%;height:4px;background:#1a1a2e;border-radius:2px;outline:none;-webkit-appearance:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;background:#e50914;border-radius:50%;cursor:pointer;box-shadow:0 2px 8px rgba(229,9,20,.4)}

/* Управление */
#ctrl{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,.9) 0%,transparent 100%);padding:20px 16px 32px;padding-bottom:max(32px,env(safe-area-inset-bottom));transition:opacity .3s;z-index:50}
.row{display:flex;align-items:center;gap:16px;margin-bottom:12px}
.cb{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);border:none;color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;transition:.2s}
.cb:active{background:rgba(255,255,255,.3);transform:scale(.95)}
.cb.big{width:56px;height:56px;font-size:24px}
.cb.on{background:#e50914}
.prog{flex:1;height:4px;background:rgba(255,255,255,.2);border-radius:2px;position:relative;cursor:pointer}
.prog-f{height:100%;background:#e50914;border-radius:2px;width:0%;position:relative}
.prog-f::after{content:'';position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:12px;height:12px;background:#e50914;border-radius:50%;opacity:0;transition:.2s}
.prog:hover .prog-f::after{opacity:1}
.tm{font-size:12px;color:rgba(255,255,255,.8);min-width:90px;text-align:right;font-variant-numeric:tabular-nums}

/* Toast */
#toast-c{position:fixed;top:max(80px,env(safe-area-inset-top)+60px);left:50%;transform:translateX(-50%);z-index:3000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{background:#1a1a2e;padding:12px 20px;border-radius:12px;font-size:14px;border-left:3px solid #e50914;animation:ti .3s;max-width:300px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.3)}
@keyframes ti{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}

/* Скрытие UI */
.hid #ctrl,.hid #badge,.hid #peers{opacity:0;pointer-events:none}
.hid #url-bar{transform:translateY(-100%)}

/* Инструкции */
.how{background:#1a1a2e;border-radius:16px;padding:20px;margin-top:20px;max-width:320px;width:100%}
.how h3{font-size:14px;margin-bottom:12px;color:#fff}
.how ul{list-style:none;font-size:13px;color:#888}
.how li{padding:6px 0;padding-left:20px;position:relative}
.how li::before{content:'•';position:absolute;left:0;color:#e50914}
</style>
</head>
<body>

<!-- Экран подключения -->
<div id="connect">
<div class="logo">CineSync</div>
<div class="sub">Смотрите фильмы вместе, где бы вы ни были</div>
<input type="text" id="un" placeholder="Ваше имя" maxlength="20">
<input type="text" id="rc" placeholder="Код комнаты (6 символов)" maxlength="6">
<button class="btn btn-red" onclick="join()">🎬 Присоединиться</button>
<div class="divider">или</div>
<button class="btn btn-dark" onclick="create()">➕ Создать комнату</button>
<div id="st" class="hidden"></div>
<div class="how">
<h3>Как это работает:</h3>
<ul>
<li>Создайте комнату и поделитесь кодом</li>
<li>Вставьте прямую ссылку на видео (MP4/WebM)</li>
<li>Включите микрофон для голосового чата</li>
<li>Видео синхронизируется автоматически</li>
</ul>
</div>
</div>

<!-- Основной интерфейс -->
<div id="main" class="hidden">
<div id="video-box">
<video id="vid" playsinline preload="metadata" style="display:none"></video>
<div id="placeholder">
<span class="icon">🎬</span>
<div>Нажмите 🔗 чтобы загрузить видео</div>
<div style="margin-top:8px;font-size:12px;color:#444">Поддерживаются прямые ссылки MP4/WebM</div>
</div>
</div>

<div id="url-bar">
<input type="text" id="vu" placeholder="Вставьте URL видео (MP4, WebM, HLS)...">
<button class="btn btn-red" style="width:auto;padding:12px 20px;font-size:14px" onclick="load()">▶️</button>
</div>

<div id="badge"><div class="dot"></div><span id="bt">Подключено</span></div>
<div id="peers"></div>

<div id="audio-set">
<div class="sl"><label>Громкость фильма <span id="vv">60%</span></label><input type="range" min="0" max="100" value="60" oninput="svv(this.value)"></div>
<div class="sl"><label>Громкость голоса <span id="av">80%</span></label><input type="range" min="0" max="100" value="80" oninput="sav(this.value)"></div>
<div class="sl"><label>Шумоподавление</label><input type="range" min="0" max="100" value="50"></div>
</div>

<div id="ctrl">
<div class="row">
<button class="cb big" id="pb" onclick="tp()">▶️</button>
<div class="prog" onclick="sk(event)"><div class="prog-f" id="pf"></div></div>
<div class="tm" id="tm">00:00 / 00:00</div>
</div>
<div class="row" style="justify-content:center;gap:24px">
<button class="cb" onclick="tu()" title="Загрузить видео">🔗</button>
<button class="cb" id="mb" onclick="tmic()" title="Микрофон">🎤</button>
<button class="cb" onclick="ta()" title="Звук">🔊</button>
<button class="cb" onclick="tf()" title="Полный экран">⛶</button>
</div>
</div>
</div>

<div id="toast-c"></div>

<script>
// ==================== КОНФИГУРАЦИЯ ====================
const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let ws = null;
let pc = null;
let dc = null;
let localStream = null;
let room = null;
let myName = '';
let isHost = false;
let isPlaying = false;
let isMicOn = false;
let audioCtx = null;
let videoGain = null;
let voiceGain = null;
let masterGain = null;
let syncTimer = null;

// ==================== УТИЛИТЫ ====================
function $(id) { return document.getElementById(id); }

function toast(msg, duration = 3000) {
    const c = $('toast-c');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), duration);
}

function showStatus(text, type) {
    const s = $('st');
    s.textContent = text;
    s.className = 'status ' + type;
    s.classList.remove('hidden');
}

function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function fmtTime(s) {
    if (!isFinite(s)) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

// ==================== СОЗДАНИЕ/ПОДКЛЮЧЕНИЕ ====================
function create() {
    myName = $('un').value.trim() || 'Я';
    room = genCode();
    isHost = true;
    showStatus('Создание комнаты...', 'wait');
    connect();
}

function join() {
    myName = $('un').value.trim() || 'Я';
    room = $('rc').value.trim().toUpperCase();
    if (room.length !== 6) {
        toast('❌ Код должен быть 6 символов');
        return;
    }
    showStatus('Подключение...', 'wait');
    connect();
}

// ==================== WEBSOCKET ====================
function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', room, name: myName }));
    };

    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        handleMsg(msg);
    };

    ws.onerror = () => {
        showStatus('Ошибка соединения. Перезагрузите.', 'err');
    };

    ws.onclose = () => {
        $('bt').textContent = 'Отключено';
        document.querySelector('.dot').style.background = '#e50914';
        document.querySelector('.dot').style.animation = 'none';
    };
}

function handleMsg(m) {
    switch (m.type) {
        case 'joined':
            onJoined(m);
            break;
        case 'peer-joined':
            onPeerJoined(m);
            break;
        case 'peer-left':
            onPeerLeft(m);
            break;
        case 'offer':
            handleOffer(m);
            break;
        case 'answer':
            handleAnswer(m);
            break;
        case 'ice-candidate':
            handleIce(m);
            break;
        case 'sync':
            handleSync(m);
            break;
    }
}

function onJoined(m) {
    $('connect').classList.add('hidden');
    $('main').classList.remove('hidden');
    showStatus('✅ Комната ' + room, 'ok');
    setTimeout(() => $('st').classList.add('hidden'), 2000);

    if (m.peers) {
        m.peers.forEach(p => { if (p !== myName) addPeer(p); });
    }

    // Если мы не хост и уже есть кто-то — инициализируем WebRTC
    if (!isHost && m.peers && m.peers.length > 1) {
        initRTC(false);
    }

    toast(isHost ? '🏠 Комната: ' + room : '✅ Подключено!');
}

function onPeerJoined(m) {
    toast('🎉 ' + m.name + ' подключился');
    addPeer(m.name);
    if (isHost) initRTC(true);
}

function onPeerLeft(m) {
    toast('👋 ' + m.name + ' вышел');
    document.querySelectorAll('.peer').forEach(el => {
        if (el.dataset.name === m.name) el.remove();
    });
}

// ==================== PEER ИНДИКАТОРЫ ====================
function addPeer(name) {
    if (document.querySelector('.peer[data-name="' + name + '"]')) return;
    const el = document.createElement('div');
    el.className = 'peer';
    el.dataset.name = name;
    el.innerHTML = '<span>' + name + '</span><div class="pv"><div class="pvf"></div></div>';
    $('peers').appendChild(el);
}

// ==================== WEBRTC ====================
async function initRTC(isInitiator) {
    if (pc) return;

    const config = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    };

    pc = new RTCPeerConnection(config);

    // DataChannel для синхронизации
    if (isInitiator) {
        dc = pc.createDataChannel('sync', { ordered: true });
        setupDC();
    } else {
        pc.ondatachannel = (e) => {
            dc = e.channel;
            setupDC();
        };
    }

    // Получаем микрофон
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,      // ВАЖНО: не глушить фильм
                noiseSuppression: true,
                autoGainControl: false,
                sampleRate: 48000
            },
            video: false
        });

        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
        setupAudioMixing();

    } catch (err) {
        toast('⚠️ Разрешите доступ к микрофону');
        console.error('Mic error:', err);
    }

    // Удалённый поток (голос собеседника)
    pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play().catch(() => {});
        if (voiceGain) audio.volume = parseFloat($('av').textContent) / 100;
    };

    // ICE
    pc.onicecandidate = (e) => {
        if (e.candidate && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: e.candidate
            }));
        }
    };

    pc.onconnectionstatechange = () => {
        console.log('WebRTC state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
            toast('🎤 Голосовая связь активна');
        }
    };

    // Offer
    if (isInitiator) {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
        } catch (e) {
            console.error('Offer error:', e);
        }
    }
}

function setupDC() {
    dc.onopen = () => {
        console.log('DataChannel открыт');
        startSyncLoop();
    };
    dc.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        applySync(msg);
    };
    dc.onerror = (e) => console.error('DC error:', e);
}

// ==================== АУДИО МИКШИРОВАНИЕ ====================
function setupAudioMixing() {
    if (!localStream) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    // Голос
    const source = audioCtx.createMediaStreamSource(localStream);
    voiceGain = audioCtx.createGain();
    voiceGain.gain.value = 0.8;

    // Фильтр для голоса
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1;

    source.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(masterGain);
}

function setupVideoAudio(video) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (!masterGain) {
            masterGain = audioCtx.createGain();
            masterGain.connect(audioCtx.destination);
        }
    }

    try {
        const source = audioCtx.createMediaElementSource(video);
        videoGain = audioCtx.createGain();
        videoGain.gain.value = 0.6;

        source.connect(videoGain);
        videoGain.connect(masterGain);

        video.muted = true; // Отключаем стандартный выход
    } catch (e) {
        // Fallback
        video.volume = 0.6;
    }
}

// ==================== СИГНАЛИНГ ====================
async function handleOffer(m) {
    if (!pc) initRTC(false);
    await pc.setRemoteDescription(m.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
}

async function handleAnswer(m) {
    await pc.setRemoteDescription(m.sdp);
}

async function handleIce(m) {
    if (pc && m.candidate) {
        await pc.addIceCandidate(m.candidate);
    }
}

// ==================== ВИДЕО ====================
function load() {
    const url = $('vu').value.trim();
    if (!url) return;

    const video = $('vid');
    const ph = $('placeholder');

    // Проверяем прямую ссылку
    if (url.match(/\\.(mp4|webm|m3u8|ogg)($|\\?)/i)) {
        video.src = url;
        video.load();
        setupVideoAudio(video);
        video.style.display = 'block';
        ph.style.display = 'none';
        toast('✅ Видео загружено');

        // Синхронизируем
        if (dc && dc.readyState === 'open') {
            dc.send(JSON.stringify({ type: 'load', url: url }));
        }
    } else {
        toast('❌ Только прямые ссылки MP4/WebM/HLS');
    }

    tu(); // скрыть панель
}

function tp() {
    const video = $('vid');
    const btn = $('pb');

    if (video.paused) {
        video.play().then(() => {
            isPlaying = true;
            btn.textContent = '⏸';
            sendSync('play', video.currentTime);
        }).catch(() => {
            toast('⚠️ Нажмите на видео для начала');
        });
    } else {
        video.pause();
        isPlaying = false;
        btn.textContent = '▶️';
        sendSync('pause', video.currentTime);
    }
}

function sk(e) {
    const video = $('vid');
    const rect = e.target.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const time = pct * video.duration;
    video.currentTime = time;
    sendSync('seek', time);
}

function sendSync(type, time) {
    const msg = JSON.stringify({ type, time });
    if (dc && dc.readyState === 'open') {
        dc.send(msg);
    } else if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'sync', stype: type, time }));
    }
}

function startSyncLoop() {
    syncTimer = setInterval(() => {
        const video = $('vid');
        if (isPlaying && video.duration) {
            sendSync('sync', video.currentTime);
        }
    }, 5000);
}

function handleSync(m) {
    // От сервера через WebSocket
    if (m.stype) {
        applySync({ type: m.stype, time: m.time });
    }
}

function applySync(m) {
    const video = $('vid');
    if (!video.duration) return;

    switch (m.type) {
        case 'play':
            video.currentTime = m.time;
            video.play().catch(() => {});
            isPlaying = true;
            $('pb').textContent = '⏸';
            break;
        case 'pause':
            video.pause();
            video.currentTime = m.time;
            isPlaying = false;
            $('pb').textContent = '▶️';
            break;
        case 'seek':
            video.currentTime = m.time;
            break;
        case 'load':
            $('vu').value = m.url;
            load();
            break;
        case 'sync':
            // Корректировка времени
            const diff = Math.abs(video.currentTime - m.time);
            if (diff > 1) {
                video.currentTime = m.time;
            }
            break;
    }
}

// ==================== UI ====================
function tu() { $('url-bar').classList.toggle('show'); }

async function tmic() {
    const btn = $('mb');

    if (!localStream) {
        // Первое включение
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false }
            });
            if (pc) {
                localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
            }
            setupAudioMixing();
            isMicOn = true;
            btn.classList.add('on');
            toast('🎤 Микрофон включён');
        } catch (e) {
            toast('❌ Нет доступа к микрофону');
        }
    } else {
        // Переключение
        isMicOn = !isMicOn;
        localStream.getAudioTracks().forEach(t => t.enabled = isMicOn);
        btn.classList.toggle('on', isMicOn);
        toast(isMicOn ? '🎤 Микрофон включён' : '🔇 Микрофон выключен');
    }
}

function ta() { $('audio-set').classList.toggle('show'); }

function tf() {
    const el = $('video-box');
    if (!document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

function svv(v) {
    const val = v / 100;
    $('vv').textContent = v + '%';
    if (videoGain) videoGain.gain.value = val;
    else $('vid').volume = val;
}

function sav(v) {
    const val = v / 100;
    $('av').textContent = v + '%';
    if (voiceGain) voiceGain.gain.value = val;
}

// ==================== ПРОГРЕСС ====================
setInterval(() => {
    const video = $('vid');
    if (video.duration) {
        $('pf').style.width = (video.currentTime / video.duration * 100) + '%';
        $('tm').textContent = fmtTime(video.currentTime) + ' / ' + fmtTime(video.duration);
    }
}, 100);

// ==================== АВТО-СКРЫТИЕ UI ====================
let hideTimer;
function resetHide() {
    document.body.classList.remove('hid');
    clearTimeout(hideTimer);
    if (isPlaying) {
        hideTimer = setTimeout(() => document.body.classList.add('hid'), 4000);
    }
}
document.addEventListener('click', resetHide);
document.addEventListener('touchstart', resetHide);

// ==================== СОБЫТИЯ ВИДЕО ====================
$('vid').addEventListener('play', () => { isPlaying = true; $('pb').textContent = '⏸'; });
$('vid').addEventListener('pause', () => { isPlaying = false; $('pb').textContent = '▶️'; });
$('vid').addEventListener('ended', () => { isPlaying = false; $('pb').textContent = '▶️'; });

// ==================== WAKE LOCK ====================
if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(() => {});
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            navigator.wakeLock.request('screen').catch(() => {});
        }
    });
}

// ==================== PWA ====================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('data:text/javascript,').catch(() => {});
}
</script>
</body>
</html>`;

fs.writeFileSync('public/index.html', htmlContent);
app.use(express.static('public'));

// WebSocket сервер
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map();

wss.on('connection', (ws) => {
    let currentRoom = null;
    let userName = '';

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            switch (msg.type) {
                case 'join':
                    currentRoom = msg.room;
                    userName = msg.name || 'Anonymous';

                    if (!rooms.has(currentRoom)) {
                        rooms.set(currentRoom, new Map());
                    }

                    const room = rooms.get(currentRoom);
                    room.set(ws, userName);

                    // Отправляем список участников
                    const peers = Array.from(room.values());
                    ws.send(JSON.stringify({
                        type: 'joined',
                        peers: peers,
                        room: currentRoom
                    }));

                    // Уведомляем других
                    broadcast(currentRoom, {
                        type: 'peer-joined',
                        name: userName
                    }, ws);
                    break;

                case 'offer':
                case 'answer':
                case 'ice-candidate':
                case 'sync':
                    broadcast(currentRoom, msg, ws);
                    break;
            }
        } catch (e) {
            console.error('WS error:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);
            broadcast(currentRoom, {
                type: 'peer-left',
                name: userName
            }, null);

            if (rooms.get(currentRoom).size === 0) {
                rooms.delete(currentRoom);
            }
        }
    });
});

function broadcast(roomId, msg, excludeWs) {
    if (!rooms.has(roomId)) return;
    rooms.get(roomId).forEach((name, ws) => {
        if (ws !== excludeWs && ws.readyState === 1) {
            try {
                ws.send(JSON.stringify(msg));
            } catch (e) {}
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('CineSync server running on port ' + PORT);
});
