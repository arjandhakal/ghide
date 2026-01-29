import { getCurrentUserId } from './user.js';

// Simple UUID generator for the browser
function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// User-scoped key cache
let cachedStorageKey = null;

async function getStorageKey() {
  if (cachedStorageKey) return cachedStorageKey;
  
  const userId = await getCurrentUserId();
  // Sanitize userId just in case, though it should be an email or 'default'
  const safeId = userId.replace(/[^a-zA-Z0-9@._-]/g, '');
  cachedStorageKey = `ghide_data_${safeId}`;
  return cachedStorageKey;
}

const DEFAULT_STATE = {
  folders: {}, // { id: { id, name, parentId, isCollapsed, order } }
  chats: {}    // { geminiId: { geminiId, title, folderId } }
};

/**
 * Loads the entire GHide state from chrome.storage.local
 */
export async function loadData() {
  const key = await getStorageKey();
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      // Deep clone default state to avoid mutation of constant
      const data = result[key] || JSON.parse(JSON.stringify(DEFAULT_STATE));
      resolve(data);
    });
  });
}

/**
 * Saves the entire state to chrome.storage.local
 */
async function saveData(state) {
  const key = await getStorageKey();
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: state }, () => {
      resolve(true);
    });
  });
}

/**
 * Subscribes to changes in the current user's data
 */
export async function subscribeToDataChanges(callback) {
  const key = await getStorageKey();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[key]) {
      callback(changes[key].newValue);
    }
  });
}

// --- Folder Operations ---

export async function createFolder(name, parentId = null) {
  const state = await loadData();
  const newId = generateUUID();
  
  // Calculate new order index (append to end)
  const siblings = Object.values(state.folders).filter(f => f.parentId === parentId);
  const order = siblings.length;

  state.folders[newId] = {
    id: newId,
    name,
    parentId,
    isCollapsed: false,
    order
  };

  await saveData(state);
  return state.folders[newId];
}

export async function updateFolder(folderId, updates) {
  const state = await loadData();
  if (state.folders[folderId]) {
    state.folders[folderId] = { ...state.folders[folderId], ...updates };
    await saveData(state);
    return state.folders[folderId];
  }
  return null;
}

export async function deleteFolder(folderId) {
  const state = await loadData();
  
  // 1. Delete the folder itself
  if (state.folders[folderId]) {
    delete state.folders[folderId];
    
    // 2. Handle Orphaned Sub-folders: Move them to root (or delete them? Let's move to root for safety)
    Object.values(state.folders).forEach(f => {
      if (f.parentId === folderId) {
        f.parentId = null; 
      }
    });

    // 3. Handle Orphaned Chats: Unassign them (return to "Recent" list)
    Object.values(state.chats).forEach(c => {
      if (c.folderId === folderId) {
        delete state.chats[c.geminiId]; // Effectively removing from Gemfold management
      }
    });

    await saveData(state);
  }
}

// --- Chat Operations ---

export async function moveChatToFolder(geminiId, title, folderId) {
  const state = await loadData();
  state.chats[geminiId] = {
    geminiId,
    title,
    folderId
  };
  await saveData(state);
}

export async function updateChatTitle(geminiId, newTitle) {
  const state = await loadData();
  if (state.chats[geminiId]) {
    state.chats[geminiId].title = newTitle;
    await saveData(state);
  }
}

export async function removeChatFromFolder(geminiId) {
  const state = await loadData();
  if (state.chats[geminiId]) {
    delete state.chats[geminiId];
    await saveData(state);
  }
}

// --- Debugging ---

export async function seedDebugData() {
  const state = await loadData();
  
  // Only seed if empty
  if (Object.keys(state.folders).length === 0) {
    console.log("GHide: Seeding debug data...");
    
    // Create "Work" Folder
    const workId = generateUUID();
    state.folders[workId] = { id: workId, name: "Work Projects", parentId: null, isCollapsed: false, order: 0 };
    
    // Create "Personal" Folder
    const personalId = generateUUID();
    state.folders[personalId] = { id: personalId, name: "Personal", parentId: null, isCollapsed: false, order: 1 };

    // Create a subfolder in Work
    const archiveId = generateUUID();
    state.folders[archiveId] = { id: archiveId, name: "Archive", parentId: workId, isCollapsed: true, order: 0 };

    await saveData(state);
    console.log("GHide: Seed complete.");
  }
}
