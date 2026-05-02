// Minimal VS Code API mock for unit tests
// This is loaded before tests via --require

// ---------- Output Channel mock (kept for setup.test.ts compatibility) ----------
const outputLines: string[] = [];
const appendedRaw: string[] = [];

const mockOutputChannel = {
  name: 'ftail',
  _lines: outputLines,
  _raw: appendedRaw,
  appendLine(value: string) { outputLines.push(value); },
  append(value: string) { appendedRaw.push(value); },
  show() {},
  dispose() {
    outputLines.length = 0;
    appendedRaw.length = 0;
  },
  clear() {
    outputLines.length = 0;
    appendedRaw.length = 0;
  },
  replace() {},
  hide() {},
};

// ---------- Terminal mock ----------
const terminalOutput: string[] = [];
const mockTerminals: Array<{ name: string; show(): void; dispose(): void }> = [];

// ---------- EventEmitter mock (mirrors vscode.EventEmitter API) ----------
class EventEmitter<T = void> {
  private listeners: Array<(data: T) => void> = [];

  event = (listener: (data: T) => void): { dispose(): void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx > -1) { this.listeners.splice(idx, 1); }
      },
    };
  };

  fire(data: T): void {
    [...this.listeners].forEach(l => l(data));
  }

  dispose(): void {
    this.listeners.length = 0;
  }
}

const commands = new Map<string, (...args: unknown[]) => unknown>();

// Mock configuration store
const configStore = new Map<string, unknown>();

// Set default ftail configuration
configStore.set('ftail.syntaxHighlighting.enabled', true);
configStore.set('ftail.syntaxHighlighting.colorizeLogLevels', true);
configStore.set('ftail.syntaxHighlighting.colorizeTimestamps', true);
configStore.set('ftail.syntaxHighlighting.colorizeNumbers', true);
configStore.set('ftail.syntaxHighlighting.colorizeUrls', true);
configStore.set('ftail.syntaxHighlighting.colorizeIpAddresses', true);
configStore.set('ftail.syntaxHighlighting.colorizeFilePaths', true);

const mockConfiguration = {
  get(key: string, defaultValue?: unknown) {
    const fullKey = `ftail.${key}`;
    return configStore.has(fullKey) ? configStore.get(fullKey) : defaultValue;
  },
  has(key: string) {
    return configStore.has(`ftail.${key}`);
  },
  update(key: string, value: unknown) {
    configStore.set(`ftail.${key}`, value);
    return Promise.resolve();
  },
  inspect() { return undefined; },
};

// Configuration change listeners
const configChangeListeners: Array<(e: { affectsConfiguration(section: string): boolean }) => void> = [];

// Create window object with writable methods that can be stubbed
const window = {
  createOutputChannel(_name: string) { return mockOutputChannel; },
  createTerminal(options: {
    name?: string;
    pty?: {
      onDidWrite: (listener: (data: string) => void) => { dispose(): void };
      open(initialDimensions: undefined): void;
      close(): void;
    };
  }) {
    const term = {
      name: options.name || '',
      show() {},
      dispose() {
        // Simulate VS Code disposing the terminal (triggers pty.close)
        if (options.pty) {
          options.pty.close();
        }
      },
    };
    if (options.pty) {
      // Subscribe to writes before calling open so open() messages are captured
      options.pty.onDidWrite((data: string) => {
        terminalOutput.push(data);
      });
      // Simulate VS Code opening the terminal immediately
      options.pty.open(undefined);
    }
    mockTerminals.push(term);
    return term;
  },
  showInformationMessage(msg: string) { return Promise.resolve(msg); },
  showErrorMessage(msg: string) { return Promise.resolve(msg); },
  showQuickPick(items: unknown[], _opts?: unknown) { return Promise.resolve(undefined); },
};

const vscode = {
  window,
  EventEmitter,
  workspace: {
    getConfiguration(_section?: string) {
      return mockConfiguration;
    },
    onDidChangeConfiguration(listener: (e: { affectsConfiguration(section: string): boolean }) => void) {
      configChangeListeners.push(listener);
      return {
        dispose() {
          const index = configChangeListeners.indexOf(listener);
          if (index > -1) {
            configChangeListeners.splice(index, 1);
          }
        }
      };
    },
  },
  commands: {
    registerCommand(id: string, handler: (...args: unknown[]) => unknown) {
      commands.set(id, handler);
      return { dispose() { commands.delete(id); } };
    },
    executeCommand(id: string, ...args: unknown[]) {
      const handler = commands.get(id);
      if (handler) { return handler(...args); }
      return Promise.resolve();
    },
  },
  Uri: {
    file(p: string) { return { scheme: 'file', fsPath: p }; },
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
  _mockChannel: mockOutputChannel,
  _commands: commands,
  _configStore: configStore,
  _terminalOutput: terminalOutput,
  _mockTerminals: mockTerminals,
  _triggerConfigChange(section: string) {
    const event = {
      affectsConfiguration(s: string) {
        return s === section || section.startsWith(s + '.') || s.startsWith(section + '.');
      }
    };
    configChangeListeners.forEach(listener => listener(event));
  },
};

// Inject into module system so `require('vscode')` returns our mock
require('module').Module._resolveFilename = (function(original: Function) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function(this: unknown, request: string, ...args: unknown[]) {
    if (request === 'vscode') { return request; }
    return original.call(this, request, ...args);
  };
})(require('module').Module._resolveFilename);

require('module').Module._extensions['.js'] = (function(original: Function) {
  return original;
})(require('module').Module._extensions['.js']);

// Register 'vscode' as a cached module
require.cache['vscode'] = {
  id: 'vscode',
  filename: 'vscode',
  loaded: true,
  exports: vscode,
  paths: [],
  children: [],
  parent: null,
} as unknown as NodeModule;
