# Mobile App Store Submission Checklist

Checklist for submitting Ajosave to the Apple App Store and Google Play Store.

---

## Pre-Build

- [ ] `capacitor.config.ts` — confirm `appId` (`app.ajosave`), `appName`, and `webDir` (`out`)
- [ ] `next.config.mjs` — add `output: 'export'` and `trailingSlash: true` for static export
- [ ] Run `npm run build` and verify the `out/` directory is generated
- [ ] Run `npx cap sync` to copy web assets and plugins to native projects
- [ ] App icons generated (1024×1024 PNG, no alpha) — place in `public/icons/`
- [ ] Splash screens generated for all required sizes
- [ ] Privacy Policy URL ready (required by both stores)
- [ ] Terms of Service URL ready

---

## iOS (App Store)

### Setup
- [ ] Xcode 15+ installed on macOS
- [ ] Apple Developer account enrolled ($99/year)
- [ ] Bundle ID registered in Apple Developer portal: `app.ajosave`
- [ ] App record created in App Store Connect

### Certificates & Provisioning
- [ ] Distribution certificate created and installed
- [ ] App Store provisioning profile created and downloaded
- [ ] Push Notifications capability enabled in Xcode (for APNs)
- [ ] APNs key (.p8) uploaded to Firebase / your push provider

### Build
- [ ] `npx cap open ios` — opens Xcode
- [ ] Set signing team and provisioning profile in Xcode
- [ ] Increment build number (`CFBundleVersion`) for each submission
- [ ] Archive build: **Product → Archive**
- [ ] Validate archive in Xcode Organizer
- [ ] Upload to App Store Connect via Xcode Organizer

### App Store Connect
- [ ] App name, subtitle, description filled in
- [ ] Keywords set (max 100 chars)
- [ ] Screenshots uploaded for iPhone 6.7", 6.5", iPad Pro 12.9" (if supporting iPad)
- [ ] App preview video (optional)
- [ ] Age rating questionnaire completed
- [ ] Category: Finance
- [ ] Privacy nutrition labels completed (data collection disclosure)
- [ ] Review notes added (test account credentials if login required)
- [ ] Submit for review

---

## Android (Google Play)

### Setup
- [ ] Android Studio installed
- [ ] Google Play Developer account enrolled ($25 one-time)
- [ ] App created in Google Play Console: `app.ajosave`

### Signing
- [ ] Keystore file generated and stored securely (never commit to git)
- [ ] `android/app/build.gradle` configured with signing config
- [ ] FCM (Firebase Cloud Messaging) configured for push notifications
- [ ] `google-services.json` placed in `android/app/`

### Build
- [ ] `npx cap open android` — opens Android Studio
- [ ] Increment `versionCode` in `android/app/build.gradle` for each release
- [ ] Build signed AAB: **Build → Generate Signed Bundle/APK → Android App Bundle**
- [ ] Test AAB on physical device or emulator

### Google Play Console
- [ ] App name, short description, full description filled in
- [ ] Screenshots uploaded (phone, 7" tablet, 10" tablet)
- [ ] Feature graphic (1024×500 PNG)
- [ ] App icon (512×512 PNG)
- [ ] Content rating questionnaire completed
- [ ] Category: Finance
- [ ] Data safety form completed (what data is collected and why)
- [ ] Target audience and content settings configured
- [ ] Release to Internal Testing track first, then promote to Production
- [ ] Submit for review

---

## Post-Submission

- [ ] Monitor crash reports (Sentry is already integrated)
- [ ] Respond to store review feedback within 24h
- [ ] Tag the release in git: `git tag v1.0.0-mobile`
- [ ] Update `CHANGELOG.md` with mobile release entry
