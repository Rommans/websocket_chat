const connection = new WebSocket('wss://websocket-chat-backend1.glitch.me');
let username;
let online = 0;

connection.onopen = () => {
    console.log('connected');
    username = prompt('Input your name', 'User') || 'Anonymous';
};

connection.onclose = () => {
    console.error('disconnected');
};

connection.onerror = error => {
    console.error('failed to connect', error);
};

connection.onmessage = event => {
    let obj = JSON.parse(event.data)
    let onlineUsers = document.querySelector('.online');
    onlineUsers.textContent = `${obj.online} ONLINE`;
    if(obj.username != undefined){
        let messageContainer = document.querySelector('#chat');
        let el = document.createElement('div');
        el.setAttribute('class', 'other-message_wrapper');
        el.innerHTML = `
            <div class="other-message_block">
                <div class="left-message">
                    <label>${obj.username}:</label>
                    <p class="other-message">${obj.message}</p>
                    <label class="time">${obj.date}</label>
                </div>
            </div>
        `;
        messageContainer.appendChild(el);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
};

document.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    let message = document.querySelector('#message').value;
    if(message.length && message.trim()){
        let time = new Date().toLocaleTimeString([], {
            hour12: false
        });
        let msg = {
            username: username,
            message: message,
            date: time
        };
        connection.send(JSON.stringify(msg));
        ownMessage(message)
        document.querySelector('#message').value = '';
    }
});

const ownMessage = (message) => {
    let time = new Date().toLocaleTimeString([], { hour12: false });
    let messageContainer = document.querySelector('#chat');
    let el = document.createElement('div');
    el.setAttribute('class', 'my-message_wrapper');
    el.innerHTML = `
        <div class="my-message_block">
            <div class="right-message">
                <label>${username}:</label>
                <p class="my-message">${message}</p>
                <label class="time">${time}</label>
            </div>
        </div>
      `;
    messageContainer.appendChild(el);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}