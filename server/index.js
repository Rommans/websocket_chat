const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();

const FILE_MAX_BYTES = 10 * 1024 * 1024;
const HEARTBEAT_INTERVAL = 30000;
const MESSAGE_MAX_LENGTH = 500;
const REPLY_PREVIEW_MAX_LENGTH = 90;
const ROOM_MAX_LENGTH = 32;
const USERNAME_MAX_LENGTH = 24;
const DEFAULT_ROOM = 'general';
const ALLOWED_REACTIONS = new Set(['like', 'heart', 'laugh', 'fire']);
const ALLOWED_FILE_TYPES = new Set([
    'application/gzip',
    'application/json',
    'application/msword',
    'application/octet-stream',
    'application/pdf',
    'application/rtf',
    'application/vnd.ms-powerpoint',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.spreadsheet-template',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/x-iwork-numbers-sffnumbers',
    'application/x-tar',
    'application/xml',
    'application/zip',
    'audio/aac',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/css',
    'text/csv',
    'text/html',
    'text/markdown',
    'text/plain',
    'text/tab-separated-values',
    'text/xml',
    'video/mpeg',
    'video/mp4',
    'video/quicktime',
    'video/webm'
]);
const ALLOWED_FILE_EXTENSIONS = new Set([
    'aac',
    'css',
    'csv',
    'doc',
    'docx',
    'gz',
    'html',
    'jpeg',
    'jpg',
    'js',
    'json',
    'log',
    'md',
    'mp3',
    'odp',
    'odt',
    'numbers',
    'ods',
    'ogg',
    'ots',
    'pdf',
    'ppt',
    'pptx',
    'rtf',
    'tar',
    'tsv',
    'txt',
    'wav',
    'webm',
    'xls',
    'xlsx',
    'xml',
    'yaml',
    'yml',
    'zip'
]);

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeText = (value, maxLength) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().slice(0, maxLength);
};

const normalizeUsername = value => normalizeText(value, USERNAME_MAX_LENGTH).replace(/\s+/g, ' ');

const normalizeMessage = value => normalizeText(value, MESSAGE_MAX_LENGTH);

const normalizeRoomId = value => {
    const room = normalizeText(value, ROOM_MAX_LENGTH)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');

    return room || DEFAULT_ROOM;
};

const getRoom = roomId => {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            clients: new Map(),
            messages: new Map()
        });
    }

    return rooms.get(roomId);
};

const getClientRoom = ws => ws.roomId ? rooms.get(ws.roomId) : null;

const createReplyPreview = message => {
    if (!message || typeof message !== 'object') {
        return null;
    }

    return {
        id: message.id,
        username: message.user.username,
        preview: normalizeText(message.preview, REPLY_PREVIEW_MAX_LENGTH),
        kind: message.kind
    };
};

const getReplyTo = (room, replyId) => createReplyPreview(room.messages.get(replyId));

const serializeReactions = reactions => Object.fromEntries(
    Array.from(reactions.entries()).map(([reaction, users]) => [reaction, users.size])
);

const rememberMessage = (room, message) => {
    room.messages.set(message.id, {
        ...message,
        reactions: new Map()
    });
};

const getOnlineUsers = room => Array.from(room.clients.values()).map(client => ({
    id: client.id,
    username: client.username
}));

const send = (ws, payload) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
};

const broadcast = (room, payload, exceptWs) => {
    room.clients.forEach((user, client) => {
        if (client !== exceptWs) {
            send(client, payload);
        }
    });
};

const broadcastPresence = (roomId, room) => {
    broadcast(room, {
        type: 'presence',
        room: roomId,
        online: room.clients.size,
        users: getOnlineUsers(room)
    });
};

const leaveRoom = ws => {
    const room = getClientRoom(ws);
    const roomId = ws.roomId;

    if (!room || !roomId) {
        return;
    }

    const user = room.clients.get(ws);
    room.clients.delete(ws);
    ws.roomId = null;

    if (user) {
        broadcast(room, {
            type: 'system',
            message: `${user.username} left`,
            date: new Date().toISOString()
        });
    }

    broadcastPresence(roomId, room);

    if (!room.clients.size) {
        rooms.delete(roomId);
    }
};

const handleJoin = (ws, payload) => {
    const username = normalizeUsername(payload.username) || 'Anonymous';
    const roomId = normalizeRoomId(payload.room);
    const room = getRoom(roomId);
    const existing = room.clients.get(ws);
    const user = existing || { id: createId(), username };

    if (ws.roomId && ws.roomId !== roomId) {
        leaveRoom(ws);
    }

    user.username = username;
    ws.roomId = roomId;
    room.clients.set(ws, user);

    send(ws, {
        type: 'ready',
        user,
        room: roomId,
        online: room.clients.size,
        users: getOnlineUsers(room)
    });

    broadcast(room, {
        type: 'system',
        message: `${username} joined #${roomId}`,
        date: new Date().toISOString()
    }, ws);

    broadcastPresence(roomId, room);
};

const handleChatMessage = (ws, payload) => {
    const room = getClientRoom(ws);
    const user = room?.clients.get(ws);
    const message = normalizeMessage(payload.message);

    if (!room || !user || !message) {
        return;
    }

    const chatMessage = {
        type: 'message',
        id: createId(),
        user,
        message,
        replyTo: getReplyTo(room, payload.replyTo),
        reactions: {},
        date: new Date().toISOString()
    };

    rememberMessage(room, {
        id: chatMessage.id,
        kind: 'message',
        user,
        preview: message
    });
    broadcast(room, chatMessage);
};

const handleTyping = (ws, payload) => {
    const room = getClientRoom(ws);
    const user = room?.clients.get(ws);

    if (!room || !user) {
        return;
    }

    broadcast(room, {
        type: 'typing',
        user,
        isTyping: Boolean(payload.isTyping)
    }, ws);
};

const isValidFile = file => {
    if (!file || typeof file !== 'object') {
        return false;
    }

    if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 120) {
        return false;
    }

    if (!Number.isInteger(file.size) || file.size <= 0 || file.size > FILE_MAX_BYTES) {
        return false;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    const hasAllowedType = ALLOWED_FILE_TYPES.has(file.mime);
    const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.has(extension);

    if (!hasAllowedType && !hasAllowedExtension) {
        return false;
    }

    if (typeof file.dataUrl !== 'string' || !file.dataUrl.startsWith('data:') || !file.dataUrl.includes(';base64,')) {
        return false;
    }

    return true;
};

const handleFileMessage = (ws, payload) => {
    const room = getClientRoom(ws);
    const user = room?.clients.get(ws);

    if (!room || !user || !isValidFile(payload.file)) {
        send(ws, {
            type: 'error',
            message: 'File should be an allowed type and smaller than 10 MB.'
        });
        return;
    }

    const fileMessage = {
        type: 'file',
        id: createId(),
        user,
        file: {
            name: normalizeText(payload.file.name, 120),
            size: payload.file.size,
            mime: payload.file.mime,
            dataUrl: payload.file.dataUrl
        },
        replyTo: getReplyTo(room, payload.replyTo),
        reactions: {},
        date: new Date().toISOString()
    };

    rememberMessage(room, {
        id: fileMessage.id,
        kind: 'file',
        user,
        preview: fileMessage.file.name
    });
    broadcast(room, fileMessage);
};

const handleReaction = (ws, payload) => {
    const room = getClientRoom(ws);
    const user = room?.clients.get(ws);
    const message = room?.messages.get(payload.messageId);

    if (!room || !user || !message || !ALLOWED_REACTIONS.has(payload.reaction)) {
        return;
    }

    const existing = message.reactions.get(payload.reaction) || new Set();

    if (existing.has(user.id)) {
        existing.delete(user.id);
    } else {
        existing.add(user.id);
    }

    if (existing.size) {
        message.reactions.set(payload.reaction, existing);
    } else {
        message.reactions.delete(payload.reaction);
    }

    broadcast(room, {
        type: 'reaction',
        messageId: payload.messageId,
        reactions: serializeReactions(message.reactions)
    });
};

wss.on('connection', ws => {
    ws.isAlive = true;
    ws.roomId = null;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', rawMessage => {
        let payload;

        try {
            payload = JSON.parse(rawMessage);
        } catch (error) {
            send(ws, {
                type: 'error',
                message: 'Message should be valid JSON.'
            });
            return;
        }

        if (!payload || typeof payload.type !== 'string') {
            return;
        }

        if (payload.type === 'join') {
            handleJoin(ws, payload);
        }

        if (payload.type === 'message') {
            handleChatMessage(ws, payload);
        }

        if (payload.type === 'file') {
            handleFileMessage(ws, payload);
        }

        if (payload.type === 'reaction') {
            handleReaction(ws, payload);
        }

        if (payload.type === 'typing') {
            handleTyping(ws, payload);
        }
    });

    ws.on('close', () => {
        leaveRoom(ws);
    });
});

const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            ws.terminate();
            return;
        }

        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
    clearInterval(heartbeat);
});

console.log(`Server is running on port ${PORT}`);
