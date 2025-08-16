class SidebarManager {
  constructor() {
    this.data = null;
    this.updateInterval = null;
    this.isRefreshing = false;
    this.init();
  }
  
  async init() {
    try {
      await this.loadData();
      this.setupEventListeners();
      this.updateDisplay();
      this.startAutoUpdate();
      
      console.log('Sidebar initialized successfully');
    } catch (error) {
      console.error('Error initializing sidebar:', error);
      this.showError('Failed to load data');
    }
  }
  
  async loadData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getDailyData' });
      this.data = response || this.getDefaultData();
    } catch (error) {
      console.error('Error loading data:', error);
      this.data = this.getDefaultData();
    }
  }
  
  getDefaultData() {
    return {
      date: new Date().toDateString(),
      queries: 0,
      totalTokens: 0,
      energyWh: 0,
      carbonGrams: 0,
      waterMl: 0
    };
  }
  
  setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    const resetBtn = document.getElementById('resetBtn');
    const detailsBtn = document.getElementById('detailsBtn');
    
    refreshBtn?.addEventListener('click', () => this.handleRefresh());
    resetBtn?.addEventListener('click', () => this.handleReset());
    detailsBtn?.addEventListener('click', () => this.handleDetails());
    
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.loadData().then(() => this.updateDisplay());
      }
    });
  }
  
  async handleRefresh() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    const refreshBtn = document.getElementById('refreshBtn');
    
    if (refreshBtn) {
      refreshBtn.classList.add('refreshing');
      refreshBtn.disabled = true;
    }
    
    try {
      await this.loadData();
      this.updateDisplay();
      this.updateStatus('Data refreshed');
      
      setTimeout(() => {
        this.updateStatus('Monitoring');
      }, 2000);
      
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.showError('Failed to refresh data');
    } finally {
      this.isRefreshing = false;
      if (refreshBtn) {
        refreshBtn.classList.remove('refreshing');
        refreshBtn.disabled = false;
      }
    }
  }
  
  updateDisplay() {
    if (!this.data) return;
    
    this.updateHeader();
    this.updateImpactLevel();
    this.updateMetrics();
    this.updateComparisons();
    this.updateProgress();
    this.updateTips();
    this.updateStatus('Monitoring');
    this.updateLastUpdated();
  }
  
  updateHeader() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
      const today = new Date();
      dateElement.textContent = today.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }
  
  updateImpactLevel() {
    const levelIndicator = document.getElementById('levelIndicator');
    const levelText = document.getElementById('levelText');
    
    if (!levelIndicator || !levelText) return;
    
    const level = getImpactLevel(this.data.carbonGrams);
    
    levelIndicator.className = `level-indicator ${level}`;
    
    const levelTexts = {
      low: 'Low Impact',
      medium: 'Medium Impact',
      high: 'High Impact'
    };
    
    levelText.textContent = levelTexts[level] || 'Unknown';
  }
  
  updateMetrics() {
    const elements = {
      queriesCount: this.data.queries,
      energyUsage: formatNumber(this.data.energyWh, 2),
      carbonEmissions: formatNumber(this.data.carbonGrams, 1),
      waterUsage: formatNumber(this.data.waterMl, 1)
    };
    
    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        const oldValue = element.textContent;
        element.textContent = value;
        
        if (oldValue !== value.toString()) {
          element.parentElement.parentElement.classList.add('updated');
          setTimeout(() => {
            element.parentElement.parentElement.classList.remove('updated');
          }, 600);
        }
      }
    });
  }
  
  updateComparisons() {
    const comparisons = getComparisonMetrics(this.data);
    
    const elements = {
      carMiles: comparisons.carMiles,
      treesNeeded: comparisons.treesNeeded,
      phoneCharges: comparisons.phoneCharges
    };
    
    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }
  
  updateProgress() {
    const progress = getDailyGoalProgress(this.data.carbonGrams);
    
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressRemaining = document.getElementById('progressRemaining');
    
    if (progressFill) {
      progressFill.style.width = `${progress.percentage}%`;
    }
    
    if (progressPercentage) {
      progressPercentage.textContent = `${progress.percentage}%`;
    }
    
    if (progressRemaining) {
      if (progress.exceeded) {
        progressRemaining.textContent = `${(this.data.carbonGrams - 100).toFixed(1)}g over goal`;
        progressRemaining.style.color = '#f44336';
      } else {
        progressRemaining.textContent = `${progress.remaining}g remaining`;
        progressRemaining.style.color = '#666';
      }
    }
  }
  
  updateTips() {
    const tips = getEfficiencyTips(this.data);
    const tipsSection = document.getElementById('tipsSection');
    const tipsList = document.getElementById('tipsList');
    
    if (!tipsSection || !tipsList) return;
    
    if (tips.length > 0) {
      tipsSection.classList.add('visible');
      tipsList.innerHTML = tips.map(tip => `<li>${tip}</li>`).join('');
    } else {
      tipsSection.classList.remove('visible');
    }
  }
  
  updateStatus(status) {
    const statusElement = document.getElementById('trackingStatus');
    if (statusElement) {
      statusElement.textContent = status;
    }
  }
  
  updateLastUpdated() {
    const lastUpdated = document.getElementById('lastUpdated');
    if (lastUpdated) {
      const now = new Date();
      lastUpdated.textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }
  
  async handleReset() {
    if (!confirm('Reset today\'s data? This cannot be undone.')) {
      return;
    }
    
    try {
      const resetBtn = document.getElementById('resetBtn');
      if (resetBtn) {
        resetBtn.textContent = 'Resetting...';
        resetBtn.disabled = true;
      }
      
      await chrome.runtime.sendMessage({ action: 'resetData' });
      await this.loadData();
      this.updateDisplay();
      this.updateStatus('Data reset');
      
      setTimeout(() => {
        this.updateStatus('Monitoring');
      }, 2000);
      
      if (resetBtn) {
        resetBtn.textContent = 'Reset Today';
        resetBtn.disabled = false;
      }
      
    } catch (error) {
      console.error('Error resetting data:', error);
      this.showError('Failed to reset data');
    }
  }
  
  handleDetails() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('details.html')
    });
  }
  
  showError(message) {
    const container = document.querySelector('.sidebar-container');
    if (!container) return;
    
    const existingError = container.querySelector('.error');
    if (existingError) {
      existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    container.insertBefore(errorDiv, container.firstChild);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
  
  startAutoUpdate() {
    this.updateInterval = setInterval(async () => {
      if (!this.isRefreshing) {
        await this.loadData();
        this.updateDisplay();
      }
    }, 10000); // Update every 10 seconds for sidebar
  }
  
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SidebarManager();
});

window.addEventListener('beforeunload', () => {
  if (window.sidebarManager) {
    window.sidebarManager.stopAutoUpdate();
  }
});
