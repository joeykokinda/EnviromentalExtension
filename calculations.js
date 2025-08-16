function calculateEnvironmentalImpact(tokens) {
  const ENERGY_PER_TOKEN_WH = 0.001;
  const CARBON_PER_TOKEN_GRAMS = 0.5;
  const WATER_PER_TOKEN_ML = 0.1;
  
  return {
    energyWh: tokens * ENERGY_PER_TOKEN_WH,
    carbonGrams: tokens * CARBON_PER_TOKEN_GRAMS,
    waterMl: tokens * WATER_PER_TOKEN_ML
  };
}

function estimateTokens(requestData, provider) {
  if (!requestData) return 100;
  
  let estimatedTokens = 0;
  
  try {
    switch (provider) {
      case 'OpenAI':
        estimatedTokens = estimateOpenAITokens(requestData);
        break;
      case 'Anthropic':
        estimatedTokens = estimateAnthropicTokens(requestData);
        break;
      case 'Cohere':
        estimatedTokens = estimateCohereTokens(requestData);
        break;
      default:
        estimatedTokens = estimateGenericTokens(requestData);
    }
  } catch (error) {
    console.error('Error estimating tokens:', error);
    estimatedTokens = 100;
  }
  
  return Math.max(estimatedTokens, 1);
}

function estimateOpenAITokens(data) {
  let tokens = 0;
  
  if (data.messages && Array.isArray(data.messages)) {
    tokens = data.messages.reduce((sum, msg) => {
      return sum + estimateTextTokens(msg.content || '');
    }, 0);
  }
  
  if (data.prompt) {
    tokens += estimateTextTokens(data.prompt);
  }
  
  if (data.max_tokens) {
    tokens += data.max_tokens;
  } else {
    tokens += 150;
  }
  
  return tokens;
}

function estimateAnthropicTokens(data) {
  let tokens = 0;
  
  if (data.messages && Array.isArray(data.messages)) {
    tokens = data.messages.reduce((sum, msg) => {
      return sum + estimateTextTokens(msg.content || '');
    }, 0);
  }
  
  if (data.prompt) {
    tokens += estimateTextTokens(data.prompt);
  }
  
  if (data.max_tokens_to_sample) {
    tokens += data.max_tokens_to_sample;
  } else {
    tokens += 150;
  }
  
  return tokens;
}

function estimateCohereTokens(data) {
  let tokens = 0;
  
  if (data.message) {
    tokens += estimateTextTokens(data.message);
  }
  
  if (data.prompt) {
    tokens += estimateTextTokens(data.prompt);
  }
  
  if (data.max_tokens) {
    tokens += data.max_tokens;
  } else {
    tokens += 150;
  }
  
  return tokens;
}

function estimateGenericTokens(data) {
  const text = JSON.stringify(data);
  return estimateTextTokens(text) + 150;
}

function estimateTextTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

function formatNumber(num, decimals = 1) {
  if (num === 0) return '0';
  
  if (num < 1) {
    return num.toFixed(decimals + 1);
  } else if (num < 1000) {
    return num.toFixed(decimals);
  } else if (num < 1000000) {
    return (num / 1000).toFixed(decimals) + 'K';
  } else {
    return (num / 1000000).toFixed(decimals) + 'M';
  }
}

function getImpactLevel(carbonGrams) {
  if (carbonGrams < 10) return 'low';
  if (carbonGrams < 50) return 'medium';
  return 'high';
}

function getComparisonMetrics(data) {
  const { energyWh, carbonGrams, waterMl } = data;
  
  return {
    carMiles: (carbonGrams / 404).toFixed(2),
    treesNeeded: (carbonGrams / 21000).toFixed(3),
    phoneCharges: (energyWh / 18).toFixed(1),
    lightBulbHours: (energyWh / 10).toFixed(1),
    coffeeCups: (waterMl / 140).toFixed(1)
  };
}

function getDailyGoalProgress(currentCarbon, dailyGoal = 100) {
  const percentage = Math.min((currentCarbon / dailyGoal) * 100, 100);
  return {
    percentage: percentage.toFixed(1),
    remaining: Math.max(dailyGoal - currentCarbon, 0).toFixed(1),
    exceeded: currentCarbon > dailyGoal
  };
}

function getEfficiencyTips(data) {
  const tips = [];
  
  if (data.queries > 20) {
    tips.push("Consider batching similar questions to reduce API calls");
  }
  
  if (data.totalTokens > 10000) {
    tips.push("Try using shorter prompts for simple tasks");
  }
  
  if (data.carbonGrams > 50) {
    tips.push("High carbon usage today - consider taking breaks between AI sessions");
  }
  
  return tips;
}
