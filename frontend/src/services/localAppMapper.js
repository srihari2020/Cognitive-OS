/**
 * localAppMapper.js
 * 
 * Strict, reliable mapping of app names to system commands
 */

const SYSTEM_APPS = {
  settings: { name: 'Settings', cmd: 'start ms-settings:', type: 'system', verified: true },
  'control panel': { name: 'Control Panel', cmd: 'control', type: 'system', verified: true },
};

const DESKTOP_APPS = {
  vscode: { name: 'VS Code', cmd: 'code', type: 'desktop', verified: true },
  code: { name: 'VS Code', cmd: 'code', type: 'desktop', verified: true },
  'vs code': { name: 'VS Code', cmd: 'code', type: 'desktop', verified: true },
  'visual studio code': { name: 'VS Code', cmd: 'code', type: 'desktop', verified: true },
  chrome: { name: 'Chrome', cmd: 'start chrome', type: 'desktop', verified: true },
  'google chrome': { name: 'Chrome', cmd: 'start chrome', type: 'desktop', verified: true },
  edge: { name: 'Edge', cmd: 'start msedge', type: 'desktop', verified: true },
  'microsoft edge': { name: 'Edge', cmd: 'start msedge', type: 'desktop', verified: true },
  notepad: { name: 'Notepad', cmd: 'notepad', type: 'desktop', verified: true },
  calculator: { name: 'Calculator', cmd: 'calc', type: 'desktop', verified: true },
  calc: { name: 'Calculator', cmd: 'calc', type: 'desktop', verified: true },
  explorer: { name: 'Explorer', cmd: 'explorer', type: 'desktop', verified: true },
  'file explorer': { name: 'Explorer', cmd: 'explorer', type: 'desktop', verified: true },
};

const URL_MAP = {
  youtube: { name: 'YouTube', cmd: 'start https://youtube.com', type: 'url', verified: true },
  google: { name: 'Google', cmd: 'start https://google.com', type: 'url', verified: true },
  gmail: { name: 'Gmail', cmd: 'start https://mail.google.com', type: 'url', verified: true },
  github: { name: 'GitHub', cmd: 'start https://github.com', type: 'url', verified: true },
  whatsapp: { name: 'WhatsApp', cmd: 'start https://web.whatsapp.com', type: 'url', verified: true },
};

const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHED_APPS = 500;

class LocalAppMapper {
  constructor() {
    this.scannedApps = new Map();
    this.lastScanAt = 0;
  }

  /**
   * Resolve app name to command
   * @param {string} appName - App name to resolve
   * @returns {Object|null} AppCommand object or null if not found
   */
  resolve(appName) {
    if (!appName || typeof appName !== 'string') {
      return null;
    }

    const name = appName.toLowerCase().trim();
    
    // Also try without spaces for fuzzy matching
    const nameNoSpaces = name.replace(/\s+/g, '');

    // Priority 1: System apps
    if (SYSTEM_APPS[name]) {
      return SYSTEM_APPS[name];
    }
    if (SYSTEM_APPS[nameNoSpaces]) {
      return SYSTEM_APPS[nameNoSpaces];
    }

    // Priority 2: Desktop apps
    if (DESKTOP_APPS[name]) {
      return DESKTOP_APPS[name];
    }
    if (DESKTOP_APPS[nameNoSpaces]) {
      return DESKTOP_APPS[nameNoSpaces];
    }

    // Priority 3: URL mappings
    if (URL_MAP[name]) {
      return URL_MAP[name];
    }
    if (URL_MAP[nameNoSpaces]) {
      return URL_MAP[nameNoSpaces];
    }

    // Priority 4: Scanned apps
    if (this.scannedApps.has(name)) {
      return this.scannedApps.get(name);
    }
    if (this.scannedApps.has(nameNoSpaces)) {
      return this.scannedApps.get(nameNoSpaces);
    }

    // Not found - return null (no guessing)
    return null;
  }

  /**
   * Register a new app command
   * @param {string} appName - App name
   * @param {Object} command - AppCommand object
   */
  register(appName, command) {
    if (!appName || !command || !command.cmd) {
      console.warn('Invalid app registration:', appName, command);
      return;
    }

    const name = appName.toLowerCase().trim();

    // Limit cache size
    if (this.scannedApps.size >= MAX_CACHED_APPS) {
      // Remove oldest entry (first entry in Map)
      const firstKey = this.scannedApps.keys().next().value;
      this.scannedApps.delete(firstKey);
    }

    this.scannedApps.set(name, {
      name: command.name || appName,
      cmd: command.cmd,
      type: command.type || 'scanned',
      verified: command.verified || false,
    });
  }

  /**
   * Scan system for installed apps
   * @returns {Promise<void>}
   */
  async scan() {
    const now = Date.now();

    // Check if cache is still valid
    if (now - this.lastScanAt < CACHE_EXPIRY_MS) {
      console.log('Using cached app scan results');
      return;
    }

    // Load from localStorage cache
    try {
      const cached = localStorage.getItem('friday_scanned_apps');
      if (cached) {
        const apps = JSON.parse(cached);
        Object.entries(apps).forEach(([name, path]) => {
          this.register(name, {
            name,
            cmd: `start "" "${path}"`,
            type: 'scanned',
            verified: false,
          });
        });
        this.lastScanAt = now;
        console.log(`Loaded ${Object.keys(apps).length} apps from cache`);
      }
    } catch (error) {
      console.error('Failed to load cached apps:', error);
    }

    // Trigger background scan if available
    if (window.electronAssistant?.scanApps) {
      try {
        const apps = await window.electronAssistant.scanApps();
        Object.entries(apps).forEach(([name, path]) => {
          this.register(name, {
            name,
            cmd: `start "" "${path}"`,
            type: 'scanned',
            verified: false,
          });
        });
        localStorage.setItem('friday_scanned_apps', JSON.stringify(apps));
        this.lastScanAt = now;
        console.log(`Scanned ${Object.keys(apps).length} apps from system`);
      } catch (error) {
        console.error('Failed to scan apps:', error);
      }
    }
  }

  /**
   * Get list of available app names
   * @returns {string[]} Array of app names
   */
  getAvailable() {
    const apps = [
      ...Object.keys(SYSTEM_APPS),
      ...Object.keys(DESKTOP_APPS),
      ...Object.keys(URL_MAP),
      ...Array.from(this.scannedApps.keys()),
    ];
    return [...new Set(apps)]; // Remove duplicates
  }

  /**
   * Clear scanned apps cache
   */
  clearCache() {
    this.scannedApps.clear();
    this.lastScanAt = 0;
    localStorage.removeItem('friday_scanned_apps');
  }
}

export const localAppMapper = new LocalAppMapper();
