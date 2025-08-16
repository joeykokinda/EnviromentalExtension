// Manual injection test - paste this in ChatGPT console
console.log(' Manual injection test starting...');

// Test if we can manually create the tracker
class TestTracker {
  constructor() {
    console.log(' Test tracker created');
    this.testSelectors();
  }
  
  testSelectors() {
    console.log(' Testing selectors...');
    
    // Test current ChatGPT selectors
    const userMessages = document.querySelectorAll('.user-message-bubble-color');
    const assistantMessages = document.querySelectorAll('p[data-start][data-end]');
    
    console.log(` User messages found: ${userMessages.length}`);
    console.log(` Assistant messages found: ${assistantMessages.length}`);
    
    // Test alternative selectors
    const allMessages = document.querySelectorAll('[data-message-id]');
    const allDataStart = document.querySelectorAll('[data-start]');
    
    console.log(` Messages with data-message-id: ${allMessages.length}`);
    console.log(` Elements with data-start: ${allDataStart.length}`);
    
    // Look for conversation container
    const main = document.querySelector('main');
    console.log(` Main element found:`, !!main);
    
    if (userMessages.length > 0) {
      console.log(' Sample user message:', userMessages[0].textContent.substring(0, 100));
    }
    
    if (assistantMessages.length > 0) {
      console.log(' Sample assistant message:', assistantMessages[0].textContent.substring(0, 100));
    }
  }
  
  simulateTracking() {
    console.log(' Simulating tracking...');
    
    // Simulate sending data to background
    const testData = {
      action: 'trackTokens',
      data: {
        type: 'input_tokens',
        provider: 'ChatGPT',
        tokens: 25,
        messageType: 'user',
        timestamp: Date.now(),
        messagePreview: 'Test message'
      }
    };
    
    console.log(' Would send to background:', testData);
    
    // Try to communicate with extension
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage(testData, (response) => {
        console.log(' Background response:', response);
      });
    } else {
      console.log(' Chrome runtime not available or not in extension context');
    }
  }
}

const testTracker = new TestTracker();
testTracker.simulateTracking();

console.log(' Manual test complete. Extension should be working if selectors found messages.');
