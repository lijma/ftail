# ftail

> Real-time log monitoring inside VS Code — like `tail -f`, with syntax highlighting.

![License](https://img.shields.io/badge/license-MIT-green)

---

## The Problem

When an AI Agent runs terminal commands, it typically **waits synchronously for the output** and reads it back into context. This has two side effects:

1. **Token waste** — large command outputs flood the context window with content the agent doesn't need.
2. **Hallucination risk** — bloated context degrades the model's accuracy and increases errors.

The fix is to redirect all command output to a **fixed log file** and let the agent query that file on demand instead of reading stdout inline:

```bash
# Agent prompt instructs the agent to do this:
some-command > console.log 2>&1
```

But then **how does the human developer watch what's happening?**  
Opening a separate terminal and running `tail -f console.log` works, but it breaks the flow.

**ftail** solves this: right-click the log file in VS Code → *Monitor with ftail* → a live terminal tab opens inside VS Code, streaming new lines as they arrive — no context switching needed.

---

## Features

- **Live monitoring** — right-click any file in the Explorer and select *Monitor with ftail*; new content streams in automatically
- **Syntax highlighting** — ANSI colors rendered natively in the VS Code Terminal panel:
  - `ERROR` → red
  - `WARN` → yellow
  - `INFO` → blue
  - `SUCCESS` → green
  - `DEBUG` → magenta
  - Timestamps → gray
  - URLs → blue
  - IP addresses → cyan
  - File paths → yellow
  - Numbers → cyan
- **Multiple files** — monitor several log files at once, each in its own terminal tab
- **Non-intrusive reads** — opens files in read-only mode, never holds a file handle; safe to use alongside any other tool
- **Toggle highlighting** — turn colors on/off at any time without restarting the monitor
- **Configurable** — granular settings to enable/disable each highlight category independently

---

## Use Cases

| Scenario | How ftail helps |
|---|---|
| Monitoring AI Agent command output (`console.log`) | Right-click the log file; watch every command the agent runs in real time |
| Debugging a running backend service | Stream the service log directly inside VS Code alongside your code |
| Tracking a long build or deployment | Follow log file output without leaving the editor |
| Spotting errors in production logs | `ERROR` lines jump out in red immediately |
| Log rotation / truncation detection | ftail detects when a file is truncated and notifies you |

---

## Installation

### From VSIX (local build)

```bash
npm install
npm run compile
npx @vscode/vsce package
code --install-extension ftail-*.vsix
```

### Development (F5 debug)

1. Open the project folder in VS Code
2. Press **F5** — a new *Extension Development Host* window opens
3. Use ftail inside that window

---

## Usage

### Start monitoring a file

1. Right-click any file in the **Explorer** panel
2. Select **Monitor with ftail**
3. A dedicated terminal tab named `ftail: <filename>` opens and streams new content

### Stop monitoring

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

```
ftail: Stop Monitoring
```

If multiple files are being monitored, a quick-pick list lets you choose which one to stop.

### Toggle syntax highlighting

```
ftail: Toggle Syntax Highlighting
```

This writes to your global VS Code settings (`ftail.syntaxHighlighting.enabled`).

---

## Configuration

All settings live under the `ftail.syntaxHighlighting` namespace:

| Setting | Default | Description |
|---|---|---|
| `ftail.syntaxHighlighting.enabled` | `true` | Master switch for all ANSI highlighting |
| `ftail.syntaxHighlighting.colorizeLogLevels` | `true` | Color ERROR / WARN / INFO / SUCCESS / DEBUG |
| `ftail.syntaxHighlighting.colorizeTimestamps` | `true` | Color ISO 8601 and common log timestamps |
| `ftail.syntaxHighlighting.colorizeNumbers` | `true` | Color integers, floats, hex values, percentages |
| `ftail.syntaxHighlighting.colorizeUrls` | `true` | Color http / https / ws / wss URLs |
| `ftail.syntaxHighlighting.colorizeIpAddresses` | `true` | Color IPv4 addresses |
| `ftail.syntaxHighlighting.colorizeFilePaths` | `true` | Color Unix and Windows file paths |

---

## How It Works

ftail uses a **poll-based** approach (500 ms interval by default) rather than `fs.watch` / `fs.watchFile`:

1. On start, it records the current file size as the baseline.
2. Every 500 ms it calls `fs.statSync` to check the current size.
3. If the file grew, it opens the file, reads only the new bytes (from the old offset to the new size), then closes the file immediately — no persistent file handles.
4. New content is passed through `LogHighlighter`, which applies ANSI escape codes, then written to the PTY terminal via `vscode.EventEmitter<string>`.
5. If the file shrank (log rotation / truncation), a warning is emitted.

This design is intentionally simple and safe: it works with any file, any OS, and any program writing to the log.

---

## Development

```bash
npm install          # install dependencies
npm run compile      # compile TypeScript
npm run test:unit    # run 122 unit tests
npm run coverage     # run tests + coverage report
```

**Test coverage: 100%** across statements, branches, functions, and lines.

---

## License

MIT
