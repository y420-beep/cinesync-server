const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = createServer(app);

app.use(express.static('public'));

const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map();

wss.on('connection', (ws) => {
    let currentRoom = null;
    let userName = '';

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'join') {
                currentRoom = msg.room;
                userName = msg.name || 'User';
                if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Map());
                const room = rooms.get(currentRoom);
                room.set(ws, userName);
                const peers = Array.from(room.values());
                ws.send(JSON.stringify({ type: 'joined', peers }));
                broadcast(currentRoom, { type: 'peer-joined', name: userName }, ws);
            } else if (['offer','answer','ice-candidate','sync'].includes(msg.type)) {
                broadcast(currentRoom, msg, ws);
            }
        } catch (e) { console.error('WS error:', e); }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);
            broadcast(currentRoom, { type: 'peer-left', name: userName }, null);
            if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
        }
    });
});

function broadcast(roomId, msg, exclude) {
    if (!rooms.has(roomId)) return;
    rooms.get(roomId).forEach((name, ws) => {
        if (ws !== exclude && ws.readyState === 1) {
            try { ws.send(JSON.stringify(msg)); } catch (e) {}
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('CineSync on port ' + PORT);
});
