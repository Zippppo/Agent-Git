const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentGitAttachments", {
  saveImage(input) {
    return ipcRenderer.invoke("attachments:save-image", input);
  },
  readImage(input) {
    return ipcRenderer.invoke("attachments:read-image", input);
  },
  openImage(input) {
    return ipcRenderer.invoke("attachments:open-image", input);
  }
});
