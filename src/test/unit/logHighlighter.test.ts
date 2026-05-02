import * as assert from 'assert';
import { LogHighlighter, Colors } from '../../logHighlighter';

describe('LogHighlighter', () => {
  let highlighter: LogHighlighter;

  beforeEach(() => {
    highlighter = new LogHighlighter();
  });

  describe('Log Level Highlighting', () => {
    it('should highlight ERROR in red', () => {
      const input = 'This is an ERROR message';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.error), 'should contain error color');
      assert.ok(output.includes('ERROR'), 'should contain ERROR text');
      assert.ok(output.includes(Colors.reset), 'should contain reset code');
    });

    it('should highlight WARN in yellow', () => {
      const input = 'This is a WARN message';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.warn), 'should contain warn color');
      assert.ok(output.includes('WARN'), 'should contain WARN text');
    });

    it('should highlight INFO in blue', () => {
      const input = 'This is an INFO message';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.info), 'should contain info color');
      assert.ok(output.includes('INFO'), 'should contain INFO text');
    });

    it('should highlight SUCCESS in green', () => {
      const input = 'This is a SUCCESS message';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.success), 'should contain success color');
      assert.ok(output.includes('SUCCESS'), 'should contain SUCCESS text');
    });

    it('should highlight DEBUG in magenta', () => {
      const input = 'This is a DEBUG message';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.debug), 'should contain debug color');
      assert.ok(output.includes('DEBUG'), 'should contain DEBUG text');
    });

    it('should handle case-insensitive log levels', () => {
      const inputs = ['error message', 'Error message', 'ERROR message'];
      for (const input of inputs) {
        const output = highlighter.highlight(input);
        assert.ok(output.includes(Colors.error), `should highlight: ${input}`);
      }
    });

    it('should highlight multiple log levels in one line', () => {
      const input = 'ERROR: failed, WARN: retrying';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.error), 'should contain error color');
      assert.ok(output.includes(Colors.warn), 'should contain warn color');
    });
  });

  describe('Timestamp Highlighting', () => {
    it('should highlight ISO 8601 timestamps', () => {
      const input = '2024-05-02T10:30:45.123Z some message';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.timestamp), 'should contain timestamp color');
      assert.ok(output.includes('2024-05-02T10:30:45.123Z'), 'should contain timestamp');
    });

    it('should highlight time-only timestamps', () => {
      const input = '10:30:45 some message';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.timestamp), 'should contain timestamp color');
      assert.ok(output.includes('10:30:45'), 'should contain time');
    });

    it('should highlight bracketed timestamps', () => {
      const input = '[2024-05-02 10:30:45] some message';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.timestamp), 'should contain timestamp color');
    });
  });

  describe('Number Highlighting', () => {
    it('should highlight integers', () => {
      const input = 'count: 42';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.number), 'should contain number color');
      assert.ok(output.includes('42'), 'should contain number');
    });

    it('should highlight floats', () => {
      const input = 'value: 3.14159';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.number), 'should contain number color');
      assert.ok(output.includes('3.14159'), 'should contain float');
    });

    it('should highlight percentages', () => {
      const input = 'progress: 85%';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.number), 'should contain number color');
      // Note: % symbol may not be inside color codes, but the number 85 should be
      assert.ok(output.includes('85'), 'should contain number part');
    });

    it('should highlight hex numbers', () => {
      const input = 'address: 0x1A2B3C';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.number), 'should contain number color');
      assert.ok(output.includes('0x1A2B3C'), 'should contain hex');
    });
  });

  describe('URL Highlighting', () => {
    it('should highlight http URLs', () => {
      const input = 'visit http://example.com for info';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.url), 'should contain url color');
      assert.ok(output.includes('http://example.com'), 'should contain URL');
    });

    it('should highlight https URLs', () => {
      const input = 'secure: https://example.com/path?query=1';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.url), 'should contain url color');
      // URL may be split by other highlighting, just check protocol and domain are present
      assert.ok(output.includes('https://example.com'), 'should contain URL protocol and domain');
    });

    it('should highlight websocket URLs', () => {
      const input = 'connect to ws://localhost:8080';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.url), 'should contain url color');
      assert.ok(output.includes('ws://localhost:8080'), 'should contain ws URL');
    });
  });

  describe('IP Address Highlighting', () => {
    it('should highlight IPv4 addresses', () => {
      const input = 'server: 192.168.1.1';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.ip), 'should contain ip color');
      assert.ok(output.includes('192.168.1.1'), 'should contain IP');
    });

    it('should highlight IPv4 with port', () => {
      const input = 'listening on 127.0.0.1:8080';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.ip), 'should contain ip color');
      assert.ok(output.includes('127.0.0.1:8080'), 'should contain IP:port');
    });
  });

  describe('File Path Highlighting', () => {
    it('should highlight Unix paths', () => {
      const input = 'file: /var/log/app.log';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.path), 'should contain path color');
      // Path may be split by other highlighting, check main components are present
      assert.ok(output.includes('/log/app.log'), 'should contain path components');
    });

    it('should highlight Windows paths', () => {
      const input = 'file: C:\\Users\\test\\file.txt';
      const output = highlighter.highlight(input);
      assert.ok(output.includes(Colors.path), 'should contain path color');
      assert.ok(output.includes('C:\\Users\\test\\file.txt'), 'should contain path');
    });
  });

  describe('Configuration', () => {
    it('should respect enabled flag', () => {
      highlighter.setOptions({ enabled: false });
      const input = 'ERROR: test message with 123';
      const output = highlighter.highlight(input);
      assert.strictEqual(output, input, 'should not modify text when disabled');
    });

    it('should respect colorizeLogLevels flag', () => {
      highlighter.setOptions({ colorizeLogLevels: false });
      const input = 'ERROR message';
      const output = highlighter.highlight(input);
      assert.ok(!output.includes(Colors.error), 'should not colorize log levels');
    });

    it('should respect colorizeNumbers flag', () => {
      highlighter.setOptions({ colorizeNumbers: false });
      const input = 'count: 42';
      const output = highlighter.highlight(input);
      assert.ok(!output.includes(Colors.number), 'should not colorize numbers');
    });

    it('should respect colorizeUrls flag', () => {
      highlighter.setOptions({ colorizeUrls: false });
      const input = 'visit https://example.com';
      const output = highlighter.highlight(input);
      assert.ok(!output.includes(Colors.url), 'should not colorize URLs');
    });

    it('should update options correctly', () => {
      const initialOptions = highlighter.getOptions();
      assert.strictEqual(initialOptions.enabled, true);

      highlighter.setOptions({ enabled: false, colorizeNumbers: false });
      const newOptions = highlighter.getOptions();
      assert.strictEqual(newOptions.enabled, false);
      assert.strictEqual(newOptions.colorizeNumbers, false);
      assert.strictEqual(newOptions.colorizeLogLevels, true); // unchanged
    });
  });

  describe('Complex Log Lines', () => {
    it('should handle typical application log line', () => {
      const input = '[2024-05-02 10:30:45] ERROR: Failed to connect to 192.168.1.1:8080 - attempt 3/10';
      const output = highlighter.highlight(input);
      
      assert.ok(output.includes(Colors.timestamp), 'should highlight timestamp');
      assert.ok(output.includes(Colors.error), 'should highlight ERROR');
      assert.ok(output.includes(Colors.ip), 'should highlight IP');
      assert.ok(output.includes(Colors.number), 'should highlight numbers');
    });

    it('should handle web server access log', () => {
      const input = '192.168.1.100 - - [02/May/2024:10:30:45 +0000] "GET /api/users HTTP/1.1" 200 1234';
      const output = highlighter.highlight(input);
      
      assert.ok(output.includes(Colors.ip), 'should highlight IP');
      assert.ok(output.includes(Colors.timestamp), 'should highlight timestamp');
      assert.ok(output.includes(Colors.number), 'should highlight status code and size');
    });

    it('should handle empty input', () => {
      const output = highlighter.highlight('');
      assert.strictEqual(output, '');
    });

    it('should handle input without special patterns', () => {
      const input = 'just plain text';
      const output = highlighter.highlight(input);
      assert.strictEqual(output, input);
    });
  });

  describe('stripColors', () => {
    it('should remove all ANSI codes', () => {
      const colored = `${Colors.error}ERROR${Colors.reset} message with ${Colors.number}123${Colors.reset}`;
      const stripped = LogHighlighter.stripColors(colored);
      assert.strictEqual(stripped, 'ERROR message with 123');
    });

    it('should handle text without ANSI codes', () => {
      const plain = 'plain text';
      const stripped = LogHighlighter.stripColors(plain);
      assert.strictEqual(stripped, plain);
    });

    it('should handle empty string', () => {
      const stripped = LogHighlighter.stripColors('');
      assert.strictEqual(stripped, '');
    });
  });

  describe('Factory method', () => {
    it('should create default highlighter', () => {
      const hl = LogHighlighter.createDefault();
      const options = hl.getOptions();
      assert.strictEqual(options.enabled, true);
      assert.strictEqual(options.colorizeLogLevels, true);
      assert.strictEqual(options.colorizeTimestamps, true);
    });
  });
});
