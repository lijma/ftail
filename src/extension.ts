import * as vscode from 'vscode';
import * as path from 'path';
import { FileMonitor } from './fileMonitor';
import { LogHighlighter } from './logHighlighter';

// Map from file path to its active FileMonitor instance
const activeMonitors = new Map<string, FileMonitor>();

// Map from file path to its terminal and write emitter
const activeTerminals = new Map<string, { terminal: vscode.Terminal; writeEmitter: vscode.EventEmitter<string> }>();

// Log highlighter instance
let highlighter: LogHighlighter | undefined;

function getHighlighter(): LogHighlighter {
  if (!highlighter) {
    highlighter = LogHighlighter.createDefault();
    updateHighlighterOptions();
  }
  return highlighter;
}

function updateHighlighterOptions(): void {
  if (!highlighter) {
    return;
  }

  const config = vscode.workspace.getConfiguration('ftail');
  highlighter.setOptions({
    enabled: config.get('syntaxHighlighting.enabled', true),
    colorizeLogLevels: config.get('syntaxHighlighting.colorizeLogLevels', true),
    colorizeTimestamps: config.get('syntaxHighlighting.colorizeTimestamps', true),
    colorizeNumbers: config.get('syntaxHighlighting.colorizeNumbers', true),
    colorizeUrls: config.get('syntaxHighlighting.colorizeUrls', true),
    colorizeIpAddresses: config.get('syntaxHighlighting.colorizeIpAddresses', true),
    colorizeFilePaths: config.get('syntaxHighlighting.colorizeFilePaths', true),
  });
}

function startMonitoring(filePath: string): void {
  if (activeMonitors.has(filePath)) {
    vscode.window.showInformationMessage(`ftail: already monitoring ${path.basename(filePath)}`);
    return;
  }

  const writeEmitter = new vscode.EventEmitter<string>();

  const pty: vscode.Pseudoterminal = {
    onDidWrite: writeEmitter.event,
    open: () => {
      writeEmitter.fire(`\x1b[2mStarted monitoring: ${filePath}\x1b[0m\r\n`);
      writeEmitter.fire(`\x1b[2mUse "Stop Monitoring (ftail)" to stop.\x1b[0m\r\n`);
    },
    close: () => { /* terminal closed by user */ },
  };

  const terminal = vscode.window.createTerminal({
    name: `ftail: ${path.basename(filePath)}`,
    pty,
  });
  terminal.show();

  activeTerminals.set(filePath, { terminal, writeEmitter });

  const monitor = new FileMonitor(filePath);
  const hl = getHighlighter();

  monitor.on('data', (content: string) => {
    const highlighted = hl.highlight(content);
    // Normalize line endings for terminal (PTY requires \r\n)
    writeEmitter.fire(highlighted.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
  });

  monitor.on('truncated', () => {
    writeEmitter.fire(`\x1b[33m[ftail] File truncated: ${filePath}\x1b[0m\r\n`);
  });

  monitor.on('error', (err: Error) => {
    writeEmitter.fire(`\x1b[31m[ftail] Error watching ${filePath}: ${err.message}\x1b[0m\r\n`);
    stopMonitoring(filePath);
  });

  monitor.on('stopped', () => {
    activeMonitors.delete(filePath);
    const entry = activeTerminals.get(filePath);
    if (entry) {
      entry.writeEmitter.fire(`\x1b[2m[ftail] Stopped monitoring: ${filePath}\x1b[0m\r\n`);
      entry.writeEmitter.dispose();
      activeTerminals.delete(filePath);
    }
  });

  activeMonitors.set(filePath, monitor);
  monitor.start();
}

function stopMonitoring(filePath: string): void {
  const monitor = activeMonitors.get(filePath);
  if (monitor) {
    monitor.stop();
    // activeMonitors.delete and activeTerminals cleanup handled in 'stopped' event
  }
}

function stopAllMonitoring(): void {
  for (const [filePath] of activeMonitors) {
    stopMonitoring(filePath);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  // Command: right-click a file to start monitoring
  const monitorCmd = vscode.commands.registerCommand(
    'ftail.monitorFile',
    (uri: vscode.Uri) => {
      if (!uri || uri.scheme !== 'file') {
        vscode.window.showErrorMessage('ftail: please select a file to monitor.');
        return;
      }
      startMonitoring(uri.fsPath);
    }
  );

  // Command: stop monitoring (shows quick pick if multiple files are monitored)
  const stopCmd = vscode.commands.registerCommand(
    'ftail.stopMonitoring',
    async () => {
      if (activeMonitors.size === 0) {
        vscode.window.showInformationMessage('ftail: no files are currently being monitored.');
        return;
      }

      const files = Array.from(activeMonitors.keys());

      if (files.length === 1) {
        stopMonitoring(files[0]);
        return;
      }

      const selected = await vscode.window.showQuickPick(
        files.map((f) => ({ label: path.basename(f), description: f })),
        { placeHolder: 'Select a file to stop monitoring' }
      );

      if (selected) {
        stopMonitoring(selected.description!);
      }
    }
  );

  // Command: toggle syntax highlighting
  const toggleHighlightCmd = vscode.commands.registerCommand(
    'ftail.toggleSyntaxHighlighting',
    async () => {
      const config = vscode.workspace.getConfiguration('ftail');
      const currentValue = config.get('syntaxHighlighting.enabled', true);
      await config.update('syntaxHighlighting.enabled', !currentValue, vscode.ConfigurationTarget.Global);
      const newState = !currentValue ? 'enabled' : 'disabled';
      vscode.window.showInformationMessage(`ftail: syntax highlighting ${newState}`);
    }
  );

  // Listen for configuration changes
  const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('ftail.syntaxHighlighting')) {
      updateHighlighterOptions();
    }
  });

  context.subscriptions.push(monitorCmd, stopCmd, toggleHighlightCmd, configChangeListener, {
    dispose: () => {
      // Snapshot before stopping (stop clears activeTerminals via 'stopped' event)
      const terminalEntries = Array.from(activeTerminals.values());
      stopAllMonitoring();
      // Dispose terminal instances (write emitters already disposed in 'stopped' handler)
      for (const entry of terminalEntries) {
        entry.terminal.dispose();
      }
      highlighter = undefined;
    },
  });
}

export function deactivate(): void {
  const terminalEntries = Array.from(activeTerminals.values());
  stopAllMonitoring();
  for (const entry of terminalEntries) {
    entry.terminal.dispose();
  }
  highlighter = undefined;
}

// Exported for testing
export { startMonitoring, stopMonitoring, stopAllMonitoring, activeMonitors, activeTerminals, getHighlighter, updateHighlighterOptions };
