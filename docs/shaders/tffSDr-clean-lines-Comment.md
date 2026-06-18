Thank you for this shader! It's been on my screen the entire day but for a completely different reason  I was interested in some shaders but also in the performance and optimizing them for raw power. So i made a tool in AI, as one does, to build shaders exactly like here on toy with the sole purpose to run a tight AI optimization loop. Yours was my "victim" 

Here's the exact same shader 4x faster! For the numbers, your original shader ran in about 2ms on my hardware and when converted as GLSL shader. After ~14 iterations and a whole day of building my new tool it went down to a shader runtime of just ~0.5ms

It's funny how it did that. First it made things compacter and inlining, then it changed algorithms around from the shader SFU unit to the cheaper and faster ALU unit.

```
#version 330 core

out vec4 fragColor;

#define PI 3.14159265

void main()
{
    vec2 coord = gl_FragCoord.xy;
    vec2 uv = (2.0 * coord - iResolution.xy) / iResolution.y;

    float ax = abs(uv.x);
    float ax2 = ax * ax;
    float ax4 = ax2 * ax2;
    float ax8 = ax4 * ax4;
    float powUvX = 0.001 * ax8;

    float thick = 0.01 + powUvX;

    vec3 color = vec3(0.0);

    float absUvY = abs(uv.y);
    if (absUvY < 0.5 + thick) {

        float sinA = sin(2.0 * PI * (0.5 * uv.x - 0.5 * iTime));
        float cosA = cos(2.0 * PI * (0.5 * uv.x - 0.5 * iTime));
        float sinW = sin(2.0 * uv.x - 2.0 * iTime);
        float cosW = cos(2.0 * uv.x - 2.0 * iTime);

        float sT = sin(0.2 * iTime);
        float cT = cos(0.2 * iTime);

        float sT2 = sT * sT;
        float sinL = sT * (5.0 + sT2 * (16.0 * sT2 - 20.0));
        float cT2 = cT * cT;
        float cosL = cT * (5.0 + cT2 * (16.0 * cT2 - 20.0));

        vec3 sinV = vec3(sinA, sinW, sinL);
        vec3 cosV = vec3(cosA, cosW, cosL);
        vec3 cdV = vec3(cos(2.0 * PI * 0.1), cT, 0.99500417);
        vec3 sdV = vec3(sin(2.0 * PI * 0.1), sT, 0.099833417);

        vec3 cdp = vec3(cos(2.0*PI*0.1), cos(2.0*PI*0.4), cos(2.0*PI*0.5));
        vec3 sdp = vec3(sin(2.0*PI*0.1), sin(2.0*PI*0.4), sin(2.0*PI*0.5));

        float oneMinusLayer = 1.0;
        float invThick = 1.0 / thick;
        for (float layer = 0.0; layer < 1.0; layer += 0.1) {
            float amp = 0.25 + 0.25 * sinV.z * oneMinusLayer;

            float y = uv.y + amp * sinV.y;
            float absY = abs(y);
            if (absY < thick) {
                vec3 hue = vec3(0.5) + vec3(0.5) * (cosV.x * cdp - sinV.x * sdp);
                float x = 1.0 - absY * invThick;
                float bright = x * x * (3.0 - 2.0 * x);
                color += bright * hue;
            }

            vec3 newSinV = sinV * cdV + cosV * sdV;
            vec3 newCosV = cosV * cdV - sinV * sdV;
            sinV = newSinV;
            cosV = newCosV;

            oneMinusLayer -= 0.1;

            // Early exit: if remaining iterations can't produce visible waves
            // max remaining |amp| <= 0.25 + 0.25 * oneMinusLayer
            // if |uv.y| >= maxAmpRemaining + thick, no remaining wave visible
            float maxAmpRemaining = 0.25 + 0.25 * oneMinusLayer;
            if (absUvY >= maxAmpRemaining + thick) break;
        }
    }
    fragColor = vec4(color, 1.0);
}
```