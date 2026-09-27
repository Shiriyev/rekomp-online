# Рекомп

Offline, single-user Android nutrition app for body recomposition. See `docs/PLAN.md` for the full spec.

## Commands

```bash
npm install
npm run android      # dev build (expo run:android), requires JDK 17 + Android SDK
npm start            # Metro for an installed dev build
npm run typecheck && npm run lint && npm test
npm run test:coverage   # enforces 100% coverage of src/domain
npm run db:generate     # drizzle-kit migration after a schema change
```

JDK 17: `export JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=~/Library/Android/sdk`.

## Standalone APK (no Mac needed to run it)

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/release/app-release.apk
```

Without `-PreactNativeArchitectures` the APK contains all four ABIs (~120 MB). The local
release build is signed with the debug key (fine for your own phone). For a signed build in the
cloud: `npx eas-cli@latest build -p android --profile preview`.

## Photos

Dish and product photos come from Pexels and are bundled once:

```bash
echo 'PEXELS_API_KEY=<PEXELS_API_KEY>' >> .env.local   # gitignored, never commit the key
npm run images:fetch            # or -- --dry-run / -- --force
```

This writes `assets/images/**`, `ATTRIBUTION.md` and `src/features/images.ts`. Without photos the
app shows icon placeholders.

## Layout

Routes live in `src/app/` (Expo Router default for SDK 57); everything else follows
`docs/PLAN.md` §2 under `src/`: `domain/` (pure logic, 100% tested), `db/` (schema, migrations,
repositories, seed, backup), `features/`, `ui/`, `theme/`.
