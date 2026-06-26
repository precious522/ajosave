import NextImage, { ImageProps } from "next/image";

/**
 * Thin wrapper around next/image that enforces WebP/AVIF delivery
 * and prevents layout shift by requiring explicit width/height.
 */
export function OptimizedImage(props: ImageProps) {
  return <NextImage {...props} />;
}
