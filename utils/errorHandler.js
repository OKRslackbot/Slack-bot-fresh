// utils/errorHandler.js

const logger = {
  debug: (...args) => console.log('[DEBUG]', new Date().toISOString(), ...args),
  info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
  warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
};

// Wrap action handlers to catch errors
function wrapAction(actionName, handler) {
  return async (args) => {
    logger.debug(`Starting action: ${actionName}`);
    const { ack } = args;
    
    try {
      // Always acknowledge first
      if (ack) {
        await ack();
        logger.debug(`Acknowledged action: ${actionName}`);
      }
      
      // Execute handler
      await handler(args);
      logger.debug(`Completed action: ${actionName}`);
      
    } catch (error) {
      logger.error(`Failed in action ${actionName}:`, error);
      logger.error('Error stack:', error.stack);
      
      // Try to notify user of error
      if (args.client && args.body?.user?.id) {
        try {
          await args.client.chat.postMessage({
            channel: args.body.user.id,
            text: `❌ An error occurred: ${error.message}. Please try again.`
          });
        } catch (msgError) {
          logger.error('Failed to send error message:', msgError);
        }
      }
    }
  };
}

// Wrap view handlers to catch errors
function wrapView(viewName, handler) {
  return async (args) => {
    logger.debug(`Starting view handler: ${viewName}`);
    const { ack } = args;
    
    try {
      // Always acknowledge first
      if (ack) {
        await ack();
        logger.debug(`Acknowledged view: ${viewName}`);
      }
      
      // Execute handler
      await handler(args);
      logger.debug(`Completed view handler: ${viewName}`);
      
    } catch (error) {
      logger.error(`Failed in view ${viewName}:`, error);
      logger.error('Error stack:', error.stack);
      
      // Try to notify user
      if (args.client && args.body?.user?.id) {
        try {
          await args.client.chat.postMessage({
            channel: args.body.user.id,
            text: `❌ Error processing form: ${error.message}`
          });
        } catch (msgError) {
          logger.error('Failed to send error message:', msgError);
        }
      }
    }
  };
}

// Setup global error handlers
function setupGlobalErrorHandlers(app) {
  // Slack app error handler
  app.error(async (error) => {
    logger.error('Slack app error:', error);
    
    if (error.code === 'slack_webapi_platform_error') {
      logger.error('Slack API Error Details:', {
        error: error.data?.error,
        response_metadata: error.data?.response_metadata
      });
    }
  });

  // Process-level error handlers
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    logger.error('Stack:', error.stack);
    // Give time to log before exit
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise);
    logger.error('Reason:', reason);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    app.stop().then(() => {
      logger.info('App stopped successfully');
      process.exit(0);
    }).catch((err) => {
      logger.error('Error stopping app:', err);
      process.exit(1);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    app.stop().then(() => {
      logger.info('App stopped successfully');
      process.exit(0);
    }).catch((err) => {
      logger.error('Error stopping app:', err);
      process.exit(1);
    });
  });
}

module.exports = {
  logger,
  wrapAction,
  wrapView,
  setupGlobalErrorHandlers
};