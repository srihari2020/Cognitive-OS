import { geminiService } from './geminiService';
import { backgroundService } from './BackgroundService';

const URL_MAP = {
  youtube: 'https://youtube.com',
  google: 'https://google.com',
  gmail: 'https://mail.google.com',
  github: 'https://github.com',
  whatsapp: 'https://web.whatsapp.com',
};

const SYSTEM_APPS = {
  settings: 'start ms-settings:',
};

const DESKTOP_APPS = {
  vscode: 'code',
  code: 'code',
  chrome: 'start chrome',
  edge: 'start msedge',
  notepad: 'notepad',
  calculator: 'calc',
  calc: 'calc',
  explorer: 'explorer',
};

let scannedApps = {};

const isElectron = !!(window.electron && window.electron.exec);

export const intentService = {
  async init() {
    if (!window.ALLOW_BACKGROUND) {
      return;
    }

    if (!isElectron) {
      return;
    }

    const cached = localStorage.getItem('friday_scanned_apps');
    if (cached) {
      try {
        scannedApps = JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached apps:', error);
      }
    }
  },

  async scanAppsInBackground() {
    if (!window.ALLOW_BACKGROUND) {
      return;
    }

    const bridge = window.electronAssistant;
    if (!bridge || !bridge.scanApps) return;

    try {
      const apps = await bridge.scanApps();
      scannedApps = apps;
      localStorage.setItem('friday_scanned_apps', JSON.stringify(apps));
    } catch (error) {
      console.error('FRIDAY: Background app scan failed:', error);
    }
  },

  async refreshApps() {
    await this.scanAppsInBackground();
  },

  async generatePlan(text, options = {}) {
    if (!text || text.trim() === '') {
      return { intent: 'chat', plan: [], response: '', confidence: 0, source: 'blocked' };
    }

    if (!window.ALLOW_BACKGROUND) {
      return { intent: 'chat', plan: [], response: '', confidence: 0, source: 'blocked' };
    }

    const input = text.trim();
    const currentState = backgroundService.getState();
    const context = { activeApp: currentState.activeApp, idleTime: currentState.idleTime };
    const geminiData = await geminiService.ask(input, context, options);

    if (!geminiData) {
      throw new Error('AI busy, try again');
    }

    if (geminiData.kind === 'chat') {
      return {
        intent: 'chat',
        plan: [],
        response: geminiData.message || '',
        confidence: 0.95,
        source: 'gemini',
      };
    }

    const command = this.normalizeCommand(geminiData.action, geminiData.target);
    const plan = this.buildPlanFromCommand(command);

    return {
      intent: command.action === 'none' ? 'chat' : 'action',
      plan,
      response: JSON.stringify(command),
      command,
      confidence: 0.95,
      source: 'gemini',
    };
  },

  normalizeCommand(action, target) {
    const normalizedAction = typeof action === 'string' ? action.trim().toLowerCase() : 'none';
    const normalizedTarget = typeof target === 'string' ? target.trim() : '';

    if (!['open_app', 'search_web', 'scroll', 'click', 'type', 'none'].includes(normalizedAction)) {
      return { action: 'none', target: '' };
    }

    if (normalizedAction !== 'none' && !normalizedTarget) {
      return { action: 'none', target: '' };
    }

    if (normalizedAction === 'open_app') {
      const appInfo = this.findBestApp(normalizedTarget);
      if (!appInfo.cmd || appInfo.type === 'invalid') {
        return { action: 'none', target: '' };
      }
      return { action: 'open_app', target: appInfo.name };
    }

    if (normalizedAction === 'scroll') {
      const direction = normalizedTarget.toLowerCase();
      if (!['up', 'down'].includes(direction)) {
        return { action: 'none', target: '' };
      }
      return { action: 'scroll', target: direction };
    }

    return { action: normalizedAction, target: normalizedTarget };
  },

  buildPlanFromCommand(command) {
    switch (command.action) {
      case 'open_app': {
        const appInfo = this.findBestApp(command.target);
        if (!appInfo.cmd || appInfo.type === 'invalid') {
          throw new Error('App not found');
        }
        return [{ action: 'open_app', target: appInfo.name, cmd: appInfo.cmd }];
      }

      case 'search_web':
        return [{ action: 'search_web', query: command.target, provider: 'google' }];

      case 'scroll':
        return [{ action: 'ui_action', sub_action: command.target === 'up' ? 'scroll_up' : 'scroll_down' }];

      case 'click':
        if (command.target.toLowerCase() === 'new tab') {
          return [{ action: 'tab_control', sub_action: 'new_tab' }];
        }
        if (command.target.toLowerCase() === 'switch tab') {
          return [{ action: 'tab_control', sub_action: 'switch_tab' }];
        }
        if (command.target.toLowerCase() === 'close tab') {
          return [{ action: 'tab_control', sub_action: 'close_tab' }];
        }
        return [{ action: 'ui_action', sub_action: 'click', target: command.target }];

      case 'type':
        return [{ action: 'ui_action', sub_action: 'type', target: command.target }];

      case 'none':
      default:
        return [];
    }
  },

  findBestApp(target) {
    const name = target.toLowerCase().trim();

    if (URL_MAP[name]) {
      return { name: target, cmd: `start ${URL_MAP[name]}`, type: 'url' };
    }

    if (SYSTEM_APPS[name]) {
      return { name: target, cmd: SYSTEM_APPS[name], type: 'system' };
    }

    if (DESKTOP_APPS[name]) {
      return { name: target, cmd: DESKTOP_APPS[name], type: 'desktop' };
    }

    if (scannedApps[name]) {
      return { name, cmd: `start "" "${scannedApps[name]}"`, type: 'scanned' };
    }

    return { name: target, cmd: '', type: 'invalid' };
  }
};
