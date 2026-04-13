/**
 * executor.js
 * 
 * The execution layer for FRIDAY.
 * Converts structured AI intent objects into real-world actions.
 */

const APP_MAP = {
  youtube: "https://youtube.com",
  whatsapp: "https://web.whatsapp.com",
  spotify: "https://open.spotify.com",
  chrome: "start chrome",
  edge: "start msedge",
  vscode: "code",
  settings: "start ms-settings:"
};

export const execute = async (intentObj) => {
  const bridge = window.electronAssistant;
  if (!bridge) {
    console.error("FRIDAY: System bridge unavailable.");
    return "System bridge unavailable, sir.";
  }

  const { intent, target, query, message, person } = intentObj;

  try {
    switch (intent) {
      case "open_app":
        return await openApp(target, bridge);

      case "search_web":
        return await openSearch(query, bridge);

      case "send_message":
        return await sendMessage(person, message, bridge);

      case "system_action":
        return await systemAction(target, bridge);

      case "chat":
        return intentObj.response || "I'm processing that, sir.";

      default:
        return "I need more clarity on that request, sir.";
    }
  } catch (error) {
    console.error("FRIDAY Execution Error:", error);
    return "I encountered an error executing that task, sir.";
  }
};

/**
 * Opens an application or a mapped website.
 */
async function openApp(target, bridge) {
  if (!target) return "I'm not sure what you want me to open, sir.";
  
  const normalizedTarget = target.toLowerCase();
  const cmd = APP_MAP[normalizedTarget];

  // 1. Check mapped commands/URLs
  if (cmd) {
    if (cmd.startsWith("http")) {
      await bridge.openExternal(cmd);
      return `Opening ${target} in your browser, sir.`;
    } else {
      await bridge.executeCommand(cmd);
      return `Launching ${target} now, sir.`;
    }
  }

  // 2. Try direct execution (fallback for apps in PATH)
  const result = await bridge.executeCommand(target);
  if (result.success) {
    return `Launching ${target}, sir.`;
  }

  // 3. Final Fallback: Suggest online search
  return `I couldn't find ${target} locally, sir. Would you like me to search for it online?`;
}

/**
 * Performs a web search.
 */
async function openSearch(query, bridge) {
  if (!query) return "What would you like me to search for, sir?";
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  await bridge.openExternal(url);
  return `Searching for "${query}" now, sir.`;
}

/**
 * Handles system-level actions.
 */
async function systemAction(target, bridge) {
  if (target === "settings") {
    await bridge.executeCommand("start ms-settings:");
    return "Opening system settings, sir.";
  }
  return `I'm sorry sir, I don't have permission for system ${target} yet.`;
}

/**
 * Sends a message (Automation placeholder).
 */
async function sendMessage(person, message, bridge) {
  // This will eventually call a Puppeteer-based backend handler
  // For now, we open WhatsApp Web as a transition
  await bridge.openExternal("https://web.whatsapp.com");
  return `Opening WhatsApp to message ${person}, sir. I'll need a moment to automate the text.`;
}
