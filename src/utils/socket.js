import { io } from 'socket.io-client';
import { API_ORIGIN } from '../config';

let socket = null;

export function getSocket() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    if (!socket) {
        socket = io(`${API_ORIGIN}`, {
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