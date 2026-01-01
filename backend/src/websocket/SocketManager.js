/**
 * WebSocket Manager
 * Manages Socket.io connections and events
 */

class SocketManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }
  
  handleConnection(socket) {
    console.log(`[Socket] Client connected: ${socket.id}`);
    
    // Authentication
    socket.on('authenticate', async (data) => {
      const { token, workspaceId } = data;
      // TODO: Verify JWT token
      socket.userId = 'user-id'; // Set from token
      socket.workspaceId = workspaceId;
      
      // Join workspace room
      socket.join(`workspace:${workspaceId}`);
      this.addToRoom(workspaceId, socket.id);
      
      socket.emit('authenticated', { success: true });
    });
    
    // Join specific rooms
    socket.on('join', (room) => {
      socket.join(room);
      this.addToRoom(room, socket.id);
      console.log(`[Socket] Client ${socket.id} joined ${room}`);
    });
    
    // Leave room
    socket.on('leave', (room) => {
      socket.leave(room);
      this.removeFromRoom(room, socket.id);
      console.log(`[Socket] Client ${socket.id} left ${room}`);
    });
    
    // Typing indicator
    socket.on('typing:start', (data) => {
      socket.to(`contact:${data.contactId}`).emit('typing:start', {
        userId: socket.userId,
        contactId: data.contactId,
      });
    });
    
    socket.on('typing:stop', (data) => {
      socket.to(`contact:${data.contactId}`).emit('typing:stop', {
        userId: socket.userId,
        contactId: data.contactId,
      });
    });
    
    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      this.removeFromAllRooms(socket.id);
    });
  }
  
  addToRoom(room, socketId) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(socketId);
  }
  
  removeFromRoom(room, socketId) {
    const roomSet = this.rooms.get(room);
    if (roomSet) {
      roomSet.delete(socketId);
      if (roomSet.size === 0) {
        this.rooms.delete(room);
      }
    }
  }
  
  removeFromAllRooms(socketId) {
    for (const [room, sockets] of this.rooms) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.rooms.delete(room);
      }
    }
  }
  
  // Event emitters
  emitToWorkspace(workspaceId, event, data) {
    this.io.to(`workspace:${workspaceId}`).emit(event, data);
  }
  
  emitToContact(contactId, event, data) {
    this.io.to(`contact:${contactId}`).emit(event, data);
  }
  
  emitToDeal(dealId, event, data) {
    this.io.to(`deal:${dealId}`).emit(event, data);
  }
  
  emitToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }
  
  // Broadcast events
  broadcastNewMessage(workspaceId, message) {
    this.emitToWorkspace(workspaceId, 'message:new', message);
  }
  
  broadcastContactUpdate(workspaceId, contact) {
    this.emitToWorkspace(workspaceId, 'contact:updated', contact);
  }
  
  broadcastDealUpdate(workspaceId, deal) {
    this.emitToWorkspace(workspaceId, 'deal:updated', deal);
  }
  
  broadcastTaskUpdate(workspaceId, task) {
    this.emitToWorkspace(workspaceId, 'task:updated', task);
  }
  
  broadcastCampaignUpdate(workspaceId, campaign) {
    this.emitToWorkspace(workspaceId, 'campaign:updated', campaign);
  }
  
  notifyUser(userId, notification) {
    this.emitToUser(userId, 'notification', notification);
  }
  
  // Get room info
  getRoomSize(room) {
    return this.rooms.get(room)?.size || 0;
  }
  
  getRooms() {
    return Array.from(this.rooms.keys());
  }
}

export default SocketManager;
