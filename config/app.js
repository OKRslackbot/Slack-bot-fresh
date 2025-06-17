/**
 * Application Configuration
 * Centralized configuration management for the OKR Bot
 */

require('dotenv').config();

const config = {
  // Slack Configuration
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },

  // Application Settings
  app: {
    name: 'OKR Slack Bot',
    version: '2.0.0',
    description: 'Professional OKR management system for Slack teams'
  },

  // Storage Configuration
  storage: {
    type: process.env.STORAGE_TYPE || 'memory', // memory, postgres, mongodb
    connectionString: process.env.DATABASE_URL,
    options: {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
      timeout: parseInt(process.env.DB_TIMEOUT) || 30000
    }
  },

  // Feature Flags
  features: {
    enableReporting: process.env.ENABLE_REPORTING !== 'false',
    enableNotifications: process.env.ENABLE_NOTIFICATIONS === 'true',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    maxObjectivesPerUser: parseInt(process.env.MAX_OBJECTIVES_PER_USER) || 50,
    maxKeyResultsPerObjective: parseInt(process.env.MAX_KR_PER_OBJECTIVE) || 10
  },

  // Validation Rules
  validation: {
    objective: {
      titleMaxLength: 200,
      descriptionMaxLength: 1000,
      maxAssignees: 10
    },
    keyResult: {
      titleMaxLength: 200,
      descriptionMaxLength: 1000,
      maxTarget: 1000000,
      minTarget: 0.01
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.ENABLE_CONSOLE_LOG !== 'false',
    enableFile: process.env.ENABLE_FILE_LOG === 'true',
    logFile: process.env.LOG_FILE || 'okr-bot.log'
  },

  // Rate Limiting
  rateLimiting: {
    enabled: process.env.ENABLE_RATE_LIMITING === 'true',
    commandsPerMinute: parseInt(process.env.COMMANDS_PER_MINUTE) || 60,
    burstLimit: parseInt(process.env.BURST_LIMIT) || 10
  },

  // Notification Settings
  notifications: {
    reminderHours: [9, 17], // 9 AM and 5 PM
    overdueReminderDays: [1, 3, 7], // Remind after 1, 3, and 7 days overdue
    progressReminderDays: 7 // Weekly progress reminders
  },

  // Report Settings
  reports: {
    maxObjectivesInReport: 50,
    maxKeyResultsInReport: 100,
    defaultTimeframe: '30d',
    cacheTimeoutMinutes: 15
  },

  // Security Settings
  security: {
    enableInputSanitization: true,
    maxInputLength: 2000,
    allowedFileTypes: ['.csv', '.json'],
    rateLimitWindowMs: 60000 // 1 minute
  },

  // Integration Settings
  integrations: {
    google: {
      enabled: process.env.GOOGLE_INTEGRATION === 'true',
      apiKey: process.env.GOOGLE_API_KEY
    },
    jira: {
      enabled: process.env.JIRA_INTEGRATION === 'true',
      baseUrl: process.env.JIRA_BASE_URL,
      apiToken: process.env.JIRA_API_TOKEN
    },
    excel: {
      enabled: process.env.EXCEL_EXPORT === 'true',
      maxRows: 10000
    }
  }
};

// Validation function
function validateConfig() {
  const required = [
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'SLACK_APP_TOKEN'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate Slack tokens format
  if (!config.slack.botToken?.startsWith('xoxb-')) {
    throw new Error('Invalid SLACK_BOT_TOKEN format - should start with xoxb-');
  }

  if (!config.slack.appToken?.startsWith('xapp-')) {
    throw new Error('Invalid SLACK_APP_TOKEN format - should start with xapp-');
  }

  return true;
}

// Development vs Production settings
function applyEnvironmentOverrides() {
  if (config.server.environment === 'production') {
    // Production overrides
    config.logging.level = 'warn';
    config.features.enableMetrics = true;
    config.rateLimiting.enabled = true;
    config.security.enableInputSanitization = true;
  } else if (config.server.environment === 'development') {
    // Development overrides
    config.logging.level = 'debug';
    config.features.enableMetrics = false;
    config.rateLimiting.enabled = false;
  }
}

// Helper functions
function getSlackConfig() {
  return config.slack;
}

function getServerConfig() {
  return config.server;
}

function getStorageConfig() {
  return config.storage;
}

function getFeatureFlags() {
  return config.features;
}

function getValidationRules() {
  return config.validation;
}

function isFeatureEnabled(featureName) {
  return config.features[featureName] === true;
}

function getIntegrationConfig(integration) {
  return config.integrations[integration] || { enabled: false };
}

// Initialize configuration
try {
  validateConfig();
  applyEnvironmentOverrides();
  console.log(`✅ Configuration loaded for ${config.server.environment} environment`);
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

module.exports = {
  ...config,
  validateConfig,
  getSlackConfig,
  getServerConfig,
  getStorageConfig,
  getFeatureFlags,
  getValidationRules,
  isFeatureEnabled,
  getIntegrationConfig
};