package com.imtty.calculator;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.res.AssetManager;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.IOException;

/**
 * Instrumented tests, which run on a real Android device or emulator.
 *
 * <p>These verify the two things that are easy to break and impossible to
 * spot in a browser preview:
 *
 * <ol>
 *   <li>the application id is the one the Play Store listing points at, and</li>
 *   <li>the interface is genuinely bundled inside the APK — there is no
 *       development server and nothing to download at runtime.</li>
 * </ol>
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    @Test
    public void usesThePublishedApplicationId() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.imtty.calculator", appContext.getPackageName());
    }

    @Test
    public void bundlesTheWebAppLocally() throws IOException {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        AssetManager assets = appContext.getAssets();

        // The bundled interface lives under assets/public in the APK.
        assertTrue(
                "index.html should be bundled with the app",
                assets.open("public/index.html") != null);
        assertTrue(
                "the privacy policy should be bundled with the app",
                assets.open("public/privacy-policy.html") != null);
        assertTrue(
                "the launcher icon should be bundled with the app",
                assets.open("public/icons/pwa-512x512.png") != null);
    }
}
