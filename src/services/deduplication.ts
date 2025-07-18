import { ParsedEvent } from './eventParser';
import { getLogger } from '../utils/logger';

export interface EventEntry {
  eventId: string;
  eventType: string;
  repository: string;
  timestamp: Date;
  processed: boolean;
}

export class EventDeduplicationService {
  private readonly processedEvents: Map<string, EventEntry> = new Map();
  private readonly maxCacheSize: number = 10000;
  private readonly cacheExpirationMs: number = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupTimer?: NodeJS.Timeout | undefined;

  constructor(maxCacheSize?: number, cacheExpirationMs?: number) {
    this.maxCacheSize = maxCacheSize || 10000;
    this.cacheExpirationMs = cacheExpirationMs || 24 * 60 * 60 * 1000;

    if (process.env['NODE_ENV'] !== 'test') {
      this.cleanupTimer = setInterval(() => this.cleanupExpiredEntries(), 60 * 60 * 1000); // Every hour
    }
  }

  /**
   * Check if an event has already been processed
   */
  isDuplicate(event: ParsedEvent): boolean {
    const logger = getLogger();
    const key = this.generateEventKey(event);

    const existingEntry = this.processedEvents.get(key);

    if (existingEntry) {
      logger.debug('Duplicate event detected', {
        eventId: event.eventId,
        eventType: event.eventType,
        repository: event.repository,
        originalTimestamp: existingEntry.timestamp,
        currentTimestamp: event.timestamp,
      });
      return true;
    }

    return false;
  }

  /**
   * Mark an event as processed
   */
  markAsProcessed(event: ParsedEvent): void {
    const logger = getLogger();
    const key = this.generateEventKey(event);

    const entry: EventEntry = {
      eventId: event.eventId,
      eventType: event.eventType,
      repository: event.repository,
      timestamp: event.timestamp,
      processed: true,
    };

    this.processedEvents.set(key, entry);

    if (this.processedEvents.size > this.maxCacheSize) {
      this.evictOldestEntries();
    }

    logger.debug('Event marked as processed', {
      eventId: event.eventId,
      eventType: event.eventType,
      repository: event.repository,
      cacheSize: this.processedEvents.size,
    });
  }

  /**
   * Check if event is duplicate and mark as processed in one operation
   */
  checkAndMarkProcessed(event: ParsedEvent): boolean {
    if (this.isDuplicate(event)) {
      return true;
    }

    this.markAsProcessed(event);
    return false;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; oldestEntry?: Date | undefined } {
    let oldestEntry: Date | undefined;

    for (const entry of this.processedEvents.values()) {
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
    }

    return {
      size: this.processedEvents.size,
      maxSize: this.maxCacheSize,
      oldestEntry: oldestEntry || undefined,
    };
  }

  /**
   * Clear all cached events (for testing)
   */
  clearCache(): void {
    this.processedEvents.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.processedEvents.clear();
  }

  private generateEventKey(event: ParsedEvent): string {
    let key = `${event.eventType}:${event.eventId}`;

    key += `:${event.repository}`;

    if (event.eventType === 'push' && event.details['headCommit']) {
      const headCommit = event.details['headCommit'] as { id: string };
      key += `:${headCommit.id}`;
    }

    return key;
  }

  private cleanupExpiredEntries(): void {
    const logger = getLogger();
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.processedEvents.entries()) {
      if (now.getTime() - entry.timestamp.getTime() > this.cacheExpirationMs) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      for (const key of expiredKeys) {
        this.processedEvents.delete(key);
      }

      logger.debug('Cleaned up expired event entries', {
        expiredCount: expiredKeys.length,
        remainingCount: this.processedEvents.size,
      });
    }
  }

  private evictOldestEntries(): void {
    const logger = getLogger();
    const entries = Array.from(this.processedEvents.entries());

    entries.sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());

    const targetSize = Math.floor(this.maxCacheSize * 0.9); // Keep 90% of max size
    const countToRemove = Math.max(1, this.processedEvents.size - targetSize);
    const keysToRemove = entries.slice(0, countToRemove).map(([key]) => key);

    for (const key of keysToRemove) {
      this.processedEvents.delete(key);
    }

    logger.debug('Evicted oldest event entries', {
      evictedCount: keysToRemove.length,
      remainingCount: this.processedEvents.size,
    });
  }
}
