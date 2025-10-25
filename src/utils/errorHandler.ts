// Global error handler for unhandled errors
export function setupGlobalErrorHandlers() {
  console.log('🔧 Setting up global error handlers...');
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection detected:', event.reason);
    
    // Log the error details
    if (event.reason instanceof Error) {
      console.error('Error message:', event.reason.message);
      console.error('Error stack:', event.reason.stack);
      console.error('Error name:', event.reason.name);
    } else {
      console.error('Rejection reason:', event.reason);
      console.error('Rejection type:', typeof event.reason);
    }
    
    // Check for specific error patterns
    const errorStr = String(event.reason);
    if (errorStr.includes('利用できません') || errorStr.includes('式')) {
      console.error('🎯 Detected "利用できません" error in promise rejection!');
      console.error('Full rejection details:', {
        reason: event.reason,
        type: typeof event.reason,
        stringified: errorStr,
        timestamp: new Date().toISOString()
      });
    }
    
    // Prevent the default browser behavior
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    console.error('🚨 Uncaught error detected:', event.error);
    console.error('Error message:', event.message);
    console.error('Error filename:', event.filename);
    console.error('Error lineno:', event.lineno);
    console.error('Error colno:', event.colno);
    
    // Log the error details
    if (event.error instanceof Error) {
      console.error('Error stack:', event.error.stack);
      console.error('Error name:', event.error.name);
    }
    
    // Check for specific error patterns
    const errorStr = String(event.message || event.error);
    if (errorStr.includes('利用できません') || errorStr.includes('式')) {
      console.error('🎯 Detected "利用できません" error in uncaught error!');
      console.error('Full error details:', {
        error: event.error,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Enhanced console error monitoring
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Log to original console.error
    originalConsoleError.apply(console, args);
    
    // Check if the error contains "利用できません" or similar Japanese error messages
    const errorMessage = args.join(' ');
    if (errorMessage.includes('利用できません') || 
        errorMessage.includes('式')) {
      // Avoid infinite loop by not using console.error for our own messages
      originalConsoleError('🎯 Detected potential error message in console.error:', errorMessage);
      originalConsoleError('Full console.error args:', args);
      originalConsoleError('Stack trace:', new Error().stack);
    }
  };

  // Monitor all console methods for error patterns
  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    originalConsoleWarn.apply(console, args);
    
    const message = args.join(' ');
    if (message.includes('利用できません') || message.includes('式')) {
      console.error('🎯 Detected "利用できません" in console.warn:', message);
    }
  };

  const originalConsoleLog = console.log;
  console.log = (...args) => {
    originalConsoleLog.apply(console, args);
    
    const message = args.join(' ');
    // スケジュールタイトル内の「利用できません」は無視（📅 で始まるログは除外）
    if ((message.includes('利用できません') || message.includes('式')) && !message.includes('📅')) {
      originalConsoleError('🎯 Detected "利用できません" in console.log:', message);
      originalConsoleError('All args:', args);
    }
  };

  // Monitor console.info as well
  const originalConsoleInfo = console.info;
  console.info = (...args) => {
    originalConsoleInfo.apply(console, args);
    
    const message = args.join(' ');
    // スケジュールタイトル内の「利用できません」は無視（📅 で始まるログは除外）
    if ((message.includes('利用できません') || message.includes('式')) && !message.includes('📅')) {
      originalConsoleError('🎯 Detected "利用できません" in console.info:', message);
      originalConsoleError('All args:', args);
    }
  };

  // Monitor console.debug as well
  const originalConsoleDebug = console.debug;
  console.debug = (...args) => {
    originalConsoleDebug.apply(console, args);
    
    const message = args.join(' ');
    // スケジュールタイトル内の「利用できません」は無視（📅 で始まるログは除外）
    if ((message.includes('利用できません') || message.includes('式')) && !message.includes('📅')) {
      originalConsoleError('🎯 Detected "利用できません" in console.debug:', message);
      originalConsoleError('All args:', args);
    }
  };

  // Additional error monitoring for DOM events (disabled to prevent infinite loops)
  // document.addEventListener('error', (event) => {
  //   originalConsoleError('🚨 DOM Error detected:', event);
  //   const errorStr = String(event.error || event.message);
  //   if (errorStr.includes('利用できません') || errorStr.includes('式')) {
  //     originalConsoleError('🎯 Detected "利用できません" error in DOM error!');
  //     originalConsoleError('Full DOM error details:', {
  //       error: event.error,
  //       message: event.message,
  //       filename: event.filename,
  //       lineno: event.lineno,
  //       colno: event.colno,
  //       timestamp: new Date().toISOString()
  //     });
  //   }
  // });

  // Monitor for any text content changes that might contain errors (disabled to prevent infinite loops)
  // const observer = new MutationObserver((mutations) => {
  //   mutations.forEach((mutation) => {
  //     if (mutation.type === 'childList') {
  //       mutation.addedNodes.forEach((node) => {
  //         if (node.nodeType === Node.TEXT_NODE) {
  //           const text = node.textContent || '';
  //           if (text.includes('利用できません') || text.includes('式')) {
  //             originalConsoleError('🎯 Detected "利用できません" in DOM text content!');
  //             originalConsoleError('Text content:', text);
  //             originalConsoleError('Parent element:', node.parentElement);
  //           }
  //         }
  //       });
  //     }
  //   });
  // });

  // Start observing (disabled)
  // observer.observe(document.body, {
  //   childList: true,
  //   subtree: true,
  //   characterData: true
  // });

  // Periodic error message scanning (disabled to prevent infinite loops)
  // setInterval(() => {
  //   // Check for error messages in the entire document
  //   const allText = document.body.innerText || document.body.textContent || '';
  //   if (allText.includes('利用できません') || allText.includes('式')) {
  //     originalConsoleError('🎯 Detected "利用できません" in document text!');
  //     originalConsoleError('Document text:', allText);
  //     originalConsoleError('Timestamp:', new Date().toISOString());
  //   }
  // }, 1000); // Check every second

  console.log('✅ Global error handlers setup complete');
}

// Function to log errors to external service (placeholder)
export function logErrorToService(error: Error, errorInfo?: any) {
  // This would typically send the error to an external logging service
  console.log('Logging error to service:', {
    message: error.message,
    stack: error.stack,
    errorInfo,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  });
}
