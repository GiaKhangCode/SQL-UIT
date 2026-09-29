import type { CSSProperties } from "react";

const bannerVariants = 3;

function bannerHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function contestBannerClass(id: string) {
  return `contest-banner-visual-${bannerHash(id) % bannerVariants}`;
}

/** The cropped, display-sized banner is the only banner students should see. */
export function contestBannerStyle(bannerUrl?: string | null): CSSProperties | undefined {
  if (!bannerUrl) return undefined;
  return {
    backgroundImage: `linear-gradient(90deg, rgba(14, 14, 51, .82), rgba(14, 14, 51, .48)), url(${JSON.stringify(bannerUrl)})`,
  };
}
