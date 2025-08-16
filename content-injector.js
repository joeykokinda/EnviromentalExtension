// Content script that injects the tracker directly into the page
console.log('LLM Environmental Impact Tracker injector loading...');

// Inject the tracking script directly into the page
function injectTracker() {
  const script = document.createElement('script');
  script.textContent = `
    console.log('LLM Tracker injected into page context');
    
    (function() {
      let processedMessages = new Set();
      let totalTokens = 0;
      let totalQueries = 0;
      
      function estimateTokens(text) {
        if (!text || typeof text !== 'string') return 0;
        const words = text.trim().split(/\\s+/).length;
        return Math.ceil(words * 1.3);
      }
      
      function sendToExtension(data) {
        // Send message to content script
        window.postMessage({
          type: 'LLM_TRACKER_DATA',
          data: data
        }, '*');
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
        
        console.log(\`\${messageType} message: \${tokens} tokens - "\${text.substring(0, 50)}..."\`);
        
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
        
        console.log(\`Scanning: \${userMessages.length} user, \${assistantMessages.length} assistant messages\`);
        
        userMessages.forEach((msg, i) => {
          const msgId = \`user-\${i}-\${msg.textContent.substring(0, 20).replace(/\\s+/g, '-')}\`;
          processMessage(msg, 'user', msgId);
        });
        
        assistantMessages.forEach((msg, i) => {
          const msgId = \`assistant-\${msg.getAttribute('data-start')}-\${msg.getAttribute('data-end')}\`;
          processMessage(msg, 'assistant', msgId);
        });
      }
      
      // Set up observer for new messages
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check for new user messages
                const newUserMessages = node.querySelectorAll ? node.querySelectorAll('.user-message-bubble-color') : [];
                const newAssistantMessages = node.querySelectorAll ? node.querySelectorAll('p[data-start][data-end]') : [];
                
                newUserMessages.forEach((msg) => {
                  const msgId = \`user-new-\${Date.now()}-\${msg.textContent.substring(0, 20).replace(/\\s+/g, '-')}\`;
                  processMessage(msg, 'user', msgId);
                });
                
                newAssistantMessages.forEach((msg) => {
                  setTimeout(() => {
                    const msgId = \`assistant-new-\${msg.getAttribute('data-start')}-\${msg.getAttribute('data-end')}\`;
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
      
      // Initial scan
      setTimeout(scanMessages, 1000);
      setTimeout(scanMessages, 3000);
      
      // Make available globally for testing
      window.llmTracker = {
        scanMessages,
        totalTokens: () => totalTokens,
        totalQueries: () => totalQueries,
        processedCount: () => processedMessages.size
      };
      
      console.log('LLM Tracker initialized and monitoring...');
    })();
  `;
  
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
  if (event.source !== window || event.data.type !== 'LLM_TRACKER_DATA') {
    return;
  }
  
  const data = event.data.data;
  console.log('Content script received data:', data);
  
  // Send to background script
  if (chrome && chrome.runtime) {
    chrome.runtime.sendMessage({
      action: 'trackTokens',
      data: data
    }).then(response => {
      console.log('Background response:', response);
    }).catch(error => {
      console.log('Background error:', error);
    });
  }
});

// Inject when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectTracker);
} else {
  injectTracker();
}

// Also try after a delay
setTimeout(injectTracker, 1000);

console.log('LLM Environmental Impact Tracker content script loaded');
