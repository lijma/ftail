import * as fs from 'fs';
import { EventEmitter } from 'events';

export interface FileMonitorOptions {
  pollInterval?: number; // milliseconds between polls, default 500
}

export class FileMonitor extends EventEmitter {
  private filePath: string;
  private pollInterval: number;
  private lastSize: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: boolean = false;

  constructor(filePath: string, options: FileMonitorOptions = {}) {
    super();
    this.filePath = filePath;
    this.pollInterval = options.pollInterval ?? 500;
  }

  /**
   * Start monitoring the file.
   * Reads the current file size first so only new content is reported.
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;

    try {
      const stat = fs.statSync(this.filePath);
      this.lastSize = stat.size;
    } catch {
      this.lastSize = 0;
    }

    this.scheduleNextPoll();
    this.emit('started', this.filePath);
  }

  /** Stop monitoring the file. */
  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.emit('stopped', this.filePath);
  }

  get isRunning(): boolean {
    return this.running;
  }

  private scheduleNextPoll(): void {
    if (!this.running) {
      return;
    }
    this.timer = setTimeout(() => this.poll(), this.pollInterval);
  }

  private poll(): void {
    if (!this.running) {
      return;
    }

    try {
      const stat = fs.statSync(this.filePath);
      const currentSize = stat.size;

      if (currentSize > this.lastSize) {
        const newContent = this.readNewContent(currentSize);
        if (newContent) {
          this.emit('data', newContent);
        }
        this.lastSize = currentSize;
      } else if (currentSize < this.lastSize) {
        // File was truncated (e.g., log rotation)
        this.lastSize = currentSize;
        this.emit('truncated', this.filePath);
      }
    } catch (err) {
      this.emit('error', err);
    }

    this.scheduleNextPoll();
  }

  // Safe file descriptor close with error suppression
  private closeFileSafe(fd: number | null): void {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Defensive programming: suppress rare closeSync failures (e.g., EBADF)
      }
    }
  }

  // Exposed for testing edge cases
  public readNewContent(currentSize: number): string | null {
    const length = currentSize - this.lastSize;
    if (length <= 0) {
      return null;
    }

    const buffer = Buffer.alloc(length);
    let fd: number | null = null;
    try {
      fd = fs.openSync(this.filePath, 'r');
      fs.readSync(fd, buffer, 0, length, this.lastSize);
      return buffer.toString('utf8');
    } catch (err) {
      this.emit('error', err);
      return null;
    /* c8 ignore next 3 */
    } finally {
      this.closeFileSafe(fd);
    }
  }
}
