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

// Раздаём статику (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});

// WebSocket сервер для сигнализации
const wss = new WebSocket.Server({ server, path: '/ws' });

// Хранилище комнат: roomId -> Set(участников)
const rooms = new Map();
// Хранилище соответствия WebSocket -> комната/имя
const clients = new Map(); // ws -> { room, name }

// Генерация токена LiveKit
function generateToken(room, participantName) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantName,
    name: participantName,
  });
  at.addGrant({ roomJoin: true, room });
  return at.toJwt();
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentName = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join': {
          const { room, name } = data;
          currentRoom = room;
          currentName = name;

          // Сохраняем клиента
          clients.set(ws, { room, name });

          // Добавляем в комнату
          if (!rooms.has(room)) rooms.set(room, new Set());
          const participants = rooms.get(room);
          participants.add(name);

          // Отправляем новому участнику список уже присутствующих
          const peers = Array.from(participants).filter(p => p !== name);
          ws.send(JSON.stringify({
            type: 'joined',
            room,
            peers,
          }));

          // Генерируем и отправляем токен LiveKit
          const token = generateToken(room, name);
          ws.send(JSON.stringify({
            type: 'livekit-token',
            token,
          }));

          // Уведомляем всех остальных о новом участнике
          broadcast(room, name, {
            type: 'peer-joined',
            name,
          });

          break;
        }

        case 'sync':
          // Пересылаем синхронизацию всем в комнате, кроме отправителя
          broadcast(currentRoom, currentName, data);
          break;

        // Старые типы WebRTC (игнорируем)
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Можно просто проигнорировать
          break;

        default:
          console.warn('Неизвестный тип сообщения:', data.type);
      }
    } catch (err) {
      console.error('Ошибка обработки сообщения WebSocket:', err);
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
          broadcast(currentRoom, currentName, {
            type: 'peer-left',
            name: currentName,
          });
        }
      }
      clients.delete(ws);
    }
  });
});

// Функция широковещательной рассылки (исключая отправителя)
function broadcast(room, sender, message) {
  const participants = rooms.get(room);
  if (!participants) return;

  for (const [client, info] of clients) {
    if (client.readyState === WebSocket.OPEN && info.room === room && info.name !== sender) {
      client.send(JSON.stringify(message));
    }
  }
}
