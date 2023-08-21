import { format, isSameWeek, isSameYear, isSameDay } from "date-fns";

export const formatFileSize = (fileSizeInBytes: number) => {
  const giga = 1024 * 1024 * 1024;
  const mega = 1024 * 1024;
  const kilo = 1024;

  if (fileSizeInBytes >= giga) {
    return `${Math.round(fileSizeInBytes / giga)} GB`;
  } else if (fileSizeInBytes >= mega) {
    return `${Math.round(fileSizeInBytes / mega)} MB`;
  } else if (fileSizeInBytes >= kilo) {
    return `${Math.round(fileSizeInBytes / kilo)} KB`;
  }

  return `${Math.round(fileSizeInBytes)} B`;
};

export const formatChatMessageDate = (d: Date) => {
  return format(d, "p");
};

export const formatSeparatorDate = (d: Date) => {
  const today = new Date();
  if (isSameDay(d, today)) {
    return "Today";
  }
  if (isSameWeek(d, today)) {
    return format(d, "EEEE");
  }
  if (isSameYear(d, today)) {
    return format(d, "LLLL, L");
  }
  return format(d, "YYYY LLLL, L");
};
