# ftail

Project context summary. AI should keep this file up to date.

## Knowledge Available

- `_cache/` — (empty, run `fcontext index` to convert documents)
- `_topics/` — (empty, AI writes analysis here)
- `_requirements/` — 4 requirements defined (REQ-001 through REQ-004)

## Key Concepts

### Architecture
- **VS Code Extension**: TypeScript-based extension following VS Code extension API patterns
- **Poll-based File Monitoring**: Uses fs.statSync and periodic polling (500ms default) to detect file changes
- **Event-driven Design**: FileMonitor class uses EventEmitter pattern for clean separation
- **Non-intrusive Reading**: Opens files in read-only mode without holding locks

### Core Components
1. **FileMonitor** (`src/fileMonitor.ts`): Core monitoring logic with events (data, error, truncated, started, stopped)
2. **Extension** (`src/extension.ts`): VS Code integration, commands, output channel management
3. **Commands**: 
   - `ftail.monitorFile` - Right-click context menu command to start monitoring
   - `ftail.stopMonitoring` - Command palette command to stop monitoring

### Test Coverage
- 36 unit tests, all passing
- 95.55% statement coverage, 92.42% branch coverage, 100% function coverage
- Mock-based testing for VS Code API to enable fast unit tests without full integration

### Requirements Status
- ✅ REQ-001: Right-click "Monitor with ftail" command
- ✅ REQ-002: Real-time display of new content in output panel
- ✅ REQ-003: Stop Monitoring button/command
- ✅ REQ-004: Non-intrusive file reading (no write locks)
