// Draw the character, including pose changes, the skeleton, and the collision box.
const Player = (() => {
    // poses stores three poses, recording root joint angles and relative child joint angles for the right leg, left leg, right arm, and left arm.
    const poses = [
        // Each of the next three rows represents a pose; each number describes a limb's relative angle.
        // In order: right thigh, right knee, left thigh, left knee, right upper arm, right elbow, left upper arm, left elbow.
        // Standing pose.
        [115, -7, 64, 7, 125, -10, 55, 10],
        // Jumping pose.
        [100, -15, 32, 74, 169, -71, 47, -25],
        // Falling pose.
        [100, -15, 32, 74, 190, 66, 35, -47]
        // Convert the angles to radians for sine and cosine; root joints use rightward as zero degrees, and knees and elbows bend relative to their parent bones.
    ].map(pose => pose.map(angle => angle * Math.PI / 180));
    // Define the root height and upper and lower segment lengths of the four limbs.
    const limbs = [
        // Origin, thigh length, shin length.
        [0, 45, 40], [0, 45, 40],
        // Origin, upper arm length, forearm length.
        [-42, 32, 36], [-42, 32, 36]
    ];

    // Get the character's rectangular collision box.
    function bounds(x, y, scale) {
        // From the center of the feet, extend 30 units in each horizontal direction and 185 units upward, then scale uniformly.
        return {x: x - 30 * scale, y: y - 185 * scale, w: 60 * scale, h: 185 * scale};
    }

    // Choose the current pose based on the jump state.
    function getPose({isGrounded, holding, elapsed, apex, duration, riseTime, blend}) {
        let angles = poses[0];
        if (!isGrounded) {
            // Limit transition length so takeoff and landing transitions do not overlap during short jumps.
            const transition = Math.min(blend, riseTime / 2,
                !holding ? (duration - apex) / 2 : blend);
            // Transition from standing to jumping.
            if (elapsed < transition) angles = mix(0, 1, elapsed / transition);
            // Hold the jumping pose.
            else if (elapsed < apex - transition) angles = poses[1];
            // Transition to the falling pose before the apex.
            else if (elapsed < apex) angles = mix(1, 2, (elapsed - apex + transition) / transition);
            // Hold the falling pose.
            else if (elapsed < duration - transition) angles = poses[2];
            // Transition to standing before landing.
            else angles = mix(2, 0, (elapsed - duration + transition) / transition);
        }
        return angles;
    }

    // Blend smoothly between two poses according to progress.
    function mix(from, to, t) {
        t = Math.max(0, Math.min(1, t));
        t = t * t * (3 - 2 * t);
        return poses[from].map((angle, i) => {
            const delta = poses[to][i] - angle;
            return angle + Math.atan2(Math.sin(delta), Math.cos(delta)) * t;
        });
    }

    // Calculate joint positions and draw the character.
    function draw(ctx, pos, scale, animation) {
        const angles = getPose(animation);
        const bones = limbs.map(([y, upper, lower], i) => {
            // Use the root joint angle for the upper segment and add the knee or elbow's relative angle for the lower segment, forming a parent-child bone relationship.
            const a = angles[i * 2], b = a + angles[i * 2 + 1];
            // Convert bone lengths and directions into joint coordinates.
            const x1 = Math.cos(a) * upper, y1 = y + Math.sin(a) * upper;
            // Store three coordinate pairs per limb: the origin, knee or elbow, and endpoint. The lower segment extends from the middle joint without changing bone length.
            return [0, y, x1, y1, x1 + Math.cos(b) * lower, y1 + Math.sin(b) * lower];
        });
        const foot = Math.max(bones[0][5], bones[1][5]) + 2;
        ctx.save();

        ctx.translate(pos.x, pos.y - foot * scale);
        ctx.scale(scale, scale);
        ctx.strokeStyle = '#e5c94f';
        ctx.fillStyle = '#eee3a1';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        bones.forEach(([x, y, x1, y1, x2, y2]) => {
            ctx.moveTo(x, y);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
        });

        ctx.moveTo(0, -55);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -78, 23, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    return {bounds, draw};
})();
