import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    if (!socket) {
        socket = io('http://localhost:3000', {
            auth: { token },
            transports: ['websocket'],
        });
    }
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}