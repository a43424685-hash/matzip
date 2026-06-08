/**
 * 카카오 지도 JS SDK 로더.
 * 브라우저에서 한 번만 <script>를 주입하고, kakao.maps.load() 까지 끝난 뒤 resolve.
 * NEXT_PUBLIC_KAKAO_JS_KEY 가 없으면 reject("NO_KEY") — 호출부에서 폴백 UI 표시.
 */

declare global {
  interface Window {
    kakao?: any;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadKakaoMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.kakao?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key || key.startsWith("여기에")) {
    return Promise.reject(new Error("NO_KEY"));
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    // autoload=false → 수동으로 kakao.maps.load() 호출 (로딩 완료 시점을 제어)
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve());
    script.onerror = () => {
      loadPromise = null; // 다음 시도에서 재주입 가능하게
      reject(new Error("SDK_LOAD_FAILED"));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
