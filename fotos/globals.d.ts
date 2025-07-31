import {
  SuccessResponse,
  User,
  ErrorResponse,
  RegisterUserData,
  CreateAlbumPayload,
  Album,
  UpdateAlbumPayload,
  Photo,
  DeletePhotoParams,
  BulkDeletePhotosParams,
  ConnectionDetails,
  SyncPhotosParams,
  ImageStreamData
} from "./src/constants/type";

export interface ElectronAPI {
  // Authentication
  login: (
    email: string,
    password: string
  ) => Promise<SuccessResponse<{ user: User; token: string }> | ErrorResponse>;
  register: (
    userData: RegisterUserData
  ) => Promise<SuccessResponse<{ user: User; token: string }> | ErrorResponse>;
  sendEmailOtp: (
    email: string
  ) => Promise<SuccessResponse<{ message: string }> | ErrorResponse>;
  forgotPassword: (
    email: string,
    otp: string,
    newPassword: string
  ) => Promise<
    | SuccessResponse<{ user: User; token: string } | { message: string }>
    | ErrorResponse
  >;
  saveUser: (user: User) => Promise<SuccessResponse | ErrorResponse>;
  loadUser: () => Promise<SuccessResponse<{ user: User }> | ErrorResponse>;
  deleteUser: () => Promise<SuccessResponse | ErrorResponse>;

  // External URL
  openExternal: (url: string) => void;

  // Album Management
  getAlbums: (forceCloudSync?: boolean) => Promise<Album[]>;
  createAlbum: (
    payload: CreateAlbumPayload
  ) => Promise<Album | { success: false; error: string }>;
  updateAlbum: (
    payload: UpdateAlbumPayload
  ) => Promise<Album | { success: false; error: string }>;
  deleteAlbum: (
    id: string
  ) => Promise<
    | SuccessResponse<{ changes: { albums: number; photos: number } }>
    | ErrorResponse
  >;
  syncAlbums: () => Promise<
    SuccessResponse<{ message: string }> | ErrorResponse
  >;
  checkAndSyncAlbums: () => Promise<
    SuccessResponse<{ message: string }> | ErrorResponse
  >;

  // Photo Management
  fetchPhotos: (albumName: string) => Promise<Photo[]>;
  deletePhoto: (
    params: DeletePhotoParams
  ) => Promise<SuccessResponse<{ changes: number }>>;
  bulkDeletePhotos: (
    params: BulkDeletePhotosParams
  ) => Promise<SuccessResponse<{ changes: number }>>;
  syncPhotosToCloud: (params: SyncPhotosParams) => Promise<Photo[]>;

  // Folder Selection
  selectFolder: () => Promise<string | null>;

  // FTP Server Operations
  startFtp: (config: {
    username: string;
    directory: string;
    albumId: string;
    albumName: string;
    token: string;
    cloudSyncEnabled: boolean;
  }) => Promise<ConnectionDetails | { error: string }>;
  getFtpCredentials: () => Promise<ConnectionDetails[]>;
  resetFtpCredentials: () => Promise<{ message: string }>;
  testFtpCredentials: (credentials: {
    username: string;
    password: string;
  }) => Promise<{ valid: boolean; expected?: string }>;
  regenerateFtpPassword: (username: string) => Promise<{ password: string }>;
  closeFtp: () => Promise<{ message: string }>;
  checkFtpStatus: () => Promise<{
    isRunning: boolean;
    credentials: ConnectionDetails[];
  }>;
  updateCloudSync: (args: {
    username: string;
    cloudSyncEnabled: boolean;
  }) => Promise<SuccessResponse<{ message: string }>>;

  // Event Listeners
  onImageStream: (callback: (data: ImageStreamData) => void) => () => void;
  onClearFtpCredentials: (
    callback: (data: { message: string }) => void
  ) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
