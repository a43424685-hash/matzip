"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Camera, Receipt, BookOpen, Check, Navigation, type LucideIcon } from "lucide-react";
import KakaoMap from "@/components/KakaoMap";

// 서버(VerificationService)와 동일하게 유지 — 50m + 정확도 50m 하드 제한
const LOCATION_THRESHOLD_METERS = 50; // 가게 50m 이내
const LOCATION_ACCURACY_LIMIT_METERS = 50; // GPS 정확도 50m 이내

/** 두 좌표 간 거리(m) — Haversine. 실시간 거리 표시용(서버가 최종 판정) */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/**
 * 사진첩/카메라에서 고른 파일을 폰에서 리사이즈한 JPEG data URL 로 변환.
 * (업로드 서버 없이 바로 첨부 — 긴 변 최대 1024px, 품질 0.6 → 보통 100~250KB)
 */
async function fileToResizedDataUrl(file: File, maxDim = 1024, quality = 0.6): Promise<string> {
  const srcUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("read fail"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("img fail"));
    i.src = srcUrl;
  });
  let w = img.width;
  let h = img.height;
  if (w >= h && w > maxDim) {
    h = Math.round((h * maxDim) / w);
    w = maxDim;
  } else if (h > w && h > maxDim) {
    w = Math.round((w * maxDim) / h);
    h = maxDim;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return srcUrl; // 캔버스 미지원 시 원본
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

type PhotoKind = "receipt" | "menu";

const PHOTO_ROWS: { kind: PhotoKind; label: string; Icon: LucideIcon; xp: number; hint: string }[] = [
  { kind: "receipt", label: "영수증", Icon: Receipt, xp: 100, hint: "가게명·날짜가 보이게 영수증을 찍어주세요" },
  { kind: "menu", label: "메뉴판", Icon: BookOpen, xp: 40, hint: "메뉴판이 보이게 찍어주세요" },
];

export interface VerifyInitial {
  locationVerified: boolean;
  receiptAttached: boolean;
  menuAttached: boolean;
}

export default function VerifyPanel({
  postId,
  initial,
  restaurant,
}: {
  postId: string;
  initial: VerifyInitial;
  /** 가게 권위 좌표 — 있으면 지도 표시 */
  restaurant?: { name: string; lat: number | null; lng: number | null };
}) {
  const router = useRouter();
  const [locVerified, setLocVerified] = useState(initial.locationVerified);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [liveDist, setLiveDist] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const verifyingRef = useRef(false); // 자동 인증 중복 호출 방지
  const hasCoords =
    restaurant != null && restaurant.lat != null && restaurant.lng != null;
  const [attached, setAttached] = useState({
    receipt: initial.receiptAttached,
    menu: initial.menuAttached,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<PhotoKind, string | null>>({
    receipt: null,
    menu: null,
  });

  async function post(body: object) {
    return fetch(`/api/posts/${postId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function stopTracking() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }

  // 위치 추적 종료 시 watch 해제
  useEffect(() => stopTracking, []);

  /** 서버에 위치 인증 요청 (범위 안에 들어오면 자동 호출) */
  async function submitLocation(lat: number, lng: number, acc: number | null) {
    if (verifyingRef.current || locVerified) return;
    verifyingRef.current = true;
    const res = await post({ type: "location", lat, lng, accuracy: acc });
    verifyingRef.current = false;
    if (!res.ok) return setMsg("인증에 실패했어요.");
    const d = await res.json();
    if (d.verified) {
      setLocVerified(true);
      const xp = d.awardedXp ? ` +${d.awardedXp} XP` : "";
      setMsg(`위치 인증 완료!${xp} (가게에서 ${d.distanceMeters}m)`);
      stopTracking();
      router.refresh();
    } else if (d.reason === "NO_COORDS") {
      setMsg("이 가게는 위치 좌표가 없어 위치 인증이 아직 불가해요. (장소 검색 연동 후 가능)");
      stopTracking();
    }
    // TOO_FAR / LOW_ACCURACY 는 추적을 유지하며 실시간 안내(아래 onPosition)로 처리
  }

  function onPosition(pos: GeolocationPosition) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const acc = pos.coords.accuracy ?? null;
    setUserLoc({ lat, lng });
    setAccuracy(acc);

    if (!hasCoords) return;
    const dist = distanceMeters(restaurant!.lat!, restaurant!.lng!, lat, lng);
    setLiveDist(dist);

    if (locVerified) return;
    if (acc != null && acc > LOCATION_ACCURACY_LIMIT_METERS) {
      setMsg(`GPS 정확도가 낮아요 (±${Math.round(acc)}m). 야외에서 다시 시도해주세요. (정확도 ${LOCATION_ACCURACY_LIMIT_METERS}m 이내 필요)`);
    } else if (dist <= LOCATION_THRESHOLD_METERS) {
      setMsg("범위 안에 들어왔어요. 인증 중…");
      submitLocation(lat, lng, acc); // 범위 진입 → 자동 인증
    } else {
      setMsg(`현재 가게에서 ${dist}m · ${LOCATION_THRESHOLD_METERS}m 이내로 들어오면 자동 인증돼요.`);
    }
  }

  function startTracking() {
    setMsg(null);
    if (!("geolocation" in navigator)) {
      setMsg("이 기기는 위치를 지원하지 않아요.");
      return;
    }
    setTracking(true);
    setMsg("내 위치를 찾는 중…");
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, () => {
      stopTracking();
      setMsg("위치 권한이 필요해요. 위치 허용 후 다시 시도해주세요.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  const PROOF_LABEL: Record<PhotoKind, string> = {
    receipt: "영수증",
    menu: "메뉴판",
  };

  /** 현장 카메라로 찍은 사진 → 리사이즈 → AI 검증+첨부 (/proof). 위치 인증 후에만 가능 */
  async function onPickProof(kind: PhotoKind, file: File | undefined) {
    if (!file) return;
    if (!locVerified) {
      setMsg("먼저 위치 인증을 해주세요. 인증 후 현장 사진을 찍어 올릴 수 있어요.");
      return;
    }
    setBusy(kind);
    setMsg(`${PROOF_LABEL[kind]} 확인 중…`);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setPreviews((p) => ({ ...p, [kind]: dataUrl }));
      const res = await fetch(`/api/posts/${postId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, image: dataUrl }),
      });
      const d = await res.json().catch(() => ({}));
      setBusy(null);
      if (res.ok && d.ok) {
        setAttached((a) => ({ ...a, [kind]: true }));
        setMsg(`${PROOF_LABEL[kind]} 인증 완료!${d.awardedXp ? ` 현재 +${d.awardedXp} XP` : ""}`);
        router.refresh();
      } else {
        // 검증 실패 — 미리보기 제거하고 사유 안내
        setPreviews((p) => ({ ...p, [kind]: null }));
        setMsg(d.reason || "사진 인증에 실패했어요. 실제 현장 사진으로 다시 시도해주세요.");
      }
    } catch {
      setBusy(null);
      setPreviews((p) => ({ ...p, [kind]: null }));
      setMsg("사진 처리에 실패했어요. 다시 시도해주세요.");
    }
  }

  return (
    <section className="card p-4">
      <h3 className="mb-1 text-sm font-extrabold text-ink">방문 인증하기</h3>
      <p className="mb-1 text-[12px] text-ink-muted">
        인증은 내 기록에만 적용돼요. 위치 인증은 가게 50m 이내에서 자동으로 됩니다.
      </p>

      <div className="divide-y divide-stone-100">
        {/* 위치 인증 (강) */}
        <div className="py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <MapPin size={16} className="text-forest" /> 위치 인증
            </span>
            {locVerified && (
              <span className="flex items-center gap-0.5 text-xs font-bold text-forest">
                <Check size={14} /> 인증됨
              </span>
            )}
          </div>
          {hasCoords && (
            <>
              <KakaoMap
                center={{ lat: restaurant!.lat!, lng: restaurant!.lng! }}
                name={restaurant!.name}
                userLoc={userLoc}
                thresholdMeters={LOCATION_THRESHOLD_METERS}
                height={180}
                className="mb-2"
              />
              {/* 실시간 거리 표시 (추적 중) */}
              {tracking && !locVerified && liveDist != null && (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm">
                  <span className="text-ink-muted">현재 가게에서</span>
                  <span className="font-bold tabular-nums text-forest">
                    {liveDist}m
                    {accuracy != null && (
                      <span className="ml-1 font-normal text-stone-400">±{Math.round(accuracy)}m</span>
                    )}
                  </span>
                </div>
              )}
            </>
          )}
          {!locVerified &&
            (tracking ? (
              <button onClick={stopTracking} className="btn-ghost h-10 w-full !text-sm">
                추적 멈추기
              </button>
            ) : (
              <button
                onClick={startTracking}
                disabled={!hasCoords}
                className="btn-outline h-10 w-full !text-sm"
              >
                <Navigation size={15} /> 현재 위치로 인증 (50m 이내)
              </button>
            ))}
          {!hasCoords && !locVerified && (
            <p className="mt-1 text-[11px] text-stone-400">
              이 가게는 좌표가 없어 위치 인증이 아직 불가해요. (장소 검색으로 등록 시 가능)
            </p>
          )}
        </div>

        {/* 추가 증거 — 현장 카메라 촬영만, 위치 인증 후에만 활성 */}
        {PHOTO_ROWS.map(({ kind, label, Icon, xp, hint }) => (
          <div key={kind} className="py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Icon size={16} className="text-forest" /> {label}
                <span className="font-normal text-stone-400">+{xp} XP</span>
              </span>
              {attached[kind] && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-forest">
                  <Check size={13} /> 인증됨
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {previews[kind] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[kind]!} alt={label} className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <label
                  className={`flex h-14 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold ${
                    locVerified
                      ? "border-forest/30 bg-forest-soft/40 text-forest active:scale-[0.99]"
                      : "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-300"
                  }`}
                >
                  <Camera size={16} />
                  {busy === kind ? "확인 중…" : "카메라로 촬영"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={!locVerified || busy === kind}
                    onChange={(e) => onPickProof(kind, e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
              )}
              {!previews[kind] && <span className="flex-1 text-[11px] text-stone-400">{hint}</span>}
            </div>
          </div>
        ))}
      </div>

      {!locVerified && (
        <p className="mt-2 text-[12px] font-medium text-stone-500">
          음식·가게 전경 사진은 등록 사진으로 올려주세요. 별도 음식 사진 인증은 사용하지 않아요.
        </p>
      )}

      <p className="mt-2 text-[11px] text-stone-400">
        영수증은 가게명·날짜를 AI가 확인해요. 메뉴판은 위치 인증 후 현장 카메라로만 첨부합니다.
      </p>
      {msg && <p className="mt-1.5 text-[13px] font-medium text-forest">{msg}</p>}
    </section>
  );
}
