# 먹고핀 앱스토어 등록 가이드 (Capacitor)

웹앱(Next.js, Vercel)을 네이티브 앱으로 감싸 스토어에 올리는 방법.
현재 방식: 네이티브 WebView가 라이브 주소(`https://matzip-psi-nine.vercel.app`)를 띄움.
→ 코드 수정/배포는 평소처럼 Vercel에 push 하면 앱에도 바로 반영됨 (앱 재배포 불필요).

준비 완료된 것(윈도우에서): Capacitor 설치, `capacitor.config.ts`, 아이콘/매니페스트.
남은 건 **맥(아이폰)** / **윈도우·맥(안드로이드)** 에서 네이티브 빌드뿐.

---

## 🍎 아이폰 (App Store) — 맥 + Xcode 필요

준비물: 맥북, Xcode(맥 앱스토어 무료), Apple 개발자 계정 $99/년, Node.js

```bash
# 1) 프로젝트 받기
git clone https://github.com/a43424685-hash/matzip.git
cd matzip
npm install

# 2) iOS 네이티브 프로젝트 생성 + 동기화
npx cap add ios
npx cap sync ios

# 3) Xcode 열기
npx cap open ios
```

Xcode에서:
1. 좌측 프로젝트 → Signing & Capabilities → Team에 본인 Apple 개발자 계정 선택
2. Bundle Identifier 확인 (`com.codebueok.mukgopin`, 중복이면 변경)
3. 실기기/시뮬레이터로 실행해 동작 확인
4. Product → Archive → Distribute App → App Store Connect 업로드
5. [App Store Connect](https://appstoreconnect.apple.com) 에서 앱 정보·스크린샷·개인정보 입력 → 심사 제출

⚠️ 애플 반려 주의: "그냥 웹 감싼 앱"은 반려될 수 있음(규정 4.2). 푸시 알림 등 네이티브 기능을 넣으면 통과율↑ (필요 시 요청).
맥이 없으면: Codemagic / Expo EAS 같은 클라우드 빌드 서비스로 대체 가능(유료·복잡).

---

## 🤖 안드로이드 (Play Store) — 맥 불필요, 더 쉬움

준비물: 윈도우/맥, Android Studio, Google Play 개발자 계정 $25(1회), Node.js

```bash
npx cap add android
npx cap sync android
npx cap open android   # Android Studio 열림
```

Android Studio에서 Build → Generate Signed Bundle (.aab) → [Play Console](https://play.google.com/console) 업로드 → 앱 정보 입력 → 심사.

> 더 쉬운 대안: [PWABuilder.com](https://www.pwabuilder.com) 에 주소 넣으면 안드로이드 패키지(.aab)를 자동 생성해줌 (이미 PWA 매니페스트 있음).

---

## 코드 바뀌면?
`server.url` 방식이라 **Vercel에 push만 하면 앱에도 자동 반영**. 네이티브 재빌드는 아이콘/설정/네이티브 기능 바뀔 때만.
