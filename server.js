const express = require('express');
const WebSocket = require('ws');
const { AccessToken } = require('livekit-server-sdk');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Конфигурация LiveKit (из переменных окружения или значения по умолчанию)
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://webrtc-if6vxkit.livekit.cloud';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APIFReDGuTuWGSa';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'UUX8aBQSAVFdxqgi9ufeX036UyEjPTcfvTRyEnuuoGdA';

// Статика
app.use(express.static(path.join(__dirname, 'public')));

// Создаём HTTP сервер
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
});

// Обработка ошибок сервера
server.on('error', (err) => {
  console.error('❌ Ошибка HTTP:', err);
});

// WebSocket сервер
const wss = new WebSocket.Server({ server, path: '/ws' });

const rooms = new Map();
const clients = new Map();

function generateToken(room, participant) {
  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participant,
      name: participant,
    });
    at.addGrant({ roomJoin: true, room });
    return at.toJwt();
  } catch (err) {
    console.error('Ошибка генерации токена:', err);
    return null;
  }
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentName = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Получено:', data.type);

      if (data.type === 'join') {
        const { room, name } = data;
        currentRoom = room;
        currentName = name;

        clients.set(ws, { room, name });

        if (!rooms.has(room)) rooms.set(room, new Set());
        const participants = rooms.get(room);
        participants.add(name);

        const peers = Array.from(participants).filter(p => p !== name);
        ws.send(JSON.stringify({ type: 'joined', room, peers }));

        const token = generateToken(room, name);
        if (token) {
          ws.send(JSON.stringify({ type: 'livekit-token', token }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Token generation failed' }));
        }

        broadcast(room, name, { type: 'peer-joined', name });
      } else if (data.type === 'sync') {
        broadcast(currentRoom, currentName, data);
      } else {
        console.warn('Неизвестный тип:', data.type);
      }
    } catch (err) {
      console.error('Ошибка обработки сообщения:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentName) {
      const participants = rooms.get(currentRoom);
      if (participants) {
        participants.delete(currentName);
        if (participants.size === 0) {
          rooms.delete(currentRoom);
        } else {
          broadcast(currentRoom, currentName, { type: 'peer-left', name: currentName });
        }
      }
      clients.delete(ws);
    }
  });

  ws.on('error', (err) => console.error('WebSocket ошибка:', err));
});

function broadcast(room, sender, message) {
  const participants = rooms.get(room);
  if (!participants) return;

  for (const [client, info] of clients) {
    if (client.readyState === WebSocket.OPEN && info.room === room && info.name !== sender) {
      client.send(JSON.stringify(message));
    }
  }
}

// Глобальный перехват ошибок, чтобы сервер не падал
process.on('uncaughtException', (err) => {
  console.error('💥 Неперехваченное исключение:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Необработанное отклонение:', reason);
});

console.log('🚀 Сервер инициализирован');
