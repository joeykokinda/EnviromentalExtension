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
    this.setupStorageListener();
    this.setupAlarms();
    
    console.log(' LLM Environmental Impact Tracker initialized');
    console.log(' Current data:', this.dailyData);
  }
  
  setupAlarms() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'dailyReset') {
        this.resetDailyData();
      }
    });
    
    chrome.alarms.create('dailyReset', {
      when: this.getNextMidnight(),
      periodInMinutes: 24 * 60
    });
  }
  
  getNextMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime();
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
  

  
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.contentScriptData) {
        this.handleContentScriptData(changes.contentScriptData.newValue);
      }
      if (namespace === 'local' && changes.tokenData) {
        this.handleTokenData(changes.tokenData.newValue);
      }
    });
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
  
  async handleTokenTracking(data) {
    if (!data || !data.tokens) {
      console.log(' Invalid token data received:', data);
      return;
    }
    
    try {
      console.log(` Background received: ${data.tokens} ${data.type} tokens from ${data.provider}`);
      console.log(` Message preview: "${data.messagePreview}"`);
      
      const tokens = data.tokens;
      const impact = calculateEnvironmentalImpact(tokens);
      
      await this.updateMetricsFromTokens({
        provider: data.provider,
        tokens: tokens,
        type: data.type,
        messageType: data.messageType
      });
      
      console.log(` Impact calculated: ${impact.energyWh}Wh, ${impact.carbonGrams}g CO2, ${impact.waterMl}ml water`);
      
    } catch (error) {
      console.error(' Error handling token tracking:', error);
    }
  }
  
  async handleTokenData(tokenDataArray) {
    if (!tokenDataArray || !Array.isArray(tokenDataArray)) return;
    
    try {
      for (const data of tokenDataArray) {
        await this.handleTokenTracking(data);
      }
      
      await chrome.storage.local.remove(['tokenData']);
      
    } catch (error) {
      console.error('Error handling token data array:', error);
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
  
  async updateMetricsFromTokens(data) {
    const today = new Date().toDateString();
    
    if (this.dailyData.date !== today) {
      await this.resetDailyData();
    }
    
    const tokens = data.tokens;
    const impact = calculateEnvironmentalImpact(tokens);
    
    if (data.messageType === 'user') {
      this.dailyData.queries += 1;
    }
    
    this.dailyData.totalTokens += tokens;
    this.dailyData.energyWh += impact.energyWh;
    this.dailyData.carbonGrams += impact.carbonGrams;
    this.dailyData.waterMl += impact.waterMl;
    
    await this.saveDailyData();
    
    console.log(` Updated metrics: ${tokens} ${data.messageType} tokens from ${data.provider}`);
    console.log(` Total today: ${this.dailyData.totalTokens} tokens, ${this.dailyData.queries} queries`);
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
  } else if (request.action === 'trackTokens') {
    tracker.handleTokenTracking(request.data);
    sendResponse({ success: true });
  }
  return true;
});

// Handle extension icon click to open sidebar
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
