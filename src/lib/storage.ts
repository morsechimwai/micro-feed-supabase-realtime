export const TASK_IMAGES_BUCKET = "tasks-images";
export const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const RANDOM_FALLBACK = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

export const createStoragePath = (fileName: string) => {
  const extension = fileName.split(".").pop();
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : RANDOM_FALLBACK();
  return `tasks/${uuid}${extension ? `.${extension}` : ""}`;
};

export const getStoragePathFromUrl = (url: string) => {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${TASK_IMAGES_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);

    if (index !== -1) {
      const path = parsed.pathname.slice(index + marker.length);
      return decodeURIComponent(path);
    }

    const altMarker = `/${TASK_IMAGES_BUCKET}/`;
    const altIndex = parsed.pathname.indexOf(altMarker);

    if (altIndex !== -1) {
      const path = parsed.pathname.slice(altIndex + altMarker.length);
      return decodeURIComponent(path);
    }

    return null;
  } catch {
    let raw = url;
    const marker = `/storage/v1/object/public/${TASK_IMAGES_BUCKET}/`;

    if (raw.includes(marker)) {
      raw = raw.slice(raw.indexOf(marker) + marker.length);
    } else {
      const altMarker = `/${TASK_IMAGES_BUCKET}/`;
      if (raw.includes(altMarker)) {
        raw = raw.slice(raw.indexOf(altMarker) + altMarker.length);
      } else {
        return null;
      }
    }

    const [path] = raw.split("?");
    return decodeURIComponent(path);
  }
};

export const composeImageReference = (path: string, publicUrl: string) => `${path}|${publicUrl}`;

export const parseImageReference = (value: string | null | undefined) => {
  if (!value) {
    return { raw: null, path: null, publicUrl: null };
  }

  if (value.includes("|")) {
    const [pathPart, ...rest] = value.split("|");
    const urlPart = rest.join("|") || null;
    const normalizedPath = pathPart || (urlPart ? getStoragePathFromUrl(urlPart) : null);
    return {
      raw: value,
      path: normalizedPath,
      publicUrl: urlPart,
    };
  }

  const derivedPath = getStoragePathFromUrl(value);
  const isLikelyPath = !value.startsWith("http://") && !value.startsWith("https://");
  return {
    raw: value,
    path: derivedPath ?? (isLikelyPath ? value : null),
    publicUrl: isLikelyPath ? null : value,
  };
};
