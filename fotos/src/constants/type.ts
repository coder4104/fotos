export interface AlbumCardProps {
  album: Album;
  userId?: string;
  onAlbumModified?: () => (void );
}

export type Camera = {
  id: string;
  name: string;
};

export type ConnectionDetails = {
  host: string;
  port: number;
  username: string;
  password: string;
  mode: string;
};


export interface User {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  emailVerified?: boolean;
  token:string;
  trialStart: string;
  subscriptionEnd: string | null; 
}

export interface RegisterUserData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  emailVerified?: boolean;
  phoneVerified?:boolean
}

export interface Album {
  id: string;
  name: string;
  date: string; 
  coverImage?: string | null;
  userId: string;
  imagePath?: string | null;
  localImagePath?: string | null;
  photoCount?: number;
}

export interface CreateAlbumPayload {
  name: string;
  date: string;
  image?: { base64: string; name: string } | null;
}

export interface UpdateAlbumPayload {
  id: string;
  name: string;
  date: string;
  image?: { base64: string; name: string } | null;
}

export interface Photo {
  id: string;
  albumId: string;
  albumName: string;
  imageUrl?: string;
  fileUrl?: string;
  originalImageUrl?: string | null; 
  caption?: string | null;
  userId?: string;
  directory?: string;
}

export interface DeletePhotoParams {
  photoId: string;
}

export interface BulkDeletePhotosParams {
  photoIds: string[];
}

export interface SyncPhotosParams {
  albumName: string;
  albumId: string;
  photoId?: string;
}

export interface ImageStreamData {
  action: "pending" | "add" | "upload" | "error";
  imageUrl?: string;
  filePath?: string;
  error?: string;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  [key: string]: T | boolean;
}

export interface ErrorResponse {
  success: false;
  error: string;
  status?: number | string;
}
