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
        versionCode = 16
        versionName = "1.4.0-test3-characters"
        // The report URL is public, but the email service key and mailbox stay SERVER-SIDE.
        val reportUrl = (System.getenv("RETROSOUND_DIAGNOSTICS_ENDPOINT") ?: "").trim()
        require(reportUrl.isEmpty() || reportUrl.matches(Regex("https://[A-Za-z0-9._:/?&=%-]+"))) {
            "RETROSOUND_DIAGNOSTICS_ENDPOINT must be an HTTPS URL"
        }
        buildConfigField("String", "DIAGNOSTICS_ENDPOINT", "\"$reportUrl\"")
    }
    buildFeatures { buildConfig = true }
    buildTypes {
        getByName("debug") {
            // Install the RC safely next to an existing 0.9 beta signed by a different key.
            applicationIdSuffix = ".v14diag"
        }
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
    implementation("androidx.work:work-runtime:2.10.2")
}
