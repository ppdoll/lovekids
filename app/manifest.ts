import type { MetadataRoute } from "next";
import { BG_COLOR, SITE_DESC, SITE_NAME, THEME_COLOR } from "@/lib/site";

/**
 * 홈 화면에 추가했을 때 앱처럼 보이게 하는 설정.
 * 아이는 부모가 만들어 준 링크(/k/...)를 한 번 연 뒤 홈 화면에 추가해 쓴다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_NAME,
    short_name: "숙제방",
    description: SITE_DESC,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BG_COLOR,
    theme_color: THEME_COLOR,
    lang: "ko",
    dir: "ltr",
    categories: ["education", "kids"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable은 안드로이드가 원형·둥근사각형으로 잘라 쓰는 용도 (가장자리 여백이 더 있다)
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
