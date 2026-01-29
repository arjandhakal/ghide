import { loadData, moveChatToFolder, subscribeToDataChanges, updateChatTitle } from './storage.js';

let observerInstance = null;
let isDragging = false; 
const titleUpdateTimers = {};

function debounceUpdateTitle(chatId, title) {
    if (titleUpdateTimers[chatId]) clearTimeout(titleUpdateTimers[chatId]);
    titleUpdateTimers[chatId] = setTimeout(() => {
        updateChatTitle(chatId, title);
        delete titleUpdateTimers[chatId];
    }, 2000);
}

/**
 * Starts observing the Gemini sidebar for chat items.
 */
export async function startObserver() {
  if (observerInstance) return;

  const state = await loadData();
  const trackedChats = new Set(Object.keys(state.chats));

  const historyContainer = document.querySelector('side-navigation-content') || document.body;

  observerInstance = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      // 1. Handle Added Nodes
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const links = node.matches?.('a[data-test-id="conversation"]') 
            ? [node] 
            : node.querySelectorAll?.('a[data-test-id="conversation"]');

          if (links && links.length > 0) {
            links.forEach(link => processChatLink(link, trackedChats));
          }
        }
      });
      
      // 2. Handle Title Changes (Rename Sync)
      // Check for changes in text content (characterData) or children of title elements
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
          let target = mutation.target;
          // Find the link container
          let link = null;
          if (target.nodeType === Node.ELEMENT_NODE) link = target.closest('a[data-test-id="conversation"]');
          else if (target.parentElement) link = target.parentElement.closest('a[data-test-id="conversation"]');
          
          if (link) {
              const chatId = extractChatId(link.href);
              if (chatId && trackedChats.has(chatId)) {
                   const titleEl = link.querySelector('.conversation-title');
                   if (titleEl) {
                       const newTitle = titleEl.textContent.trim();
                       if (newTitle) debounceUpdateTitle(chatId, newTitle);
                   }
              }
          }
      }
    });
  });

  observerInstance.observe(historyContainer, {
    childList: true,
    subtree: true,
    characterData: true 
  });

  // Initial pass
  const existingLinks = document.querySelectorAll('a[data-test-id="conversation"]');
  existingLinks.forEach(link => processChatLink(link, trackedChats));
  
  // Update tracked chats when storage changes
  subscribeToDataChanges((newState) => {
       trackedChats.clear();
       if (newState && newState.chats) {
           Object.keys(newState.chats).forEach(id => trackedChats.add(id));
       }
       
       const links = document.querySelectorAll('a[data-test-id="conversation"]');
       links.forEach(link => processChatLink(link, trackedChats));
  });
}

function extractChatId(href) {
  const match = href.match(/\/app\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function processChatLink(link, trackedChats) {
  const chatId = extractChatId(link.href);
  if (!chatId) return;

  if (trackedChats.has(chatId)) {
    // Hidden
    link.style.display = 'none';
    const wrapper = link.closest('.conversation-items-container');
    if (wrapper) wrapper.style.display = 'none';

  } else {
    // Visible
    link.style.display = ''; 
    const wrapper = link.closest('.conversation-items-container');
    if (wrapper) wrapper.style.display = '';

    // Enable Drag
    link.draggable = true;
    link.removeEventListener('dragstart', handleDragStart);
    link.addEventListener('dragstart', handleDragStart);

    // Inject "Quick Move" Button
    injectQuickMoveButton(link, chatId);
  }
}

function handleDragStart(e) {
  const link = e.target.closest('a');
  const chatId = extractChatId(link.href);
  const titleEl = link.querySelector('.conversation-title');
  const title = titleEl ? titleEl.textContent.trim() : 'Untitled Chat';

  if (chatId) {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'chat',
      chatId: chatId,
      title: title,
      origin: 'native'
    }));
    e.dataTransfer.effectAllowed = 'move';
  }
}

// --- Quick Move Feature ---

function injectQuickMoveButton(link, chatId) {
    if (link.querySelector('.ghide-quick-move-btn')) return;

    // We want to insert it before the title, or in a convenient spot
    // Structure: <a ...> <div icon> <div title> ... </a>
    // We can't insert a BUTTON inside an Anchor easily without event bubbling issues.
    // Instead, we can inject it *into* the link but stop propagation.
    
    const btn = document.createElement('span');
    btn.className = 'ghide-quick-move-btn';
    // Folder Icon
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>`;
    btn.title = "Move to Folder";
    
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Don't trigger navigation
        
        const titleEl = link.querySelector('.conversation-title');
        const title = titleEl ? titleEl.textContent.trim() : 'Untitled Chat';
        
        showFolderSelectModal(chatId, title);
    };

    // Insert as first child
    link.insertBefore(btn, link.firstChild);
}

async function showFolderSelectModal(chatId, title) {
    const state = await loadData();
    
    const overlay = document.createElement('div');
    overlay.className = 'ghide-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'ghide-modal';
    
    modal.innerHTML = `
        <div class="ghide-modal-header">
            <span>Move to Folder</span>
            <span class="ghide-modal-close">✕</span>
        </div>
        <div class="ghide-modal-list"></div>
    `;
    
    const list = modal.querySelector('.ghide-modal-list');
    
    // Flatten folders for selection (or just show roots? let's show flat list for now)
    const folders = Object.values(state.folders);
    
    if (folders.length === 0) {
        list.innerHTML = '<div style="padding:12px; opacity:0.5;">No folders created</div>';
    } else {
        folders.forEach(folder => {
            const item = document.createElement('div');
            item.className = 'ghide-modal-item';
            // Simple Indentation visual
            const prefix = folder.parentId ? '↳ ' : ''; 
            item.textContent = prefix + folder.name;
            
            item.onclick = async () => {
                await moveChatToFolder(chatId, title, folder.id);
                overlay.remove();
            };
            list.appendChild(item);
        });
    }

    modal.querySelector('.ghide-modal-close').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}
