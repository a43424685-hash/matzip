"use client";

/**
 * 현재 위치 가져오기 — 네이티브 앱에선 Capacitor Geolocation(네이티브 CoreLocation)을 써서
 * 권한 팝업이 "먹고핀" 이름 + 한글(Info.plist 문구)로 뜨게 한다.
 *
 * 안전장치: 네이티브 플러그인이 없는 빌드(현재 출시본 등)에서는 플러그인 호출이
 * "not implemented"로 실패하므로, 그 경우 브라우저 navigator.geolocation 으로 자동 대체한다.
 * → 지금 웹 배포를 해도 현재 앱은 기존대로(브라우저 위치) 동작하고,
 *   다음 네이티브 빌드부터 한글 네이티브 팝업으로 바뀐다.
 */

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

function isNative(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** 브라우저 geolocation 을 Promise 로 감싼 것 (fallback 경로) */
function browserGetPosition(opts?: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("NO_GEO"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null }),
      (err) => reject(err),
      opts ?? { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/**
 * 현재 위치 1회 조회. 네이티브 플러그인 우선, 실패 시 브라우저로 대체.
 * 권한 거부/실패는 throw.
 */
export async function getCurrentPositionSafe(opts?: PositionOptions): Promise<Coords> {
  if (isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      // 권한 요청(네이티브 팝업 — 먹고핀 + 한글). 이미 허용됐으면 바로 통과.
      const perm = await Geolocation.requestPermissions();
      if (perm.location === "denied") throw new Error("PERMISSION_DENIED");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: opts?.timeout ?? 12000,
        maximumAge: opts?.maximumAge ?? 60000,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 플러그인이 없는 빌드("not implemented")면 브라우저로 대체.
      // 진짜 권한 거부(PERMISSION_DENIED)면 그대로 던진다.
      if (/not implemented|unimplemented|UNIMPLEMENTED/i.test(msg)) {
        return browserGetPosition(opts);
      }
      throw e;
    }
  }
  return browserGetPosition(opts);
}
