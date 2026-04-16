import { geminiService } from './geminiService';
import { backgroundService } from './BackgroundService';
import { responseTransformer } from './responseTransformer';
import { localAppMapper } from './localAppMapper';

const isElectron = !!(window.electron && window.electron.exec);

export const intentService = {
  async init() {
    if (!window.ALLOW_BACKGROUND) {
      return;
    }

    if (!isElectron) {
      return;
    }

    // Initialize app mapper with cached apps
    await localAppMapper.scan();
  },

  async scanAppsInBackground() {
    if (!window.ALLOW_BACKGROUND) {
      return;
    }

    await localAppMapper.scan();
  },

  async refreshApps() {
    localAppMapper.clearCache();
    await localAppMapper.scan();
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

    // Generate natural language response instead of JSON
    const naturalResponse = responseTransformer.generateNaturalMessage(command.action, command.target);

    return {
      intent: command.action === 'none' ? 'chat' : 'action',
      plan,
      response: naturalResponse,
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
      if (!appInfo) {
        console.warn(`App not found: ${normalizedTarget}`);
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
        if (!appInfo) {
          throw new Error(`App not found: ${command.target}`);
        }
        // Pass a normalized app key that backend can recognize
        const appKey = this.getAppKey(appInfo);
        return [{ action: 'open_app', target: appKey }];
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

  getAppKey(appInfo) {
    // Map app names to backend-recognized keys
    const nameToKey = {
      'VS Code': 'vscode',
      'Chrome': 'chrome',
      'Edge': 'edge',
      'Settings': 'settings',
      'Control Panel': 'control panel',
      'Notepad': 'notepad',
      'Calculator': 'calc',
      'Explorer': 'explorer',
      'YouTube': 'youtube',
      'Google': 'google',
      'Gmail': 'gmail',
      'GitHub': 'github',
      'WhatsApp': 'whatsapp',
    };

    return nameToKey[appInfo.name] || appInfo.name.toLowerCase();
  },

  findBestApp(target) {
    if (!target) {
      return null;
    }

    // Use localAppMapper for resolution
    const appCommand = localAppMapper.resolve(target);
    return appCommand;
  }
};
