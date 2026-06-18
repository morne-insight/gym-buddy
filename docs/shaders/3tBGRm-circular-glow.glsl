#define PI 3.14159265

// --------------------------------------------------------
// Color palette
// --------------------------------------------------------
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.1, 0.4, 0.5);
    return a + b * cos(2.0 * PI * (c * t + d));
}

// --------------------------------------------------------
// Wave shape
// --------------------------------------------------------
vec4 wave(vec2 uv, float amp, float freq, float phase, float thick, vec3 hue) {
    float x = uv.x - phase;
    float y = uv.y + amp * sin(freq * x);
    float bright = smoothstep(0.0, 1.0, 1.0 - abs(y) / thick);
    return vec4(vec3(bright) * hue, 1.0);
}

// --------------------------------------------------------
// Audio helpers (iChannel0 = microphone sound texture)
// y = 0: waveform L, y = 1: waveform R, y = 2: FFT
// --------------------------------------------------------
float sampleFFT(float normBin) {
    normBin = clamp(normBin, 0.0, 1.0);
    float x = normBin * 511.0;              // 512 bins
    return texelFetch(iChannel0, ivec2(int(x), 2), 0).x;
}

// Slightly smoothed band around a center bin
float sampleFFTBand(float center, float radius) {
    center = clamp(center, 0.0, 1.0);
    radius = max(radius, 0.0);

    float sum = 0.0;
    float wsum = 0.0;

    // small kernel over neighboring bins
    for (int i = -4; i <= 4; i++) {
        float offs = float(i) / 4.0; // [-1,1]
        float b = clamp(center + offs * radius, 0.0, 1.0);
        float w = 1.0 - abs(offs);   // triangular weights
        sum  += sampleFFT(b) * w;
        wsum += w;
    }

    return (wsum > 0.0) ? sum / wsum : 0.0;
}

// Overall low-frequency level (for subtle global motion)
float getLowLevel() {
    float sum = 0.0;
    int N = 32; // focus on bass/low mids
    for (int i = 0; i < N; i++) {
        float b = float(i) / float(N - 1); // [0,1]
        sum += sampleFFT(b);
    }
    return sum / float(N);
}

// --------------------------------------------------------
// Main
// --------------------------------------------------------
void mainImage(out vec4 color, in vec2 fragCoord) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

    color = vec4(0.0);

    const int LAYERS = 10;
    float lowLevel = getLowLevel();

    for (int i = 0; i < LAYERS; i++) {
        float layer = float(i) / float(LAYERS - 1); // 0..1

        // Map layers to frequency bands (log-ish: more detail in bass)
        float bandPos = pow(layer, 2.0); // bias towards low frequencies
        float bandRadius = mix(0.01, 0.08, layer);

        float fft = sampleFFTBand(bandPos, bandRadius);

        // Shape the FFT a bit for visual impact
        float energy = pow(clamp(fft * 120.0, 0.0, 1.0), 1.2);

        // Audio-reactive parameters per layer
        float baseAmp  = 0.15 + 0.15 * sin(iTime + layer * 2.0) * (1.0 - layer);
        float amp      = baseAmp * (0.5 + energy * 3.0);

        float baseFreq = 2.0 + 3.0 * layer;
        float freq     = baseFreq * (1.0 + energy * 2.0);

        float phase    = iTime * (1.0 - 0.4 * layer) + energy * 2.0;

        float thick    = 0.01 + 0.001 * pow(abs(uv.x), 8.0);
        thick         *= 1.0 + energy * 1.5;

        // Color: mix position, time, layer, and band energy
        float t = 0.5 * uv.x + layer * 1.2 - 0.4 * iTime + energy * 2.5;
        vec3 hue = palette(t);

        // Slight global breathing from low frequencies
        float globalWarp = 1.0 + lowLevel * 2.0;
        vec2 uvWarped = vec2(uv.x, uv.y * globalWarp);

        color += wave(uvWarped, amp, freq, phase, thick, hue);
    }

    // Optional: soft vignette
    float r = length(uv);
    float vignette = smoothstep(1.2, 0.4, r);
    color.rgb *= vignette;
}
