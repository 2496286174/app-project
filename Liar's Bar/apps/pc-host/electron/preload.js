// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 示例：发送消息到主进程
  sendMessage: (message) => ipcRenderer.send('message', message),
  // 示例：接收主进程消息
  onMessage: (callback) => ipcRenderer.on('message', (event, ...args) => callback(...args))
});
