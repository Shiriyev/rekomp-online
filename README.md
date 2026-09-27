# Рекомп

Offline, single-user Android nutrition app for body recomposition. See `docs/PLAN.md` for the full spec.

## Commands

```bash
npm install
npm run android      # dev build (expo run:android), requires JDK 17 + Android SDK
npm start            # Metro for an installed dev build
npm run typecheck && npm run lint && npm test
npx eas-cli@latest build -p android --profile preview   # installable APK
```

## Layout

Routes live in `src/app/` (Expo Router default for SDK 57); everything else follows `docs/PLAN.md` §2 under `src/`.
