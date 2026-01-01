/**
 * WebSocket Client
 * Real-time communication with backend via Socket.io
 */

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }
  
  connect(token, workspaceId) {
    if (this.socket && this.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }
    
    // Create socket connection
    this.socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Authenticate
      this.socket.emit('authenticate', { token, workspaceId });
    });
    
    this.socket.on('authenticated', (data) => {
      console.log('[WebSocket] Authenticated', data);
      this.emit('authenticated', data);
    });
    
    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      this.connected = false;
      this.emit('disconnected');
    });
    
    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`[WebSocket] Reconnection attempt ${attempt}`);
      this.reconnectAttempts = attempt;
    });
    
    this.socket.on('reconnect_failed', () => {
      console.error('[WebSocket] Reconnection failed');
      this.emit('reconnect_failed');
    });
    
    // Business events
    this.socket.on('message:new', (message) => {
      this.emit('message:new', message);
    });
    
    this.socket.on('contact:updated', (contact) => {
      this.emit('contact:updated', contact);
    });
    
    this.socket.on('deal:updated', (deal) => {
      this.emit('deal:updated', deal);
    });
    
    this.socket.on('task:updated', (task) => {
      this.emit('task:updated', task);
    });
    
    this.socket.on('campaign:updated', (campaign) => {
      this.emit('campaign:updated', campaign);
    });
    
    this.socket.on('notification', (notification) => {
      this.emit('notification', notification);
    });
    
    this.socket.on('typing:start', (data) => {
      this.emit('typing:start', data);
    });
    
    this.socket.on('typing:stop', (data) => {
      this.emit('typing:stop', data);
    });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
  
  // Room management
  joinRoom(room) {
    if (this.socket && this.connected) {
      this.socket.emit('join', room);
    }
  }
  
  leaveRoom(room) {
    if (this.socket && this.connected) {
      this.socket.emit('leave', room);
    }
  }
  
  // Typing indicators
  startTyping(contactId) {
    if (this.socket && this.connected) {
      this.socket.emit('typing:start', { contactId });
    }
  }
  
  stopTyping(contactId) {
    if (this.socket && this.connected) {
      this.socket.emit('typing:stop', { contactId });
    }
  }
}

// Create singleton instance
const wsClient = new WebSocketClient();

// Export for use in modules
window.WebSocketClient = wsClient;

export default wsClient;
