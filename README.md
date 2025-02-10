# Discord Clone with SFU

A Discord-like web application implementing Selective Forwarding Unit (SFU) architecture for efficient video/audio streaming using PeerJS and Socket.IO.

## Features

- Real-time video and audio communication
- Text chat functionality
- Modern Discord-like UI
- Room-based communication
- Participant list with online status
- Selective Forwarding Unit (SFU) architecture for efficient streaming

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd discord-clone
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Enter your username and a room ID to join
4. Click "Join Call" to start video/audio streaming
5. Share the room ID with others to let them join the same room

## Technical Details

The application uses:
- Express.js for the web server
- Socket.IO for real-time communication
- PeerJS for WebRTC connections
- SFU architecture for efficient video/audio streaming

### SFU Implementation

The Selective Forwarding Unit (SFU) architecture is implemented using PeerJS, where:
- Each client connects to the PeerJS server
- When a new user joins, they establish connections with existing users
- The server coordinates the connection process
- Video/audio streams are selectively forwarded to reduce bandwidth usage

## Browser Support

The application works best with modern browsers that support WebRTC:
- Google Chrome (recommended)
- Mozilla Firefox
- Microsoft Edge
- Safari

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details. 