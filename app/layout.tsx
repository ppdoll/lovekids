import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BG_COLOR, SITE_DESC, SITE_NAME, siteUrl, THEME_COLOR } from "@/lib/site";
import ServiceWorker from "./sw-register";
import "./globals.css";

/**
 * 메타데이터를 요청 시점에 만든다.
 * 고정값으로 두면 빌드할 때 주소를 몰라 og:image가 localhost로 굳어지고,
 * 그러면 카카오톡에 링크를 보내도 미리보기 이미지가 안 뜬다.
 */
export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  return {
    ...baseMetadata,
    // OG 이미지 주소를 절대 경로로 만들려면 기준 주소가 필요하다
    metadataBase: new URL(siteUrl(host)),
  };
}

const baseMetadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // 아이폰에서 홈 화면에 추가했을 때 주소창 없이 앱처럼 열리게 한다
  appleWebApp: {
    capable: true,
    title: "숙제방",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESC,
    locale: "ko_KR",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "러브키즈 숙제방 — 국어·영어·수학 매일 숙제",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESC,
    images: ["/og.png"],
  },
  // 가족용 사이트라 검색에 노출될 이유가 없다
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
  other: {
    // Next는 표준 태그(mobile-web-app-capable)만 넣는데, iOS 16.4 이전 기기는
    // 이 예전 태그가 있어야 홈 화면에서 주소창 없이 앱처럼 열린다.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 앱처럼 쓸 때 실수로 확대돼 화면이 어긋나지 않도록 (확대 자체는 막지 않는다)
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BG_COLOR },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
