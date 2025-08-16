// Force inject the tracker - paste this in ChatGPT console if extension doesn't work
console.log('Force injecting LLM tracker...');

(function() {
  let processedMessages = new Set();
  let totalTokens = 0;
  let totalQueries = 0;
  
  function estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }
  
  function sendToExtension(data) {
    console.log('Sending to extension:', data);
    
    // Try to send to extension
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        action: 'trackTokens',
        data: data
      }, (response) => {
        console.log('Extension response:', response);
      });
    } else {
      console.log('Extension not available, data would be:', data);
    }
  }
  
  function processMessage(element, messageType, messageId) {
    if (processedMessages.has(messageId)) return;
    
    let text = '';
    if (element.classList.contains('user-message-bubble-color')) {
      const textDiv = element.querySelector('.whitespace-pre-wrap');
      text = textDiv ? textDiv.textContent : element.textContent;
    } else if (element.hasAttribute('data-start')) {
      text = element.textContent;
    }
    
    if (!text || text.length < 3) return;
    
    const tokens = estimateTokens(text);
    processedMessages.add(messageId);
    
    if (messageType === 'user') {
      totalQueries++;
    }
    totalTokens += tokens;
    
    console.log(`${messageType} message: ${tokens} tokens - "${text.substring(0, 50)}..."`);
    
    sendToExtension({
      type: messageType === 'user' ? 'input_tokens' : 'output_tokens',
      provider: 'ChatGPT',
      tokens: tokens,
      messageType: messageType,
      timestamp: Date.now(),
      messagePreview: text.substring(0, 100),
      totalTokens: totalTokens,
      totalQueries: totalQueries
    });
  }
  
  function scanMessages() {
    const userMessages = document.querySelectorAll('.user-message-bubble-color');
    const assistantMessages = document.querySelectorAll('p[data-start][data-end]');
    
    console.log(`Scanning: ${userMessages.length} user, ${assistantMessages.length} assistant messages`);
    
    userMessages.forEach((msg, i) => {
      const msgId = `user-${i}-${msg.textContent.substring(0, 20).replace(/\s+/g, '-')}`;
      processMessage(msg, 'user', msgId);
    });
    
    assistantMessages.forEach((msg, i) => {
      const msgId = `assistant-${msg.getAttribute('data-start')}-${msg.getAttribute('data-end')}`;
      processMessage(msg, 'assistant', msgId);
    });
    
    console.log(`Total processed: ${totalQueries} queries, ${totalTokens} tokens`);
  }
  
  // Set up observer for new messages
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const newUserMessages = node.querySelectorAll ? node.querySelectorAll('.user-message-bubble-color') : [];
            const newAssistantMessages = node.querySelectorAll ? node.querySelectorAll('p[data-start][data-end]') : [];
            
            newUserMessages.forEach((msg) => {
              const msgId = `user-new-${Date.now()}-${msg.textContent.substring(0, 20).replace(/\s+/g, '-')}`;
              processMessage(msg, 'user', msgId);
            });
            
            newAssistantMessages.forEach((msg) => {
              setTimeout(() => {
                const msgId = `assistant-new-${msg.getAttribute('data-start')}-${msg.getAttribute('data-end')}`;
                processMessage(msg, 'assistant', msgId);
              }, 1000);
            });
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Make available globally
  window.forceTracker = {
    scan: scanMessages,
    tokens: () => totalTokens,
    queries: () => totalQueries,
    processed: () => processedMessages.size
  };
  
  // Initial scan
  scanMessages();
  
  console.log('Force tracker initialized! Use window.forceTracker to interact.');
})();
