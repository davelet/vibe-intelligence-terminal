import { Terminal } from 'xterm';

export class TerminalMenu {
  private contextMenu: HTMLDivElement;
  private currentFontSize: number;
  private readonly MIN_FONT_SIZE = 8;
  private readonly MAX_FONT_SIZE = 32;
  private readonly DEFAULT_FONT_SIZE = 14;

  constructor(private term: Terminal) {
    console.log('Initializing TerminalMenu...');
    console.log('Terminal element:', term.element);
    
    this.currentFontSize = this.DEFAULT_FONT_SIZE;
    this.contextMenu = this.createContextMenu();
    
    if (this.contextMenu) {
      console.log('Context menu created:', this.contextMenu);
    } else {
      console.error('Failed to create context menu');
    }
    
    this.setupEventListeners();
    this.loadFontSize();
    
    // Verify terminal element
    if (!term.element) {
      console.error('Terminal element is not available');
    } else {
      console.log('Terminal element found:', term.element);
    }
  }

  private createContextMenu(): HTMLDivElement {
    // Create menu container
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.display = 'none'; // Start hidden

    // Add menu items
    const menuItems = [
      { label: 'Increase Font Size (Ctrl/Cmd +)', action: () => this.updateFontSize(1) },
      { label: 'Decrease Font Size (Ctrl/Cmd -)', action: () => this.updateFontSize(-1) },
      { label: 'Reset Font Size (Ctrl/Cmd 0)', action: () => this.resetFontSize() }
    ];

    menuItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'context-menu-item';
      div.textContent = item.label;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        this.hideMenu();
      });
      menu.appendChild(div);
    });

    // Add menu to the terminal container
    if (this.term.element) {
      this.term.element.appendChild(menu);
    } else {
      console.warn('Terminal element not found, appending menu to body');
      document.body.appendChild(menu);
    }
    
    return menu;
  }

  private setupEventListeners(): void {
    // Show context menu on right-click
    this.term.element?.addEventListener('contextmenu', (e) => {
      // Allow default context menu when Shift key is pressed
      if (e.shiftKey) {
        return; // Let the browser handle it
      }
      
      // Only handle right-clicks on the terminal element
      if (e.target === this.term.element || this.term.element?.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = this.term.element.getBoundingClientRect();
        // Calculate position relative to the terminal
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.showMenu(x, y);
      }
    });

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      // Only hide if the click is outside the context menu
      if (e.target !== this.contextMenu && !this.contextMenu.contains(e.target as Node)) {
        this.hideMenu();
      }
    });

    // Prevent context menu from closing when clicking inside it
    this.contextMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        this.updateFontSize(1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        this.updateFontSize(-1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        this.resetFontSize();
      }
    });
  }

  private showMenu(x: number, y: number): void {
    if (!this.contextMenu || !this.term.element) return;
    
    // Show the menu
    this.contextMenu.style.display = 'block';
    
    // Position the menu at the click position
    this.contextMenu.style.position = 'absolute';
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    
    // Ensure the menu is within the terminal bounds
    const menuRect = this.contextMenu.getBoundingClientRect();
    const termRect = this.term.element.getBoundingClientRect();
    
    // Adjust position if menu would go outside the terminal
    if (x + menuRect.width > termRect.width) {
      this.contextMenu.style.left = `${Math.max(0, termRect.width - menuRect.width - 10)}px`;
    }
    if (y + menuRect.height > termRect.height) {
      this.contextMenu.style.top = `${Math.max(0, termRect.height - menuRect.height - 10)}px`;
    }
    
    // Bring focus to the terminal
    this.term.focus();
  }

  private hideMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
  }

  private updateFontSize(delta: number): void {
    const newSize = Math.max(
      this.MIN_FONT_SIZE, 
      Math.min(this.MAX_FONT_SIZE, this.currentFontSize + delta)
    );
    
    if (newSize !== this.currentFontSize) {
      this.currentFontSize = newSize;
      this.term.options.fontSize = this.currentFontSize;
      this.saveFontSize();
    }
  }

  private resetFontSize(): void {
    this.currentFontSize = this.DEFAULT_FONT_SIZE;
    this.term.options.fontSize = this.currentFontSize;
    this.saveFontSize();
  }

  private saveFontSize(): void {
    localStorage.setItem('terminalFontSize', this.currentFontSize.toString());
  }

  private loadFontSize(): void {
    const savedSize = localStorage.getItem('terminalFontSize');
    if (savedSize) {
      const size = parseInt(savedSize, 10);
      if (!isNaN(size) && size >= this.MIN_FONT_SIZE && size <= this.MAX_FONT_SIZE) {
        this.currentFontSize = size;
        this.term.options.fontSize = this.currentFontSize;
      }
    }
  }
}
