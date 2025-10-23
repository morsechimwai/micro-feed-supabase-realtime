export const USERS_STORAGE_BUCKET = "users-images";
export const USERS_BUCKET_FOLDER = "users";
export const POSTS_STORAGE_BUCKET = "posts-images";
export const POSTS_BUCKET_FOLDER = "posts";
export const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const RANDOM_FALLBACK = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createMarkerVariants = (bucket: string) => ({
  primary: `/storage/v1/object/public/${bucket}/`,
  secondary: `/${bucket}/`,
});

const createStoragePathForBucket = (bucketFolder: string, fileName: string) => {
  const extension = fileName.split(".").pop();
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : RANDOM_FALLBACK();
  return `${bucketFolder}/${uuid}${extension ? `.${extension}` : ""}`;
};

export const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

export const createStoragePath = (
  fileName: string,
  bucketFolder: string = POSTS_BUCKET_FOLDER
) => createStoragePathForBucket(bucketFolder, fileName);

export const createUserStoragePath = (fileName: string) =>
  createStoragePathForBucket(USERS_BUCKET_FOLDER, fileName);

export const createPostStoragePath = (fileName: string) =>
  createStoragePathForBucket(POSTS_BUCKET_FOLDER, fileName);

export const getStoragePathFromUrl = (url: string, bucket: string = POSTS_STORAGE_BUCKET) => {
  if (!url) {
    return null;
  }

  const markers = createMarkerVariants(bucket);

  try {
    const parsed = new URL(url);
    const index = parsed.pathname.indexOf(markers.primary);

    if (index !== -1) {
      const path = parsed.pathname.slice(index + markers.primary.length);
      return decodeURIComponent(path);
    }

    const altIndex = parsed.pathname.indexOf(markers.secondary);

    if (altIndex !== -1) {
      const path = parsed.pathname.slice(altIndex + markers.secondary.length);
      return decodeURIComponent(path);
    }

    return null;
  } catch {
    let raw = url;

    if (raw.includes(markers.primary)) {
      raw = raw.slice(raw.indexOf(markers.primary) + markers.primary.length);
    } else if (raw.includes(markers.secondary)) {
      raw = raw.slice(raw.indexOf(markers.secondary) + markers.secondary.length);
    } else {
      return null;
    }

    const [path] = raw.split("?");
    return decodeURIComponent(path);
  }
};

export const withCacheBuster = (url: string, suffix?: string) => {
  const token = suffix ?? Date.now().toString(36);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${token}`;
};

export const composeImageReference = (path: string, publicUrl: string) => `${path}|${publicUrl}`;

export const parseImageReference = (
  value: string | null | undefined,
  bucket: string = POSTS_STORAGE_BUCKET
) => {
  if (!value) {
    return { raw: null, path: null, publicUrl: null };
  }

  if (value.includes("|")) {
    const [pathPart, ...rest] = value.split("|");
    const urlPart = rest.join("|") || null;
    const normalizedPath =
      pathPart || (urlPart ? getStoragePathFromUrl(urlPart, bucket) : null);
    return {
      raw: value,
      path: normalizedPath,
      publicUrl: urlPart,
    };
  }

  const derivedPath = getStoragePathFromUrl(value, bucket);
  const isLikelyPath = !value.startsWith("http://") && !value.startsWith("https://");
  return {
    raw: value,
    path: derivedPath ?? (isLikelyPath ? value : null),
    publicUrl: isLikelyPath ? null : value,
  };
};
