# Vibe Intelligence Terminal

A modern terminal application built with Tauri and TypeScript.

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run tauri dev
```

## Features

### Context Menu

Right-click anywhere in the terminal to open the context menu with the following options:

- **Increase Font Size (Ctrl/Cmd +)**: Make the font larger
- **Decrease Font Size (Ctrl/Cmd -)**: Make the font smaller
- **Reset Font Size (Ctrl/Cmd 0)**: Reset to default font size

#### Keyboard Shortcuts

- `Ctrl/Cmd +`: Increase font size
- `Ctrl/Cmd -`: Decrease font size
- `Ctrl/Cmd 0`: Reset font size to default

#### Access Browser Context Menu

To access the browser's default context menu (for inspecting elements, etc.), hold `Shift` while right-clicking.

## Customization

The terminal uses the following font stack by default:
- Jetbrains Mono
- MesloLGS NF
- System monospace fallback

You can modify the font family and other styles in `src/main.ts` and `index.html`.