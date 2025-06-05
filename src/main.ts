import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api";

const terminalElement = document.getElementById("terminal") as HTMLElement;

const fitAddon = new FitAddon();
const term = new Terminal({
  fontFamily: "Jetbrains Mono, MesloLGS NF",
  theme: {
    background: "rgb(47, 47, 47)",
  },
});
term.loadAddon(fitAddon);
term.open(terminalElement);

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
