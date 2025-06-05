import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api";

const terminalElement = document.getElementById("terminal") as HTMLElement;

const fitAddon = new FitAddon();
// Add custom styles for the terminal container
const style = document.createElement('style');
style.textContent = `
  #terminal {
    padding: 16px;
    height: 100%;
    box-sizing: border-box;
  }
  .xterm {
    padding: 8px;
    height: 100%;
  }
  .xterm-viewport {
    border-radius: 4px;
  }
`;
document.head.appendChild(style);

// Create terminal with initial settings
const term = new Terminal({
  fontFamily: "Jetbrains Mono, MesloLGS NF",
  theme: {
    background: "rgb(47, 47, 47)",
    cursor: "#f0f0f0"
  },
  cursorStyle: 'block',
  cursorBlink: true,
  fontSize: 14,
  lineHeight: 1.2,
  letterSpacing: 0.5
});

// Load terminal addons and open terminal
term.loadAddon(fitAddon);
term.open(terminalElement);

// Initialize terminal menu after terminal is opened
import { TerminalMenu } from './terminalMenu';
setTimeout(() => {
  new TerminalMenu(term);
  // Focus the terminal after opening
  term.focus();
}, 0);

// Make the terminal fit all the window size
async function fitTerminal() {
  fitAddon.fit();
  void invoke<string>("async_resize_pty", {
    rows: term.rows,
    cols: term.cols,
  });
}

// Write data from pty into the terminal
function writeToTerminal(data: string) {
  return new Promise<void>((r) => {
    term.write(data, () => r());
  });
}

// Write data from the terminal to the pty
function writeToPty(data: string) {
  void invoke("async_write_to_pty", {
    data,
  });
}
async function initShell() {
  // Show initialization message
  term.writeln("Initializing terminal...");
  
  try {
    await invoke("async_create_shell");
    
    // Clear the screen after 3 seconds
    // setTimeout(() => {
    //   term.writeln("\x1B[2J\x1B[H");
    //   term.writeln(`You are using ${shellName}\r`);
    // }, 3000);
  } catch (error) {
    term.writeln(`Error creating shell: ${error}`);
  }
}

initShell();
term.onData(writeToPty);
addEventListener("resize", fitTerminal);
fitTerminal();

async function readFromPty() {
  const data = await invoke<string>("async_read_from_pty");

  if (data) {
    await writeToTerminal(data);
  }

  window.requestAnimationFrame(readFromPty);
}

window.requestAnimationFrame(readFromPty);
