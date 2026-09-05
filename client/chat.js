const REMOTE_WS_URL = 'wss://websocket-chat-s2s0.onrender.com';
const LOCAL_WS_URL = 'ws://localhost:8080';
const FILE_MAX_BYTES = 10 * 1024 * 1024;
const MESSAGE_COLLAPSED_HEIGHT = 220;
const SCROLL_THRESHOLD = 96;
const TYPING_IDLE_DELAY = 1100;
const RECONNECT_DELAY = 2500;
const LONG_PRESS_DELAY = 520;
const DEFAULT_ROOM = 'general';
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
    onlineCount: document.querySelector('.online-count'),
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
    connection: null,
    isTyping: false,
    reconnectTimer: null,
    typingTimer: null,
    typingTimers: new Map(),
    typingUsers: new Map(),
    messages: new Map(),
    replyTo: null,
    room: DEFAULT_ROOM,
    touchActionTimer: null,
    user: null,
    username: ''
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

const copyImage = async file => {
    if (!navigator.clipboard || !window.ClipboardItem || !file.mime.startsWith('image/')) {
        throw new Error('Image clipboard is not available.');
    }

    const response = await fetch(file.dataUrl);
    const blob = await response.blob();

    await navigator.clipboard.write([
        new ClipboardItem({
            [blob.type]: blob
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

const resetRoomState = () => {
    state.messages.clear();
    state.typingUsers.clear();
    state.typingTimers.forEach(timer => window.clearTimeout(timer));
    state.typingTimers.clear();
    clearReplyTo();

    elements.chat.querySelectorAll('.message-row, .system-message').forEach(element => element.remove());

    if (elements.emptyState) {
        elements.emptyState.hidden = false;
    }

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

    state.connection.send(JSON.stringify(payload));
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

const scrollToBottom = ({ force = false, behavior = 'auto' } = {}) => {
    if (!force && !isNearBottom()) {
        updateScrollToBottomButton();
        return;
    }

    elements.chat.scrollTo({
        top: elements.chat.scrollHeight,
        behavior
    });
    updateScrollToBottomButton();
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

    elements.chat.appendChild(wrapper);
    scrollToBottom();
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

const appendFileMessage = ({ id, user, file, replyTo, reactions, date, own }) => {
    hideEmptyState();

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
        const preview = document.createElement('img');
        preview.className = 'file-preview';
        preview.src = file.dataUrl;
        preview.alt = file.name;
        fileCard.append(preview);
    }

    if (file.mime.startsWith('video/')) {
        const preview = document.createElement('video');
        preview.className = 'file-preview';
        preview.src = file.dataUrl;
        preview.controls = true;
        preview.preload = 'metadata';
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

    elements.chat.appendChild(wrapper);
    scrollToBottom();
};

const appendSystemMessage = (message, date) => {
    hideEmptyState();

    const row = createElement('div', 'system-message');
    const text = createElement('span', '', message);
    const time = createElement('small', '', formatTime(date));

    row.append(text, time);
    elements.chat.appendChild(row);
    scrollToBottom();
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
        state.user = payload.user;
        state.room = payload.room || state.room;
        elements.roomName.textContent = `#${state.room}`;
        renderUsers(payload.users || []);
        setComposerReady();
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
        resetRoomState();

        if (state.username) {
            sendPayload({
                type: 'join',
                username: state.username,
                room: state.room
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

elements.chat.addEventListener('scroll', updateScrollToBottomButton, { passive: true });

elements.scrollToBottomButton?.addEventListener('click', () => {
    scrollToBottom({ force: true, behavior: 'smooth' });
});

elements.nameForm.addEventListener('submit', event => {
    event.preventDefault();

    state.username = normalizeUsername(elements.username.value) || 'Anonymous';
    state.room = getRoomId();
    elements.roomName.textContent = `#${state.room}`;
    elements.nameModal.hidden = true;
    connect();
});

elements.sidebarToggle.addEventListener('click', () => {
    const isCollapsed = elements.chatShell.classList.toggle('sidebar-collapsed');
    const label = isCollapsed ? 'Expand online users panel' : 'Collapse online users panel';
    const title = isCollapsed ? 'Expand panel' : 'Collapse panel';

    elements.sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
    elements.sidebarToggle.setAttribute('aria-label', label);
    elements.sidebarToggle.title = title;
});

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
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        elements.composer.requestSubmit();
    }
});

elements.username.focus();
state.room = getRoomId();
elements.roomName.textContent = `#${state.room}`;
