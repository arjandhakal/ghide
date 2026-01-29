import { mountFolderTree, promptNewFolder } from '../components/FolderTree.js';
import { startObserver } from '../utils/observer.js';
import './styles.css';

console.log('GHide: Content script loaded');

function injectGHide() {
  const parent = document.querySelector('side-navigation-content > .sidenav-with-history-container') || 
                 document.querySelector('side-navigation-content > div');
  
  const anchor = document.querySelector('.gems-list-container');
  
  if (parent && anchor) {
    if (document.getElementById('ghide-root')) return;

    console.log('GHide: Target found, injecting...');
    const container = document.createElement('div');
    container.id = 'ghide-root';
    
    // Header
    const header = document.createElement('div');
    header.className = 'ghide-header';
    header.innerHTML = `
      <div class="ghide-header-title">
        <span>MY FOLDERS</span>
      </div>
    `;
    
    // Add New Folder Button
    const addBtn = document.createElement('button');
    addBtn.className = 'ghide-new-folder-btn';
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg>`; // Plus Icon
    addBtn.title = "New Folder";
    addBtn.onclick = () => {
        promptNewFolder(null); // Create at root
    };
    
    header.appendChild(addBtn);

    // Body (Tree)
    const body = document.createElement('div');
    body.className = 'ghide-body';
    
    container.appendChild(header);
    container.appendChild(body);
    
    // Mount the tree component
    mountFolderTree(body);
    
    // Start observing the native list (now that we have our place)
    startObserver();

    // Insert after anchor (Gems list)
    anchor.insertAdjacentElement('afterend', container);
    
    // Resize Observer for collapsed state
    // We observe the parent container's width
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const width = entry.contentRect.width;
            // Native Gemini sidebar collapse threshold is usually around 60-80px
            if (width < 200) {
                container.classList.add('ghide-hidden');
            } else {
                container.classList.remove('ghide-hidden');
            }
        }
    });
    
    // Observe the main sidebar container
    const sidebar = document.querySelector('side-navigation-content');
    if (sidebar) resizeObserver.observe(sidebar);
  }
}

// Observer to handle dynamic loading (Gemini is an SPA)
const observer = new MutationObserver((mutations) => {
  injectGHide();
});

// Start observing
setTimeout(() => {
    const root = document.querySelector('body');
    if (root) {
        observer.observe(root, { childList: true, subtree: true });
        injectGHide();
    }
}, 1000);

