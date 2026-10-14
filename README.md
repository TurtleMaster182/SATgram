# SATflow

An Android study app that turns a spare minute into a short SAT practice session.

Install **SATflow.apk** on Android 8.0 or later. Allow installation from the app used to open the APK when Android asks. No account, advertising, analytics, or subscription is required.

- 240 original SAT-style exercises are available immediately offline: math, grammar, vocabulary, evidence, and inference.
- Eight official current-format practice tests supply 960 indexed question cards with answer checking. Select a test under **Source**, or start it from **Test library**. The first question downloads the original test PDF; the first explanation downloads its companion PDF. Downloaded files stay in private app storage and then work offline.
- Official example questions and two older released SAT tests are available in the full PDF reader. Extra personal PDFs can be imported with Android's document picker.
- Daily targets, bookmarks, mistake review, local progress, JSON export/restore, and 10-question stopping points support manageable practice.
- Correctly answered cards are scheduled for review after 1, 3, 7, then 14 days. Incorrect cards remain available in mistake review. Repeats and skips do not pretend to be new mastery.

## Source coverage

The internet collection was verified on **October 14, 2026**. Official practice PDFs 4–11 are current public publisher resources. Legacy practice tests 9 and 10 are original College Board resources hosted on Khan Academy's original CDN. The official digital SAT examples are included as a source link/reader entry.

This is **not a complete archive of every SAT administered during 2016–2026**. Many real tests were never publicly released. Resource years are their publication/copyright years, not assumed test dates. No missing year is invented, and unavailable legacy links are not represented as downloaded or indexed questions.

The older full tests use the previous SAT format. Current PDF tests use digital-format questions in a **nonadaptive paper format**; their question counts differ from the adaptive Bluebook exam. Practice accuracy in SATflow is **not an estimated SAT score**. Use an official adaptive Bluebook test to rehearse the current exam experience.

Official sources:

- https://satsuite.collegeboard.org/practice/practice-tests/paper
- https://satsuite.collegeboard.org/practice/practice-tests
- https://satsuite.collegeboard.org/media/pdf/digital-sat-sample-questions.pdf
- https://cdn.kastatic.org/KA-share/sat/sat-practice-test-9.pdf
- https://cdn.kastatic.org/KA-share/sat/sat-practice-test-10.pdf

Every indexed official card includes its source, module, number, page coordinates, factual answer key, and original explanation page. The APK and source archive **do not contain official copyrighted question text or PDF bytes**. Android obtains selected PDFs directly from their original hosts for personal practice and checks SHA-256 hashes before rendering. If the publisher changes a PDF, the reader refuses to use mismatched question coordinates and offers the original source link instead.

Official explanation cards show the source explanation page, which may include adjacent answers. Personal imported PDFs support page reading; automatic question extraction and answer checking are available only for the eight indexed tests.

SAT is a College Board trademark. This independent app is not endorsed by College Board. Public availability does not grant redistribution rights to official test materials.

## Build

The app is plain Java with an embedded HTML/CSS/JavaScript interface and uses no third-party Android dependencies.

### Android Studio

Open this folder, use JDK 17, install Android SDK 35, and run the `app` module. Gradle 8.11.1 is compatible with the configured Android Gradle Plugin 8.9.2. A Gradle wrapper is not bundled; Android Studio can use a local Gradle installation, or run `gradle wrapper --gradle-version 8.11.1` before `./gradlew assembleDebug`.

Before building after changes to the web UI, synchronize the files in `dist/` into `app/src/main/assets/`, or use the SDK-only script below, which handles that step.

### SDK-only build

Install `platforms;android-35` and `build-tools;35.0.0` using the Android SDK Manager, then:

```sh
export ANDROID_SDK_ROOT=/path/to/android-sdk
bash build-apk.sh
```

The script creates a signed development APK at `dist/SATflow.apk`. `SATFLOW_KEYSTORE` can select the existing development keystore so later builds update the same installation. `SATFLOW_BUILD_TOOLS` and `SATFLOW_ANDROID_JAR` can override SDK paths.

The delivered APK uses a development signing certificate. A rebuilt APK signed with another certificate requires uninstalling the previous build first; export progress before doing so. The source bundle includes this development key at `signing/satflow-debug.keystore` (development password: `android`). Set `SATFLOW_KEYSTORE` to that path when rebuilding to retain update compatibility. Do not use this development key for Play Store publication.

## Development and verification

`generate_practice.py` creates the deterministic original question bank. The official index contains metadata only. `index-official-pdfs.py` rebuilds it from verified source PDFs placed in a local `pdf/` folder; PyMuPDF is required only for index maintenance. The PDFs are deliberately excluded from the project. `tests/core.test.js` checks numerical answers, spaced review, history validation, and progress persistence. Run `node --test tests/core.test.js`.

The website is a responsive companion preview containing the original bank and official source links. The native bridge is needed to render official PDF cards because browsers cannot assume cross-origin PDF download permission. The web version caches original practice after the first visit using a service worker. Android includes those exercises and assets directly.

Only the local `https://satflow.local/` asset origin can use the Android bridge. External sites open in the normal browser. Downloads accept only the fixed HTTPS publisher/CDN hosts, enforce size limits, and verify fingerprints. Imported PDFs use the Android document picker. Progress files are validated before replacing device data.

No Android emulator or physical device was available during creation. The APK was compiled and its Android manifest, DEX payload, assets, and signatures were verified. Simulated DOM checks covered both preview and native UI flows, including source selection, answer gating, explanations, bookmarks, sessions, and the reader. Sample question crops were rendered from the verified PDFs for visual inspection. Browser visual QA was unavailable. Runtime Android PDF rendering and document-picker flows still need a first installation check on a device.
