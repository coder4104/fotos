const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const logger = require("./logger");
const {
  PHOTOS_FILE_PATH,
  ALBUM_FILE_PATH,
  SYNC_FILE_PATH,
  CLOUDINARY_CONFIG,
  USER_FILE_PATH,
  SERVER_URL,
} = require("./constants");

cloudinary.config(CLOUDINARY_CONFIG);

let photosData = [];

const axiosInstance = axios.create({
  baseURL: SERVER_URL,
});

async function userData() {
  try {
    const data = await fs.readFile(USER_FILE_PATH, "utf-8");
    console.log(JSON.parse(data));
    return JSON.parse(data) || {};
  } catch (error) {
    logger.error("Failed to load user data", { error: error.message });
    throw error;
  }
}

axiosInstance.interceptors.request.use(async (config) => {
  const user = await userData();
  console.log(user);
  if (user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

async function loadPhotosData() {
  try {
    const data = await fs.readFile(PHOTOS_FILE_PATH, "utf8");
    photosData = JSON.parse(data);
    logger.info("Loaded photos data from file", { file: PHOTOS_FILE_PATH });
    return photosData || [];
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.info("Photos file not found, initializing empty");
      photosData = [];
      await savePhotosData();
    } else {
      logger.error("Failed to load photos data", { error: error.message });
      throw error;
    }
  }
}

async function savePhotosData(updatedPhotos = photosData) {
  try {
    await fs.mkdir(path.dirname(PHOTOS_FILE_PATH), { recursive: true });
    await fs.writeFile(
      PHOTOS_FILE_PATH,
      JSON.stringify(updatedPhotos, null, 2),
      "utf-8"
    );
    logger.info("Successfully saved photos data to file", {
      file: PHOTOS_FILE_PATH,
      photoCount: updatedPhotos.length,
    });
  } catch (error) {
    logger.error("Failed to save photos data", {
      file: PHOTOS_FILE_PATH,
      error: error.message,
    });
    throw error;
  }
}

async function fetchPhotos(albumName, cloudSync = false) {
  logger.info("Fetching photos from JSON storage", { albumName });
  try {
    const rawAlbums = await fs.readFile(ALBUM_FILE_PATH, "utf-8");
    const albums = rawAlbums.trim() ? JSON.parse(rawAlbums) : [];
    const album = albums.find((album) => album.name === albumName);
    const albumId = album ? album.id : null;

    let photos = await loadPhotosData();
    if (!Array.isArray(photos)) {
      logger.warn("Photos data is not an array, initializing as empty", {
        albumName,
      });
      photos = [];
    }

    if (cloudSync) {
      if (!albumId) {
        throw new Error(`No album found for albumName: ${albumName}`);
      }

      logger.info("Syncing photos from cloud", { albumName, albumId });

      const response = await axiosInstance.get(
        `/api/photos/sync-cloud/${albumId}`
      );

      const cloudPhotosRaw = response.data.photos;

      // Normalize cloud structure to match local
      const cloudPhotos = cloudPhotosRaw.map((photo) => ({
        id: photo.id,
        albumId: photo.albumId || albumId,
        albumName: photo.albumName || albumName,
        userId: photo.userId || null,
        imageUrl: photo.originalImageUrl || photo.imageUrl, // original local path
        createdAt: photo.createdAt,
        directory: photo.originalImageUrl
          ? path.dirname(photo.originalImageUrl.replace("file://", ""))
          : "",
        fileUrl: photo.imageUrl || null, // uploaded cloud URL
      }));

      // Replace local photos of this album with cloud photos
      photos = photos.filter((photo) => photo.albumId !== albumId);
      photos = [...photos, ...cloudPhotos];

      await fs.writeFile(PHOTOS_FILE_PATH, JSON.stringify(photos, null, 2));
      logger.info("Local photos overwritten with cloud data", {
        albumName,
        albumId,
        totalPhotos: cloudPhotos.length,
      });
    }

    const filteredPhotos = photos.filter(
      (photo) =>
        photo.albumName === albumName || (albumId && photo.albumId === albumId)
    );

    logger.info("Photos fetched successfully", {
      albumName,
      albumId,
      totalPhotos: photos.length,
      filteredPhotos: filteredPhotos.length,
    });

    // Final normalized return
    return filteredPhotos.map((photo) => ({
      id: photo.id,
      albumId: photo.albumId || albumId,
      albumName: photo.albumName || albumName,
      userId: photo.userId || null,
      imageUrl: photo.imageUrl,
      createdAt: photo.createdAt,
      directory: photo.directory || (photo.imageUrl?.startsWith("file://")
        ? path.dirname(photo.imageUrl.replace("file://", ""))
        : ""),
      fileUrl: photo.fileUrl || photo.imageUrl,
    }));
  } catch (error) {
    logger.error("Error fetching photos", { albumName, error: error.message });
    throw error;
  }
}


async function deletePhoto({ photoId }, processedFiles, mainWindow) {
  logger.info("Deleting photo from JSON storage", { photoId });
  try {
    await loadPhotosData();
    const photoToDelete = photosData.find((photo) => photo.id === photoId);

    if (!photoToDelete) {
      logger.info("No photo found with the given ID", { photoId });
      return { success: true, changes: 0 };
    }

    if (photoToDelete.imageUrl?.startsWith("file://")) {
      const filePath = photoToDelete.imageUrl.replace("file://", "");
      processedFiles.delete(filePath);
      logger.info("Removed file from processed files tracking", { filePath });
    }

    const updatedPhotos = photosData.filter((photo) => photo.id !== photoId);
    await savePhotosData(updatedPhotos);
    photosData = updatedPhotos;

    if (photoToDelete.fileUrl?.startsWith("https://res.cloudinary.com")) {
      await appendToSyncQueue({
        action: "delete_photo",
        photoId: photoToDelete.id,
        albumId: photoToDelete.albumId,
        userId: photoToDelete.userId,
      });
      logger.info("Photo deletion added to sync queue", { photoId });
    }

    logger.info("Photo metadata deleted successfully", { photoId });
    return { success: true, changes: 1 };
  } catch (error) {
    logger.error("Error deleting photo", { photoId, error: error.message });
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
}

async function bulkDeletePhotos({ photoIds }, processedFiles, mainWindow) {
  logger.info("Bulk deleting photos from JSON storage", { photoIds });
  try {
    await loadPhotosData();
    const photosToDelete = photosData.filter((photo) =>
      photoIds.includes(photo.id)
    );

    for (const photo of photosToDelete) {
      if (photo.imageUrl?.startsWith("file://")) {
        const filePath = photo.imageUrl.replace("file://", "");
        processedFiles.delete(filePath);
        logger.info("Removed file from processed files tracking", { filePath });
      }
    }

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

    const updatedPhotos = photosData.filter(
      (photo) => !photoIds.includes(photo.id)
    );
    const changes = photosData.length - updatedPhotos.length;
    await savePhotosData(updatedPhotos);
    photosData = updatedPhotos;

    logger.info("Photos metadata bulk deleted successfully", {
      photoIds,
      changes,
    });
    return { success: true, changes };
  } catch (error) {
    logger.error("Error bulk deleting photos", {
      photoIds,
      error: error.message,
    });
    throw new Error(`Failed to bulk delete photos: ${error.message}`);
  }
}

async function uploadImage({ base64Image, albumId, token }, mainWindow) {
  logger.info("Processing image upload", { albumId, dataType: "base64" });
  if (!base64Image || !albumId || !token) {
    logger.error("Missing required parameters", {
      base64Image: !!base64Image,
      albumId,
      token,
    });
    return { error: "Invalid image data, album ID, or token" };
  }

  try {
    const retry = async (fn, retries = 3, baseDelay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (error) {
          logger.warn(`Attempt ${i + 1} failed`, { error: error.message });
          if (i === retries - 1) throw error;
          const delay = baseDelay * Math.pow(2, i);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    let base64String = base64Image;
    if (base64String.startsWith("data:image/")) {
      base64String = base64String.split(",")[1];
    }

    if (!/^[A-Za-z0-9+/=]+$/.test(base64String)) {
      logger.error("Invalid base64 data");
      throw new Error("Invalid base64 image data");
    }

    const publicId = `image-${crypto.randomUUID()}`;
    const uploadResult = await retry(() =>
      cloudinary.uploader.upload(`data:image/jpeg;base64,${base64String}`, {
        folder: "albums",
        resource_type: "image",
        public_id: publicId,
      })
    );

    const cloudinaryUrl = uploadResult.secure_url;
    logger.info("Image uploaded to Cloudinary", { publicId, cloudinaryUrl });

    mainWindow.webContents.send("image-stream", {
      action: "upload",
      data: cloudinaryUrl,
    });

    const response = await retry(() =>
      axiosInstance.post("/api/upload-photo", {
        albumId,
        imageUrl: cloudinaryUrl,
      })
    );

    if (!response.data || response.status >= 400) {
      logger.error("Failed to save photo to database", {
        cloudinaryUrl,
        albumId,
        status: response.status,
        error: response.data?.error || "Unknown error",
      });
      throw new Error(
        response.data?.error || "Failed to save photo to database"
      );
    }

    logger.info("Photo saved to database", { cloudinaryUrl, albumId });
    return { url: cloudinaryUrl };
  } catch (error) {
    logger.error("Image upload error", { error: error.message });
    return { error: error.message };
  }
}

async function syncPhotosToCloud({ albumName, albumId, photoId }, mainWindow) {
  try {
    photosData = await loadPhotosData();
    let localPhotos = (photosData || []).filter(
      (photo) =>
        photo.albumName === albumName &&
        !photo.fileUrl?.startsWith("https://res.cloudinary.com")
    );
    console.log(photosData, photoId);
    if (photoId) {
      localPhotos = localPhotos.filter((photo) => photo.id === photoId);
      if (localPhotos.length === 0) {
        logger.info("No matching photo found for sync", { photoId, albumName });
        return [];
      }
    }

    logger.info("Local photos fetched for sync", {
      albumName,
      count: localPhotos.length,
    });

    const retry = async (fn, retries = 3, baseDelay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (error) {
          logger.warn(`Attempt ${i + 1} failed`, { error: error.message });
          if (i === retries - 1) throw error;
          const delay = baseDelay * Math.pow(2, i);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    const syncedPhotos = [];
    for (const photo of localPhotos) {
      try {
        if (photo?.fileUrl?.startsWith("https://res.cloudinary.com")) {
          logger.info("Photo already in cloud", {
            photoId: photo.id,
            url: photo.fileUrl,
          });
          syncedPhotos.push(photo);
          continue;
        }

        const filePath = photo.imageUrl
          .replace(/^file:\/\//, "")
          .replace(/\//g, path.sep);
        const fileBuffer = await fs.readFile(filePath);
        const base64Image = fileBuffer.toString("base64");

        const publicId = `image-${crypto.randomUUID()}`;
        const uploadResult = await retry(() =>
          cloudinary.uploader.upload(`data:image/jpeg;base64,${base64Image}`, {
            folder: "albums",
            resource_type: "image",
            public_id: publicId,
          })
        );

        const cloudinaryUrl = uploadResult.secure_url;
        logger.info("Image uploaded to Cloudinary", {
          photoId: photo.id,
          cloudinaryUrl,
        });

        const response = await axiosInstance.post("/api/upload-photo", {
          albumId,
          imageUrl: cloudinaryUrl,
          originalImageUrl: photo.imageUrl,
          albumName,
          photoId: photo.id,
        });

        if (!response.data || response.status >= 400) {
          logger.error("Failed to save photo to server database", {
            cloudinaryUrl,
            albumId,
            status: response.status,
            error: response.data?.error || "Unknown error",
          });
          throw new Error(
            response.data?.error || "Failed to save photo to server"
          );
        }

        logger.info("Photo saved to server database", {
          photoId: photo.id,
          cloudinaryUrl,
        });

        photosData = photosData.map((p) =>
          p.id === photo.id
            ? { ...p, imageUrl: photo.imageUrl, fileUrl: cloudinaryUrl }
            : p
        );

        await savePhotosData();
        logger.info("Updated photo URL in JSON storage", {
          photoId: photo.id,
          cloudinaryUrl,
          albumName,
        });

        syncedPhotos.push({
          ...photo,
          imageUrl: photo.imageUrl,
          fileUrl: cloudinaryUrl,
        });
      } catch (error) {
        logger.error("Failed to sync photo", {
          photoId: photo.id,
          error: error.message,
        });
      }
    }

    logger.info("Photo sync completed", {
      albumName,
      totalPhotos: localPhotos.length,
      syncedCount: syncedPhotos.length,
    });

    return syncedPhotos;
  } catch (error) {
    logger.error("Error syncing photos to cloud", {
      albumName,
      error: error.message,
    });
    throw error;
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

async function isImageFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath, { encoding: null, flag: "r" });
    const magicNumbers = {
      jpg: ["ffd8ff"],
      png: ["89504e47"],
      gif: ["47494638"],
      webp: ["52494646"],
      tiff: ["49492a00", "4d4d002a"],
      bmp: ["424d"],
      cr2: ["49492a00"],
      cr3: ["66747970637278"],
      nef: ["4d4d002a"],
      arw: ["49492a00", "4d4d002a"],
    };
    const firstBytes = buffer.slice(0, 8).toString("hex").toLowerCase();
    return Object.values(magicNumbers).some((group) =>
      group.some((magic) => firstBytes.startsWith(magic))
    );
  } catch (error) {
    logger.error("Failed to validate file as image", {
      filePath,
      error: error.message,
    });
    return false;
  }
}

module.exports = {
  loadPhotosData,
  savePhotosData,
  fetchPhotos,
  deletePhoto,
  bulkDeletePhotos,
  uploadImage,
  syncPhotosToCloud,
  isImageFile,
  appendToSyncQueue,
};
