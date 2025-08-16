// Load calculations module
importScripts('calculations.js');

class LLMTracker {
  constructor() {
    this.dailyData = {
      date: new Date().toDateString(),
      queries: 0,
      totalTokens: 0,
      energyWh: 0,
      carbonGrams: 0,
      waterMl: 0
    };
    
    this.apiEndpoints = {
      'api.openai.com': 'OpenAI',
      'api.anthropic.com': 'Anthropic',
      'api.cohere.ai': 'Cohere',
      'api.together.xyz': 'Together',
      'api.replicate.com': 'Replicate'
    };
    
    this.init();
  }
  
  async init() {
    await this.loadDailyData();
    this.setupWebRequestListener();
    this.setupStorageListener();
    
    console.log('LLM Environmental Impact Tracker initialized');
  }
  
  async loadDailyData() {
    try {
      const stored = await chrome.storage.local.get(['dailyData']);
      const today = new Date().toDateString();
      
      if (stored.dailyData && stored.dailyData.date === today) {
        this.dailyData = stored.dailyData;
      } else {
        this.dailyData.date = today;
        await this.saveDailyData();
      }
    } catch (error) {
      console.error('Error loading daily data:', error);
    }
  }
  
  async saveDailyData() {
    try {
      await chrome.storage.local.set({ dailyData: this.dailyData });
    } catch (error) {
      console.error('Error saving daily data:', error);
    }
  }
  
  setupWebRequestListener() {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleRequest(details),
      {
        urls: [
          "https://api.openai.com/v1/*",
          "https://api.anthropic.com/v1/*",
          "https://api.cohere.ai/v1/*",
          "https://api.together.xyz/inference",
          "https://api.replicate.com/v1/*"
        ]
      },
      ["requestBody"]
    );
    
    chrome.webRequest.onCompleted.addListener(
      (details) => this.handleResponse(details),
      {
        urls: [
          "https://api.openai.com/v1/*",
          "https://api.anthropic.com/v1/*",
          "https://api.cohere.ai/v1/*",
          "https://api.together.xyz/inference",
          "https://api.replicate.com/v1/*"
        ]
      },
      ["responseHeaders"]
    );
  }
  
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.contentScriptData) {
        this.handleContentScriptData(changes.contentScriptData.newValue);
      }
    });
  }
  
  async handleRequest(details) {
    try {
      const url = new URL(details.url);
      const provider = this.getProvider(url.hostname);
      
      if (!provider) return;
      
      let requestData = {};
      if (details.requestBody && details.requestBody.raw) {
        const decoder = new TextDecoder();
        const bodyText = decoder.decode(details.requestBody.raw[0].bytes);
        requestData = JSON.parse(bodyText);
      }
      
      const estimatedTokens = estimateTokens(requestData, provider);
      
      await this.updateMetrics({
        provider,
        requestTokens: estimatedTokens,
        type: 'request'
      });
      
    } catch (error) {
      console.error('Error handling request:', error);
    }
  }
  
  async handleResponse(details) {
    try {
      if (details.statusCode !== 200) return;
      
      const url = new URL(details.url);
      const provider = this.getProvider(url.hostname);
      
      if (!provider) return;
      
      const usageHeader = details.responseHeaders?.find(
        h => h.name.toLowerCase() === 'x-ratelimit-remaining-tokens' || 
             h.name.toLowerCase() === 'anthropic-ratelimit-tokens-remaining'
      );
      
      let responseTokens = 0;
      if (usageHeader) {
        responseTokens = parseInt(usageHeader.value) || 0;
      } else {
        responseTokens = 150;
      }
      
      await this.updateMetrics({
        provider,
        responseTokens,
        type: 'response'
      });
      
    } catch (error) {
      console.error('Error handling response:', error);
    }
  }
  
  async handleContentScriptData(data) {
    if (!data) return;
    
    try {
      const impact = calculateEnvironmentalImpact(data.estimatedTokens || 100);
      
      await this.updateMetrics({
        provider: data.provider || 'Web Interface',
        requestTokens: data.estimatedTokens || 100,
        type: 'content_script'
      });
      
    } catch (error) {
      console.error('Error handling content script data:', error);
    }
  }
  
  async updateMetrics(data) {
    const today = new Date().toDateString();
    
    if (this.dailyData.date !== today) {
      await this.resetDailyData();
    }
    
    const tokens = (data.requestTokens || 0) + (data.responseTokens || 0);
    const impact = calculateEnvironmentalImpact(tokens);
    
    this.dailyData.queries += 1;
    this.dailyData.totalTokens += tokens;
    this.dailyData.energyWh += impact.energyWh;
    this.dailyData.carbonGrams += impact.carbonGrams;
    this.dailyData.waterMl += impact.waterMl;
    
    await this.saveDailyData();
    
    console.log(`Updated metrics: ${tokens} tokens, Provider: ${data.provider}`);
  }
  
  async resetDailyData() {
    const today = new Date().toDateString();
    
    await chrome.storage.local.set({
      [`history_${this.dailyData.date}`]: { ...this.dailyData }
    });
    
    this.dailyData = {
      date: today,
      queries: 0,
      totalTokens: 0,
      energyWh: 0,
      carbonGrams: 0,
      waterMl: 0
    };
  }
  
  getProvider(hostname) {
    return this.apiEndpoints[hostname] || null;
  }
}

const tracker = new LLMTracker();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDailyData') {
    sendResponse(tracker.dailyData);
  } else if (request.action === 'resetData') {
    tracker.resetDailyData().then(() => {
      sendResponse({ success: true });
    });
  }
  return true;
});
