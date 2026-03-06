const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const users = [];
const usersOnline = { online: 0 };

wss.on('connection', ws => {   
    users.push(ws);
    usersOnline.online = wss.clients.size;
    users.forEach(user => user.send(JSON.stringify(usersOnline)));
    
    ws.on('message', message => {
        const msg = JSON.parse(message);
        msg.online = wss.clients.size;
        const receivers = users.filter(user => user !== ws);
        receivers.forEach(reciever => reciever.send(JSON.stringify(msg)));
    });

    ws.on('close', () => {
        const index = users.indexOf(ws);
        if (index > -1) {
            users.splice(index, 1);
        }
        
        usersOnline.online = wss.clients.size;
        users.forEach(user => user.send(JSON.stringify(usersOnline)));
    });
});

console.log(`Server is running on port ${PORT}`);