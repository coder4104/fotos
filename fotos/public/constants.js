const path = require("path");
const fs = require("fs").promises;
const { app } = require("electron");
const logger = console; 

const config = {
  SERVER_URL: "https://backend-google-three.vercel.app",
  FTP_PORT: 2121,
  FTP_PASV_RANGE: "8000-9000",
  DEFAULT_FTP_PASSWORD: "xy12z",
  DATA_DIR: path.join(app.getPath("userData"), "data"),
  PHOTOS_FILE_PATH: path.join(app.getPath("userData"), "data", "photos.json"),
  ALBUM_FILE_PATH: path.join(app.getPath("userData"), "data", "album.json"),
  SYNC_FILE_PATH: path.join(app.getPath("userData"), "data", "syncQueue.json"),
  IMAGE_DIR_PATH: path.join(app.getPath("userData"), "data", "images"),
  USER_FILE_PATH: path.join(app.getPath("userData"), "data", "user.json"),
  PASSWORD_FILE_PATH: path.join(app.getPath("userData"), "ftpPassword.json"),
  CLOUDINARY_CONFIG: {
    cloud_name: "dxfujspwu",
    api_key: "575875917966656",
    api_secret: "_MvreXnhQZ_1FyRyL75Fnuyt6u0",
  },
};

async function ensureFileExists(filePath, defaultContent = "{}") {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      logger.info(`Removing invalid file structure at ${filePath}`);
      await fs.rm(filePath, { force: true });
      await fs.writeFile(filePath, defaultContent, "utf-8");
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      logger.info(`Creating initial file at ${filePath}`);
      await fs.writeFile(filePath, defaultContent, "utf-8");
    } else {
      logger.error(`Error accessing file at ${filePath}:`, err);
      throw err;
    }
  }
}

async function ensureAppFileStructure() {
  try {
    await fs.mkdir(config.DATA_DIR, { recursive: true });
    await fs.mkdir(config.IMAGE_DIR_PATH, { recursive: true });

    await ensureFileExists(config.ALBUM_FILE_PATH, "[]");
    await ensureFileExists(config.PHOTOS_FILE_PATH, "[]");
    await ensureFileExists(config.SYNC_FILE_PATH, "[]");
    const red = await ensureFileExists(config.USER_FILE_PATH, "{}");
    console.log(red)

    logger.info("All file structures are ensured.");
  } catch (err) {
    logger.error("Failed to ensure app file structure:", err);
    throw err;
  }
}

module.exports = {
  ...config,
  ensureAppFileStructure,
};
