float getLevel() {
    float max = 0.0;
    for (int x = 0; x < 512; x++) {
        float value = texelFetch(iChannel0, ivec2(x, 1), 0).x;
        value = abs(value - 0.5) * 2.0;
        if (value > max) max = value;
    }
    return max;
}

float decay = 0.25;

void mainImage(out vec4 color, in vec2 coord) {
    vec2 uv = coord / iResolution.xy;
    float level = getLevel() / decay;
    vec4 newColor = vec4(level);
    vec4 oldColor = texture(iChannel1, vec2(0.0, 0.0));
    color = mix(newColor, oldColor, 1.0 - decay);
}