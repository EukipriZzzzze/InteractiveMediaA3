// Main game flow: window sizing, pointer input, physics, camera movement, game reset, and the animation loop.

const cnv = document.getElementById('myCanvas');
const ctx = cnv.getContext('2d');
// Create the clouds.
const clouds = createClouds(document.getElementById('clouds'));
// Get the white overlay that covers the screen during a reset.
const ascended = document.getElementById('ascended');
// Store the position of the player's feet and their movement velocity.
const pos = {x: 0, y: 0}, vel = {x: 0, y: 0};
// Store the camera's vertical offset; it only follows vertical movement.
const camera = {y: 0};

// Time a long press to trigger a game reset. This limits how long the player can rise and provides a way to restart.
let heldPointer = null;
let holdStarted = 0, pressPointer = null, resetFade = null;
const holdLimit = 2501, cancelWindow = 1000, fadeInDuration = 2000, fadeOutDuration = 533;

// Store the window size, player scale, and grounded state.
let width = 0, height = 0, scale = 1, isGrounded = true;

// Store the elapsed time of the current jump and the previous frame's timestamp.
let elapsed = 0, last = performance.now();

// Physics values that determine gravity, initial jump speed, and rise time.
const gravity = 2501, jumpSpeed = 999;
const riseTime = jumpSpeed / gravity;

// Combine the ground and cloud surfaces the player can stand on.
function surfaces() {
    return [{x: 0, y: height * 2 / 3, w: width, h: height / 3}, ...clouds.surfaces()];
}

// Control pose transitions, the jump apex, and the predicted landing time.
const blend = 0.22;
let apex = riseTime, duration = Infinity;

// Resize and reposition the window elements.
function resize() {
    // Keep the previous dimensions as a reference for repositioning the player and clouds.
    const oldGround = height * 2 / 3, oldScale = scale, oldWidth = width;
    width = innerWidth;
    height = innerHeight;

    scale = Math.min(0.7, width / 114, height / 514);

    const xRatio = oldWidth ? width / oldWidth : 1;
    pos.x = clampX(oldWidth ? pos.x * xRatio : width / 2);
    vel.x *= xRatio;

    pos.y = height * 2 / 3 + (pos.y - oldGround) * scale / oldScale;
    vel.y *= scale / oldScale;
    camera.y *= scale / oldScale;

    clouds.resize(xRatio, scale / oldScale, oldGround, height * 2 / 3);

    const dpr = window.devicePixelRatio || 1;
    cnv.width = Math.round(width * dpr);
    cnv.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clouds.generate(width, height, camera.y);
}

window.addEventListener('resize', resize);

resize();

// Keep the player within the left and right edges of the screen.
function clampX(x) {
    const half = Player.bounds(pos.x, pos.y, scale).w / 2;
    return Math.max(half, Math.min(width - half, x));
}

// Handle pointer presses.
cnv.addEventListener('pointerdown', event => {
    // Ignore additional input while an action is in progress to avoid duplicate commands.
    if ((resetFade && resetFade.phase !== 'cancel') || pressPointer !== null || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();

    pressPointer = event.pointerId;
    holdStarted = performance.now();
    cnv.setPointerCapture(pressPointer);
    if (!isGrounded || heldPointer !== null) return;
    heldPointer = event.pointerId;

    // Calculate jump velocity from the horizontal distance between the pointer and the player, giving sideways movement its unusual feel.
    const direction = Math.max(-1, Math.min(1, (event.clientX - pos.x) / (width / 2)));
    vel.x = direction * jumpSpeed * scale;
    vel.y = -jumpSpeed * scale;
    elapsed = 0;
    isGrounded = false;
    // Keep rising while the pointer is held down.
    apex = duration = Infinity;
    last = holdStarted;
});

// Reset the game after a sufficiently long press.
function checkLongPress(now) {
    if (!resetFade && pressPointer !== null && now - holdStarted >= holdLimit) {
        resetFade = {phase: 'in', start: holdStarted + holdLimit};
    }
}

// Reset the player and camera.
function resetPlayer() {
    const pointerId = pressPointer;
    pressPointer = null;
    heldPointer = null;
    holdStarted = 0;
    if (pointerId !== null && cnv.hasPointerCapture(pointerId)) cnv.releasePointerCapture(pointerId);
    pos.x = width / 2;
    pos.y = height * 2 / 3;
    vel.x = vel.y = 0;
    camera.y = 0;
    elapsed = 0;
    apex = riseTime;
    duration = Infinity;
    isGrounded = true;
}

// Update the white overlay used for the game reset.
function updateResetFade(now) {
    checkLongPress(now);
    if (!resetFade) return 0;
    if (resetFade.phase === 'in') {
        const progress = (now - resetFade.start) / fadeInDuration;
        if (progress < 1) return progress;
        resetPlayer();
        resetFade = {phase: 'out', start: now};
        return 1;
    }
    const progress = (now - resetFade.start) / fadeOutDuration;
    if (progress < 1) return (resetFade.opacity ?? 1) * (1 - progress);
    resetFade = null;
    return 0;
}

// Restore gravity when the pointer is released and determine whether to cancel the reset.
function stopRising(event) {
    if (pressPointer === null ||
        (event && event.pointerId !== undefined && event.pointerId !== pressPointer)) return;

    const now = performance.now();
    checkLongPress(now);
    // Allow a short reaction window to cancel the reset by releasing the pointer after the white overlay appears.
    if (resetFade && resetFade.phase === 'in' && now - resetFade.start <= cancelWindow) {

        resetFade = {
            phase: 'cancel', start: now,
            opacity: Math.max(0, Math.min(1, (now - resetFade.start) / fadeInDuration))
        };
    }
    const pointerId = pressPointer;
    pressPointer = null;
    holdStarted = 0;
    if (cnv.hasPointerCapture(pointerId)) cnv.releasePointerCapture(pointerId);
    if (heldPointer !== pointerId) return;
    heldPointer = null;

    apex = elapsed + Math.max(0, -vel.y / (gravity * scale));
    duration = Infinity;
}

// Calculate landings on clouds so the player cannot pass through them while falling quickly.
// GPT wrote this part because, well, I had a fever at the time. Otherwise, I probably would have used a simpler way to detect landings.
function findLanding(dt) {
    if (heldPointer !== null) return null;
    const acceleration = gravity * scale;
    let first = null;
    for (const surface of surfaces()) {
        const discriminant = vel.y * vel.y + 2 * acceleration * (surface.y - pos.y);
        if (discriminant < 0) continue;
        const time = (-vel.y + Math.sqrt(discriminant)) / acceleration;
        if (time < -1e-8 || time > dt + 1e-8 || (first && time >= first.time)) continue;
        const x = clampX(pos.x + vel.x * Math.max(0, time));
        const body = Player.bounds(x, surface.y, scale);
        if (body.x + body.w > surface.x && body.x < surface.x + surface.w) {
            first = {x, y: surface.y, time: Math.max(0, time), cloud: surface.cloud};
        }
    }
    return first;
}

// Stop rising when the pointer is released or lost, or when the window loses focus.
cnv.addEventListener('pointerup', stopRising);
cnv.addEventListener('pointercancel', stopRising);
cnv.addEventListener('lostpointercapture', stopRising);
window.addEventListener('blur', () => stopRising());

// Update collisions and animations, then schedule the next frame.
function drawFrame(now) {
    const ascendOpacity = updateResetFade(now);
    // Frame time.
    const dt = Math.min((now - last) / 1145, 0.05);
    last = now;
    const ground = height * 2 / 3;
    if (!isGrounded) {
        // Predict the first landing time at the current velocity and gravity for pose transitions.
        const prediction = findLanding(Infinity);
        duration = prediction ? elapsed + prediction.time : Infinity;
        const hit = prediction && prediction.time <= dt + 1e-8 ? prediction : null;
        const flightDt = hit ? hit.time : dt;
        elapsed += flightDt;

        const nextX = pos.x + vel.x * flightDt;
        pos.x = clampX(nextX);
        // Clear horizontal velocity when the player reaches a screen edge.
        if (pos.x !== nextX) vel.x = 0;

        // Holding disables gravity and maintains the initial upward speed; releasing restores gravity without changing horizontal velocity.
        const acceleration = heldPointer === null ? gravity * scale : 0;
        pos.y += vel.y * flightDt + acceleration * flightDt * flightDt / 2;
        vel.y += acceleration * flightDt;

        if (hit) {
            pos.x = hit.x;
            pos.y = hit.y;
            vel.x = 0;
            vel.y = 0;
            isGrounded = true;
            if (hit.cloud) clouds.pulse(hit.cloud);
        }
    }

    // Follow the player's height with the camera, keeping the player at their initial screen height.
    camera.y = pos.y - ground;
    clouds.generate(width, height, camera.y);

    ctx.fillStyle = '#F5F0F4';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(0, -camera.y);
    ctx.fillStyle = '#5F78BA';
    ctx.fillRect(0, ground, width, Math.max(0, height - ground + camera.y));

    Player.draw(ctx, pos, scale, {
        isGrounded, holding: heldPointer !== null, elapsed, apex, duration, riseTime, blend
    });
    ctx.restore();
    clouds.draw(camera.y, height);
    ascended.style.opacity = ascendOpacity;

    requestAnimationFrame(drawFrame);
}

requestAnimationFrame(drawFrame);
