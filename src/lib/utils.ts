// Utility functions and helpers
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Date formatting
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

dayjs.extend(relativeTime);

export const formatCreatedAt = (createdAt: string) => {
  const timestamp = dayjs(createdAt);

  if (dayjs().diff(timestamp, "day") === 0) {
    return timestamp.fromNow();
  }

  return timestamp.format("D MMM YYYY");
};
