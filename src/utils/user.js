
/**
 * Attempts to retrieve the current user's unique identifier.
 * Uses multiple strategies to be robust against DOM changes.
 */
export async function getCurrentUserId() {
  return new Promise((resolve) => {
    // Retry a few times because the avatar might load late
    let attempts = 0;
    const maxAttempts = 10;
    
    const check = () => {
      // Strategy 1: Look for the Google Account button aria-label
      // Usually contains "Google Account: Name (email)"
      // Selector targets the avatar button in top-right
      const accountBtns = document.querySelectorAll('a[href^="https://accounts.google.com"], button[aria-label*="Google Account"]');
      
      for (const btn of accountBtns) {
        const label = btn.getAttribute('aria-label') || '';
        // Regex to find email inside parentheses: "Name (email@domain.com)"
        const emailMatch = label.match(/\(([\w.-]+@[\w.-]+\.\w+)\)/); 
        if (emailMatch) {
            resolve(emailMatch[1]);
            return;
        }
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        console.warn('GHide : Could not identify user email. Falling back to "default".');
        resolve('default');
      }
    };
    
    check();
  });
}
