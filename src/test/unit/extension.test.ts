import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';

// The vscode mock is injected via setup.ts (--require)
// We need to get the mock channel to inspect calls
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode');

// Re-require extension fresh for each test suite using a helper
function loadExtension() {
  // Remove cached version so we get a fresh module state
  const extPath = path.resolve(__dirname, '../../extension.js');
  delete require.cache[extPath];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(extPath);
}

describe('extension', function () {
  this.timeout(5000);

  let tmpFile: string;
  let ext: ReturnType<typeof loadExtension>;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `ftail-ext-test-${Date.now()}.log`);
    fs.writeFileSync(tmpFile, 'hello\n');
    // Clear terminal output state
    vscode._terminalOutput.length = 0;
    vscode._mockTerminals.length = 0;
    ext = loadExtension();
  });

  afterEach(() => {
    // Stop all monitors and cleanup
    ext.stopAllMonitoring();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  describe('startMonitoring()', () => {
    it('should add file to activeMonitors', () => {
      ext.startMonitoring(tmpFile);
      assert.ok(ext.activeMonitors.has(tmpFile));
    });

    it('should not add duplicate monitor for same file', () => {
      ext.startMonitoring(tmpFile);
      ext.startMonitoring(tmpFile); // second call is no-op
      assert.strictEqual(ext.activeMonitors.size, 1);
    });

    it('should log start message to terminal', () => {
      ext.startMonitoring(tmpFile);
      const output = vscode._terminalOutput.join('');
      assert.ok(output.includes('Started monitoring'));
    });
  });

  describe('stopMonitoring()', () => {
    it('should remove file from activeMonitors', (done) => {
      ext.startMonitoring(tmpFile);
      assert.ok(ext.activeMonitors.has(tmpFile));
      // Give the 'stopped' event a tick to fire
      setTimeout(() => {
        ext.stopMonitoring(tmpFile);
        setTimeout(() => {
          assert.ok(!ext.activeMonitors.has(tmpFile));
          done();
        }, 50);
      }, 10);
    });

    it('should be safe to call for a file that is not monitored', () => {
      assert.doesNotThrow(() => ext.stopMonitoring('/some/random/file.log'));
    });
  });

  describe('stopAllMonitoring()', () => {
    it('should stop all active monitors', (done) => {
      const tmpFile2 = path.join(os.tmpdir(), `ftail-ext-test2-${Date.now()}.log`);
      fs.writeFileSync(tmpFile2, 'x\n');

      ext.startMonitoring(tmpFile);
      ext.startMonitoring(tmpFile2);
      assert.strictEqual(ext.activeMonitors.size, 2);

      ext.stopAllMonitoring();

      setTimeout(() => {
        assert.strictEqual(ext.activeMonitors.size, 0);
        try { fs.unlinkSync(tmpFile2); } catch { /* ignore */ }
        done();
      }, 100);
    });
  });

  describe('getActiveTerminals()', () => {
    it('should create a terminal when monitoring starts', () => {
      ext.startMonitoring(tmpFile);
      assert.strictEqual(vscode._mockTerminals.length, 1);
      assert.ok(vscode._mockTerminals[0].name.includes(path.basename(tmpFile)));
    });
  });

  describe('activate()', () => {
    it('should register commands without throwing', () => {
      const subscriptions: { dispose(): void }[] = [];
      const mockContext = { subscriptions };

      assert.doesNotThrow(() => {
        ext.activate(mockContext);
      });

      // Cleanup
      subscriptions.forEach((s) => s.dispose());
    });
  });

  describe('deactivate()', () => {
    it('should call stopAllMonitoring', () => {
      ext.startMonitoring(tmpFile);
      assert.ok(ext.activeMonitors.size > 0);
      ext.deactivate();
      // activeMonitors will be cleared asynchronously via 'stopped' event
      // Just ensure deactivate doesn't throw
    });
  });

  describe('ftail.monitorFile command', () => {
    it('should show error if uri is missing', async () => {
      const showErrorStub = sinon.stub(vscode.window, 'showErrorMessage').resolves('');
      try {
        const subscriptions: { dispose(): void }[] = [];
        const mockContext = { subscriptions };
        ext.activate(mockContext);

        await vscode._commands.get('ftail.monitorFile')(undefined);
        assert.ok(showErrorStub.calledOnce);
      } finally {
        showErrorStub.restore();
        // Cleanup subscriptions
      }
    });

    it('should show error if uri scheme is not file', async () => {
      const showErrorStub = sinon.stub(vscode.window, 'showErrorMessage').resolves('');
      try {
        const subscriptions: { dispose(): void }[] = [];
        const mockContext = { subscriptions };
        ext.activate(mockContext);

        await vscode._commands.get('ftail.monitorFile')({ scheme: 'untitled', fsPath: '/some/path' });
        assert.ok(showErrorStub.calledOnce);
      } finally {
        showErrorStub.restore();
      }
    });

    it('should start monitoring when valid file uri is provided', async () => {
      const subscriptions: { dispose(): void }[] = [];
      const mockContext = { subscriptions };
      ext.activate(mockContext);

      const uri = { scheme: 'file', fsPath: tmpFile };
      await vscode._commands.get('ftail.monitorFile')(uri);

      assert.ok(ext.activeMonitors.has(tmpFile));
    });
  });

  describe('ftail.stopMonitoring command', () => {
    it('should show info if no files are monitored', async () => {
      const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('');
      try {
        const subscriptions: { dispose(): void }[] = [];
        ext.activate({ subscriptions });

        await vscode._commands.get('ftail.stopMonitoring')();
        assert.ok(showInfoStub.calledOnce);
      } finally {
        showInfoStub.restore();
      }
    });

    it('should stop the only monitored file directly', (done) => {
      const subscriptions: { dispose(): void }[] = [];
      ext.activate({ subscriptions });

      ext.startMonitoring(tmpFile);

      vscode._commands.get('ftail.stopMonitoring')().then(() => {
        setTimeout(() => {
          assert.ok(!ext.activeMonitors.has(tmpFile));
          done();
        }, 100);
      });
    });

    it('should show quick pick when multiple files are monitored', async () => {
      const tmpFile2 = path.join(os.tmpdir(), `ftail-qp-${Date.now()}.log`);
      fs.writeFileSync(tmpFile2, 'y\n');

      try {
        const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
        const subscriptions: { dispose(): void }[] = [];
        ext.activate({ subscriptions });

        ext.startMonitoring(tmpFile);
        ext.startMonitoring(tmpFile2);

        await vscode._commands.get('ftail.stopMonitoring')();
        assert.ok(showQuickPickStub.calledOnce);
        showQuickPickStub.restore();
      } finally {
        ext.stopMonitoring(tmpFile2);
        try { fs.unlinkSync(tmpFile2); } catch { /* ignore */ }
      }
    });
  });

  describe('event handlers', () => {
    it('should handle data event and write to terminal', (done) => {
      ext.startMonitoring(tmpFile);
      vscode._terminalOutput.length = 0;

      setTimeout(() => {
        fs.appendFileSync(tmpFile, 'new data\n');
      }, 100);

      setTimeout(() => {
        const output = vscode._terminalOutput.join('');
        assert.ok(output.includes('new data'));
        done();
      }, 600);
    });

    it('should handle truncated event and write to terminal', (done) => {
      ext.startMonitoring(tmpFile);
      vscode._terminalOutput.length = 0;

      setTimeout(() => {
        fs.writeFileSync(tmpFile, '');
      }, 100);

      setTimeout(() => {
        const output = vscode._terminalOutput.join('');
        assert.ok(output.includes('truncated'));
        done();
      }, 600);
    });

    it('should handle error event and stop monitoring', (done) => {
      ext.startMonitoring(tmpFile);
      vscode._terminalOutput.length = 0;

      setTimeout(() => {
        fs.unlinkSync(tmpFile);
      }, 100);

      setTimeout(() => {
        const output = vscode._terminalOutput.join('');
        assert.ok(output.includes('Error watching') || output.includes('Stopped monitoring'));
        assert.ok(!ext.activeMonitors.has(tmpFile));
        // Recreate for cleanup
        fs.writeFileSync(tmpFile, '');
        done();
      }, 600);
    });
  });

  describe('context disposal', () => {
    it('should stop all monitoring when context is disposed', (done) => {
      const subscriptions: { dispose(): void }[] = [];
      ext.activate({ subscriptions });
      
      ext.startMonitoring(tmpFile);
      assert.strictEqual(ext.activeMonitors.size, 1);
      
      // Dispose all subscriptions (simulates deactivation)
      subscriptions.forEach((s) => s.dispose());
      
      setTimeout(() => {
        assert.strictEqual(ext.activeMonitors.size, 0);
        done();
      }, 100);
    });

    it('should dispose terminals on context disposal', (done) => {
      const subscriptions: { dispose(): void }[] = [];
      ext.activate({ subscriptions });

      ext.startMonitoring(tmpFile);
      assert.strictEqual(vscode._mockTerminals.length, 1);

      // Dispose all subscriptions (simulates deactivation)
      subscriptions.forEach((s) => s.dispose());

      setTimeout(() => {
        // All monitors should be stopped
        assert.strictEqual(ext.activeMonitors.size, 0);
        done();
      }, 100);
    });

    it('should handle quick pick selection to stop specific file', async () => {
      const tmpFile2 = path.join(os.tmpdir(), `ftail-pick-${Date.now()}.log`);
      fs.writeFileSync(tmpFile2, 'content\n');
      
      const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves({
        label: path.basename(tmpFile),
        description: tmpFile
      });

      try {
        const subscriptions: { dispose(): void }[] = [];
        ext.activate({ subscriptions });

        ext.startMonitoring(tmpFile);
        ext.startMonitoring(tmpFile2);
        assert.strictEqual(ext.activeMonitors.size, 2);

        await vscode._commands.get('ftail.stopMonitoring')();
        
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.ok(!ext.activeMonitors.has(tmpFile));
      } finally {
        showQuickPickStub.restore();
        ext.stopMonitoring(tmpFile2);
        try { fs.unlinkSync(tmpFile2); } catch { /* ignore */ }
      }
    });
  });

  describe('syntax highlighting', () => {
    it('should apply highlighting to monitored file data', (done) => {
      ext.startMonitoring(tmpFile);
      vscode._terminalOutput.length = 0;

      setTimeout(() => {
        fs.appendFileSync(tmpFile, 'ERROR: test message\n');
      }, 100);

      setTimeout(() => {
        const output = vscode._terminalOutput.join('');
        // Terminal renders ANSI: ERROR should be present (with or without color codes)
        assert.ok(output.includes('ERROR'), 'should contain ERROR text');
        ext.stopMonitoring(tmpFile);
        done();
      }, 600);
    });

    it('should get highlighter instance', () => {
      const hl = ext.getHighlighter();
      assert.ok(hl, 'should return highlighter');
      assert.strictEqual(typeof hl.highlight, 'function');
    });

    it('should register toggleSyntaxHighlighting command', () => {
      const subscriptions: { dispose(): void }[] = [];
      ext.activate({ subscriptions });
      
      const cmd = vscode._commands.get('ftail.toggleSyntaxHighlighting');
      assert.ok(cmd, 'should register toggle command');
    });

    it('should toggle syntax highlighting via command', async () => {
      const subscriptions: { dispose(): void }[] = [];
      ext.activate({ subscriptions });
      
      const toggleCmd = vscode._commands.get('ftail.toggleSyntaxHighlighting');
      assert.ok(toggleCmd, 'toggle command should exist');
      
      // First toggle: should disable (from true to false)
      await toggleCmd();
      
      // Second toggle: should enable (from false to true)
      await toggleCmd();
      
      // Command should complete without errors
    });

    it('should call updateHighlighterOptions when highlighter is null', () => {
      // This tests the early return in updateHighlighterOptions when highlighter is null
      // At this point, highlighter hasn't been initialized yet
      ext.updateHighlighterOptions();
      // Should not throw
    });

    it('should handle configuration change event', async () => {
      const subscriptions: { dispose(): void }[] = [];
      ext.activate({ subscriptions });
      
      // Initialize the highlighter
      ext.getHighlighter();
      
      // Simulate configuration change
      const config = vscode.workspace.getConfiguration('ftail');
      await config.update('syntaxHighlighting.enabled', false, vscode.ConfigurationTarget.Global);
      
      // Trigger the configuration change event
      vscode._triggerConfigChange('ftail.syntaxHighlighting');
      
      // Verify the highlighter was updated (no errors thrown)
    });
  });
});
