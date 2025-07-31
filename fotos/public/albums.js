const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;
const logger = require("./logger");
const {
  ALBUM_FILE_PATH,
  IMAGE_DIR_PATH,
  SYNC_FILE_PATH,
  USER_FILE_PATH,
  CLOUDINARY_CONFIG,
  SERVER_URL,
} = require("./constants");

const { loadPhotosData, savePhotosData } = require("./photos");

cloudinary.config(CLOUDINARY_CONFIG);

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

async function userData() {
  try {
    const data = await fs.readFile(USER_FILE_PATH, "utf-8");
    return JSON.parse(data) || {};
  } catch (error) {
    logger.error("Failed to load user data", { error: error.message });
    throw error;
  }
}

async function ensureAlbumFileStructure() {
  try {
    await fs.mkdir(path.dirname(ALBUM_FILE_PATH), { recursive: true });
    await fs.mkdir(IMAGE_DIR_PATH, { recursive: true });
    try {
      const stat = await fs.stat(ALBUM_FILE_PATH);
      if (!stat.isFile()) {
        logger.info(`Removing non-file at ${ALBUM_FILE_PATH} to create file`);
        await fs.rm(ALBUM_FILE_PATH, { recursive: true, force: true });
        await fs.writeFile(ALBUM_FILE_PATH, JSON.stringify([]), "utf-8");
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        logger.info("Creating initial album.json at:", ALBUM_FILE_PATH);
        await fs.writeFile(ALBUM_FILE_PATH, JSON.stringify([]), "utf-8");
      } else {
        logger.error("Error checking album.json:", err);
        throw err;
      }
    }
  } catch (err) {
    logger.error("Error ensuring album file structure:", err);
    throw err;
  }
}

async function appendToSyncQueue(entry) {
  try {
    let queue = [];
    try {
      const raw = await fs.readFile(SYNC_FILE_PATH, "utf-8");
      queue = raw.trim() ? JSON.parse(raw) : [];
    } catch (_) {}
    queue.push(entry);
    await fs.writeFile(SYNC_FILE_PATH, JSON.stringify(queue, null, 2), "utf-8");
  } catch (err) {
    logger.error("Failed to append to sync queue", { error: err.message });
    throw err;
  }
}

async function createAlbum(album) {
  const { name, date, image } = album;
  logger.info("Creating new album", { name, date });
  await ensureAlbumFileStructure();
  try {
    let albums = [];
    try {
      const raw = await fs.readFile(ALBUM_FILE_PATH, "utf-8");
      albums = raw.trim() ? JSON.parse(raw) : [];
    } catch (err) {
      if (err.code === "ENOENT") {
        await fs.writeFile(ALBUM_FILE_PATH, JSON.stringify([]), "utf-8");
      } else {
        throw err;
      }
    }
    const { nanoid } = await import("nanoid");

    const newId = nanoid();
    let imagePath = "";
    if (image?.base64 && image?.name) {
      const extension = path.extname(image.name);
      imagePath = path.join(IMAGE_DIR_PATH, `${newId}${extension}`);
      await fs.mkdir(IMAGE_DIR_PATH, { recursive: true });
      const base64Data = image.base64.replace(/^data:image\/\w+;base64,/, "");
      await fs.writeFile(imagePath, base64Data, "base64");
    }

    const user = await userData();
    const newAlbum = { id: newId, userId: user.id, name, date, imagePath };
    albums.push(newAlbum);

    await fs.writeFile(
      ALBUM_FILE_PATH,
      JSON.stringify(albums, null, 2),
      "utf-8"
    );
    await appendToSyncQueue({
      action: "create",
      album: newAlbum,
      imageBase64: image?.base64 || null,
    });

    return newAlbum;
  } catch (error) {
    logger.error("Failed to create album", { error: error.message });
    return { success: false, error: error.message };
  }
}

async function getAlbums(forceCloudSync = false) {
  await ensureAlbumFileStructure();
  try {
    if (forceCloudSync && (await isOnline())) {
      logger.info("Fetching albums from cloud...");
      const cloudResponse = await axiosInstance.get("/api/albums");
      const cloudAlbums = cloudResponse.data;
      await fs.writeFile(
        ALBUM_FILE_PATH,
        JSON.stringify(cloudAlbums, null, 2),
        "utf-8"
      );
      logger.info("Local albums replaced with cloud albums.", cloudAlbums);
      return cloudAlbums;
    } else {
      const user = await userData();
      const raw = await fs.readFile(ALBUM_FILE_PATH, "utf-8");
      const data = raw.trim() ? JSON.parse(raw) : [];
      const filteredData = data.filter((album) => album.userId === user.id);
      logger.info("Loaded albums from local storage", {
        count: filteredData.length,
      });
      return filteredData;
    }
  } catch (err) {
    logger.error("Error getting albums:", { error: err.message });
    return [];
  }
}

async function updateAlbum({ id, name, date, image }) {
  await ensureAlbumFileStructure();
  logger.info("Updating album", { id, name, date });
  try {
    const raw = await fs.readFile(ALBUM_FILE_PATH, "utf-8");
    const albums = JSON.parse(raw);

    const index = albums.findIndex((a) => a.id === id);
    if (index === -1) {
      logger.error("Album not found", { id });
      throw new Error("Album not found");
    }

    let imagePath = albums[index].imagePath;
    if (image?.base64 && image?.name) {
      const extension = path.extname(image.name);
      imagePath = path.join(IMAGE_DIR_PATH, `${id}${extension}`);
      await fs.mkdir(IMAGE_DIR_PATH, { recursive: true });
      const base64Data = image.base64.replace(/^data:image\/\w+;base64,/, "");
      await fs.writeFile(imagePath, base64Data, "base64");
      logger.info("Updated image saved", { path: imagePath });
    }

    const user = await userData();
    albums[index] = { id, name, date, imagePath, userId: user.id };
    await fs.writeFile(
      ALBUM_FILE_PATH,
      JSON.stringify(albums, null, 2),
      "utf-8"
    );

    await appendToSyncQueue({
      action: "update",
      id,
      name,
      date,
      imagePath,
      imageBase64: image?.base64 || null,
      userId: user.id,
    });
    logger.info("Album updated successfully", { id });
    return albums[index];
  } catch (err) {
    logger.error("Error updating album", { error: err.message });
    throw err;
  }
}

async function deleteAlbum(id) {
  await ensureAlbumFileStructure();
  logger.info("Deleting album", { id });
  try {
    const raw = await fs.readFile(ALBUM_FILE_PATH, "utf-8");
    let albums = JSON.parse(raw);
    const album = albums.find((a) => a.id === id);

    if (!album) {
      logger.error("Album not found for deletion", { id });
      return { success: false, error: "Album not found" };
    }

    const photosData = await loadPhotosData();
    const photosToDelete = photosData.filter((photo) => photo.albumId === id);

    for (const photo of photosToDelete) {
      if (photo.fileUrl?.startsWith("https://res.cloudinary.com")) {
        await appendToSyncQueue({
          action: "delete_photo",
          photoId: photo.id,
          albumId: photo.albumId,
          userId: photo.userId,
        });
        logger.info("Photo deletion added to sync queue", {
          photoId: photo.id,
        });
      }
    }

    const updatedPhotos = photosData.filter((photo) => photo.albumId !== id);
    const photoChanges = photosData.length - updatedPhotos.length;
    await savePhotosData(updatedPhotos);

    albums = albums.filter((a) => a.id !== id);
    await fs.writeFile(
      ALBUM_FILE_PATH,
      JSON.stringify(albums, null, 2),
      "utf-8"
    );

    const user = await userData();
    await appendToSyncQueue({ action: "delete", id, userId: user.id });

    logger.info("Album and associated photos deleted successfully", {
      id,
      photoChanges,
    });
    return { success: true, changes: { albums: 1, photos: photoChanges } };
  } catch (err) {
    logger.error("Error deleting album", { error: err.message });
    return { success: false, error: err.message };
  }
}

async function syncAlbums() {
  if (await isOnline()) {
    try {
      let queue = [];
      try {
        const raw = await fs.readFile(SYNC_FILE_PATH, "utf-8");
        queue = raw.trim() ? JSON.parse(raw) : [];
      } catch (err) {
        if (err.code === "ENOENT") {
          logger.info("Sync queue not found. Nothing to sync.");
          return { success: true, message: "No queue file" };
        }
        throw err;
      }
      if (queue.length === 0) {
        logger.info("Sync queue is empty.");
        return { success: true, message: "Nothing to sync" };
      }
      logger.info(`Syncing ${queue.length} entries to cloud...`);
      for (const entry of queue) {
        const { action, album, id, name, date, imagePath, userId } = entry;
        try {
          if (action === "create") {
            logger.info("Syncing CREATE for album", album?.id);
            let coverImageUrl = null;
            if (album.imagePath) {
              const result = await cloudinary.uploader.upload(album.imagePath, {
                folder: "albums",
                resource_type: "image",
              });
              coverImageUrl = result.secure_url;
            }
            await axiosInstance.post("/api/albums", {
              ...album,
              coverImageUrl,
              localImagePath: album.imagePath,
            });
          } else if (action === "update") {
            logger.info("Syncing UPDATE for album", id);
            let coverImageUrl = null;
            if (imagePath) {
              const result = await cloudinary.uploader.upload(imagePath, {
                folder: "albums",
                resource_type: "image",
              });
              coverImageUrl = result.secure_url;
            }
            await axiosInstance.put(`/api/albums/${id}`, {
              name,
              date,
              userId,
              coverImageUrl,
              localImagePath: imagePath,
            });
          } else if (action === "delete") {
            logger.info("Syncing DELETE for album", id);
            await axiosInstance.delete(`/api/albums/${id}`);
          }
        } catch (err) {
          logger.warn("Failed to sync one entry:", { error: err.message });
        }
      }
      await fs.writeFile(SYNC_FILE_PATH, JSON.stringify([], null, 2), "utf-8");
      logger.info("Sync completed. Queue cleared.");
      return { success: true, message: "Synced successfully" };
    } catch (err) {
      logger.error("Error during cloud sync:", { error: err.message });
      return { success: false, error: err.message };
    }
  }
  return { success: false, message: "Offline, sync queued" };
}

async function isOnline() {
  return require("electron").net.isOnline();
}

module.exports = {
  createAlbum,
  getAlbums,
  updateAlbum,
  deleteAlbum,
  syncAlbums,
  appendToSyncQueue,
  userData,
  ensureAlbumFileStructure,
};
