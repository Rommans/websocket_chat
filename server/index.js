const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const users = [];
const usersOnline = { online: 0 };

wss.on('connection', ws => {   
    users.push(ws)
    usersOnline.online = wss.clients.size;
    users.forEach(user => user.send(JSON.stringify(usersOnline)));
    ws.on('message', message => {
        const msg = JSON.parse(message);
        msg.online = wss.clients.size;
        const receivers = users.filter(user => user !== ws);
        receivers.forEach(reciever => reciever.send(JSON.stringify(msg)));
    });

    ws.on('close', () => {
        usersOnline.online = wss.clients.size;
        users.forEach(user => user.send(JSON.stringify(usersOnline)));
    })
});

console.log('Server is running on port 8080')