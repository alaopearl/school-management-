const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

let ioInstance = null;

function init(io) {
    ioInstance = io;
    ioInstance.on('connection', (socket) => {
        console.log('Socket connected:', socket.id);

        // Try to authenticate if token provided in handshake
        const token = socket.handshake.auth && socket.handshake.auth.token;
        if (token && typeof token === 'string') {
            const raw = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
            jwt.verify(raw, JWT_SECRET, (err, payload) => {
                if (err || !payload) {
                    console.warn('Socket authentication failed for', socket.id, err ? err.message : 'no payload');
                    // reject connection
                    try { socket.emit('unauthorized', { message: 'Invalid or expired token' }); } catch (e) {}
                    return socket.disconnect(true);
                }
                socket.user = payload;
                try {
                    if (payload.id || payload.user_id) {
                        const userId = payload.user_id || payload.id;
                        socket.join(`user:${userId}`);
                        console.log(`Socket ${socket.id} joined room user:${userId}`);
                    }
                    if (payload.school_id) {
                        socket.join(`school:${payload.school_id}`);
                        console.log(`Socket ${socket.id} joined room school:${payload.school_id}`);
                    }
                } catch (joinErr) {
                    console.warn('Socket join error:', joinErr.message);
                }
            });
        } else {
            // no token: disconnect
            console.warn('Socket connection without token, disconnecting', socket.id);
            try { socket.emit('unauthorized', { message: 'Authentication required' }); } catch (e) {}
            return socket.disconnect(true);
        }

        socket.on('identify', (data) => {
            try {
                const userId = data && (data.userId || data.user_id);
                if (userId) {
                    const room = `user:${userId}`;
                    socket.join(room);
                    console.log(`Socket ${socket.id} joined room ${room}`);
                }
                const schoolId = data && data.schoolId;
                if (schoolId) {
                    const sroom = `school:${schoolId}`;
                    socket.join(sroom);
                    console.log(`Socket ${socket.id} joined room ${sroom}`);
                }
            } catch (err) {
                console.warn('Identify handler error:', err.message);
            }
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected:', socket.id);
        });
    });
}

function getIo() {
    return ioInstance;
}

module.exports = { init, getIo };
