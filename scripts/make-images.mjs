/**
 * 공유 미리보기(OG) 이미지와 앱 아이콘(PWA)을 만든다.
 *
 * 왜 미리 만들어 두는가:
 *  - 런타임에 이미지를 만들면 한글 폰트를 어디선가 받아와야 해서 깨지기 쉽다.
 *  - OG 이미지는 카카오톡·페이스북 크롤러가 로그인 없이 읽어야 하므로 정적 파일이 안전하다.
 *
 * 실행: node scripts/make-images.mjs
 * (결과물은 public/ 에 저장되고 그대로 커밋한다)
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "public");
mkdirSync(path.join(OUT, "icons"), { recursive: true });

/** 앱 아이콘 — 글꼴에 기대지 않고 도형으로만 그린다 (연필과 책, 하트) */
function iconSvg(size, { maskable = false } = {}) {
  const s = size;
  // maskable 아이콘은 가장자리가 잘리므로 안쪽으로 여백을 더 준다
  const pad = maskable ? s * 0.18 : s * 0.1;
  const inner = s - pad * 2;
  const r = maskable ? s * 0.5 : s * 0.22; // 배경 라운드
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFB86B"/>
      <stop offset="55%" stop-color="#FF8FA8"/>
      <stop offset="100%" stop-color="#FF7AB0"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${maskable ? 0 : r}" fill="url(#bg)"/>
  <g transform="translate(${pad} ${pad})">
    <!-- 펼친 책 -->
    <path d="M ${inner * 0.08} ${inner * 0.28}
             Q ${inner * 0.3} ${inner * 0.18} ${inner * 0.5} ${inner * 0.3}
             L ${inner * 0.5} ${inner * 0.82}
             Q ${inner * 0.3} ${inner * 0.7} ${inner * 0.08} ${inner * 0.8} Z"
          fill="#ffffff" opacity="0.97"/>
    <path d="M ${inner * 0.92} ${inner * 0.28}
             Q ${inner * 0.7} ${inner * 0.18} ${inner * 0.5} ${inner * 0.3}
             L ${inner * 0.5} ${inner * 0.82}
             Q ${inner * 0.7} ${inner * 0.7} ${inner * 0.92} ${inner * 0.8} Z"
          fill="#ffffff" opacity="0.85"/>
    <!-- 책 가운데 선 -->
    <rect x="${inner * 0.485}" y="${inner * 0.29}" width="${inner * 0.03}" height="${inner * 0.53}" rx="${inner * 0.015}" fill="#FF8FA8" opacity="0.5"/>
    <!-- 하트 -->
    <path d="M ${inner * 0.5} ${inner * 0.2}
             c ${-inner * 0.06} ${-inner * 0.09}, ${-inner * 0.2} ${-inner * 0.03}, ${-inner * 0.14} ${inner * 0.07}
             c ${inner * 0.035} ${inner * 0.06}, ${inner * 0.1} ${inner * 0.1}, ${inner * 0.14} ${inner * 0.13}
             c ${inner * 0.04} ${-inner * 0.03}, ${inner * 0.105} ${-inner * 0.07}, ${inner * 0.14} ${-inner * 0.13}
             c ${inner * 0.06} ${-inner * 0.1}, ${-inner * 0.08} ${-inner * 0.16}, ${-inner * 0.14} ${-inner * 0.07} Z"
          fill="#ffffff"/>
  </g>
</svg>`;
}

/** 공유 미리보기 카드 (1200x630) */
function ogSvg() {
  const W = 1200;
  const H = 630;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF9EC"/>
      <stop offset="55%" stop-color="#FFEFF5"/>
      <stop offset="100%" stop-color="#EEF4FF"/>
    </linearGradient>
    <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFB86B"/>
      <stop offset="100%" stop-color="#FF7AB0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- 장식용 원 -->
  <circle cx="1080" cy="120" r="150" fill="#FFD8E8" opacity="0.5"/>
  <circle cx="120" cy="560" r="110" fill="#FFE7C9" opacity="0.55"/>

  <!-- 아이콘 -->
  <g transform="translate(96 150)">
    <rect width="140" height="140" rx="34" fill="url(#chip)"/>
    <g transform="translate(14 14)">
      <path d="M 10 34 Q 36 22 60 36 L 60 100 Q 36 86 10 96 Z" fill="#fff" opacity="0.97"/>
      <path d="M 110 34 Q 84 22 60 36 L 60 100 Q 84 86 110 96 Z" fill="#fff" opacity="0.85"/>
      <rect x="57" y="35" width="6" height="64" rx="3" fill="#FF8FA8" opacity="0.5"/>
    </g>
  </g>

  <text x="270" y="228" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif"
        font-size="76" font-weight="bold" fill="#3D3348">러브키즈 숙제방</text>
  <text x="272" y="292" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif"
        font-size="34" fill="#7A7185">매일매일 우리 아이 숙제, 자동 출제하고 바로 채점</text>

  <!-- 과목 칩 -->
  <g font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="32" font-weight="bold">
    <rect x="96" y="400" width="180" height="76" rx="24" fill="#FFF1E6"/>
    <text x="186" y="449" fill="#FF8A3D" text-anchor="middle">국어</text>
    <rect x="296" y="400" width="180" height="76" rx="24" fill="#E9F2FF"/>
    <text x="386" y="449" fill="#4C9AFF" text-anchor="middle">영어</text>
    <rect x="496" y="400" width="180" height="76" rx="24" fill="#E7F8F0"/>
    <text x="586" y="449" fill="#2FBF85" text-anchor="middle">수학</text>
  </g>

  <text x="96" y="546" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif"
        font-size="27" fill="#9A93A3">학년에 맞는 문제 · 연속 정답 콤보 · 부모님 진도 확인</text>
</svg>`;
}

/** SVG를 지정한 크기의 PNG로 저장. 확대 렌더 후 줄여서 가장자리를 매끄럽게 만든다. */
async function png(svg, file, w, h = w) {
  const out = await sharp(Buffer.from(svg), { density: 300 })
    .resize(w, h, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(path.join(OUT, file), out);
  const meta = await sharp(out).metadata();
  const ok = meta.width === w && meta.height === h ? "" : "  ⚠️ 크기 불일치";
  console.log(`  ${file}  ${meta.width}x${meta.height}  ${(out.length / 1024).toFixed(1)}KB${ok}`);
}

console.log("앱 아이콘");
await png(iconSvg(512), "icons/icon-512.png", 512);
await png(iconSvg(512), "icons/icon-192.png", 192);
await png(iconSvg(512, { maskable: true }), "icons/icon-maskable-512.png", 512);
await png(iconSvg(512), "apple-touch-icon.png", 180);
await png(iconSvg(512), "icons/icon-32.png", 32);

console.log("공유 미리보기");
await png(ogSvg(), "og.png", 1200, 630);

console.log("\n완료 — public/ 에 저장했습니다.");
