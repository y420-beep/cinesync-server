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
let pendingPlay = false; // Ожидаем ручного запуска

// ==================== УТИЛИТЫ ====================
function $(id) { return document.getElementById(id); }

function toast(msg, duration = 3000) {
    const c = $('toast-c');
    // Удаляем старые тосты чтобы не дублировались
    while (c.children.length > 2) c.removeChild(c.firstChild);
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
        toast('❌ Код — 6 символов');
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
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    pc = new RTCPeerConnection(config);

    if (isInitiator) {
        dc = pc.createDataChannel('sync', { ordered: true });
        setupDC();
    } else {
        pc.ondatachannel = (e) => {
            dc = e.channel;
            setupDC();
        };
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
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
    }

    pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play().catch(() => {});
    };

    pc.onicecandidate = (e) => {
        if (e.candidate && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
        }
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
            toast('🎤 Голосовая связь активна');
        }
    };

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
}

// ==================== АУДИО МИКШИРОВАНИЕ ====================
function setupAudioMixing() {
    if (!localStream) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    const source = audioCtx.createMediaStreamSource(localStream);
    voiceGain = audioCtx.createGain();
    voiceGain.gain.value = 0.8;

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
        video.muted = true;
    } catch (e) {
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

    if (url.match(/\.(mp4|webm|m3u8|ogg)($|\?)/i)) {
        video.src = url;
        video.load();
        setupVideoAudio(video);
        video.style.display = 'block';
        ph.style.display = 'none';
        toast('✅ Видео загружено. Нажмите ▶️');
    } else {
        toast('❌ Только прямые ссылки MP4/WebM/HLS');
    }

    tu();
}

// ==================== PLAY/PAUSE — РУЧНАЯ СИНХРОНИЗАЦИЯ ====================
function tp() {
    const video = $('vid');
    const btn = $('pb');

    // ВАЖНО: play() вызывается напрямую в обработчике клика
    if (video.paused) {
        const promise = video.play();
        
        if (promise !== undefined) {
            promise.then(() => {
                isPlaying = true;
                btn.textContent = '⏸';
                // Отправляем сигнал другому
                sendSync('play', video.currentTime);
                toast('▶️ Воспроизведение');
            }).catch(err => {
                // iOS заблокировал
                toast('⚠️ Нажмите на видео');
                console.log('Play blocked by iOS:', err);
            });
        }
    } else {
        video.pause();
        isPlaying = false;
        btn.textContent = '▶️';
        sendSync('pause', video.currentTime);
        toast('⏸ Пауза');
    }
}

// КЛИК НА ВИДЕО — для iOS разблокировки
$('vid').addEventListener('click', function() {
    if (this.paused) {
        this.play().then(() => {
            isPlaying = true;
            $('pb').textContent = '⏸';
            sendSync('play', this.currentTime);
        }).catch(() => {});
    } else {
        this.pause();
        isPlaying = false;
        $('pb').textContent = '▶️';
        sendSync('pause', this.currentTime);
    }
});

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
    if (m.stype) {
        applySync({ type: m.stype, time: m.time });
    }
}

function applySync(m) {
    const video = $('vid');
    if (!video.duration) return;

    switch (m.type) {
        case 'play':
            // iOS: НЕ запускаем автоматически, показываем кнопку
            video.currentTime = m.time;
            pendingPlay = true;
            toast('▶️ Собеседник нажал Play! Нажмите ▶️');
            $('pb').textContent = '▶️';
            // Пытаемся запустить (может не сработать на iOS)
            video.play().then(() => {
                isPlaying = true;
                $('pb').textContent = '⏸';
                pendingPlay = false;
            }).catch(() => {
                // iOS заблокировал — ждём ручного нажатия
            });
            break;
            
        case 'pause':
            video.pause();
            video.currentTime = m.time;
            isPlaying = false;
            $('pb').textContent = '▶️';
            pendingPlay = false;
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
            if (diff > 1 && !video.paused) {
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

// ==================== AUDIO CONTEXT UNLOCK ====================
document.addEventListener('click', function unlockAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });
