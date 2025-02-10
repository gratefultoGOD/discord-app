// Initialize Socket.IO
const socket = io('/');

// Initialize PeerJS
const peer = new Peer(undefined, {
    host: window.location.hostname,
    port: 80,
    path: '/peerjs',
    secure: false,
    debug: 3,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    }
});

let currentUser = null;
let localStream = null;
let micEnabled = false;
let cameraEnabled = false;
const peers = {};
const streams = new Map();
const usernames = new Map(); // Store usernames for all participants

// DOM Elements
const videoGrid = document.getElementById('video-grid');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendMessageButton = document.getElementById('send-message');
const joinCallButton = document.getElementById('joinCall');
const toggleMicButton = document.getElementById('toggleMic');
const toggleCameraButton = document.getElementById('toggleCamera');
const modal = document.getElementById('room-modal');
const usernameInput = document.getElementById('username-input');
const joinButton = document.getElementById('join-room-button');
const participantsList = document.getElementById('participants-list');
const participantCount = document.getElementById('participant-count');

// Show modal on page load
modal.style.display = 'flex';

// Media Control Handlers
toggleMicButton.addEventListener('click', () => {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            micEnabled = !micEnabled;
            audioTracks[0].enabled = micEnabled;
            toggleMicButton.classList.toggle('off', !micEnabled);
            // Emit mic state to other users
            socket.emit('mic-state-changed', {
                userId: peer.id,
                enabled: micEnabled
            });
        }
    }
});

toggleCameraButton.addEventListener('click', () => {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            cameraEnabled = !cameraEnabled;
            videoTracks[0].enabled = cameraEnabled;
            toggleCameraButton.classList.toggle('off', !cameraEnabled);
        }
    }
});

// Join Handler
joinButton.addEventListener('click', () => {
    const username = usernameInput.value;
    if (username) {
        currentUser = {
            id: peer.id,
            username: username
        };
        usernames.set(peer.id, username);
        modal.style.display = 'none';
        joinMainRoom();
    }
});

// Join Call Handler
joinCallButton.addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        // Initialize control buttons and set initial states
        toggleMicButton.disabled = false;
        toggleCameraButton.disabled = false;
        
        // Set initial states for audio and video tracks
        const audioTracks = localStream.getAudioTracks();
        const videoTracks = localStream.getVideoTracks();
        
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = micEnabled;
            toggleMicButton.classList.toggle('off', !micEnabled);
        }
        
        if (videoTracks.length > 0) {
            videoTracks[0].enabled = cameraEnabled;
            toggleCameraButton.classList.toggle('off', !cameraEnabled);
        }
        
        addVideoStream(peer.id, localStream, true);
        socket.emit('stream-ready', peer.id);

        // Emit initial states
        socket.emit('mic-state-changed', {
            userId: peer.id,
            enabled: micEnabled
        });

        // Answer incoming calls with the local stream
        peer.on('call', call => {
            call.answer(localStream);
            call.on('stream', remoteStream => {
                if (!streams.has(call.peer)) {
                    addVideoStream(call.peer, remoteStream);
                }
            });
        });
    } catch (err) {
        console.error('Failed to get local stream:', err);
    }
});

// Chat Message Handler
sendMessageButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message.trim()) {
        socket.emit('message', message);
        messageInput.value = '';
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessageButton.click();
    }
});

// Socket.IO Event Handlers
socket.on('user-connected', (data) => {
    console.log('User connected:', data);
    const { userId, username } = data;
    usernames.set(userId, username);
    connectToNewUser(userId);
    updateParticipantsList();
});

socket.on('user-disconnected', userId => {
    console.log('User disconnected:', userId);
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
    usernames.delete(userId);
    removeVideoStream(userId);
    updateParticipantsList();
});

socket.on('message', data => {
    addMessage(data);
});

socket.on('existing-users', users => {
    users.forEach(user => {
        const { userId, username } = user;
        usernames.set(userId, username);
        connectToNewUser(userId);
    });
    updateParticipantsList();
});

socket.on('new-stream-available', data => {
    const { userId, username, streamId } = data;
    usernames.set(userId, username);
    if (localStream) {
        connectToNewUser(userId);
    }
});

socket.on('user-mic-state', (data) => {
    const { userId, enabled } = data;
    const stream = streams.get(userId);
    if (stream) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = enabled;
            // Update UI if needed
            const videoContainer = document.getElementById(`video-${userId}`);
            if (videoContainer) {
                const micIcon = videoContainer.querySelector('.mic-status');
                if (!micIcon) {
                    const micStatus = document.createElement('div');
                    micStatus.className = 'mic-status';
                    micStatus.innerHTML = `<i class="fas fa-microphone${enabled ? '' : '-slash'}"></i>`;
                    videoContainer.appendChild(micStatus);
                } else {
                    micIcon.innerHTML = `<i class="fas fa-microphone${enabled ? '' : '-slash'}"></i>`;
                }
            }
        }
    }
});

// PeerJS Event Handlers
peer.on('open', id => {
    console.log('My peer ID is:', id);
});

// Helper Functions
function joinMainRoom() {
    socket.emit('join-main-room', {
        userId: peer.id,
        username: currentUser.username
    });
}

function connectToNewUser(userId) {
    if (localStream) {
        const call = peer.call(userId, localStream);
        peers[userId] = call;

        call.on('stream', remoteStream => {
            if (!streams.has(userId)) {
                addVideoStream(userId, remoteStream);
            }
        });

        call.on('close', () => {
            removeVideoStream(userId);
        });
    }
}

function addVideoStream(userId, stream, isLocal = false) {
    if (streams.has(userId)) return;

    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `video-${userId}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    if (isLocal) {
        video.muted = true;
    }

    // Add username label to video
    const usernameLabel = document.createElement('div');
    usernameLabel.className = 'username-label';
    usernameLabel.textContent = usernames.get(userId) || 'Unknown User';

    videoContainer.appendChild(video);
    videoContainer.appendChild(usernameLabel);
    videoGrid.appendChild(videoContainer);
    streams.set(userId, stream);

    video.addEventListener('loadedmetadata', () => {
        video.play();
    });

    updateParticipantsList();
}

function removeVideoStream(userId) {
    const videoContainer = document.getElementById(`video-${userId}`);
    if (videoContainer) {
        videoContainer.remove();
        streams.delete(userId);
    }
    updateParticipantsList();
}

function addMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.innerHTML = `
        <strong>${data.username}</strong>
        <span>${new Date(data.timestamp).toLocaleTimeString()}</span>
        <p>${data.message}</p>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateParticipantsList() {
    participantsList.innerHTML = '';
    const participants = Array.from(streams.keys());
    
    participants.forEach(userId => {
        const participantElement = document.createElement('div');
        participantElement.className = 'participant';
        participantElement.innerHTML = `
            <i class="fas fa-user"></i>
            <span>${usernames.get(userId) || 'Unknown User'}</span>
        `;
        participantsList.appendChild(participantElement);
    });

    participantCount.textContent = participants.length;
} 