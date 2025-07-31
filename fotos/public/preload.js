const { contextBridge, ipcRenderer, shell: ex } = require("electron");

const imageStreamListeners = new Set();

const imageStreamHandler = (event, data) => {
  console.log("Received image-stream event:", JSON.stringify(data));
  imageStreamListeners.forEach((listener) => {
    try {
      listener(data);
    } catch (error) {
      console.error("Error in image-stream listener:", error.message);
    }
  });
};

ipcRenderer.on("image-stream", imageStreamHandler);

contextBridge.exposeInMainWorld("electronAPI", {
  login: (email, password) =>
    ipcRenderer.invoke("auth:login", { email, password }),
  register: (userData) => ipcRenderer.invoke("auth:register", userData),
  sendEmailOtp: (email) => ipcRenderer.invoke("auth:send-email-otp", { email }),
  verifyEmailOtp: (email, otp) => ipcRenderer.invoke("auth:verify-email-otp", { email, otp }),
  forgotPassword: (email, otp, newPassword) =>
    ipcRenderer.invoke("auth:forgotPassword", { email, otp, newPassword }),
  saveUser: async (user) => {
    return await ipcRenderer.invoke("save-user", user);
  },
  loadUser: async () => {
    return await ipcRenderer.invoke("load-user");
  },
  deleteUser: () => ipcRenderer.invoke("delete-user"),

  openExternal: (url) => ipcRenderer.send("open-external", url),

  getAlbums: async (forceCloudSync = false) => {
    return await ipcRenderer.invoke("albums:get", forceCloudSync);
  },
  createAlbum: (payload) => ipcRenderer.invoke("albums:create", payload),
  updateAlbum: (payload) => ipcRenderer.invoke("albums:update", payload),
  deleteAlbum: (id) => ipcRenderer.invoke("albums:delete", id),
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),

  fetchPhotos: (albumName,cloudSyncPhotos) => ipcRenderer.invoke("fetch-photos", albumName,cloudSyncPhotos),
  deletePhoto: (params) => ipcRenderer.invoke("delete-photo", params),
  bulkDeletePhotos: (params) =>
    ipcRenderer.invoke("bulk-delete-photos", params),

  syncPhotosToCloud: (params) =>
    ipcRenderer.invoke("sync-photos-to-cloud", params),
  syncAlbums: () => ipcRenderer.invoke("sync:albums"),
  checkAndSyncAlbums: () => ipcRenderer.invoke("check-and-sync-albums"),
  updateCloudSync: (args) => ipcRenderer.invoke("update-cloud-sync", args),

  startFtp: (config) => ipcRenderer.invoke("start-ftp", config),
  getFtpCredentials: () => ipcRenderer.invoke("get-ftp-credentials"),
  resetFtpCredentials: () => ipcRenderer.invoke("reset-ftp-credentials"),
  testFtpCredentials: (credentials) =>
    ipcRenderer.invoke("test-ftp-credentials", credentials),
  regenerateFtpPassword: (username) =>
    ipcRenderer.invoke("regenerate-ftp-password", username),
  closeFtp: () => ipcRenderer.invoke("close-ftp"),
  checkFtpStatus: () => ipcRenderer.invoke("check-ftp-status"),
  onImageStream: (callback) => {
    console.log(
      "Registering image-stream listener, total:",
      imageStreamListeners.size + 1
    );
    imageStreamListeners.add(callback);
    return () => {
      imageStreamListeners.delete(callback);
      console.log(
        "Removed image-stream listener, total:",
        imageStreamListeners.size
      );
    };
  },
  removeImageStreamListener: (callback) => {
    imageStreamListeners.delete(callback);
    console.log(
      "Removed image-stream listener via removeImageStreamListener, total:",
      imageStreamListeners.size
    );
  },
  onClearFtpCredentials: (callback) =>
    ipcRenderer.on("clear-ftp-credentials", (event, data) => callback(data)),
  removeClearFtpCredentialsListener: (callback) =>
    ipcRenderer.removeListener("clear-ftp-credentials", callback),
});
