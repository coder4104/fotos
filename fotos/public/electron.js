const { app, BrowserWindow, ipcMain, dialog, Menu, net } = require("electron");
const path = require("path");
const os = require("os");
const FtpSrv = require("ftp-srv");
const chokidar = require("chokidar");
const { exec } = require("child_process");
const debounce = require("lodash.debounce");
const logger = require("./logger");
const fs = require("fs").promises;
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const {
  createAlbum,
  getAlbums,
  updateAlbum,
  deleteAlbum,
  syncAlbums,
  appendToSyncQueue,
  userData,
} = require("./albums");
const {
  loadPhotosData,
  savePhotosData,
  fetchPhotos,
  deletePhoto,
  bulkDeletePhotos,
  uploadImage,
  syncPhotosToCloud,
  isImageFile,
  appendToSyncQueue: appendPhotoToSyncQueue,
} = require("./photos");
const {
  FTP_PORT,
  FTP_PASV_RANGE,
  DEFAULT_FTP_PASSWORD,
  PASSWORD_FILE_PATH,
  DATA_DIR,
  USER_FILE_PATH,
  ALBUM_FILE_PATH,
  ensureAppFileStructure,
  SERVER_URL,
} = require("./constants");
require("dotenv").config();

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", {
    reason: reason.message || reason,
    promise,
  });
});

async function isOnline() {
  return require("electron").net.isOnline();
}

let mainWindow;
let ftpServer;
let authWindow = null;
const userCredentials = new Map();
const directories = new Map();
const albumIds = new Map();
const albumNames = new Map();
const processedFiles = new Set();
const watchers = new Map();
const userCloudSync = new Map();

let ftpPassword = DEFAULT_FTP_PASSWORD;

const axiosInstance = axios.create({
  baseURL: SERVER_URL,
});

axiosInstance.interceptors.request.use(async (config) => {
  const user = await userData();
  console.log(user);
  if (user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

async function loadFtpPassword() {
  try {
    const data = await fs.readFile(PASSWORD_FILE_PATH, "utf8");
    const parsed = JSON.parse(data);
    if (parsed.password && /^[a-z0-9]{5}$/.test(parsed.password)) {
      ftpPassword = parsed.password;
      logger.info("Loaded FTP password from file", { password: ftpPassword });
    } else {
      logger.warn("Invalid password in file, using default");
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.info("Password file not found, initializing with default");
      await saveFtpPassword(DEFAULT_FTP_PASSWORD);
    } else {
      logger.error("Failed to load FTP password", { error: error.message });
    }
  }
}

async function saveFtpPassword(password) {
  try {
    await fs.writeFile(PASSWORD_FILE_PATH, JSON.stringify({ password }));
    logger.info("Saved FTP password to file", { password });
  } catch (error) {
    logger.error("Failed to save FTP password", { error: error.message });
  }
}

async function saveUserData(user) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USER_FILE_PATH, JSON.stringify(user, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    logger.error("Error saving user:", { error: error.message });
    return { success: false, error: error.message };
  }
}

const isPortInUse = (port) => {
  return new Promise((resolve) => {
    const server = require("net").createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
};

const findAvailablePort = async (startPort) => {
  let port = startPort;
  const maxAttempts = 100;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
    port++;
    attempts++;
  }

  throw new Error(`No available ports found after ${maxAttempts} attempts`);
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  const startUrl = path.join(__dirname, "../dist/index.html");
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.openDevTools({ mode: "detach" });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  logger.info("Main window created", { startUrl });
};

const generatePassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 5; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

async function startFtpServer(
  username,
  directory,
  albumId,
  albumName,
  token,
  port = FTP_PORT,
  cloudSyncEnabled
) {
  const normalizedUsername = username.replace(/\s+/g, "");
  if (!normalizedUsername || !directory || !albumId || !albumName || !token) {
    logger.error("Missing parameters for FTP server", {
      username: normalizedUsername,
      directory,
      albumId,
      albumName,
    });
    return {
      error:
        "Username, directory, album ID, album name, and token are required",
    };
  }

  logger.info("Starting FTP server with parameters", {
    username: normalizedUsername,
    directory,
    albumId,
    albumName,
  });

  const absoluteDir = path.resolve(directory);
  try {
    const stats = await fs.stat(absoluteDir);
    if (!stats.isDirectory()) {
      logger.error("Selected path is not a directory", { directory });
      return { error: "Selected path is not a directory" };
    }
  } catch (error) {
    logger.error("Directory inaccessible", { directory, error: error.message });
    return { error: "Directory does not exist or is inaccessible" };
  }

  const password = ftpPassword;
  userCredentials.set(normalizedUsername, { password });
  directories.set(normalizedUsername, absoluteDir);
  albumIds.set(normalizedUsername, albumId);
  albumNames.set(normalizedUsername, albumName);
  userCloudSync.set(normalizedUsername, cloudSyncEnabled);

  logger.info("Stored credentials", {
    username: normalizedUsername,
    password,
    albumName,
    source: "User-selected album",
  });

  const interfaces = os.networkInterfaces();
  const address =
    Object.values(interfaces)
      .flat()
      .filter((iface) => iface.family === "IPv4" && !iface.internal)
      .map((iface) => iface.address)[0] || "localhost";
  const host = address;

  let ftpPort = port;

  try {
    ftpPort = await findAvailablePort(port);
    logger.info(`Selected FTP port: ${ftpPort}`);
  } catch (error) {
    logger.error("Failed to find available port for FTP", {
      error: error.message,
    });
    return { error: "Failed to find available port for FTP server" };
  }

  if (ftpServer && !ftpServer.closed) {
    const existingCreds = userCredentials.get(normalizedUsername);
    if (
      existingCreds &&
      directories.get(normalizedUsername) === absoluteDir &&
      albumIds.get(normalizedUsername) === albumId &&
      albumNames.get(normalizedUsername) === albumName
    ) {
      logger.info("FTP server already running with matching credentials", {
        username: normalizedUsername,
        host,
        ftpPort,
      });
      const credentialsToSave = {
        host,
        username: normalizedUsername,
        password,
        port: ftpPort,
        mode: "Passive",
      };
      await mainWindow.webContents.executeJavaScript(
        `localStorage.setItem("ftpCredentials", ${JSON.stringify(
          JSON.stringify(credentialsToSave)
        )})`
      );
      return credentialsToSave;
    }
  }

  if (ftpServer) {
    await ftpServer.close();
    ftpServer = null;
    watchers.forEach((watcher) => watcher.close());
    watchers.clear();
    logger.info("Closed existing FTP server to start new one");
  }

  ftpServer = new FtpSrv({
    url: `ftp://0.0.0.0:${ftpPort}`,
    anonymous: false,
    pasv_range: FTP_PASV_RANGE,
    pasv_url: host,
    greeting: ["Welcome to FTP server"],
  });

  ftpServer.on(
    "login",
    ({ connection, username, password }, resolve, reject) => {
      logger.info("FTP login attempt", { username });
      const normalizedLoginUsername = username.replace(/\s+/g, "");
      const user = userCredentials.get(normalizedLoginUsername);
      if (user && user.password === password) {
        resolve({ root: directories.get(normalizedLoginUsername) });
        logger.info("FTP login successful", {
          username: normalizedLoginUsername,
          root: directories.get(normalizedLoginUsername),
        });
      } else {
        logger.error("FTP login failed: Invalid credentials", {
          username: normalizedLoginUsername,
          expected: user?.password,
          received: password,
        });
        reject(new Error("Invalid credentials"));
      }
    }
  );

  ftpServer.on("stor", ({ connection, filename }, resolve) => {
    logger.info("FTP file upload started", {
      filename,
      username: connection.username,
      directory: directories.get(connection.username),
    });
    resolve();
  });

  ftpServer.on("stor-complete", ({ connection, filename }) => {
    logger.info("FTP file upload completed", {
      filename,
      username: connection.username,
      directory: directories.get(connection.username),
    });
  });

  try {
    await ftpServer.listen();
    logger.info(`FTP Server running on ftp://${host}:${ftpPort}`);

    const watcher = chokidar.watch(absoluteDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 200,
      },
    });

    watchers.set(normalizedUsername, watcher);

    const handleFileAdd = debounce(async (filePath, albumName, albumId) => {
      const fileName = path.basename(filePath);
      const cloudSyncEnabled = userCloudSync.get(normalizedUsername);
      console.log(cloudSyncEnabled);
      logger.info("Chokidar detected new file", {
        filePath,
        fileName,
        albumName,
        directory: absoluteDir,
      });

      if (processedFiles.has(filePath)) {
        logger.info("File already processed", { filePath });
        return;
      }

      processedFiles.add(filePath);
      setTimeout(() => processedFiles.delete(filePath), 60000);

      mainWindow.webContents.send("image-stream", {
        action: "pending",
        filePath,
      });
      logger.info("Notified frontend of pending file", { filePath });

      const isImage = await isImageFile(filePath);
      if (!isImage) {
        logger.error("File is not a recognized image", { filePath });
        mainWindow.webContents.send("image-stream", {
          action: "error",
          error: `Not an image: ${fileName}`,
        });
        return;
      }

      try {
        await fs.access(filePath);
      } catch (err) {
        logger.info("File no longer exists, skipping", { filePath });
        return;
      }

      const fileUrl = `file://${filePath.replace(/\\/g, "/")}`;
      console.log(fileUrl);
      const photoId = uuidv4();
      const createdAt = new Date().toISOString();
      logger.info("Processing photo for storage", {
        fileName,
        albumName,
        photoId,
        fileUrl,
      });

      try {
        mainWindow.webContents.send("image-stream", {
          action: "add",
          imageUrl: fileUrl,
          filePath,
          albumName,
        });

        const photosData = await loadPhotosData();
        const user = await userData();
        const raw = await fs.readFile(ALBUM_FILE_PATH, "utf-8");
        const albums = raw.trim() ? JSON.parse(raw) : [];

        const album = albums.find((album) => album.name === albumName);
        console.log(album);
        const albumId = album ? album.id : null;
        const newPhoto = {
          id: photoId,
          albumId,
          albumName,
          userId: user.id,
          imageUrl: fileUrl,
          createdAt,
          directory,
        };
        console.log(newPhoto);
        photosData.push(newPhoto);
        await savePhotosData(photosData);
        logger.info("Photo inserted into JSON storage", {
          photoId,
          albumName,
          albumId,
          fileUrl,
          source: "User-selected album",
          photosCount: photosData.length,
          directory,
        });

        if (cloudSyncEnabled) {
          if (await isOnline()) {
            await syncPhotosToCloud({ albumName, albumId, photoId });
          } else {
            await appendToSyncQueue({
              action: "sync_photo",
              photoId,
              albumId,
              albumName,
              filePath,
              userId: user.id,
              createdAt,
            });
            logger.info("Photo added to sync queue due to offline status", {
              photoId,
              albumName,
            });
          }
        }
      } catch (error) {
        logger.error("Storage insertion error", {
          filePath,
          error: error.message,
          stack: error.stack,
        });
        mainWindow.webContents.send("image-stream", {
          action: "error",
          error: `Failed to store photo: ${fileName}`,
        });
        return;
      }

      logger.info("Sent image-stream to frontend", { fileUrl, albumName });
    }, 1000);

    watcher.on("add", (filePath) =>
      handleFileAdd(filePath, albumName, albumId)
    );

    watcher.on("error", (error) => {
      logger.error("Chokidar error", {
        error: error.message,
        directory: absoluteDir,
      });
    });

    logger.info("Returning FTP connection details", {
      host,
      username,
      password,
      ftpPort,
    });
    const credentialsToSave = {
      host,
      username: normalizedUsername,
      password,
      port: ftpPort,
      mode: "Passive",
    };
    await mainWindow.webContents.executeJavaScript(
      `localStorage.setItem("ftpCredentials", ${JSON.stringify(
        JSON.stringify(credentialsToSave)
      )})`
    );
    return credentialsToSave;
  } catch (error) {
    logger.error("FTP Server failed to start", { error: error.message });
    if (ftpServer) {
      ftpServer.close();
      ftpServer = null;
    }
    return { error: "Failed to start FTP server: " + error.message };
  }
}

ipcMain.handle("fetch-photos", async (event, albumName, cloudSync) => {
  return await fetchPhotos(albumName, cloudSync);
});

ipcMain.handle("delete-photo", async (event, args) => {
  return await deletePhoto(args, processedFiles, mainWindow);
});

ipcMain.handle("bulk-delete-photos", async (event, args) => {
  return await bulkDeletePhotos(args, processedFiles, mainWindow);
});

ipcMain.handle("get-ftp-credentials", async () => {
  const credentials = Array.from(userCredentials.entries())
    .map(([username, { password }]) => {
      const normalizedUsername = username.replace(/\s+/g, "");
      const directory = directories.get(normalizedUsername);
      const albumId = albumIds.get(normalizedUsername);
      const albumName = albumNames.get(normalizedUsername);
      const interfaces = os.networkInterfaces();
      const address = Object.values(interfaces)
        .flat()
        .filter((iface) => iface.family === "IPv4" && !iface.internal)
        .map((iface) => iface.address);
      const host = address[0] || "localhost";
      const port = FTP_PORT;
      if (!ftpServer || ftpServer.closed) {
        return {};
      }
      return {
        username: normalizedUsername,
        password,
        directory,
        albumId,
        albumName,
        host,
        port,
        mode: "Passive",
      };
    })
    .filter((cred) => Object.keys(cred).length > 0);

  logger.info("Returning stored credentials", { credentials });
  return credentials;
});

ipcMain.handle("check-ftp-status", async () => {
  if (ftpServer && !ftpServer.closed) {
    const credentials = Array.from(userCredentials.entries()).map(
      ([username, { password }]) => {
        const normalizedUsername = username.replace(/\s+/g, "");
        const directory = directories.get(normalizedUsername);
        const albumId = albumIds.get(normalizedUsername);
        const albumName = albumNames.get(normalizedUsername);
        const interfaces = os.networkInterfaces();
        const address = Object.values(interfaces)
          .flat()
          .filter((iface) => iface.family === "IPv4" && !iface.internal)
          .map((iface) => iface.address);
        const host = address[0] || "localhost";
        const port = FTP_PORT;
        return {
          username: normalizedUsername,
          password,
          directory,
          albumId,
          albumName,
          host,
          port,
          mode: "Passive",
        };
      }
    );
    return { isRunning: true, credentials };
  } else {
    logger.info("FTP server is not running");
    return { isRunning: false, credentials: [] };
  }
});

ipcMain.handle("save-user", async (_event, user) => {
  return await saveUserData(user);
});

ipcMain.handle("delete-user", async () => {
  try {
    await fs.rm(USER_FILE_PATH, { force: true });
    return { success: true };
  } catch (err) {
    logger.error("Error deleting user file:", { error: err.message });
    return { success: false, error: err.message };
  }
});

ipcMain.handle("load-user", async () => {
  try {
    const data = await fs.readFile(USER_FILE_PATH, "utf-8");
    const user = JSON.parse(data);
    return { success: true, user };
  } catch (error) {
    logger.error("Failed to load user:", { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle("albums:create", async (event, album) => {
  return await createAlbum(album);
});

ipcMain.handle("albums:get", async (_event, forceCloudSync = false) => {
  return await getAlbums(forceCloudSync);
});

ipcMain.handle("albums:update", async (_, args) => {
  return await updateAlbum(args);
});

ipcMain.handle("albums:delete", async (_, id) => {
  return await deleteAlbum(id);
});

ipcMain.handle("sync:albums", async () => {
  return await syncAlbums();
});

ipcMain.handle("check-and-sync-albums", async () => {
  if (await net.isOnline()) {
    return await syncAlbums();
  }
  return { success: false, message: "Offline, sync queued" };
});

ipcMain.handle("dialog:selectFolder", async () => {
  logger.info("Opening folder selection dialog");
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (result.canceled) {
    logger.info("Folder selection canceled");
    return null;
  }

  logger.info("Folder selected", { path: result.filePaths[0] });
  return result.filePaths[0];
});

ipcMain.handle(
  "start-ftp",
  async (
    event,
    { username, directory, albumId, albumName, token, cloudSyncEnabled }
  ) => {
    logger.info("Starting FTP server", {
      username,
      directory,
      albumId,
      albumName,
    });
    return await startFtpServer(
      username,
      directory,
      albumId,
      albumName,
      token,
      FTP_PORT,
      cloudSyncEnabled
    );
  }
);

ipcMain.handle("reset-ftp-credentials", async () => {
  userCredentials.clear();
  directories.clear();
  albumIds.clear();
  albumNames.clear();
  processedFiles.clear();
  watchers.forEach((watcher) => watcher.close());
  watchers.clear();
  if (ftpServer) {
    await ftpServer.close();
    ftpServer = null;
  }
  logger.info("Credentials and servers reset");
  return { message: "Credentials reset successfully" };
});

ipcMain.handle("close-ftp", async () => {
  logger.info("Closing FTP server");
  if (ftpServer) {
    try {
      await ftpServer.close();
      ftpServer = null;
      watchers.forEach((watcher) => watcher.close());
      watchers.clear();
      logger.info("FTP server closed successfully");
      return { message: "FTP server closed successfully" };
    } catch (error) {
      logger.error("Failed to close FTP server", { error: error.message });
      throw new Error("Failed to close FTP server: " + error.message);
    }
  } else {
    logger.info("No FTP server running");
    return { message: "No FTP server running" };
  }
});

ipcMain.handle("regenerate-ftp-password", async (event, username) => {
  logger.info("Regenerating FTP password", { username });
  const normalizedUsername = username.replace(/\s+/g, "");
  const newPassword = generatePassword();
  ftpPassword = newPassword;
  await saveFtpPassword(newPassword);
  userCredentials.set(normalizedUsername, { password: newPassword });
  logger.info("New password generated and saved", {
    username: normalizedUsername,
    password: newPassword,
  });

  const savedCredentials = await mainWindow.webContents.executeJavaScript(
    'localStorage.getItem("ftpCredentials")'
  );
  if (savedCredentials) {
    const creds = JSON.parse(savedCredentials);
    if (creds.username === normalizedUsername) {
      creds.password = newPassword;
      await mainWindow.webContents.executeJavaScript(
        `localStorage.setItem("ftpCredentials", ${JSON.stringify(
          JSON.stringify(creds)
        )})`
      );
    }
  }

  return { password: newPassword };
});

ipcMain.handle(
  "test-ftp-credentials",
  async (event, { username, password }) => {
    logger.info("Testing credentials", { username });
    const normalizedUsername = username.replace(/\s+/g, "");
    const user = userCredentials.get(normalizedUsername);
    if (user && user.password === password) {
      logger.info("Test credentials successful", {
        username: normalizedUsername,
      });
      return { valid: true };
    } else {
      logger.error("Test credentials failed", {
        username: normalizedUsername,
        expected: user?.password,
      });
      return { valid: false, expected: user?.password };
    }
  }
);

ipcMain.handle("upload-image", async (event, args) => {
  return await uploadImage(args, mainWindow);
});

ipcMain.handle("sync-photos-to-cloud", async (event, args) => {
  return await syncPhotosToCloud(args, mainWindow);
});

ipcMain.handle(
  "update-cloud-sync",
  async (event, { username, cloudSyncEnabled }) => {
    logger.info("Updating cloud sync state", { username, cloudSyncEnabled });
    const normalizedUsername = username.replace(/\s+/g, "");
    userCloudSync.set(normalizedUsername, cloudSyncEnabled);

    if (cloudSyncEnabled) {
      logger.info("Triggering album sync due to cloud sync enabled", {
        username,
      });
      await syncAlbums();
    }

    return {
      success: true,
      message: `Cloud sync ${cloudSyncEnabled ? "enabled" : "disabled"}`,
    };
  }
);

ipcMain.handle("auth:login", async (event, { email, password }) => {
  await ensureAppFileStructure();
  try {
    const response = await axiosInstance.post("/api/auth/login", {
      email: email.trim(),
      password: password.trim(),
    });
    const userData = {
      id: response.data.user.id,
      name: response.data.user.name,
      email: response.data.user.email,
      phone: response.data.user.phone,
      emailVerified: !!response.data.user.emailVerified,
      token: response.data.token,
      trialStart: response.data.user.trialStart,
      subscriptionEnd: response.data.user.subscriptionEnd,
    };
    const saveResult = await saveUserData(userData);
    if (!saveResult.success) {
      throw new Error("Failed to save user data locally");
    }
    return { success: true, user: userData, token: response.data.token };
  } catch (error) {
    logger.error("Login error:", { error: error.message });
    return {
      success: false,
      error: error.response?.data?.error || "Invalid email or password",
      status: error.response?.status,
    };
  }
});

ipcMain.handle("auth:register", async (event, userData) => {
  await ensureAppFileStructure();
  try {
    if (net.isOnline()) {
      const response = await axiosInstance.post("/api/auth/register", {
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email: userData.email.trim(),
        password: userData.password.trim(),
        phone: userData.phone.trim(),
        emailVerified: userData.emailVerified,
      });

      const savedUser = {
        id: response.data.user.id,
        name: response.data.user.name,
        email: response.data.user.email,
        phone: response.data.user.phone,
        emailVerified: !!response.data.user.emailVerified,
        token: response.data.token,
        trialStart: response.data.user.trialStart,
        subscriptionEnd: response.data.user.subscriptionEnd,
      };

      const saveResult = await saveUserData(savedUser);
      if (!saveResult.success) {
        throw new Error("Failed to save user data locally");
      }

      return { success: true, user: savedUser, token: response.data.token };
    } else {
      const offlineUser = {
        id: Date.now().toString(),
        name: `${userData.firstName} ${userData.lastName}`,
        email: userData.email,
        phone: userData.phone,
        emailVerified: userData.emailVerified,
        token: "offline-token",
      };

      const saveResult = await saveUserData(offlineUser);
      if (!saveResult.success) {
        throw new Error("Failed to save user data locally");
      }

      await appendToSyncQueue({
        action: "register",
        userData: {
          firstName: userData.firstName.trim(),
          lastName: userData.lastName.trim(),
          email: userData.email.trim(),
          password: userData.password.trim(),
          phone: userData.phone.trim(),
          emailVerified: userData.emailVerified,
        },
      });

      return { success: true, user: offlineUser, token: "offline-token" };
    }
  } catch (error) {
    logger.error("Registration error:", { error: error.message });
    return {
      success: false,
      error:
        error.response?.data?.error || error.message || "Registration failed",
    };
  }
});

ipcMain.handle("auth:send-email-otp", async (event, { email }) => {
  await ensureAppFileStructure();
  try {
    const response = await axiosInstance.post("/api/auth/send-email-otp", {
      email: email.trim(),
    });
    logger.info("Send OTP response:", response.data);
    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    logger.error("Send OTP error:", { error: error.message });
    return {
      success: false,
      error: error.response?.data?.error || "Failed to send OTP",
    };
  }
});

ipcMain.handle("auth:verify-email-otp", async (event, { email, otp }) => {
  await ensureAppFileStructure();
  try {
    console.log("Verifying OTP for:", email);
    const response = await axiosInstance.post("/api/auth/verify-email-otp", {
      email: email.trim(),
      otp: otp.trim(),
    });
    logger.info("Verify OTP response:", response.data);
    return {
      success: true,
      message: response.data.message || "OTP verified successfully",
    };
  } catch (error) {
    logger.error("Verify OTP error:", {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    return {
      success: false,
      error: error.response?.data?.error || "OTP verification failed",
    };
  }
});

ipcMain.handle(
  "auth:forgotPassword",
  async (event, { email, otp, newPassword }) => {
    await ensureAppFileStructure();
    try {
      if (net.isOnline()) {
        const response = await axiosInstance.post("/api/auth/forgot-password", {
          email: email.trim(),
          otp: otp.trim(),
          newPassword: newPassword.trim(),
        });

        const userData = {
          id: response.data.user.id,
          name: response.data.user.name,
          email: response.data.user.email,
          phone: response.data.user.phone,
          emailVerified: !!response.data.user.emailVerified,
          token: response.data.token,
          trialStart: response.data.trialStart,
          subscriptionEnd: response.data.user.subscriptionEnd,
        };

        const saveResult = await saveUserData(userData);
        if (!saveResult.success) {
          throw new Error("Failed to save user data locally");
        }

        logger.info("Save result:", saveResult);
        return { success: true, user: userData, token: response.data.token };
      } else {
        await appendToSyncQueue({
          action: "forgot-password",
          email: email.trim(),
          otp: otp.trim(),
          newPassword: newPassword.trim(),
        });
        return { success: true, message: "Password reset queued for sync" };
      }
    } catch (error) {
      logger.error("Forgot password error:", { error: error.message });
      return {
        success: false,
        error: error.response?.data?.error || "Invalid OTP or reset failed",
      };
    }
  }
);

app.whenReady().then(async () => {
  try {
    await loadFtpPassword();
    await loadPhotosData();
    await ensureAppFileStructure();
    console.log(`${path.join(app.getPath("userData"), "data")}`);
    logger.info("Electron app starting");
    createWindow();
    Menu.setApplicationMenu(null);
  } catch (error) {
    logger.error("App initialization failed", { error: error.message });
  }
});

const notifyRendererToClearCredentials = () => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    win.webContents.send("clear-ftp-credentials", {
      message: "App is closing, clear FTP credentials and localStorage",
    });
    logger.info("Notified renderer to clear FTP credentials and localStorage");
  });
};

app.on("window-all-closed", async () => {
  logger.info("All windows closed");
  if (process.platform !== "darwin") {
    logger.info("Quitting app, closing FTP server");
    if (ftpServer) {
      try {
        await ftpServer.close();
        logger.info("FTP server closed successfully");
        ftpServer = null;
      } catch (error) {
        logger.error("Failed to close FTP server", { error: error.message });
      }
    }
    notifyRendererToClearCredentials();
    watchers.forEach((watcher) => watcher.close());
    watchers.clear();
    app.quit();
  }
});

app.on("before-quit", async () => {
  logger.info("App is quitting, ensuring FTP server is closed");
  if (ftpServer) {
    try {
      await ftpServer.close();
      logger.info("FTP server shut down before quit");
      ftpServer = null;
    } catch (error) {
      logger.error("Failed to close FTP server", { error: error.message });
    }
  }
  notifyRendererToClearCredentials();
  watchers.forEach((watcher) => watcher.close());
  watchers.clear();
});

ipcMain.on("open-external", (event, url) => {
  let cmd;
  switch (process.platform) {
    case "darwin":
      cmd = `open "${url}"`;
      break;
    case "win32":
      cmd = `start "" "${url}"`;
      break;
    default:
      cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (error) => {
    if (error) {
      logger.error("Failed to open URL:", { error: error.message });
    }
  });
});

ipcMain.on("exit-app", () => {
  logger.info("Received exit-app message from renderer, closing app");
  if (mainWindow) {
    mainWindow.close();
  }
});
