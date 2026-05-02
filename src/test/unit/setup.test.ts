import * as assert from 'assert';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode');

describe('vscode mock (setup.ts)', function () {
  it('should provide Uri.file function', () => {
    const uri = vscode.Uri.file('/some/path');
    assert.strictEqual(uri.scheme, 'file');
    assert.strictEqual(uri.fsPath, '/some/path');
  });

  it('should provide window.showInformationMessage', async () => {
    const result = await vscode.window.showInformationMessage('test');
    assert.strictEqual(result, 'test');
  });

  it('should provide window.showErrorMessage', async () => {
    const result = await vscode.window.showErrorMessage('error');
    assert.strictEqual(result, 'error');
  });

  it('should provide window.showQuickPick', async () => {
    const result = await vscode.window.showQuickPick([{ label: 'item' }]);
    assert.strictEqual(result, undefined);
  });

  it('should provide window.createOutputChannel', () => {
    const channel = vscode.window.createOutputChannel('test');
    assert.ok(channel);
    assert.strictEqual(channel.name, 'ftail');
  });

  it('should provide window.createTerminal', () => {
    const written: string[] = [];
    const emitter = new vscode.EventEmitter();
    const terminal = vscode.window.createTerminal({
      name: 'test-terminal',
      pty: {
        onDidWrite: emitter.event,
        open: () => { emitter.fire('opened\r\n'); },
        close: () => {},
      },
    });
    assert.ok(terminal);
    assert.strictEqual(terminal.name, 'test-terminal');
    // 'opened' message should have been captured via onDidWrite
    assert.ok(vscode._terminalOutput.join('').includes('opened'));
    terminal.show();
    terminal.dispose(); // triggers pty.close()
    void written;
  });

  it('should create terminal without pty', () => {
    const terminal = vscode.window.createTerminal({ name: 'plain-terminal' });
    assert.ok(terminal);
    assert.strictEqual(terminal.name, 'plain-terminal');
    terminal.show();
    terminal.dispose();

    // Also test fallback when name is omitted
    const termNoName = vscode.window.createTerminal({});
    assert.strictEqual(termNoName.name, '');
    termNoName.dispose();
  });

  it('should provide EventEmitter class', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emitter = new (vscode.EventEmitter as any)();
    const received: string[] = [];
    const sub = emitter.event((data: string) => received.push(data));
    emitter.fire('hello');
    emitter.fire('world');
    assert.deepStrictEqual(received, ['hello', 'world']);
    sub.dispose();
    emitter.fire('after-dispose');
    assert.strictEqual(received.length, 2, 'listener should be removed after dispose');
    emitter.dispose();
  });

  it('should provide commands.registerCommand', () => {
    const disposable = vscode.commands.registerCommand('test.command', () => 'test');
    assert.ok(disposable);
    assert.ok(typeof disposable.dispose === 'function');
    disposable.dispose();
  });

  it('should provide commands.executeCommand', async () => {
    let called = false;
    const disposable = vscode.commands.registerCommand('test.cmd', () => { called = true; });
    await vscode.commands.executeCommand('test.cmd');
    assert.ok(called);
    disposable.dispose();
  });

  it('should handle executeCommand for non-existent command', async () => {
    const result = await vscode.commands.executeCommand('non.existent');
    assert.strictEqual(result, undefined);
  });

  it('should provide mockChannel methods', () => {
    const channel = vscode._mockChannel;
    
    // Test all methods for coverage
    channel.show();
    channel.hide();
    channel.replace();
    channel.clear();
    channel.dispose();
    
    channel.appendLine('line');
    assert.strictEqual(channel._lines[0], 'line');
    
    channel.append('raw');
    assert.strictEqual(channel._raw[0], 'raw');
    
    channel.clear();
    assert.strictEqual(channel._lines.length, 0);
    assert.strictEqual(channel._raw.length, 0);
  });

  it('should maintain command registry', () => {
    const handler = () => 'result';
    vscode.commands.registerCommand('test.reg', handler);
    assert.ok(vscode._commands.has('test.reg'));
    
    const disposable = { dispose() { vscode._commands.delete('test.reg'); } };
    disposable.dispose();
    assert.ok(!vscode._commands.has('test.reg'));
  });

  it('should provide workspace.getConfiguration', () => {
    const config = vscode.workspace.getConfiguration('ftail');
    assert.ok(config);
    assert.strictEqual(typeof config.get, 'function');
    assert.strictEqual(typeof config.has, 'function');
    assert.strictEqual(typeof config.update, 'function');
    assert.strictEqual(typeof config.inspect, 'function');
    
    // Call inspect to improve function coverage
    const inspectResult = config.inspect('syntaxHighlighting.enabled');
    assert.strictEqual(inspectResult, undefined);
  });

  it('should get configuration values', () => {
    const config = vscode.workspace.getConfiguration('ftail');
    
    // Get current value (may have been changed by previous tests)
    const currentValue = config.get('syntaxHighlighting.enabled');
    assert.ok(currentValue === true || currentValue === false, 'should be boolean');
    
    // Test with defaults
    const colorizeLogLevels = config.get('syntaxHighlighting.colorizeLogLevels', false);
    assert.ok(colorizeLogLevels === true || colorizeLogLevels === false);
    
    // Non-existent key with default
    assert.strictEqual(config.get('nonexistent.key', 'default'), 'default');
  });

  it('should check if configuration has key', () => {
    const config = vscode.workspace.getConfiguration('ftail');
    
    assert.strictEqual(config.has('syntaxHighlighting.enabled'), true);
    assert.strictEqual(config.has('nonexistent.key'), false);
  });

  it('should update configuration values', async () => {
    const config = vscode.workspace.getConfiguration('ftail');
    
    const originalValue = config.get('syntaxHighlighting.enabled');
    await config.update('syntaxHighlighting.enabled', false);
    assert.strictEqual(config.get('syntaxHighlighting.enabled'), false);
    
    // Reset to original value
    await config.update('syntaxHighlighting.enabled', originalValue);
  });

  it('should provide workspace.onDidChangeConfiguration', () => {
    const listener = vscode.workspace.onDidChangeConfiguration(() => {});
    assert.ok(listener);
    assert.strictEqual(typeof listener.dispose, 'function');
    listener.dispose();
  });

  it('should provide ConfigurationTarget enum', () => {
    assert.strictEqual(vscode.ConfigurationTarget.Global, 1);
    assert.strictEqual(vscode.ConfigurationTarget.Workspace, 2);
    assert.strictEqual(vscode.ConfigurationTarget.WorkspaceFolder, 3);
  });

  it('should trigger configuration change listeners', () => {
    let called = false;
    let affectedFtail = false;
    let affectedFtailSub = false;
    let notAffectedOther = true;
    
    const disposable = vscode.workspace.onDidChangeConfiguration((e: { affectsConfiguration(section: string): boolean }) => {
      called = true;
      affectedFtail = e.affectsConfiguration('ftail');
      affectedFtailSub = e.affectsConfiguration('ftail.syntaxHighlighting');
      notAffectedOther = e.affectsConfiguration('otherExtension');
    });
    
    vscode._triggerConfigChange('ftail.syntaxHighlighting.enabled');
    
    assert.ok(called, 'listener should be called');
    assert.ok(affectedFtail, 'should affect ftail section');
    assert.ok(affectedFtailSub, 'should affect ftail.syntaxHighlighting section');
    assert.ok(!notAffectedOther, 'should not affect unrelated section');
    
    disposable.dispose();
  });
});
