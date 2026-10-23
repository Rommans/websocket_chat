const http = require('http');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
});

const rooms = new Map();

const FILE_MAX_BYTES = 10 * 1024 * 1024;
// A 10 MB file is ~13.4 MB as base64, plus the JSON envelope.
const PAYLOAD_MAX_BYTES = 15 * 1024 * 1024;
const FILE_MIME_MAX_LENGTH = 100;
const ROOM_MESSAGES_LIMIT = 500;
const HEARTBEAT_INTERVAL = 30000;
// How long a disconnected user stays "online" so a reconnect does not post "left"/"joined". A tab that closes
// cleanly (closed, reloaded) only needs to cover a reload. A dropped connection gets longer: a background tab
// in Chrome fires its reconnect timer only once a minute, after the heartbeat has reaped the old socket.
const CLEAN_LEAVE_GRACE_PERIOD = 5000;
const DROPPED_LEAVE_GRACE_PERIOD = 90000;
// 1005 is what the server sees when the browser calls close() without a code.
const CLEAN_CLOSE_CODES = new Set([1000, 1001, 1005]);
const SESSION_KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
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

const wss = new WebSocket.Server({ server, maxPayload: PAYLOAD_MAX_BYTES });

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeText = (value, maxLength) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().slice(0, maxLength);
};

const normalizeUsername = value => normalizeText(value, USERNAME_MAX_LENGTH).replace(/\s+/g, ' ');

const normalizeMessage = value => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim();
};

const normalizeRoomId = value => {
    const room = normalizeText(value, ROOM_MAX_LENGTH)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');

    return room || DEFAULT_ROOM;
};

const normalizeSessionKey = value => typeof value === 'string' && SESSION_KEY_PATTERN.test(value) ? value : null;

// sessions: secret per-tab key -> { user, sockets, leaveTimer }. Lets one person keep their identity across
// reconnects and overlapping connections (a new socket can join before the server notices the old one is dead).
const getRoom = roomId => {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            clients: new Map(),
            messages: new Map(),
            sessions: new Map()
        });
    }

    return rooms.get(roomId);
};

const deleteRoomIfEmpty = (roomId, room) => {
    if (!room.clients.size && !room.sessions.size && rooms.get(roomId) === room) {
        rooms.delete(roomId);
    }
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
        preview: normalizeText(message.preview, REPLY_PREVIEW_MAX_LENGTH),
        reactions: new Map()
    });

    // Map keeps insertion order, so the first key is the oldest message.
    if (room.messages.size > ROOM_MESSAGES_LIMIT) {
        room.messages.delete(room.messages.keys().next().value);
    }
};

// One entry per person: a user with two sockets, or one waiting out the leave grace period, is listed once.
const getOnlineUsers = room => {
    const users = new Map();

    room.sessions.forEach(session => users.set(session.user.id, session.user));
    room.clients.forEach(user => users.set(user.id, user));

    return Array.from(users.values(), user => ({
        id: user.id,
        username: user.username
    }));
};

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
    const users = getOnlineUsers(room);

    broadcast(room, {
        type: 'presence',
        room: roomId,
        online: users.length,
        users
    });
};

const announceLeave = (roomId, room, user) => {
    broadcast(room, {
        type: 'system',
        message: `${user.username} left`,
        date: new Date().toISOString()
    });
    broadcastPresence(roomId, room);
    deleteRoomIfEmpty(roomId, room);
};

const leaveRoom = (ws, gracePeriod = CLEAN_LEAVE_GRACE_PERIOD) => {
    const room = getClientRoom(ws);
    const roomId = ws.roomId;
    const sessionKey = ws.sessionKey;

    if (!room || !roomId) {
        return;
    }

    const user = room.clients.get(ws);
    const session = sessionKey ? room.sessions.get(sessionKey) : null;
    room.clients.delete(ws);
    ws.roomId = null;

    if (!session) {
        if (user) {
            announceLeave(roomId, room, user);
        } else {
            deleteRoomIfEmpty(roomId, room);
        }

        return;
    }

    session.sockets.delete(ws);

    // Another connection of the same tab is still here (e.g. the old socket of a reconnect was just reaped).
    if (session.sockets.size) {
        return;
    }

    session.leaveTimer = setTimeout(() => {
        room.sessions.delete(sessionKey);
        announceLeave(roomId, room, session.user);
    }, gracePeriod);
};

const handleJoin = (ws, payload) => {
    const username = normalizeUsername(payload.username) || 'Anonymous';
    const roomId = normalizeRoomId(payload.room);
    const sessionKey = normalizeSessionKey(payload.session);

    if (ws.roomId && ws.roomId !== roomId) {
        leaveRoom(ws);
    }

    const room = getRoom(roomId);
    const session = sessionKey ? room.sessions.get(sessionKey) : null;
    const isReturning = Boolean(session) || room.clients.has(ws);
    const user = session?.user || room.clients.get(ws) || { id: createId(), username };

    user.username = username;
    ws.roomId = roomId;
    ws.sessionKey = sessionKey;
    room.clients.set(ws, user);

    if (sessionKey) {
        const activeSession = session || { user, sockets: new Set(), leaveTimer: null };

        clearTimeout(activeSession.leaveTimer);
        activeSession.leaveTimer = null;
        activeSession.sockets.add(ws);
        room.sessions.set(sessionKey, activeSession);
    }

    const users = getOnlineUsers(room);

    send(ws, {
        type: 'ready',
        user,
        room: roomId,
        online: users.length,
        users
    });

    if (!isReturning) {
        broadcast(room, {
            type: 'system',
            message: `${username} joined #${roomId}`,
            date: new Date().toISOString()
        }, ws);
    }

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

// Returns the decoded byte size of a base64 data URL, or 0 when it is malformed.
const getDataUrlSize = dataUrl => {
    if (typeof dataUrl !== 'string') {
        return 0;
    }

    const commaIndex = dataUrl.indexOf(',');
    const header = dataUrl.slice(0, commaIndex);
    const base64 = dataUrl.slice(commaIndex + 1);

    if (commaIndex === -1 || !header.startsWith('data:') || !header.endsWith(';base64')) {
        return 0;
    }

    if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
        return 0;
    }

    const padding = base64.length - base64.replace(/=+$/, '').length;

    return base64.length / 4 * 3 - padding;
};

// Measures the file from its data instead of trusting the size the client claims; returns 0 when invalid.
const getValidFileSize = file => {
    if (!file || typeof file !== 'object') {
        return 0;
    }

    if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 120) {
        return 0;
    }

    if (typeof file.mime !== 'string' || file.mime.length > FILE_MIME_MAX_LENGTH) {
        return 0;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    const hasAllowedType = ALLOWED_FILE_TYPES.has(file.mime);
    const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.has(extension);

    if (!hasAllowedType && !hasAllowedExtension) {
        return 0;
    }

    const size = getDataUrlSize(file.dataUrl);

    return size <= FILE_MAX_BYTES ? size : 0;
};

const handleFileMessage = (ws, payload) => {
    const room = getClientRoom(ws);
    const user = room?.clients.get(ws);
    const size = getValidFileSize(payload.file);

    if (!room || !user || !size) {
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
            size,
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

    // Without a listener, a protocol error (e.g. a frame above maxPayload) crashes the whole server.
    // ws closes the connection itself afterwards.
    ws.on('error', error => {
        console.warn(`WebSocket error: ${error.message}`);
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

    ws.on('close', code => {
        leaveRoom(ws, CLEAN_CLOSE_CODES.has(code) ? CLEAN_LEAVE_GRACE_PERIOD : DROPPED_LEAVE_GRACE_PERIOD);
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

server.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}`);
});
