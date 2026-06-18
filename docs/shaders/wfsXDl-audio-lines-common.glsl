#define PI 3.14159265

float _sin(float x) {
    return sin(2.0 * PI * x);
}

float _cos(float x) {
    return cos(2.0 * PI * x);
}

vec3 rotateX(vec3 v, float a) {
    return vec3(
        v.x,
        v.y * _cos(a) - v.z * _sin(a),
        v.z * _cos(a) + v.y * _sin(a)
    );
}

vec3 rotateY(vec3 v, float a) {
    return vec3(
        v.x * _cos(a) - v.z * _sin(a),
        v.y,
        v.z * _cos(a) + v.x * _sin(a)
    );
}

vec3 rotateZ(vec3 v, float a) {
    return vec3(
        v.x * _cos(a) - v.y * _sin(a),
        v.y * _cos(a) + v.x * _sin(a),
        v.z
    );
}

vec2 outOfBounds = vec2(-1.0, -1.0);

vec2 project(vec3 p, float d) {
    return 
        p.z > 0.0 ?
            vec2(p.x * d / p.z, p.y * d / p.z) :
            outOfBounds;
}
