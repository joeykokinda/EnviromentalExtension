console.log('LLM Environmental Impact Tracker content script loading...');

class ChatGPTTracker {
  constructor() {
    this.isActive = false;
    this.currentProvider = null;
    this.observers = [];
    this.processedMessages = new Set();
    
    this.providerConfigs = {
      'chat.openai.com': {
        name: 'ChatGPT',
        selectors: {
          messageContainer: '[data-message-id]',
          userMessage: '.user-message-bubble-color',
          assistantMessage: 'p[data-start][data-end]',
          inputArea: '#prompt-textarea, [data-testid="prompt-textarea"]',
          sendButton: '[data-testid="send-button"]',
          conversationContainer: 'main'
        }
      },
      'claude.ai': {
        name: 'Claude',
        selectors: {
          messageContainer: '[data-testid="message"]',
          userMessage: '[data-is-author="true"]',
          assistantMessage: '[data-is-author="false"]',
          inputArea: 'div[contenteditable="true"]',
          sendButton: 'button[aria-label*="Send"]'
        }
      }
    };
    
    this.init();
  }
  
  init() {
    console.log(' Content script starting on:', window.location.href);
    this.detectProvider();
    
    if (this.currentProvider) {
      console.log(` LLM Environmental Tracker initialized for ${this.currentProvider.name}`);
      console.log(' Provider config:', this.currentProvider);
      this.setupObservers();
      setTimeout(() => {
        this.scanExistingMessages();
      }, 2000);
    } else {
      console.log(' LLM Tracker: Not on a supported LLM website');
      console.log(' Current hostname:', window.location.hostname);
    }
  }
  
  detectProvider() {
    const hostname = window.location.hostname;
    const config = this.providerConfigs[hostname];
    
    if (config) {
      this.currentProvider = {
        ...config,
        hostname
      };
      this.isActive = true;
    }
  }
  
  setupObservers() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForNewMessages(node);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.observers.push(observer);
  }
  
  scanExistingMessages() {
    console.log(' Scanning existing messages...');
    console.log(' User selector:', this.currentProvider.selectors.userMessage);
    console.log(' Assistant selector:', this.currentProvider.selectors.assistantMessage);
    
    const userMessages = document.querySelectorAll(this.currentProvider.selectors.userMessage);
    const assistantMessages = document.querySelectorAll(this.currentProvider.selectors.assistantMessage);
    
    console.log(` Found ${userMessages.length} user messages and ${assistantMessages.length} assistant messages`);
    
    // Debug: log all potential message elements
    const allDivs = document.querySelectorAll('div');
    console.log(` Total divs on page: ${allDivs.length}`);
    
    // Look for any elements that might contain messages
    const potentialUserMessages = document.querySelectorAll('[class*="user"]');
    const potentialAssistantMessages = document.querySelectorAll('[data-start]');
    console.log(` Potential user elements: ${potentialUserMessages.length}`);
    console.log(` Potential assistant elements: ${potentialAssistantMessages.length}`);
    
    userMessages.forEach((msg, index) => {
      const msgId = `existing-user-${index}-${msg.textContent.substring(0, 20)}`;
      console.log(` Processing user message ${index}:`, msg.textContent.substring(0, 50));
      this.processMessage(msg, 'user', msgId);
    });
    
    assistantMessages.forEach((msg, index) => {
      const msgId = `existing-assistant-${index}-${msg.getAttribute('data-start') || index}`;
      console.log(` Processing assistant message ${index}:`, msg.textContent.substring(0, 50));
      this.processMessage(msg, 'assistant', msgId);
    });
  }
  
  checkForNewMessages(node) {
    const userMessages = node.querySelectorAll ? node.querySelectorAll(this.currentProvider.selectors.userMessage) : [];
    const assistantMessages = node.querySelectorAll ? node.querySelectorAll(this.currentProvider.selectors.assistantMessage) : [];
    
    userMessages.forEach((msg) => {
      const msgId = this.getMessageId(msg);
      if (!this.processedMessages.has(msgId)) {
        this.processMessage(msg, 'user', msgId);
      }
    });
    
    assistantMessages.forEach((msg) => {
      const msgId = this.getMessageId(msg);
      if (!this.processedMessages.has(msgId)) {
        setTimeout(() => {
          this.processMessage(msg, 'assistant', msgId);
        }, 1000);
      }
    });
  }
  
  getMessageId(element) {
    if (element.hasAttribute('data-start') && element.hasAttribute('data-end')) {
      return `assistant-${element.getAttribute('data-start')}-${element.getAttribute('data-end')}`;
    }
    
    if (element.classList.contains('user-message-bubble-color')) {
      const text = element.textContent.substring(0, 30).replace(/\s+/g, '-');
      return `user-${text}-${Date.now()}`;
    }
    
    return element.getAttribute('data-message-id') || 
           element.getAttribute('data-testid') || 
           `msg-${element.textContent.substring(0, 30)}-${Date.now()}`;
  }
  
  processMessage(messageElement, type, messageId) {
    if (this.processedMessages.has(messageId)) {
      return;
    }
    
    const text = this.extractText(messageElement);
    if (!text || text.length < 5) {
      return;
    }
    
    const tokens = this.estimateTokens(text);
    
    console.log(` ${type} message: ${tokens} tokens (${text.length} chars)`);
    console.log(`Text preview: "${text.substring(0, 100)}..."`);
    
    this.processedMessages.add(messageId);
    
    this.sendToBackground({
      type: type === 'user' ? 'input_tokens' : 'output_tokens',
      provider: this.currentProvider.name,
      tokens: tokens,
      textLength: text.length,
      messageType: type,
      timestamp: Date.now(),
      messagePreview: text.substring(0, 100)
    });
  }
  
  extractText(element) {
    if (!element) return '';
    
    let text = '';
    
    if (element.classList.contains('user-message-bubble-color')) {
      const textDiv = element.querySelector('.whitespace-pre-wrap');
      text = textDiv ? textDiv.textContent : element.textContent;
    } else if (element.hasAttribute('data-start') && element.hasAttribute('data-end')) {
      text = element.textContent || element.innerText;
    } else {
      const clonedElement = element.cloneNode(true);
      const elementsToRemove = clonedElement.querySelectorAll('button, svg, .sr-only, [aria-hidden="true"]');
      elementsToRemove.forEach(el => el.remove());
      text = clonedElement.textContent || clonedElement.innerText || '';
    }
    
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }
  
  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    
    text = text.trim();
    if (text.length === 0) return 0;
    
    const words = text.split(/\s+/).length;
    const chars = text.length;
    
    const tokenEstimate = Math.max(
      Math.ceil(words * 1.3),
      Math.ceil(chars / 4)
    );
    
    return Math.max(tokenEstimate, 1);
  }
  
  sendToBackground(data) {
    try {
      chrome.runtime.sendMessage({
        action: 'trackTokens',
        data: data
      }).catch(error => {
        console.log(' Background script not ready, using storage fallback');
        chrome.storage.local.get(['tokenData'], (result) => {
          const existing = result.tokenData || [];
          existing.push(data);
          chrome.storage.local.set({ tokenData: existing });
        });
      });
      
      console.log(' Sent to background:', data);
      
    } catch (error) {
      console.error(' Error sending to background:', error);
    }
  }
  
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.processedMessages.clear();
  }
}

let tracker = null;

function initTracker() {
  console.log(' Initializing tracker...');
  if (tracker) {
    tracker.cleanup();
  }
  tracker = new ChatGPTTracker();
}

// Multiple initialization strategies to ensure loading
console.log(' Content script document state:', document.readyState);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTracker);
  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      initTracker();
    }
  });
} else {
  initTracker();
}

// Also try after a delay
setTimeout(initTracker, 1000);
setTimeout(initTracker, 3000);

window.addEventListener('beforeunload', () => {
  if (tracker) {
    tracker.cleanup();
  }
});

setTimeout(() => {
  if (tracker && tracker.isActive) {
    tracker.scanExistingMessages();
  }
}, 3000);

// Global function for manual testing
window.testLLMTracker = function() {
  console.log(' Manual test started');
  if (tracker) {
    console.log(' Tracker exists:', tracker.isActive);
    console.log(' Current provider:', tracker.currentProvider?.name);
    tracker.scanExistingMessages();
  } else {
    console.log(' No tracker found');
  }
};