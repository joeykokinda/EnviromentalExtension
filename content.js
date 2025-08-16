class LLMWebsiteDetector {
  constructor() {
    this.isActive = false;
    this.currentProvider = null;
    this.observers = [];
    this.queryCount = 0;
    this.lastActivity = Date.now();
    
    this.providerConfigs = {
      'chat.openai.com': {
        name: 'ChatGPT',
        selectors: {
          inputArea: '[data-testid="prompt-textarea"], textarea[placeholder*="message"]',
          sendButton: '[data-testid="send-button"], button[aria-label*="Send"]',
          responseContainer: '[data-message-author-role="assistant"]',
          newConversation: 'button[aria-label*="New chat"]'
        }
      },
      'claude.ai': {
        name: 'Claude',
        selectors: {
          inputArea: 'div[contenteditable="true"]',
          sendButton: 'button[aria-label*="Send"]',
          responseContainer: '[data-is-streaming="false"]',
          newConversation: 'button[aria-label*="Start new conversation"]'
        }
      },
      'bard.google.com': {
        name: 'Bard',
        selectors: {
          inputArea: 'rich-textarea textarea',
          sendButton: 'button[aria-label*="Send"]',
          responseContainer: '.model-response-text',
          newConversation: 'button[aria-label*="Reset chat"]'
        }
      },
      'gemini.google.com': {
        name: 'Gemini',
        selectors: {
          inputArea: 'rich-textarea textarea',
          sendButton: 'button[aria-label*="Send"]',
          responseContainer: '.model-response-text',
          newConversation: 'button[aria-label*="New chat"]'
        }
      }
    };
    
    this.init();
  }
  
  init() {
    this.detectProvider();
    
    if (this.currentProvider) {
      this.setupObservers();
      this.trackPageActivity();
      console.log(`LLM tracker initialized for ${this.currentProvider.name}`);
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
    if (!this.currentProvider) return;
    
    this.observeInputActivity();
    this.observeResponseGeneration();
    this.observePageChanges();
  }
  
  observeInputActivity() {
    const { inputArea, sendButton } = this.currentProvider.selectors;
    
    const inputObserver = new MutationObserver(() => {
      const input = document.querySelector(inputArea);
      if (input && !input.dataset.trackerAttached) {
        this.attachInputListeners(input);
        input.dataset.trackerAttached = 'true';
      }
    });
    
    inputObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.observers.push(inputObserver);
    
    const existingInput = document.querySelector(inputArea);
    if (existingInput) {
      this.attachInputListeners(existingInput);
    }
  }
  
  attachInputListeners(input) {
    const sendButton = document.querySelector(this.currentProvider.selectors.sendButton);
    
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        this.handleQuerySubmission(input);
      });
    }
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
        this.handleQuerySubmission(input);
      }
    });
  }
  
  observeResponseGeneration() {
    const { responseContainer } = this.currentProvider.selectors;
    
    const responseObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const responses = node.querySelectorAll(responseContainer);
              responses.forEach((response) => {
                if (!response.dataset.trackerProcessed) {
                  this.handleResponseGeneration(response);
                  response.dataset.trackerProcessed = 'true';
                }
              });
            }
          });
        }
      });
    });
    
    responseObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.observers.push(responseObserver);
  }
  
  observePageChanges() {
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== this.lastUrl) {
        this.lastUrl = window.location.href;
        this.handlePageChange();
      }
    });
    
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.observers.push(urlObserver);
    this.lastUrl = window.location.href;
  }
  
  handleQuerySubmission(input) {
    try {
      const query = this.extractText(input);
      
      if (!query || query.trim().length < 3) return;
      
      const estimatedTokens = this.estimateTokens(query);
      
      this.queryCount++;
      this.lastActivity = Date.now();
      
      this.sendToBackground({
        type: 'query_submitted',
        provider: this.currentProvider.name,
        queryLength: query.length,
        estimatedTokens,
        timestamp: Date.now()
      });
      
      console.log(`Query submitted to ${this.currentProvider.name}: ${estimatedTokens} estimated tokens`);
      
    } catch (error) {
      console.error('Error handling query submission:', error);
    }
  }
  
  handleResponseGeneration(responseElement) {
    try {
      setTimeout(() => {
        const responseText = this.extractText(responseElement);
        
        if (!responseText || responseText.length < 10) return;
        
        const estimatedTokens = this.estimateTokens(responseText);
        
        this.sendToBackground({
          type: 'response_generated',
          provider: this.currentProvider.name,
          responseLength: responseText.length,
          estimatedTokens,
          timestamp: Date.now()
        });
        
        console.log(`Response generated by ${this.currentProvider.name}: ${estimatedTokens} estimated tokens`);
        
      }, 2000);
      
    } catch (error) {
      console.error('Error handling response generation:', error);
    }
  }
  
  handlePageChange() {
    const isNewConversation = this.detectNewConversation();
    
    if (isNewConversation) {
      this.sendToBackground({
        type: 'new_conversation',
        provider: this.currentProvider.name,
        previousQueryCount: this.queryCount,
        timestamp: Date.now()
      });
      
      this.queryCount = 0;
      console.log(`New conversation started on ${this.currentProvider.name}`);
    }
  }
  
  detectNewConversation() {
    const url = window.location.href;
    const pathname = window.location.pathname;
    
    if (this.currentProvider.hostname === 'chat.openai.com') {
      return pathname === '/' || pathname.includes('/c/');
    } else if (this.currentProvider.hostname === 'claude.ai') {
      return pathname === '/chat' || pathname.includes('/chat/');
    }
    
    return false;
  }
  
  extractText(element) {
    if (!element) return '';
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value;
    } else if (element.contentEditable === 'true') {
      return element.textContent || element.innerText;
    } else {
      return element.textContent || element.innerText;
    }
  }
  
  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }
  
  sendToBackground(data) {
    try {
      chrome.storage.local.set({
        contentScriptData: {
          ...data,
          url: window.location.href,
          title: document.title
        }
      });
    } catch (error) {
      console.error('Error sending data to background:', error);
    }
  }
  
  trackPageActivity() {
    let activityTimer;
    
    const resetTimer = () => {
      clearTimeout(activityTimer);
      activityTimer = setTimeout(() => {
        if (this.queryCount > 0) {
          this.sendToBackground({
            type: 'session_summary',
            provider: this.currentProvider.name,
            totalQueries: this.queryCount,
            sessionDuration: Date.now() - this.lastActivity,
            timestamp: Date.now()
          });
        }
      }, 300000);
    };
    
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });
    
    resetTimer();
  }
  
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

let detector = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    detector = new LLMWebsiteDetector();
  });
} else {
  detector = new LLMWebsiteDetector();
}

window.addEventListener('beforeunload', () => {
  if (detector) {
    detector.cleanup();
  }
});
