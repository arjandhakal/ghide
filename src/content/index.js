import './styles.css';

console.log('Gemfold: Content script loaded');

function injectGemfold() {
  // Use a more generic selector if the specific one is brittle, but per research:
  // Parent: side-navigation-content > div.sidenav-with-history-container
  // Anchor: div.gems-list-container
  
  // Note: Gemini class names might be obfuscated or change, but per research, we look for these structure containers.
  // The 'sidenav-with-history-container' class was noted in research.
  
  const parent = document.querySelector('side-navigation-content > .sidenav-with-history-container') || 
                 document.querySelector('side-navigation-content > div'); // Fallback
  
  const anchor = document.querySelector('.gems-list-container');
  
  if (parent && anchor) {
    if (document.getElementById('gemfold-root')) return;

    console.log('Gemfold: Target found, injecting...');
    const container = document.createElement('div');
    container.id = 'gemfold-root';
    container.innerHTML = `
      <div class="gemfold-header">
        <span class="material-symbols-outlined">folder</span>
        <span>Gemfold Folders</span>
      </div>
      <div class="gemfold-body">
        (Folders will appear here)
      </div>
    `;
    
    // Insert after anchor (Gems list)
    // parent.insertBefore(container, anchor.nextSibling);
    // Safer: insert specifically after anchor
    anchor.insertAdjacentElement('afterend', container);
    
  } else {
    // console.debug('Gemfold: Waiting for sidebar...');
  }
}

// Observer to handle dynamic loading (Gemini is an SPA)
const observer = new MutationObserver((mutations) => {
  injectGemfold();
});

// Start observing
setTimeout(() => {
    const root = document.querySelector('body');
    if (root) {
        observer.observe(root, { childList: true, subtree: true });
        injectGemfold();
    }
}, 1000);
