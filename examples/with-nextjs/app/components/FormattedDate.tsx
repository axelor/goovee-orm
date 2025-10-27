"use client";

interface FormattedDateProps {
  value: Date | string;
  format?: "full" | "short" | "relative" | "date-only";
  className?: string;
}

function toDate(value: Date | string): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;

  const date = value.includes("T")
    ? new Date(value)
    : new Date(
        new Date(value).getUTCFullYear(),
        new Date(value).getUTCMonth(),
        new Date(value).getUTCDate(),
      );

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function FormattedDate({
  value,
  format = "full",
  className,
}: FormattedDateProps) {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  const formatDate = () => {
    switch (format) {
      case "full":
        return date.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      case "short":
        return date.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      case "date-only":
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      case "relative":
        return getRelativeTime(date);
      default:
        return date.toLocaleString();
    }
  };

  return (
    <time dateTime={date.toISOString()} className={className}>
      {formatDate()}
    </time>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}
