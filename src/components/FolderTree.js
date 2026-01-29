import { loadData, subscribeToDataChanges, removeChatFromFolder, moveChatToFolder, createFolder, deleteFolder, updateFolder } from '../utils/storage.js';

// --- Icons (SVG) ---
const ICONS = {
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>`,
  chat: `<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M240-400h320v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z"/></svg>`,
  more: `<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"/></svg>`,
  add: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg>`
};

/**
 * Main entry point: Mounts the folder tree into the container.
 * @param {HTMLElement} container 
 */
export async function mountFolderTree(container) {
  // Clear loading state
  container.innerHTML = '';
  
  // Add A11y role
  container.setAttribute('role', 'tree');
  
  const state = await loadData();
  renderTree(container, state);

  // Setup a listener for storage changes (for multi-tab sync)
  subscribeToDataChanges((newValue) => {
    if (newValue) renderTree(container, newValue);
  });
}

/**
 * Renders the full tree from state
 */
function renderTree(container, state) {
  container.innerHTML = ''; 
  
  const rootFolders = getSortedChildren(state.folders, null);
  
  if (rootFolders.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ghide-empty-state';
    empty.textContent = 'Drag chats here to organize';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'ghide-tree-list';
  list.setAttribute('role', 'group');
  
  rootFolders.forEach(folder => {
    list.appendChild(createFolderNode(folder, state));
  });

  container.appendChild(list);
}

/**
 * Creates a DOM node for a folder (and its children recursively)
 */
function createFolderNode(folder, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ghide-folder-wrapper';
  wrapper.setAttribute('role', 'treeitem');
  wrapper.setAttribute('aria-expanded', !folder.isCollapsed);

  // 1. Folder Row (Header)
  const row = document.createElement('div');
  row.className = 'ghide-folder-row';
  row.dataset.folderId = folder.id;
  row.tabIndex = 0; // Keyboard focusable
  
  // Icon (Chevron)
  const toggleBtn = document.createElement('span');
  toggleBtn.className = 'ghide-icon-btn';
  toggleBtn.innerHTML = folder.isCollapsed ? ICONS.chevronRight : ICONS.chevronDown;
  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    handleToggleFolder(folder);
  };

  // Folder Icon + Name
  const label = document.createElement('span');
  label.className = 'ghide-folder-label';
  // Use textContent for user input to prevent XSS
  label.innerHTML = ICONS.folder + ' ';
  const textSpan = document.createElement('span');
  textSpan.className = 'ghide-text';
  textSpan.textContent = folder.name;
  label.appendChild(textSpan);
  
  // Actions Button (Options)
  const actionsBtn = document.createElement('button');
  actionsBtn.className = 'ghide-folder-actions-btn';
  actionsBtn.innerHTML = ICONS.more;
  actionsBtn.title = "Folder Options";
  actionsBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFolderContextMenu(e, folder);
  };

  row.appendChild(toggleBtn);
  row.appendChild(label);
  row.appendChild(actionsBtn);
  wrapper.appendChild(row);

  // --- Interaction Handlers ---
  
  // Keyboard: Enter/Space to toggle
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggleFolder(folder);
    }
  });

  // Drag & Drop (Drop Zone)
  row.addEventListener('dragover', (e) => {
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = 'move';
    row.classList.add('ghide-drag-over');
  });

  row.addEventListener('dragleave', (e) => {
    row.classList.remove('ghide-drag-over');
  });

  row.addEventListener('drop', async (e) => {
    e.preventDefault();
    row.classList.remove('ghide-drag-over');
    
    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data && data.type === 'chat') {
            await moveChatToFolder(data.chatId, data.title, folder.id);
        }
    } catch (err) {
        console.error('GHide: Drop error', err);
    }
  });

  // 2. Children Container (if not collapsed)
  if (!folder.isCollapsed) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'ghide-children';
    childrenContainer.setAttribute('role', 'group');

    // A. Sub-folders
    const subFolders = getSortedChildren(state.folders, folder.id);
    subFolders.forEach(sub => {
      childrenContainer.appendChild(createFolderNode(sub, state));
    });

    // B. Chats in this folder
    const chats = getChatsInFolder(state.chats, folder.id);
    chats.forEach(chat => {
      childrenContainer.appendChild(createChatNode(chat));
    });

    // Indentation/Empty state for folder
    if (subFolders.length === 0 && chats.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'ghide-empty-folder';
        emptyMsg.textContent = 'Empty';
        childrenContainer.appendChild(emptyMsg);
    }

    wrapper.appendChild(childrenContainer);
  }

  return wrapper;
}

/**
 * Creates a DOM node for a chat item
 */
function createChatNode(chat) {
  const rowWrapper = document.createElement('div');
  rowWrapper.className = 'ghide-chat-row-wrapper';

  const row = document.createElement('a');
  row.className = 'ghide-chat-row';
  row.href = `/app/${chat.geminiId}`; // Gemini link format
  row.dataset.chatId = chat.geminiId;
  row.setAttribute('role', 'treeitem');
  
  // Highlight if active
  if (window.location.href.includes(chat.geminiId)) {
    row.classList.add('active');
  }

  // Safe DOM construction
  const iconSpan = document.createElement('span');
  iconSpan.className = 'ghide-chat-icon';
  iconSpan.innerHTML = ICONS.chat;
  
  const textSpan = document.createElement('span');
  textSpan.className = 'ghide-text';
  textSpan.textContent = chat.title;

  row.appendChild(iconSpan);
  row.appendChild(document.createTextNode(' '));
  row.appendChild(textSpan);
  
  // --- Drag Source (Re-ordering/Moving) ---
  row.draggable = true;
  row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'chat',
          chatId: chat.geminiId,
          title: chat.title,
          origin: 'folder'
      }));
  });

  // --- Actions Button (Context Menu) ---
  const actionsBtn = document.createElement('button');
  actionsBtn.className = 'ghide-actions-btn';
  actionsBtn.innerHTML = ICONS.more;
  actionsBtn.title = "Options";
  actionsBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openChatContextMenu(e, chat);
  };

  rowWrapper.appendChild(row);
  rowWrapper.appendChild(actionsBtn);
  
  return rowWrapper;
}

// --- Context Menus ---

function openChatContextMenu(event, chat) {
    removeExistingMenus();
    const menu = createMenuBase(event);
    
    // Remove from Folder
    const removeOption = createMenuItem('Remove from folder', async () => {
        await removeChatFromFolder(chat.geminiId);
        menu.remove();
    });

    menu.appendChild(removeOption);
    document.body.appendChild(menu);
    positionMenu(menu, event);
}

function openFolderContextMenu(event, folder) {
    removeExistingMenus();
    const menu = createMenuBase(event);

    // Rename
    menu.appendChild(createMenuItem('Rename', () => {
        menu.remove();
        promptRenameFolder(folder);
    }));

    // New Subfolder
    menu.appendChild(createMenuItem('New Subfolder', () => {
        menu.remove();
        promptNewFolder(folder.id);
    }));

    // Delete
    const deleteOption = createMenuItem('Delete Folder', async () => {
        if(confirm(`Delete "${folder.name}"? Chats will be moved to Recent.`)) {
            await deleteFolder(folder.id);
        }
        menu.remove();
    });
    deleteOption.classList.add('danger');
    menu.appendChild(deleteOption);

    document.body.appendChild(menu);
    positionMenu(menu, event);
}

// --- Menu Helpers ---

function removeExistingMenus() {
    const existing = document.querySelector('.ghide-context-menu');
    if (existing) existing.remove();
}

function createMenuBase(event) {
    const menu = document.createElement('div');
    menu.className = 'ghide-context-menu';
    
    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 10);
    return menu;
}

function createMenuItem(text, onClick) {
    const item = document.createElement('div');
    item.className = 'ghide-menu-item';
    item.textContent = text;
    item.onclick = onClick;
    return item;
}

function positionMenu(menu, event) {
    const rect = event.target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    
    // Safety check for screen bounds
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
    }
}

// --- Dialogs ---

export function promptNewFolder(parentId = null) {
    showInputModal("New Folder Name", "Create", async (name) => {
        if (name) await createFolder(name, parentId);
    });
}

function promptRenameFolder(folder) {
    showInputModal("Rename Folder", "Save", async (name) => {
        if (name) await updateFolder(folder.id, { name });
    }, folder.name);
}

function showInputModal(title, actionBtnText, onConfirm, defaultValue = '') {
    const overlay = document.createElement('div');
    overlay.className = 'ghide-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'ghide-modal';
    
    // Header
    const header = document.createElement('div');
    header.className = 'ghide-modal-header';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    const closeIcon = document.createElement('span');
    closeIcon.className = 'ghide-modal-close';
    closeIcon.textContent = '✕';
    header.appendChild(titleSpan);
    header.appendChild(closeIcon);

    // Body
    const body = document.createElement('div');
    body.className = 'ghide-modal-body';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ghide-input';
    input.value = defaultValue;
    input.placeholder = 'Folder Name';
    // input.autofocus = true; // Handled by setTimeout below

    const btn = document.createElement('button');
    btn.className = 'ghide-btn-primary';
    btn.textContent = actionBtnText;

    body.appendChild(input);
    body.appendChild(btn);

    modal.appendChild(header);
    modal.appendChild(body);
    
    const closeBtn = closeIcon;
    const actionBtn = btn;
    
    const close = () => overlay.remove();
    const submit = () => {
        const val = input.value.trim();
        if (val) {
            onConfirm(val);
            close();
        }
    };

    closeBtn.onclick = close;
    overlay.onclick = (e) => { if(e.target === overlay) close(); };
    actionBtn.onclick = submit;
    input.onkeydown = (e) => { if(e.key === 'Enter') submit(); };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    // Focus hack
    setTimeout(() => input.focus(), 50);
}


// --- Helpers ---

function getSortedChildren(foldersMap, parentId) {
  return Object.values(foldersMap)
    .filter(f => f.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

function getChatsInFolder(chatsMap, folderId) {
  return Object.values(chatsMap)
    .filter(c => c.folderId === folderId);
}

async function handleToggleFolder(folder) {
  await updateFolder(folder.id, { isCollapsed: !folder.isCollapsed });
}
