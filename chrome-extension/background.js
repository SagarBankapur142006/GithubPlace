// Ideora Chrome Extension Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "valuate-ideora",
    title: "✨ Valuate on Ideora",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "valuate-ideora" && tab.id) {
    // Send selected text to content script in the active tab
    chrome.tabs.sendMessage(tab.id, {
      action: "startValuation",
      text: info.selectionText
    });
  }
});
