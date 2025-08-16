// Test script to verify domain detection - paste in ChatGPT console
console.log('Domain test starting...');
console.log('Current URL:', window.location.href);
console.log('Current hostname:', window.location.hostname);

// Test if we're on the right domain
const supportedDomains = ['chat.openai.com', 'chatgpt.com'];
const currentDomain = window.location.hostname;
const isSupported = supportedDomains.includes(currentDomain);

console.log('Supported domains:', supportedDomains);
console.log('Current domain supported:', isSupported);

// Test selectors
const userMessages = document.querySelectorAll('.user-message-bubble-color');
const assistantMessages = document.querySelectorAll('p[data-start][data-end]');

console.log(`Found ${userMessages.length} user messages`);
console.log(`Found ${assistantMessages.length} assistant messages`);

if (userMessages.length > 0) {
  console.log('Sample user message:', userMessages[0].textContent.substring(0, 50));
}

if (assistantMessages.length > 0) {
  console.log('Sample assistant message:', assistantMessages[0].textContent.substring(0, 50));
}

// Test extension availability
console.log('Chrome runtime available:', typeof chrome !== 'undefined' && !!chrome.runtime);
console.log('Extension ID:', chrome?.runtime?.id);

console.log('Domain test complete!');
