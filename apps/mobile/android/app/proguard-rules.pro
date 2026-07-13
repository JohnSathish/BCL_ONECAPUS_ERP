# Add project specific ProGuard rules here.
# Appended to the default Android ProGuard/R8 config from build.gradle.

# Keep line numbers for crash stacks (still obfuscate class/method names).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# --- React Native / Hermes / TurboModules ---
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# --- Reanimated / Gesture Handler (common RN keep set) ---
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# --- Expo modules ---
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**

# --- Firebase / Play Services (FCM via google-services + expo-notifications) ---
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# --- Razorpay (WebView JS bridge) ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-keepclasseswithmembers class * {
    public void onPayment*(...);
}
-optimizations !method/inlining/

# OkHttp / Okio (transitively used)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# @generated begin expo-build-properties - expo prebuild (DO NOT MODIFY)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-keepclasseswithmembers class * { public void onPayment*(...); }
-optimizations !method/inlining/
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
# @generated end expo-build-properties