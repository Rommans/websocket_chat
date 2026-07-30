# WebSocket Chat

A small real-time chat built with a browser client and a Node.js WebSocket server.

## Features

- username join screen
- online user list
- connection status
- join and leave messages
- replies and live reactions
- URL-based rooms
- typing indicator
- live file sharing without storage
- image paste from clipboard
- image copy back to clipboard where the browser allows it
- minimal message formatting for bold, italic, inline code and HTTPS links
- safe text rendering without injecting message HTML
- basic Content Security Policy
- local and production WebSocket URL selection

Files are sent through the active WebSocket connection as data URLs. They are not stored anywhere and disappear after the chat session is refreshed. The current limit is 10 MB per file, with support for common images, GIFs, audio, videos, documents, spreadsheets, presentations, archives, text and code/config files.

Rooms are selected with the `room` query parameter. For example, `/?room=dev` and `/?room=design` are separate live rooms. If no room is provided, the client joins `general`.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the WebSocket server:

```bash
npm run start
```

Start the client:

```bash
npm run dev
```

Open `http://localhost:1234`. The local client connects to `ws://localhost:8080`. The deployed client connects to the Render WebSocket server.

## Build And Deploy

Build the client:

```bash
npm run build
```

Deploy to GitHub Pages:

```bash
npm run deploy
```
