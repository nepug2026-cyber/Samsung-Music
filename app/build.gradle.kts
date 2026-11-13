plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.retrosound.one"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.retrosound.one"
        minSdk = 29
        targetSdk = 35
        versionCode = 10
        versionName = "1.0.0-rc1"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}
dependencies {
    implementation("androidx.media3:media3-exoplayer:1.8.0")
    implementation("androidx.media3:media3-session:1.8.0")
    implementation("com.google.guava:guava:33.4.0-android")
}
