vec3 palette(float t) {
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.0);
    vec3 d = vec3(0.1, 0.4, 0.5);
    return a + b * cos(2.0 * PI * (c * t + d));
}

vec4 wave(vec2 xy, vec4 color, float amp, float freq, float phase, vec3 hue, float strength) {
    strength = clamp(strength, 0.0, 1.0);
    float wave1a = _sin(phase + 0.4 * freq * xy.x);
    float wave1b = _sin(phase + 0.2 * freq * xy.x);
    float y = clamp(xy.y + amp * (wave1a + wave1b) / 2.0, -1.0, 1.0);
    float wave2a = _sin(phase + 0.2 * freq * xy.x);
    float wave2b = _sin(phase + 0.1 * freq * xy.x);
    float thicknessBalance = 0.5 * (wave2a + wave2b) / 2.0;
    thicknessBalance = 0.5 + _sin(0.25 * (iTime + xy.x)) * thicknessBalance;
    float topThickness = 0.5 * pow(1.0 - thicknessBalance, 3.0);
    float bottomThickness = 0.25 * pow(thicknessBalance, 3.0);
    topThickness = clamp(topThickness, 0.01, 1.0);
    bottomThickness = clamp(bottomThickness, 0.01, 1.0);
    float brightness = y > 0.0 ? 1.0 - y / topThickness : 1.0 + y / bottomThickness;
    brightness = clamp(brightness, 0.0, 1.0);
    brightness = pow(brightness, 5.0 - 4.0 * strength);
    return vec4(vec3(brightness) * hue, 1.0);
}

void mainImage(out vec4 color, in vec2 coord) {
    vec2 uv = (2.0 * coord - iResolution.xy) / min(iResolution.x, iResolution.y);
    vec2 mouse =
        iMouse.x == 0.0 && iMouse.y == 0.0 ?
            vec2(0.0, 0.0) :
            (2.0 * iMouse.xy - iResolution.xy) / iResolution.xy;
    color = vec4(0.0, 0.0, 0.0, 1.0);
    float level = texture(iChannel1, vec2(0.0)).x;
    float layers = 5.0;
    for (float layer = 0.0; layer < layers; layer += 1.0) {
        float z = 0.25 + layer * 0.05;
        vec3 xyz = vec3(uv, z);
        xyz = rotateX(xyz, 0.25 * mouse.y / 4.0);
        xyz = rotateY(xyz, 0.25 * mouse.x / 4.0);
        xyz = rotateZ(xyz, 0.025 * _sin(0.1 * iTime));
        vec2 xy = project(xyz, z);
        float percent = layer / layers;
        float amp = 0.1 + 0.1 * percent + 0.1 * level;
        float freq = 0.5 + 1.0 * percent;
        float phase = 0.1 * iTime - percent;
        vec3 hue = palette(0.4 * percent + 0.1 * xy.x - iTime / 5.0);
        float strength = 10.0 * level;
        vec4 layerColor = wave(xy, color, amp, freq, phase, hue, strength);
        float darken = tanh(xyz.z / 0.25);
        color += darken * layerColor;
    }
}
