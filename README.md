# 맛집 레벨업 (Matzip LevelUp) — MVP

> 내 맛집 지도를 키우고, 진짜 맛집을 잘 아는 사람으로 레벨업하는 소셜 맛집 앱.

`FOOD_APP_SPEC.md` 기준으로 시작한 앱입니다. 사용자 → 맛집등록 → 위치/영수증/메뉴 인증 → XP → 레벨 → 랭킹 루프 + 소셜/검색을 구현했고, **카카오 로그인, 사진/영상 업로드(Supabase Storage), 유료 맛집지도 결제·정산(PortOne), PWA**까지 실제 동작합니다. Vercel + Supabase에 배포 운영 중입니다.

---

## 1. 명세 요약 (핵심)

- 단순 맛집 검색이 아니라 **게임화된 소셜 맛집 앱**. 등록/반응으로 XP를 얻어 레벨업.
- 레벨은 2종: **전체 레벨** + **지역 레벨**(17개 시도). 둘 다 만렙 Lv.200.
- 랭킹 3종: **전체**(전체 레벨순 TOP50), **지역**(지역 레벨순 TOP50), **이번 주 인기 맛집**(음식점 반응 점수 TOP50).
- 카테고리는 음식 종류가 아니라 **"가고 싶은 이유"**(가성비/야장/노포/데이트/비 오는 날/미슐랭 …) 중심.
- 사장님 홍보/광고는 **일반 랭킹·XP와 완전 분리**.

## 2. 구현 범위 (MVP)

| 구분 | 상태 |
|---|---|
| 회원가입/로그인 | ✅ 이메일+비번(쿠키 세션) + **카카오 OAuth** |
| 맛집 등록 + XP 지급 | ✅ 구현 |
| 전체/지역 XP·레벨 | ✅ 구현 |
| 좋아요 / 저장 (+멱등/어뷰징 한도) | ✅ 구현 |
| 랭킹 3종 | ✅ 캐시(RankingCache, cron 갱신) 우선 read |
| 검색(지역+카테고리+가격+정렬) | ✅ 구현 |
| 내 지도(프로필) | ✅ 구현 |
| 사진/영상 | ✅ **Supabase Storage 업로드**, `media.type = image\|video` |
| 방문 인증 | ✅ 위치(GPS 50m) + 영수증/메뉴(AI 검증), 인증 게이트로 XP 해제 |
| 유료 맛집지도(크리에이터) | ✅ 판매자격·맛보기·구매·결제(**PortOne V2**)·정산·출금 |
| 사장님 홍보(owner_promotions) | 🔒 데이터 구조 + 상세페이지 분리 노출만 |
| 랭킹 캐시 테이블 | ✅ `rankings_cache` + cron 갱신, read는 캐시 우선 |

## 3. 기술 스택 / 폴더 구조

- **Next.js 15 (App Router) + TypeScript** / **TailwindCSS** / **Prisma 6 + Supabase Postgres**
- 인프라: **Vercel**(호스팅) · **Supabase**(Postgres + Storage) · **카카오 OAuth**(로그인) · **PortOne V2**(결제) · **Resend**(메일, 선택) · **PWA**(설치형)
- 스키마 변경은 `npm run db:push`로 Supabase에 반영(마이그레이션 폴더 없이 db push 방식).

```
prisma/
  schema.prisma        # 전체 데이터 모델
  seed.ts              # 17개 시도 + 카테고리 48개
scripts/smoke.ts       # 핵심 루프 검증 스크립트 (npm run smoke)
src/
  lib/
    db.ts              # Prisma 싱글톤
    auth.ts            # 세션/비밀번호
    labels.ts          # UI 라벨 (가격대/재방문/정렬)
  server/
    xp/
      xpRules.ts       # XP 지급표·가중치·어뷰징 한도 (밸런스는 여기만 수정)
      LevelService.ts  # 레벨 공식 (Lv.200) / 진행률
      XpService.ts     # awardXp() — 멱등 + 전체/지역 동시 적립 + 로그
    ranking/
      RankingService.ts# 랭킹 3종 + 캐시 refresh 골격
    restaurant/
      RestaurantService.ts # 등록/좋아요/저장/검색
    catalog.ts         # 지역/카테고리 조회
  components/          # BottomNav, LevelBar, PostCard, LikeSaveButtons, RegisterForm
  app/                # 라우트 (home, search, register, restaurants/[postId], rankings, me, login, signup)
    actions/          # 서버 액션 (auth, post)
    api/{like,save}/  # 좋아요/저장 토글 라우트 핸들러
```

## 4. 데이터 모델 핵심

`User`, `Region`, `UserRegionStat`(지역 랭킹 기준), `Restaurant`(primary_region 필수), `RestaurantPost`,
`Media`(image/video), `Category`(DB seed) + `RestaurantPostCategory`, `Like`(user×post 유니크), `Save`(user×restaurant 유니크),
`XpEvent`(모든 XP 로그 + `dedupeKey` 멱등), `RankingCache`, `OwnerPromotion`(랭킹/XP 무관).

## 5. 핵심 화면

하단 탭 5개: **홈 / 검색 / 등록 / 랭킹 / 내 지도**
- 홈: 내 레벨바, 카테고리 바로가기, 이번 주 인기 맛집, 최신 맛집 피드
- 등록: 음식점명·지역·카테고리(필수) + 사진/영상/리뷰/가격/웨이팅/재방문 → 완료 시 +XP 보상 화면
- 랭킹: 전체 / 지역(시도 선택) / 이번 주 인기(전국·지역 필터) 탭
- 상세: 미디어/카테고리/리뷰/반응/지도열기 + **사장님 홍보(광고 라벨, 분리)**
- 내 지도: 전체 레벨 + 지역별 레벨 + 내가 등록/저장한 맛집

## 6. 실행 방법

```bash
npm install
npm run db:push     # Supabase Postgres 스키마 동기화 (.env DATABASE_URL 필요)
npm run db:seed     # 17개 시도 + 카테고리 시드
npm run smoke       # (선택) 핵심 루프 검증 + 데모 유저/맛집 데이터 생성
npm run dev         # http://localhost:3000
npm run build       # 프로덕션 빌드 (next build만 실행)
```

> **빌드 ↔ Prisma Client 생성 분리**: `npm run build` 는 `next build` 만 실행합니다.
> Prisma Client 생성(`prisma generate`)은 **`postinstall`(npm install 시) 또는 `npm run prisma:generate`** 로 분리했습니다.
> 이렇게 한 이유: dev 서버가 켜진 상태에서 `prisma generate` 가 돌면 Windows 에서 query engine DLL 이 잠겨
> `EPERM rename query_engine-windows.dll.node` 로 빌드가 실패하기 때문입니다. 이제 **서버가 켜져 있어도 `npm run build` 가 됩니다.**
> (스키마를 바꾼 경우에만 서버를 끄고 `npm run prisma:generate` 를 한 번 실행하세요.)

> ⚠️ **프로덕션 빌드는 NTFS 드라이브에서 하세요.**
> `next build`의 모듈 경로 해석은 `fs.readlink`(realpath)를 호출하는데, **exFAT/FAT 드라이브는 심볼릭링크/reparse-point를 지원하지 않아 `readlink EISDIR` 오류로 빌드가 실패**합니다.
> 저장소가 exFAT 드라이브에 있으면 NTFS 경로(예: `C:\matzip`)로 복사해서 빌드하세요:
> ```bash
> robocopy <소스경로> C:\matzip /E /XD node_modules .next
> cd C:\matzip && npm install && npm run build && npm start
> ```
> 비-ASCII 폴더명 자체는 빌드에 문제가 없습니다. **dev 서버·smoke·tsc·lint 는 exFAT에서도 정상 동작**합니다 — 빌드만 NTFS가 필요합니다.

## 7. 수동 검증 가이드

1. `/signup` 에서 가입 → 홈에서 내 레벨바(Lv.1) 확인.
2. `/register` 에서 맛집 등록(사진 업로드 + 한줄평 + 카테고리 3개 + 가격/재방문) → **미인증이라 XP 0(보류)**. 상세에서 **위치 인증** 시 보류 XP 일괄 해제(≈460 XP).
3. `/me` 에서 전체 레벨 상승 + 해당 **지역 레벨**이 따로 생긴 것 확인.
4. 다른 지역 맛집을 하나 더 등록 → 지역 레벨이 **독립적으로** 오르는지 확인.
5. 두 번째 계정으로 로그인 → 첫 계정 글에 **좋아요/저장** → 첫 계정 XP가 +10/+25 되는지(`/me`).
6. 같은 글에 좋아요를 **껐다 켜도** XP가 다시 오르지 않는지(멱등) 확인.
7. `/rankings` 전체/지역/이번 주 인기 탭에서 각각 데이터 확인.
8. `/search?sort=weekly` 등 필터/정렬 동작 확인.

자동 검증: `npm run smoke` 는 위 1~7을 코드로 단언(assert)합니다. (마지막 실행: **모든 테스트 통과**)

### Phase 2 추가 QA (모바일 폭 390px 기준)

9. **등록 UX**: `/register` 에서 추천 태그(야장/노포/가성비…) 칩을 누르면 즉시 채워지고, 하단 고정바의 **"예상 획득 +N XP"** 가 입력에 따라 실시간으로 바뀌는지. 필수는 음식점명·지역·카테고리.
10. **등록 → 공유 루프**: 등록 완료 화면의 **"공유하고 자랑하기"** → `/share/[postId]` 에서 딥그린 공유 카드(가게명·지역·한줄평·카테고리·Lv·워터마크)가 보이고, "공유하기"(모바일=네이티브 공유 시트) / "이미지 저장"(PNG 다운로드)이 동작하는지.
11. **사진 유무 카드 분리**: 홈/검색 피드에서 사진 있는 맛집=큰 이미지 카드, 사진 없는 맛집=작은 텍스트 카드. 이미지 URL이 깨져도 **큰 빈 박스/깨진 이미지 대신 간판형 placeholder**.
12. **검색 연결**: 홈 카테고리 칩 → `/search?categoryIds=…` 로 해당 태그가 선택된 채 열리고, 검색 페이지에서 칩 클릭 시 즉시 토글(초록)되는지.
13. **상세 공유**: `/restaurants/[postId]` 하단 "이 맛집 공유하기" → 공유 카드 진입.

> 공유 카드 이미지 추출(`html-to-image`)은 외부 이미지를 쓰지 않는 브랜드 카드라 CORS 없이 안정적으로 PNG가 생성됩니다. 네이티브 파일 공유(`navigator.share({files}))`)는 모바일에서 동작하고, 데스크톱은 자동으로 이미지 다운로드로 폴백합니다.

## 8. XP/레벨/랭킹 설계 메모

- **XP는 `XpService.awardXp()` 한 곳에서만** 지급. 호출 시 `XpEvent` 로그 + 전체XP + 지역XP + 레벨 재계산을 항상 함께 수행.
- **멱등성**: `XpEvent.dedupeKey` 유니크. 좋아요는 `like_received:{postId}:{likerId}` → 취소 후 재좋아요해도 재지급 없음.
- **어뷰징 한도**(`xpRules.ABUSE_LIMITS`): 하루 등록 기본 XP 10건, 같은 사람→같은 사람 좋아요 XP 하루 3건, 동일 음식점 중복 등록 기본 XP 없음, 셀프 좋아요/저장 XP 없음.
- **레벨 공식**: `requiredXpForNextLevel(level) = 150 + floor(level^1.5 * 40)`, 만렙 Lv.200 (`LevelService`).
- **랭킹** read는 `RankingCache`(cron 갱신) 우선 — 실시간 집계 쿼리와 분리해 읽기 부하를 캐시로 흡수.

자세한 가정/판단은 [`ASSUMPTIONS.md`](./ASSUMPTIONS.md) 참고.
