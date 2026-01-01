/**
 * Queue Manager
 * Bull queue manager for background jobs
 */

import Queue from 'bull';

class QueueManager {
  constructor() {
    this.queues = new Map();
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    };
  }
  
  /**
   * Get or create queue
   */
  getQueue(name, options = {}) {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
          ...options.defaultJobOptions,
        },
        ...options,
      });
      
      queue.on('error', (error) => {
        console.error(`[Queue:${name}] Error:`, error);
      });
      
      queue.on('failed', (job, error) => {
        console.error(`[Queue:${name}] Job ${job.id} failed:`, error);
      });
      
      this.queues.set(name, queue);
    }
    
    return this.queues.get(name);
  }
  
  /**
   * Add job to queue
   */
  async addJob(queueName, data, options = {}) {
    const queue = this.getQueue(queueName);
    return queue.add(data, options);
  }
  
  /**
   * Add bulk jobs
   */
  async addBulk(queueName, jobs) {
    const queue = this.getQueue(queueName);
    return queue.addBulk(jobs);
  }
  
  /**
   * Process jobs in queue
   */
  process(queueName, processor, concurrency = 1) {
    const queue = this.getQueue(queueName);
    queue.process(concurrency, processor);
  }
  
  /**
   * Get job by ID
   */
  async getJob(queueName, jobId) {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }
  
  /**
   * Get job counts
   */
  async getJobCounts(queueName) {
    const queue = this.getQueue(queueName);
    return queue.getJobCounts();
  }
  
  /**
   * Get waiting jobs
   */
  async getWaiting(queueName, start = 0, end = -1) {
    const queue = this.getQueue(queueName);
    return queue.getWaiting(start, end);
  }
  
  /**
   * Get active jobs
   */
  async getActive(queueName, start = 0, end = -1) {
    const queue = this.getQueue(queueName);
    return queue.getActive(start, end);
  }
  
  /**
   * Get completed jobs
   */
  async getCompleted(queueName, start = 0, end = -1) {
    const queue = this.getQueue(queueName);
    return queue.getCompleted(start, end);
  }
  
  /**
   * Get failed jobs
   */
  async getFailed(queueName, start = 0, end = -1) {
    const queue = this.getQueue(queueName);
    return queue.getFailed(start, end);
  }
  
  /**
   * Pause queue
   */
  async pause(queueName) {
    const queue = this.getQueue(queueName);
    return queue.pause();
  }
  
  /**
   * Resume queue
   */
  async resume(queueName) {
    const queue = this.getQueue(queueName);
    return queue.resume();
  }
  
  /**
   * Clean queue (remove completed/failed jobs)
   */
  async clean(queueName, grace, status = 'completed') {
    const queue = this.getQueue(queueName);
    return queue.clean(grace, status);
  }
  
  /**
   * Empty queue (remove all jobs)
   */
  async empty(queueName) {
    const queue = this.getQueue(queueName);
    return queue.empty();
  }
  
  /**
   * Close queue
   */
  async close(queueName) {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.close();
      this.queues.delete(queueName);
    }
  }
  
  /**
   * Close all queues
   */
  async closeAll() {
    for (const [name, queue] of this.queues) {
      await queue.close();
    }
    this.queues.clear();
  }
}

export default new QueueManager();
