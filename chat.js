const REMOTE_WS_URL = 'wss://websocket-chat-s2s0.onrender.com';
const LOCAL_WS_URL = 'ws://localhost:8080';
const FILE_MAX_BYTES = 10 * 1024 * 1024;
// Keep in sync with the server's WebSocket maxPayload.
const PAYLOAD_MAX_BYTES = 15 * 1024 * 1024;
const IME_PROCESS_KEY_CODE = 229;
const SHORT_VIEWPORT_HEIGHT = 300;
const MESSAGE_COLLAPSED_HEIGHT = 220;
const SCROLL_THRESHOLD = 96;
const TYPING_IDLE_DELAY = 1100;
const RECONNECT_DELAY = 2500;
const LONG_PRESS_DELAY = 520;
const DEFAULT_ROOM = 'general';
const BASE_TITLE = document.title;
const NOTIFY_SETTINGS_KEY = 'ws-chat:notifications';
const SESSION_STORAGE_KEY = 'ws-chat:session';
const NOTIFICATION_PREVIEW_LENGTH = 120;
const NOTIFY_SOUND_COOLDOWN = 1500;
const NOTIFY_SOUND = { tones: [880, 1320], spacing: 0.12, length: 0.18, volume: 0.08 };
const VIEWER_MAX_SCALE = 5;
const VIEWER_CLICK_SCALE = 2.5;
const VIEWER_WHEEL_SPEED = 0.0015;
const VIEWER_DRAG_THRESHOLD = 4;
const MOBILE_LAYOUT_QUERY = window.matchMedia('(max-width: 760px), (max-height: 500px) and (pointer: coarse)');
const REACTIONS = [
    { id: 'like', label: 'Like', icon: '👍' },
    { id: 'heart', label: 'Love', icon: '❤️' },
    { id: 'laugh', label: 'Laugh', icon: '😂' },
    { id: 'fire', label: 'Fire', icon: '🔥' }
];
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

const elements = {
    attachButton: document.querySelector('.attach-btn'),
    chat: document.querySelector('#chat'),
    chatShell: document.querySelector('.chat-shell'),
    composer: document.querySelector('.composer'),
    connectionNotice: document.querySelector('#connectionNotice'),
    connectionPill: document.querySelector('.connection-pill'),
    connectionStatus: document.querySelector('#connectionStatus'),
    dropOverlay: document.querySelector('#dropOverlay'),
    emptyState: document.querySelector('.empty-state'),
    fileInput: document.querySelector('#fileInput'),
    message: document.querySelector('#message'),
    nameForm: document.querySelector('#nameForm'),
    nameModal: document.querySelector('#nameModal'),
    notifyDesktop: document.querySelector('#notifyDesktop'),
    notifyHint: document.querySelector('#notifyHint'),
    notifyMenu: document.querySelector('#notifyMenu'),
    notifySound: document.querySelector('#notifySound'),
    notifyToggle: document.querySelector('#notifyToggle'),
    onlineCount: document.querySelector('.online-count'),
    photoViewer: document.querySelector('#photoViewer'),
    viewerAuthor: document.querySelector('#viewerAuthor'),
    viewerClose: document.querySelector('#viewerClose'),
    viewerDownload: document.querySelector('#viewerDownload'),
    viewerImage: document.querySelector('#viewerImage'),
    viewerMeta: document.querySelector('#viewerMeta'),
    viewerNext: document.querySelector('#viewerNext'),
    viewerPrev: document.querySelector('#viewerPrev'),
    viewerStage: document.querySelector('#viewerStage'),
    cancelReply: document.querySelector('#cancelReply'),
    replyAuthor: document.querySelector('#replyAuthor'),
    replyBar: document.querySelector('#replyBar'),
    replyPreview: document.querySelector('#replyPreview'),
    roomName: document.querySelector('#roomName'),
    scrollToBottomButton: document.querySelector('#scrollToBottom'),
    sidebarToggle: document.querySelector('#sidebarToggle'),
    submitButton: document.querySelector('.submit-btn'),
    typingIndicator: document.querySelector('#typingIndicator'),
    username: document.querySelector('#username'),
    usersList: document.querySelector('#usersList')
};

const state = {
    audioContext: null,
    chatHeight: 0,
    connection: null,
    isTyping: false,
    lastNotification: null,
    lastSoundAt: 0,
    notify: { desktop: false, sound: false },
    reconnectTimer: null,
    typingTimer: null,
    typingTimers: new Map(),
    typingUsers: new Map(),
    messages: new Map(),
    replyTo: null,
    room: DEFAULT_ROOM,
    sessionKey: '',
    stickToBottom: true,
    touchActionTimer: null,
    unreadCount: 0,
    user: null,
    username: '',
    viewer: { current: null, scale: 1, x: 0, y: 0, pointer: null, returnFocus: null }
};

const getSocketUrl = () => {
    const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

    return isLocal ? LOCAL_WS_URL : REMOTE_WS_URL;
};

const getRoomId = () => {
    const params = new URLSearchParams(window.location.search);
    const room = (params.get('room') || DEFAULT_ROOM)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);

    return room || DEFAULT_ROOM;
};

const formatTime = dateValue => {
    const date = dateValue ? new Date(dateValue) : new Date();

    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

const createElement = (tagName, className, text) => {
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
};

const normalizeUsername = value => value.trim().replace(/\s+/g, ' ').slice(0, 24);

const normalizeMessage = value => value.trim();

const createLink = url => {
    const link = createElement('a', 'message-link', url);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    return link;
};

const createFormattedNode = (token, value) => {
    if (token === '**') {
        return createElement('strong', '', value);
    }

    if (token === '*') {
        return createElement('em', '', value);
    }

    if (token === '`') {
        return createElement('code', '', value);
    }

    return document.createTextNode(value);
};

const appendPlainTextWithLinks = (fragment, text) => {
    const linkPattern = /https:\/\/[^\s<>"']+/g;
    let lastIndex = 0;
    let match = linkPattern.exec(text);

    while (match) {
        if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        fragment.appendChild(createLink(match[0]));
        lastIndex = match.index + match[0].length;
        match = linkPattern.exec(text);
    }

    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
};

const appendFormattedChunk = (fragment, token, value) => {
    if (!value) {
        return;
    }

    if (!token) {
        appendPlainTextWithLinks(fragment, value);
        return;
    }

    fragment.appendChild(createFormattedNode(token, value));
};

const renderFormattedText = text => {
    const fragment = document.createDocumentFragment();
    const pattern = /(\*\*[^*\n][\s\S]*?\*\*)|(\*[^*\n][\s\S]*?\*)|(`[^`\n]+`)/g;
    let lastIndex = 0;
    let match = pattern.exec(text);

    while (match) {
        appendFormattedChunk(fragment, '', text.slice(lastIndex, match.index));

        const raw = match[0];
        const token = raw.startsWith('**') ? '**' : raw.startsWith('*') ? '*' : '`';
        const value = token === '**' ? raw.slice(2, -2) : raw.slice(1, -1);

        appendFormattedChunk(fragment, token, value);
        lastIndex = match.index + raw.length;
        match = pattern.exec(text);
    }

    appendFormattedChunk(fragment, '', text.slice(lastIndex));

    return fragment;
};

const getReplyPreview = item => {
    if (item.kind === 'file') {
        return item.file.name;
    }

    return item.message;
};

const rememberMessage = item => {
    state.messages.set(item.id, {
        ...item,
        preview: getReplyPreview(item)
    });
};

const renderReplyPreview = replyTo => {
    if (!replyTo) {
        return null;
    }

    const reply = createElement('button', 'reply-preview', '');
    const author = createElement('strong', '', replyTo.username);
    const preview = createElement('span', '', replyTo.preview);

    reply.type = 'button';
    reply.setAttribute('aria-label', `Reply to ${replyTo.username}`);
    reply.append(author, preview);
    reply.addEventListener('click', () => {
        document.querySelector(`[data-message-id="${replyTo.id}"]`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    });

    return reply;
};

const createAvatar = username => {
    const avatar = createElement('span', 'avatar', username.charAt(0).toUpperCase() || '?');
    avatar.style.setProperty('--avatar-color', getUserColor(username));

    return avatar;
};

const copyText = text => {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();

    return Promise.resolve();
};

// Goes through <img> + canvas: the CSP blocks fetch() of data: URLs, and clipboards only accept PNG images.
const imageToPngBlob = dataUrl => new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode image.')), 'image/png');
    };
    image.onerror = () => reject(new Error('Could not load image.'));
    image.src = dataUrl;
});

const copyImage = file => {
    if (!navigator.clipboard?.write || !window.ClipboardItem || !file.mime.startsWith('image/')) {
        return Promise.reject(new Error('Image clipboard is not available.'));
    }

    // Pass the blob as a promise so write() runs inside the click gesture, which Safari requires.
    return navigator.clipboard.write([
        new ClipboardItem({
            'image/png': imageToPngBlob(file.dataUrl)
        })
    ]);
};

const createCopyButton = ({ label = 'Copy message', onCopy }) => {
    const button = createElement('button', 'copy-btn', 'Copy');
    button.type = 'button';
    button.setAttribute('aria-label', label);

    button.addEventListener('click', async () => {
        const previousText = button.textContent;

        try {
            await onCopy();
            button.textContent = 'Copied';
            button.classList.add('copied');
            window.setTimeout(() => {
                button.textContent = previousText;
                button.classList.remove('copied');
            }, 1200);
        } catch (error) {
            button.textContent = 'Failed';
            window.setTimeout(() => {
                button.textContent = previousText;
            }, 1200);
        }
    });

    return button;
};

const setReplyTo = item => {
    state.replyTo = {
        id: item.id,
        username: item.user.username,
        preview: item.preview,
        kind: item.kind
    };

    elements.replyAuthor.textContent = state.replyTo.username;
    elements.replyPreview.textContent = state.replyTo.preview;
    elements.replyBar.hidden = false;
    elements.message.focus();
};

const clearReplyTo = () => {
    state.replyTo = null;
    elements.replyAuthor.textContent = '';
    elements.replyPreview.textContent = '';
    elements.replyBar.hidden = true;
};

const clearTypingState = () => {
    state.typingUsers.clear();
    state.typingTimers.forEach(timer => window.clearTimeout(timer));
    state.typingTimers.clear();
    renderTyping();
};

const isTouchMode = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

const closeOpenMessageActions = exceptBubble => {
    elements.chat.querySelectorAll('.message-bubble.actions-open').forEach(bubble => {
        if (bubble !== exceptBubble) {
            bubble.classList.remove('actions-open');
        }
    });
};

const openMessageActions = bubble => {
    if (!bubble) {
        return;
    }

    closeOpenMessageActions(bubble);
    bubble.classList.add('actions-open');
};

const bindTouchActions = bubble => {
    bubble.addEventListener('pointerdown', event => {
        if (!isTouchMode() || event.target.closest('button, a, input, textarea')) {
            return;
        }

        window.clearTimeout(state.touchActionTimer);
        state.touchActionTimer = window.setTimeout(() => {
            openMessageActions(bubble);
        }, LONG_PRESS_DELAY);
    });

    bubble.addEventListener('pointerup', event => {
        window.clearTimeout(state.touchActionTimer);

        if (isTouchMode() && !event.target.closest('button, a, input, textarea')) {
            openMessageActions(bubble);
        }
    });

    bubble.addEventListener('pointermove', () => {
        window.clearTimeout(state.touchActionTimer);
    });

    bubble.addEventListener('pointercancel', () => {
        window.clearTimeout(state.touchActionTimer);
    });
};

const createReplyButton = item => {
    const button = createElement('button', 'reply-btn', 'Reply');
    button.type = 'button';
    button.setAttribute('aria-label', 'Reply to message');
    button.addEventListener('click', () => setReplyTo(item));

    return button;
};

const createMessageActions = item => {
    const actions = createElement('div', 'message-actions');
    actions.appendChild(createReplyButton(item));

    return actions;
};

const updateReactionBarState = bar => {
    const reactedButtons = Array.from(bar.querySelectorAll('.has-reactions'));

    bar.classList.toggle('has-any-reactions', Boolean(reactedButtons.length));
    bar.querySelectorAll('.reaction-btn').forEach(button => {
        button.classList.remove('primary-reaction');
    });

    reactedButtons[0]?.classList.add('primary-reaction');
};

const renderReactionCount = (button, count) => {
    const counter = button.querySelector('.reaction-count');
    counter.textContent = count ? String(count) : '';
    button.classList.toggle('has-reactions', Boolean(count));

    const bar = button.closest('.reaction-bar');

    if (bar) {
        updateReactionBarState(bar);
    }
};

const createReactionBar = item => {
    const bar = createElement('div', 'reaction-bar');

    REACTIONS.forEach(reaction => {
        const button = createElement('button', 'reaction-btn', '');
        const icon = createElement('span', '', reaction.icon);
        const count = createElement('span', 'reaction-count', '');

        button.type = 'button';
        button.dataset.reaction = reaction.id;
        button.setAttribute('aria-label', reaction.label);
        button.append(icon, count);
        renderReactionCount(button, item.reactions?.[reaction.id] || 0);
        button.addEventListener('click', () => {
            sendPayload({
                type: 'reaction',
                messageId: item.id,
                reaction: reaction.id
            });
        });
        bar.appendChild(button);
    });

    updateReactionBarState(bar);

    return bar;
};

const updateReactionBar = (messageId, reactions) => {
    const row = document.querySelector(`[data-message-id="${messageId}"]`);

    if (!row) {
        return;
    }

    REACTIONS.forEach(reaction => {
        const button = row.querySelector(`[data-reaction="${reaction.id}"]`);

        if (button) {
            renderReactionCount(button, reactions[reaction.id] || 0);
        }
    });
};

const getUserColor = value => {
    const palette = ['#1f8a70', '#bf6f13', '#3959a8', '#b8325f', '#367a2f', '#8b5f21'];
    const seed = value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);

    return palette[seed % palette.length];
};

const sendPayload = payload => {
    if (!state.connection || state.connection.readyState !== WebSocket.OPEN) {
        return false;
    }

    const data = JSON.stringify(payload);

    // The server drops the connection on oversized frames. UTF-8 takes at most 3 bytes per UTF-16 unit,
    // so only long payloads need the exact byte count.
    if (data.length * 3 > PAYLOAD_MAX_BYTES && new Blob([data]).size > PAYLOAD_MAX_BYTES) {
        appendErrorMessage('This message is too large to send.');
        return false;
    }

    state.connection.send(data);
    return true;
};

const setConnectionStatus = (status, label) => {
    elements.connectionPill.dataset.status = status;
    elements.connectionStatus.textContent = label;
};

const setComposerEnabled = enabled => {
    elements.attachButton.disabled = !enabled;
    elements.message.disabled = !enabled;
    elements.submitButton.disabled = !enabled;
};

const setConnectionNotice = message => {
    elements.connectionNotice.textContent = message;
    elements.connectionNotice.hidden = !message;
};

const setComposerUnavailable = message => {
    setComposerEnabled(false);
    elements.message.placeholder = message;
};

const setComposerReady = () => {
    setComposerEnabled(true);
    elements.message.placeholder = 'Message or paste an image';
    setConnectionNotice('');
};

const isNearBottom = () => {
    const { scrollTop, scrollHeight, clientHeight } = elements.chat;

    return scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
};

const updateScrollToBottomButton = () => {
    if (!elements.scrollToBottomButton) {
        return;
    }

    elements.scrollToBottomButton.hidden = isNearBottom();
};

const scrollToBottom = (behavior = 'auto') => {
    state.stickToBottom = true;
    elements.chat.scrollTo({
        top: elements.chat.scrollHeight,
        behavior
    });
    updateScrollToBottomButton();
};

// Decide before appending: once a tall message is in, the chat is no longer "near bottom".
const appendToChat = (element, { stick = state.stickToBottom } = {}) => {
    elements.chat.appendChild(element);

    if (stick) {
        scrollToBottom();
        return;
    }

    updateScrollToBottomButton();
};

const keepBottomOnLoad = media => {
    media.addEventListener(media.tagName === 'IMG' ? 'load' : 'loadedmetadata', () => {
        if (state.stickToBottom) {
            scrollToBottom();
        }
    }, { once: true });
};

const resizeComposerInput = () => {
    const input = elements.message;

    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
};

const setSidebarCollapsed = collapsed => {
    const label = collapsed ? 'Expand online users panel' : 'Collapse online users panel';

    elements.chatShell.classList.toggle('sidebar-collapsed', collapsed);
    elements.sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    elements.sidebarToggle.setAttribute('aria-label', label);
    elements.sidebarToggle.title = collapsed ? 'Expand panel' : 'Collapse panel';
};

// 100vh ignores the mobile toolbar and keyboard. On mobile the app is a fixed layer sized and moved to the visual
// viewport, so iOS can neither hide the composer under the keyboard nor pan the header out of view.
const syncViewport = () => {
    const viewport = window.visualViewport;

    if (viewport && viewport.scale > 1) {
        return;
    }

    const root = document.documentElement;
    const height = viewport ? viewport.height : window.innerHeight;
    const offset = viewport ? viewport.offsetTop : 0;

    root.style.setProperty('--app-height', `${Math.round(height)}px`);
    root.style.setProperty('--app-offset', `${Math.round(offset)}px`);
    root.classList.toggle('is-short-viewport', height < SHORT_VIEWPORT_HEIGHT);
};

const readStorage = key => {
    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        return null;
    }
};

const writeStorage = (key, value) => {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        // Storage can be blocked (private mode); the setting then lasts for this page only.
    }
};

// A per-tab secret that lets the server recognise this tab after a reconnect. It is never shown to others.
const getSessionKey = () => {
    let key = '';

    try {
        key = window.sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
    } catch (error) {
        key = '';
    }

    if (!key) {
        const bytes = window.crypto.getRandomValues(new Uint8Array(16));
        key = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

        try {
            window.sessionStorage.setItem(SESSION_STORAGE_KEY, key);
        } catch (error) {
            // Without sessionStorage the key still covers reconnects until the page reloads.
        }
    }

    return key;
};

const isDesktopNotifySupported = () => 'Notification' in window;

const canShowDesktopNotifications = () => state.notify.desktop
    && isDesktopNotifySupported()
    && Notification.permission === 'granted';

const getNotifyHint = () => {
    if (!isDesktopNotifySupported()) {
        return 'This browser does not support desktop notifications.';
    }

    if (Notification.permission === 'denied') {
        return 'Notifications are blocked for this site. Allow them in the browser site settings.';
    }

    return '';
};

const renderNotifyControls = () => {
    const desktopOn = canShowDesktopNotifications();
    const hint = getNotifyHint();

    elements.notifyDesktop.checked = desktopOn;
    elements.notifyDesktop.disabled = Boolean(hint);
    elements.notifySound.checked = state.notify.sound;
    elements.notifyToggle.classList.toggle('is-active', desktopOn || state.notify.sound);
    elements.notifyHint.textContent = hint;
    elements.notifyHint.hidden = !hint;
};

const loadNotifySettings = () => {
    try {
        const saved = JSON.parse(readStorage(NOTIFY_SETTINGS_KEY)) || {};
        state.notify = { desktop: Boolean(saved.desktop), sound: Boolean(saved.sound) };
    } catch (error) {
        state.notify = { desktop: false, sound: false };
    }
};

const saveNotifySettings = () => {
    writeStorage(NOTIFY_SETTINGS_KEY, JSON.stringify(state.notify));
};

const setNotifyMenuOpen = open => {
    elements.notifyMenu.hidden = !open;
    elements.notifyToggle.setAttribute('aria-expanded', String(open));
};

// Browsers only let audio start after a user gesture, so this runs from clicks (join, the Sound toggle).
const unlockAudio = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        return Promise.resolve();
    }

    state.audioContext = state.audioContext || new AudioContextClass();

    return state.audioContext.resume().catch(() => {});
};

const playNotifySound = () => {
    const context = state.audioContext;

    if (!context || context.state !== 'running') {
        return;
    }

    const now = context.currentTime;

    NOTIFY_SOUND.tones.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + index * NOTIFY_SOUND.spacing;

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(NOTIFY_SOUND.volume, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + NOTIFY_SOUND.length);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + NOTIFY_SOUND.length);
    });
};

const isPageInactive = () => document.hidden || !document.hasFocus();

const renderTitle = () => {
    document.title = state.unreadCount ? `(${state.unreadCount}) ${BASE_TITLE}` : BASE_TITLE;
};

const clearUnread = () => {
    if (isPageInactive()) {
        return;
    }

    state.unreadCount = 0;
    renderTitle();
    state.lastNotification?.close();
    state.lastNotification = null;
};

const showDesktopNotification = (username, text) => {
    const body = text.replace(/\s+/g, ' ');

    try {
        const notification = new Notification(`${username} · #${state.room}`, {
            body: body.length > NOTIFICATION_PREVIEW_LENGTH ? `${body.slice(0, NOTIFICATION_PREVIEW_LENGTH)}…` : body,
            icon: 'favicon.svg',
            // One notification per room that updates instead of piling up.
            tag: `ws-chat-${state.room}`,
            renotify: true,
            silent: state.notify.sound
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        state.lastNotification = notification;
    } catch (error) {
        // Mobile Chrome only allows notifications from a service worker; the unread counter still works.
    }
};

const getChatImages = () => Array.from(elements.chat.querySelectorAll('.file-preview-btn img'));

const applyViewerTransform = () => {
    const { scale, x, y } = state.viewer;

    elements.viewerImage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    elements.viewerImage.classList.toggle('is-zoomed', scale > 1);
};

// Keep a zoomed photo covering the stage instead of letting it be dragged out of view.
const clampViewerOffset = () => {
    const viewer = state.viewer;
    const image = elements.viewerImage;
    const stage = elements.viewerStage;
    const maxX = Math.max(0, (image.offsetWidth * viewer.scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * viewer.scale - stage.clientHeight) / 2);

    viewer.x = Math.min(maxX, Math.max(-maxX, viewer.x));
    viewer.y = Math.min(maxY, Math.max(-maxY, viewer.y));
};

// Zooms so the point under the cursor stays in place; without a cursor it zooms around the centre.
const zoomViewer = (scale, clientX, clientY) => {
    const viewer = state.viewer;
    const image = elements.viewerImage;
    const nextScale = Math.min(VIEWER_MAX_SCALE, Math.max(1, scale));
    const stageRect = elements.viewerStage.getBoundingClientRect();
    const centerX = stageRect.left + image.offsetLeft + image.offsetWidth / 2;
    const centerY = stageRect.top + image.offsetTop + image.offsetHeight / 2;
    const dx = clientX === undefined ? 0 : clientX - centerX;
    const dy = clientY === undefined ? 0 : clientY - centerY;
    const ratio = nextScale / viewer.scale;

    viewer.x = nextScale === 1 ? 0 : dx - ratio * (dx - viewer.x);
    viewer.y = nextScale === 1 ? 0 : dy - ratio * (dy - viewer.y);
    viewer.scale = nextScale;
    clampViewerOffset();
    applyViewerTransform();
};

const showViewerImage = image => {
    const images = getChatImages();
    const index = images.indexOf(image);
    const meta = image.closest('.message-bubble').querySelector('.message-meta');

    Object.assign(state.viewer, { current: image, scale: 1, x: 0, y: 0 });
    applyViewerTransform();
    elements.viewerImage.src = image.src;
    elements.viewerImage.alt = image.alt;
    elements.viewerAuthor.textContent = meta.querySelector('strong').textContent;
    elements.viewerMeta.textContent = `${meta.querySelector('span').textContent} · ${index + 1} / ${images.length}`;
    elements.viewerDownload.href = image.src;
    elements.viewerDownload.download = image.alt;
    elements.viewerPrev.disabled = index <= 0;
    elements.viewerNext.disabled = index >= images.length - 1;
    elements.viewerPrev.hidden = images.length < 2;
    elements.viewerNext.hidden = images.length < 2;
};

const showSiblingImage = step => {
    const images = getChatImages();
    const next = images[images.indexOf(state.viewer.current) + step];

    if (next) {
        showViewerImage(next);
    }
};

const openViewer = image => {
    state.viewer.returnFocus = document.activeElement;
    elements.photoViewer.hidden = false;
    showViewerImage(image);
    elements.viewerClose.focus();
};

const closeViewer = () => {
    elements.photoViewer.hidden = true;
    elements.viewerImage.removeAttribute('src');
    state.viewer.current = null;
    state.viewer.pointer = null;
    state.viewer.returnFocus?.focus();
};

const notifyIncoming = (user, text) => {
    if (!isPageInactive()) {
        return;
    }

    state.unreadCount += 1;
    renderTitle();

    if (state.notify.sound && Date.now() - state.lastSoundAt > NOTIFY_SOUND_COOLDOWN) {
        state.lastSoundAt = Date.now();
        playNotifySound();
    }

    if (canShowDesktopNotifications()) {
        showDesktopNotification(user.username, text);
    }
};

const setupMessageCollapse = textElement => {
    requestAnimationFrame(() => {
        if (textElement.scrollHeight <= MESSAGE_COLLAPSED_HEIGHT) {
            return;
        }

        textElement.classList.add('is-collapsible', 'is-collapsed');

        const toggle = createElement('button', 'message-expand-btn', 'Show more');
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.addEventListener('click', () => {
            const collapsed = textElement.classList.toggle('is-collapsed');
            toggle.textContent = collapsed ? 'Show more' : 'Show less';
            toggle.setAttribute('aria-expanded', String(!collapsed));
        });

        textElement.insertAdjacentElement('afterend', toggle);
    });
};

const hideEmptyState = () => {
    if (elements.emptyState) {
        elements.emptyState.hidden = true;
    }
};

const appendMessage = ({ id, user, message, replyTo, reactions, date, own }) => {
    hideEmptyState();

    const item = { id, kind: 'message', user, message, replyTo, reactions: reactions || {}, preview: message };
    const wrapper = createElement('article', own ? 'message-row own' : 'message-row');
    const bubble = createElement('div', 'message-bubble');
    const meta = createElement('div', 'message-meta');
    const author = createElement('strong', '', own ? 'You' : user.username);
    const time = createElement('span', '', formatTime(date));
    const text = createElement('p', 'message-text');
    const copyButton = createCopyButton({
        label: 'Copy message',
        onCopy: () => copyText(message)
    });
    const replyPreview = renderReplyPreview(replyTo);
    const reactionBar = createReactionBar(item);

    wrapper.dataset.messageId = id;
    rememberMessage(item);
    bindTouchActions(bubble);

    text.appendChild(renderFormattedText(message));
    setupMessageCollapse(text);
    meta.append(author, time);
    bubble.append(meta);

    if (replyPreview) {
        bubble.appendChild(replyPreview);
    }

    bubble.append(text, reactionBar, createMessageActions(item), copyButton);

    if (!own) {
        wrapper.append(createAvatar(user.username), bubble);
    } else {
        wrapper.append(bubble);
    }

    appendToChat(wrapper, { stick: own || state.stickToBottom });
};

const formatFileSize = bytes => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isAllowedFile = file => {
    const extension = file.name.split('.').pop().toLowerCase();

    return ALLOWED_FILE_TYPES.has(file.type) || ALLOWED_FILE_EXTENSIONS.has(extension);
};

const appendFileMessage = ({ id, user, file: rawFile, replyTo, reactions, date, own }) => {
    hideEmptyState();

    const file = { ...rawFile, mime: typeof rawFile.mime === 'string' ? rawFile.mime : '' };
    const item = { id, kind: 'file', user, file, replyTo, reactions: reactions || {}, preview: file.name };
    const wrapper = createElement('article', own ? 'message-row own' : 'message-row');
    const bubble = createElement('div', 'message-bubble file-bubble');
    const meta = createElement('div', 'message-meta');
    const author = createElement('strong', '', own ? 'You' : user.username);
    const time = createElement('span', '', formatTime(date));
    const fileCard = createElement('div', 'file-card');
    const fileInfo = createElement('div', 'file-info');
    const fileName = createElement('strong', '', file.name);
    const fileMeta = createElement('span', '', `${file.mime || 'file'} · ${formatFileSize(file.size)}`);
    const download = createElement('a', 'download-link', 'Download');
    const replyPreview = renderReplyPreview(replyTo);
    const reactionBar = createReactionBar(item);

    wrapper.dataset.messageId = id;
    rememberMessage(item);
    bindTouchActions(bubble);
    meta.append(author, time);
    fileInfo.append(fileName, fileMeta);
    download.href = file.dataUrl;
    download.download = file.name;

    if (file.mime.startsWith('image/')) {
        const open = createElement('button', 'file-preview-btn');
        const preview = document.createElement('img');
        open.type = 'button';
        open.setAttribute('aria-label', `Open ${file.name}`);
        preview.className = 'file-preview';
        preview.src = file.dataUrl;
        preview.alt = file.name;
        keepBottomOnLoad(preview);
        open.append(preview);
        open.addEventListener('click', () => openViewer(preview));
        fileCard.append(open);
    }

    if (file.mime.startsWith('video/')) {
        const preview = document.createElement('video');
        preview.className = 'file-preview';
        preview.src = file.dataUrl;
        preview.controls = true;
        preview.preload = 'metadata';
        keepBottomOnLoad(preview);
        fileCard.append(preview);
    }

    if (file.mime.startsWith('audio/')) {
        const preview = document.createElement('audio');
        preview.className = 'audio-preview';
        preview.src = file.dataUrl;
        preview.controls = true;
        preview.preload = 'metadata';
        fileCard.append(preview);
    }

    fileCard.append(fileInfo, download);
    bubble.append(meta);

    if (replyPreview) {
        bubble.appendChild(replyPreview);
    }

    bubble.append(fileCard, reactionBar, createMessageActions(item), createCopyButton({
        label: file.mime.startsWith('image/') ? 'Copy image' : 'Copy file name',
        onCopy: () => file.mime.startsWith('image/') ? copyImage(file) : copyText(file.name)
    }));

    if (!own) {
        wrapper.append(createAvatar(user.username), bubble);
    } else {
        wrapper.append(bubble);
    }

    appendToChat(wrapper, { stick: own || state.stickToBottom });
};

const appendSystemMessage = (message, date) => {
    hideEmptyState();

    const row = createElement('div', 'system-message');
    const text = createElement('span', '', message);
    const time = createElement('small', '', formatTime(date));

    row.append(text, time);
    appendToChat(row);

    return row;
};

// A background tab can reconnect every minute; refresh the last notice instead of stacking new ones.
const showReconnectedNotice = () => {
    const last = elements.chat.lastElementChild;

    if (last?.classList.contains('reconnect-notice')) {
        last.querySelector('small').textContent = formatTime();
        return;
    }

    appendSystemMessage('Reconnected. Messages sent while you were offline are not shown.')
        .classList.add('reconnect-notice');
};

const appendErrorMessage = message => {
    appendSystemMessage(message, new Date().toISOString());
};

const renderUsers = users => {
    elements.usersList.replaceChildren();
    elements.onlineCount.textContent = users.length;

    users.forEach(user => {
        const item = createElement('li', 'user-item');
        const name = createElement('span', '', user.id === state.user?.id ? `${user.username} (you)` : user.username);

        item.append(createAvatar(user.username), name);
        elements.usersList.appendChild(item);
    });
};

const renderTyping = () => {
    const names = Array.from(state.typingUsers.values());

    if (!names.length) {
        elements.typingIndicator.textContent = '';
        return;
    }

    elements.typingIndicator.textContent = names.length === 1
        ? `${names[0]} is typing...`
        : `${names.slice(0, 2).join(', ')} are typing...`;
};

const clearTypingUser = userId => {
    window.clearTimeout(state.typingTimers.get(userId));
    state.typingTimers.delete(userId);
    state.typingUsers.delete(userId);
    renderTyping();
};

const handleTypingEvent = payload => {
    if (!payload.user || payload.user.id === state.user?.id) {
        return;
    }

    if (!payload.isTyping) {
        clearTypingUser(payload.user.id);
        return;
    }

    state.typingUsers.set(payload.user.id, payload.user.username);
    renderTyping();

    window.clearTimeout(state.typingTimers.get(payload.user.id));
    state.typingTimers.set(
        payload.user.id,
        window.setTimeout(() => clearTypingUser(payload.user.id), TYPING_IDLE_DELAY + 500)
    );
};

const handleServerMessage = event => {
    let payload;

    try {
        payload = JSON.parse(event.data);
    } catch (error) {
        return;
    }

    if (payload.type === 'ready') {
        const isRejoin = Boolean(state.user);

        state.user = payload.user;
        state.room = payload.room || state.room;
        elements.roomName.textContent = `#${state.room}`;
        renderUsers(payload.users || []);
        setComposerReady();

        if (isRejoin) {
            showReconnectedNotice();
        }

        return;
    }

    if (payload.type === 'presence') {
        renderUsers(payload.users || []);
        return;
    }

    if (payload.type === 'message') {
        appendMessage({
            id: payload.id,
            user: payload.user,
            message: payload.message,
            replyTo: payload.replyTo,
            reactions: payload.reactions,
            date: payload.date,
            own: payload.user?.id === state.user?.id
        });
        clearTypingUser(payload.user?.id);

        if (payload.user?.id !== state.user?.id) {
            notifyIncoming(payload.user, payload.message);
        }

        return;
    }

    if (payload.type === 'file') {
        appendFileMessage({
            id: payload.id,
            user: payload.user,
            file: payload.file,
            replyTo: payload.replyTo,
            reactions: payload.reactions,
            date: payload.date,
            own: payload.user?.id === state.user?.id
        });
        clearTypingUser(payload.user?.id);

        if (payload.user?.id !== state.user?.id) {
            notifyIncoming(payload.user, `📎 ${payload.file?.name || 'File'}`);
        }

        return;
    }

    if (payload.type === 'system') {
        appendSystemMessage(payload.message, payload.date);
        return;
    }

    if (payload.type === 'error') {
        appendErrorMessage(payload.message);
        return;
    }

    if (payload.type === 'typing') {
        handleTypingEvent(payload);
        return;
    }

    if (payload.type === 'reaction') {
        updateReactionBar(payload.messageId, payload.reactions || {});
    }
};

const readFileAsDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
});

const sendFile = async file => {
    if (!file) {
        return;
    }

    if (!isAllowedFile(file)) {
        appendErrorMessage('This file type is not supported.');
        return;
    }

    if (file.size > FILE_MAX_BYTES) {
        appendErrorMessage('File should be smaller than 10 MB.');
        return;
    }

    try {
        const dataUrl = await readFileAsDataUrl(file);

        const sent = sendPayload({
            type: 'file',
            replyTo: state.replyTo?.id,
            file: {
                name: file.name,
                size: file.size,
                mime: file.type,
                dataUrl
            }
        });

        if (sent) {
            clearReplyTo();
        }
    } catch (error) {
        appendErrorMessage('Could not read this file.');
    }
};

const connect = () => {
    window.clearTimeout(state.reconnectTimer);
    setConnectionStatus('connecting', 'Connecting');
    setConnectionNotice('Connecting to the chat server...');
    setComposerUnavailable('Waiting for server...');

    state.connection = new WebSocket(getSocketUrl());

    state.connection.onopen = () => {
        setConnectionStatus('online', 'Online');
        setConnectionNotice('Connected. Joining the room...');
        clearTypingState();

        if (state.username) {
            sendPayload({
                type: 'join',
                username: state.username,
                room: state.room,
                session: state.sessionKey
            });
        }
    };

    state.connection.onmessage = handleServerMessage;

    state.connection.onerror = () => {
        setConnectionStatus('offline', 'Connection issue');
        setConnectionNotice('The chat server is not responding yet. It may be waking up after inactivity.');
        setComposerUnavailable('Server is waking up...');
    };

    state.connection.onclose = () => {
        setConnectionStatus('offline', 'Reconnecting');
        setConnectionNotice('Disconnected. Reconnecting automatically...');
        setComposerUnavailable('Reconnecting...');
        state.reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY);
    };
};

// Background tabs delay the reconnect timer by up to a minute; don't wait for it once the user is back.
// Only a fully closed socket is replaced: a closing one will schedule its own reconnect.
const reconnectNow = () => {
    if (state.username && state.connection?.readyState === WebSocket.CLOSED) {
        connect();
    }
};

const stopTyping = () => {
    if (!state.isTyping) {
        return;
    }

    state.isTyping = false;
    sendPayload({
        type: 'typing',
        isTyping: false
    });
};

elements.chat.addEventListener('scroll', () => {
    // Scroll anchoring fires a scroll event when the list resizes; let the ResizeObserver handle that one.
    if (elements.chat.clientHeight !== state.chatHeight) {
        return;
    }

    state.stickToBottom = isNearBottom();
    updateScrollToBottomButton();
}, { passive: true });

// The message list shrinks when the keyboard, reply bar or a taller composer appears; keep the latest message visible.
new ResizeObserver(() => {
    state.chatHeight = elements.chat.clientHeight;

    if (state.stickToBottom) {
        scrollToBottom();
        return;
    }

    updateScrollToBottomButton();
}).observe(elements.chat);

elements.scrollToBottomButton?.addEventListener('click', () => {
    scrollToBottom('smooth');
});

elements.nameForm.addEventListener('submit', event => {
    event.preventDefault();

    state.username = normalizeUsername(elements.username.value) || 'Anonymous';
    state.room = getRoomId();
    elements.roomName.textContent = `#${state.room}`;
    elements.nameModal.hidden = true;

    if (state.notify.sound) {
        unlockAudio();
    }

    connect();
});

elements.notifyToggle.addEventListener('click', () => {
    setNotifyMenuOpen(elements.notifyMenu.hidden);
});

elements.notifyDesktop.addEventListener('change', async () => {
    if (elements.notifyDesktop.checked && Notification.permission !== 'granted') {
        await Notification.requestPermission();
    }

    state.notify.desktop = elements.notifyDesktop.checked && Notification.permission === 'granted';
    saveNotifySettings();
    renderNotifyControls();
});

elements.notifySound.addEventListener('change', () => {
    state.notify.sound = elements.notifySound.checked;
    saveNotifySettings();
    renderNotifyControls();

    if (state.notify.sound) {
        unlockAudio().then(playNotifySound);
    }
});

document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.notify-control')) {
        setNotifyMenuOpen(false);
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        setNotifyMenuOpen(false);
    }
});

document.addEventListener('visibilitychange', () => {
    clearUnread();

    if (!document.hidden) {
        reconnectNow();
    }
});
window.addEventListener('focus', clearUnread);
window.addEventListener('online', reconnectNow);

elements.viewerClose.addEventListener('click', closeViewer);
elements.viewerPrev.addEventListener('click', () => showSiblingImage(-1));
elements.viewerNext.addEventListener('click', () => showSiblingImage(1));

document.addEventListener('keydown', event => {
    if (elements.photoViewer.hidden) {
        return;
    }

    const actions = {
        Escape: closeViewer,
        ArrowLeft: () => showSiblingImage(-1),
        ArrowRight: () => showSiblingImage(1)
    };

    if (actions[event.key]) {
        event.preventDefault();
        actions[event.key]();
    }
});

elements.viewerStage.addEventListener('wheel', event => {
    event.preventDefault();
    zoomViewer(state.viewer.scale * Math.exp(-event.deltaY * VIEWER_WHEEL_SPEED), event.clientX, event.clientY);
}, { passive: false });

// One pointer flow for mouse and touch: a press that barely moves is a click (zoom on the photo, close on the
// backdrop); a press that moves pans a zoomed photo.
elements.viewerStage.addEventListener('pointerdown', event => {
    if (event.button !== 0) {
        return;
    }

    state.viewer.pointer = {
        id: event.pointerId,
        onImage: event.target === elements.viewerImage,
        startX: event.clientX,
        startY: event.clientY,
        originX: state.viewer.x,
        originY: state.viewer.y,
        moved: false
    };
    elements.viewerStage.setPointerCapture(event.pointerId);
});

elements.viewerStage.addEventListener('pointermove', event => {
    const pointer = state.viewer.pointer;

    if (!pointer || pointer.id !== event.pointerId) {
        return;
    }

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    pointer.moved = pointer.moved || Math.hypot(dx, dy) > VIEWER_DRAG_THRESHOLD;

    if (pointer.moved && state.viewer.scale > 1) {
        state.viewer.x = pointer.originX + dx;
        state.viewer.y = pointer.originY + dy;
        clampViewerOffset();
        elements.viewerImage.classList.add('is-dragging');
        applyViewerTransform();
    }
});

elements.viewerStage.addEventListener('pointerup', event => {
    const pointer = state.viewer.pointer;

    if (!pointer || pointer.id !== event.pointerId) {
        return;
    }

    state.viewer.pointer = null;
    elements.viewerImage.classList.remove('is-dragging');

    if (pointer.moved) {
        return;
    }

    if (!pointer.onImage) {
        closeViewer();
        return;
    }

    zoomViewer(state.viewer.scale > 1 ? 1 : VIEWER_CLICK_SCALE, event.clientX, event.clientY);
});

elements.viewerStage.addEventListener('pointercancel', () => {
    state.viewer.pointer = null;
    elements.viewerImage.classList.remove('is-dragging');
});

elements.sidebarToggle.addEventListener('click', () => {
    setSidebarCollapsed(!elements.chatShell.classList.contains('sidebar-collapsed'));
});

MOBILE_LAYOUT_QUERY.addEventListener('change', event => {
    setSidebarCollapsed(event.matches);
});

window.visualViewport?.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('scroll', syncViewport);
window.addEventListener('resize', syncViewport);

elements.composer.addEventListener('submit', event => {
    event.preventDefault();

    const message = normalizeMessage(elements.message.value);

    if (!message) {
        return;
    }

    const sent = sendPayload({
        type: 'message',
        replyTo: state.replyTo?.id,
        message
    });

    if (sent) {
        elements.message.value = '';
        resizeComposerInput();
        clearReplyTo();
        stopTyping();
    }
});

elements.cancelReply.addEventListener('click', clearReplyTo);

elements.attachButton.addEventListener('click', () => {
    elements.fileInput.click();
});

elements.fileInput.addEventListener('change', () => {
    sendFile(elements.fileInput.files[0]);
    elements.fileInput.value = '';
});

elements.chat.addEventListener('dragover', event => {
    event.preventDefault();

    if (!elements.message.disabled) {
        elements.dropOverlay.hidden = false;
    }
});

elements.chat.addEventListener('dragleave', event => {
    if (!elements.chat.contains(event.relatedTarget)) {
        elements.dropOverlay.hidden = true;
    }
});

elements.chat.addEventListener('drop', event => {
    event.preventDefault();
    elements.dropOverlay.hidden = true;

    if (!elements.message.disabled) {
        sendFile(event.dataTransfer.files[0]);
    }
});

document.addEventListener('paste', event => {
    if (elements.message.disabled || elements.nameModal.hidden !== true) {
        return;
    }

    const file = Array.from(event.clipboardData?.files || []).find(item => item.type.startsWith('image/'));

    if (file) {
        event.preventDefault();
        sendFile(file);
    }
});

document.addEventListener('pointerdown', event => {
    if (!isTouchMode() || event.target.closest('.message-bubble')) {
        return;
    }

    closeOpenMessageActions();
});

elements.message.addEventListener('input', () => {
    resizeComposerInput();

    if (!state.isTyping) {
        state.isTyping = true;
        sendPayload({
            type: 'typing',
            isTyping: true
        });
    }

    window.clearTimeout(state.typingTimer);
    state.typingTimer = window.setTimeout(stopTyping, TYPING_IDLE_DELAY);
});

elements.message.addEventListener('keydown', event => {
    // Skip Enter that confirms an IME candidate (Safari reports it only via keyCode 229)
    // and on touch keyboards, where Enter inserts a new line and the Send button sends.
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE) {
        return;
    }

    if (isTouchMode()) {
        return;
    }

    event.preventDefault();
    elements.composer.requestSubmit();
});

syncViewport();
setSidebarCollapsed(MOBILE_LAYOUT_QUERY.matches);
state.sessionKey = getSessionKey();
loadNotifySettings();
renderNotifyControls();
elements.message.enterKeyHint = isTouchMode() ? 'enter' : 'send';
elements.username.focus();
state.room = getRoomId();
elements.roomName.textContent = `#${state.room}`;
