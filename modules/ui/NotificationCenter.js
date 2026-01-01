/**
 * Notification Center
 * In-app notification management
 */

class NotificationCenter {
  constructor() {
    this.notifications = [];
    this.listeners = [];
    this.maxNotifications = 50;
  }
  
  show(notification) {
    const n = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      read: false,
      ...notification,
    };
    
    this.notifications.unshift(n);
    
    // Limit stored notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }
    
    // Notify listeners
    this.notifyListeners();
    
    // Show browser notification if permission granted
    if (Notification.permission === 'granted' && notification.showBrowser !== false) {
      new Notification(notification.title, {
        body: notification.message,
        icon: notification.icon || '/icons/icon-128.png',
      });
    }
    
    return n.id;
  }
  
  success(title, message, options = {}) {
    return this.show({
      type: 'success',
      title,
      message,
      ...options,
    });
  }
  
  error(title, message, options = {}) {
    return this.show({
      type: 'error',
      title,
      message,
      ...options,
    });
  }
  
  warning(title, message, options = {}) {
    return this.show({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }
  
  info(title, message, options = {}) {
    return this.show({
      type: 'info',
      title,
      message,
      ...options,
    });
  }
  
  markAsRead(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notifyListeners();
    }
  }
  
  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.notifyListeners();
  }
  
  remove(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index > -1) {
      this.notifications.splice(index, 1);
      this.notifyListeners();
    }
  }
  
  clear() {
    this.notifications = [];
    this.notifyListeners();
  }
  
  getAll() {
    return this.notifications;
  }
  
  getUnread() {
    return this.notifications.filter(n => !n.read);
  }
  
  getUnreadCount() {
    return this.getUnread().length;
  }
  
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.notifications);
      } catch (error) {
        console.error('[NotificationCenter] Listener error:', error);
      }
    });
  }
  
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }
}

// Create singleton instance
const notificationCenter = new NotificationCenter();

// Export for use in modules
window.NotificationCenter = notificationCenter;

export default notificationCenter;
