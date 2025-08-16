// Direct content script that works without CSP violations
console.log('LLM Environmental Impact Tracker direct content script loading...');

(function() {
  'use strict';
  
  let processedMessages = new Set();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalQueries = 0;
  let observer = null;
  let isInitialized = false;
  let refreshInterval = null;
  
  // Provider configurations
  const providerConfigs = {
    'chat.openai.com': {
      name: 'ChatGPT',
      selectors: {
        userMessage: '.user-message-bubble-color',
        assistantMessage: 'p[data-start][data-end]'
      }
    },
    'chatgpt.com': {
      name: 'ChatGPT',
      selectors: {
        userMessage: '.user-message-bubble-color',
        assistantMessage: 'p[data-start][data-end]'
      }
    },
    'claude.ai': {
      name: 'Claude',
      selectors: {
        userMessage: '[data-is-author="true"]',
        assistantMessage: '[data-is-author="false"]'
      }
    }
  };
  
  function getCurrentProvider() {
    const hostname = window.location.hostname;
    return providerConfigs[hostname] || null;
  }
  
  function estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    
    text = text.trim();
    if (text.length === 0) return 0;
    
    // More accurate token estimation
    // GPT tokenizer approximation: ~4 characters per token on average
    // But also consider word boundaries and special characters
    
    const words = text.split(/\s+/).length;
    const chars = text.length;
    
    // Different estimation methods
    const wordBasedTokens = Math.ceil(words * 1.3); // ~1.3 tokens per word
    const charBasedTokens = Math.ceil(chars / 4);   // ~4 chars per token
    
    // Use the higher estimate for safety, but cap extremely high estimates
    let tokens = Math.max(wordBasedTokens, charBasedTokens);
    
    // Adjust for special cases
    if (text.includes('```')) tokens += 10; // Code blocks use more tokens
    if (text.includes('http')) tokens += 5; // URLs use more tokens
    if (/[^\x00-\x7F]/.test(text)) tokens *= 1.2; // Non-ASCII characters
    
    return Math.max(Math.floor(tokens), 1);
  }
  
  function extractText(element) {
    if (!element) return '';
    
    let text = '';
    
    // ChatGPT user messages
    if (element.classList.contains('user-message-bubble-color')) {
      const textDiv = element.querySelector('.whitespace-pre-wrap');
      text = textDiv ? textDiv.textContent : element.textContent;
    }
    // ChatGPT assistant messages
    else if (element.hasAttribute('data-start') && element.hasAttribute('data-end')) {
      text = element.textContent || element.innerText;
    }
    // Claude messages
    else if (element.hasAttribute('data-is-author')) {
      text = element.textContent || element.innerText;
    }
    // Generic fallback
    else {
      const clonedElement = element.cloneNode(true);
      const elementsToRemove = clonedElement.querySelectorAll('button, svg, .sr-only, [aria-hidden="true"]');
      elementsToRemove.forEach(el => el.remove());
      text = clonedElement.textContent || clonedElement.innerText || '';
    }
    
    return text.replace(/\s+/g, ' ').trim();
  }
  

  
  function sendToBackground(data) {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'trackTokens',
          data: data
        }).then(response => {
          console.log('✓ Sent to background:', data.tokens, 'tokens');
        }).catch(error => {
          console.log('Background error:', error);
        });
      }
      
    } catch (error) {
      console.error('Error sending to background:', error);
    }
  }
  
  async function processMessage(element, messageType, messageId) {
    if (processedMessages.has(messageId)) return false;
    
    const text = extractText(element);
    if (!text || text.length < 3) return false;
    
    const tokens = estimateTokens(text);
    processedMessages.add(messageId);
    
    if (messageType === 'user') {
      totalQueries++;
      totalInputTokens += tokens;
    } else {
      totalOutputTokens += tokens;
    }
    
    const totalTokens = totalInputTokens + totalOutputTokens;
    
    // Clear console output with stats
    console.log(`📊 INPUT: ${totalInputTokens} tokens | OUTPUT: ${totalOutputTokens} tokens | TOTAL: ${totalTokens} tokens | QUERIES: ${totalQueries}`);
    console.log(`➕ NEW ${messageType.toUpperCase()}: +${tokens} tokens - "${text.substring(0, 60)}..."`);
    
    const provider = getCurrentProvider();
    sendToBackground({
      type: messageType === 'user' ? 'input_tokens' : 'output_tokens',
      provider: provider ? provider.name : 'Unknown',
      tokens: tokens,
      messageType: messageType,
      timestamp: Date.now(),
      messagePreview: text.substring(0, 100),
      totalTokens: totalTokens,
      totalQueries: totalQueries
    });
    
    return true;
  }
  
  function getMessageId(element, messageType, index) {
    if (element.hasAttribute('data-start') && element.hasAttribute('data-end')) {
      return `assistant-${element.getAttribute('data-start')}-${element.getAttribute('data-end')}`;
    }
    
    if (element.classList.contains('user-message-bubble-color')) {
      const text = element.textContent.substring(0, 20).replace(/\s+/g, '-');
      return `user-${index}-${text}`;
    }
    
    if (element.hasAttribute('data-is-author')) {
      const isUser = element.getAttribute('data-is-author') === 'true';
      const text = element.textContent.substring(0, 20).replace(/\s+/g, '-');
      return `${isUser ? 'user' : 'assistant'}-${index}-${text}`;
    }
    
    return `${messageType}-${index}-${Date.now()}`;
  }
  
  function scanMessages() {
    console.clear();
    console.log('🔄 AUTO-REFRESHING MESSAGE SCAN...');
    
    // Reset counters for fresh count
    processedMessages.clear();
    totalInputTokens = 0;
    totalOutputTokens = 0;
    totalQueries = 0;
    
    // Universal selectors that work across sites
    const allDataStartElements = document.querySelectorAll('p[data-start][data-end]');
    const allUserBubbles = document.querySelectorAll('.user-message-bubble-color');
    const allClaudeMessages = document.querySelectorAll('[data-is-author]');
    
    console.log(`Found: ${allUserBubbles.length} user messages, ${allDataStartElements.length} assistant messages`);
    
    // Process ChatGPT user messages (INPUT)
    allUserBubbles.forEach((msg, i) => {
      const text = extractText(msg);
      if (text && text.length > 3) {
        const tokens = estimateTokens(text);
        totalInputTokens += tokens;
        totalQueries++;
        console.log(`INPUT ${i+1}: ${tokens} tokens - "${text.substring(0, 50)}..."`);
      }
    });
    
    // Process assistant messages (OUTPUT)
    allDataStartElements.forEach((msg, i) => {
      const text = extractText(msg);
      if (text && text.length > 3) {
        const tokens = estimateTokens(text);
        totalOutputTokens += tokens;
        console.log(`OUTPUT ${i+1}: ${tokens} tokens - "${text.substring(0, 50)}..."`);
      }
    });
    
    // Process Claude messages
    allClaudeMessages.forEach((msg, i) => {
      const text = extractText(msg);
      const isUser = msg.getAttribute('data-is-author') === 'true';
      
      if (text && text.length > 3) {
        const tokens = estimateTokens(text);
        if (isUser) {
          totalInputTokens += tokens;
          totalQueries++;
          console.log(`CLAUDE INPUT ${i+1}: ${tokens} tokens - "${text.substring(0, 50)}..."`);
        } else {
          totalOutputTokens += tokens;
          console.log(`CLAUDE OUTPUT ${i+1}: ${tokens} tokens - "${text.substring(0, 50)}..."`);
        }
      }
    });
    
    const totalTokens = totalInputTokens + totalOutputTokens;
    
    console.log('='.repeat(80));
    console.log(`📊 TOTALS: INPUT: ${totalInputTokens} | OUTPUT: ${totalOutputTokens} | TOTAL: ${totalTokens} | QUERIES: ${totalQueries}`);
    console.log(`🌍 IMPACT: ${(totalTokens * 0.5).toFixed(1)}g CO2 | ${(totalTokens * 0.001).toFixed(3)}Wh energy | ${(totalTokens * 0.1).toFixed(1)}ml water`);
    console.log('='.repeat(80));
    
    // Send totals to background
    const provider = getCurrentProvider();
    sendToBackground({
      type: 'session_total',
      provider: provider ? provider.name : 'Unknown',
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalTokens,
      queries: totalQueries,
      timestamp: Date.now()
    });
  }
  
  function startAutoRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    // Auto-refresh every 3 seconds
    refreshInterval = setInterval(() => {
      scanMessages();
    }, 3000);
    
    console.log('🔄 Auto-refresh started - scanning every 3 seconds');
  }
  
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('🚀 Initializing LLM Environmental Impact Tracker...');
    console.log(`📍 URL: ${window.location.href}`);
    
    // Initial scan
    scanMessages();
    
    // Start auto-refresh every 3 seconds
    startAutoRefresh();
    
    console.log('✅ LLM tracker initialized with auto-refresh');
  }
  
  // Add keyboard shortcut for manual refresh
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+R to manually refresh/scan
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      console.log('Manual refresh triggered by keyboard shortcut');
      scanMessages();
    }
  });
  
  // Make available globally for testing
  window.llmTracker = {
    scan: scanMessages,
    inputTokens: () => totalInputTokens,
    outputTokens: () => totalOutputTokens,
    totalTokens: () => totalInputTokens + totalOutputTokens,
    queries: () => totalQueries,
    provider: getCurrentProvider,
    refresh: () => {
      console.log('🔄 Manual refresh triggered');
      scanMessages();
    },
    startAutoRefresh: startAutoRefresh,
    stopAutoRefresh: () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('🛑 Auto-refresh stopped');
      }
    }
  };
  
  // Initialize when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Also try after a delay
  setTimeout(init, 1000);
  
  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (observer) {
      observer.disconnect();
    }
  });
  
  console.log('LLM Environmental Impact Tracker content script loaded');
  
})();
