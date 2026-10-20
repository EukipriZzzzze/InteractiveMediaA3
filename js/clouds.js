// Draw the clouds, including generation, display, animation, and surfaces the player can stand on.

function createClouds(layer) {
    // Generate and store clouds row by row, tracking their positions, sizes, and visual effects.
    const rows = [];

    // Control the clouds' aspect ratio.
    const cloudAspect = 115 / 216;

    // SVG image of a cloud.
    const cloudSVG = `<svg preserveAspectRatio="none" viewBox="0 0 214 119" xmlns="http://www.w3.org/2000/svg"><path d="M179.84,36.61c.07-3.12-.42-6.3-1.57-9.4-4.86-13.17-19.48-19.9-32.65-15.04-2.69,1-5.11,2.4-7.22,4.12-5.59-4.23-12.09-7.91-19.3-10.73C89.32-6.08,58.68,1.15,50.64,21.7c-.79,2.03-1.33,4.11-1.63,6.22C21.84,28.37,0,45.42,0,66.39s22.43,38.5,50.1,38.5c3.79,0,7.47-.33,11.02-.95,7.33,9.72,28.03,16.04,52.08,14.9,22.51-1.07,41.47-8.37,49.04-17.81,2.52.75,5.16,1.29,7.89,1.62,21.82,2.58,41.26-10.18,43.43-28.49,2.1-17.78-12.87-34.26-33.71-37.56Z" fill="#b3bee0"/></svg>`;

    // Generate a random number within the specified range.
    const random = (min, max) => min + Math.random() * (max - min);

    // Create the clouds' floating and scaling animations.
    // I kept running into problems I could not solve while writing this part, so I asked ChatGPT to help refactor it.
    function createCloudElement(cloud) {
        const element = document.createElement('div');
        element.className = 'cloud';

        // Separate positioning, floating, and scaling so their transforms do not override each other.
        element.innerHTML = `<div class="cloud-float"><div class="cloud-impact">${cloudSVG}</div></div>`;

        // Give each cloud a random animation duration and effect.
        const duration = random(4.5, 8.5);
        element.style.setProperty('--float-duration', `${duration}s`);
        // Start animations at random points so all the clouds do not sway at once.
        element.style.setProperty('--float-delay', `${-random(0, duration)}s`);
        element.style.setProperty('--float-up', `${-random(2, 5)}px`);
        element.style.setProperty('--float-down', `${random(2, 4)}px`);
        element.style.setProperty('--tilt-left', `${-random(1, 2.2)}deg`);
        element.style.setProperty('--tilt-right', `${random(1, 2.2)}deg`);

        cloud.element = element;
        cloud.impact = element.querySelector('.cloud-impact');

        // Clear the bounce animation when it ends so it can play again next time.
        cloud.impact.addEventListener('animationend', event => {
            if (event.animationName === 'cloud-land') cloud.impact.classList.remove('bounce');
        });
        return element;
    }

    // Generate rows of clouds upward based on the camera height.
    function generate(width, height, cameraY) {
        // Generate above the highest row; start at ground level on the first pass.
        let top = rows.length ? rows[rows.length - 1].y : height * 2 / 3;

        // Keep generating clouds until they reach one screen height above the view.
        while (top > cameraY - height) {
            // Spacing between cloud rows.
            top -= random(171, 233);

            // Randomly generate one to four clouds per row.
            const count = 1 + Math.floor(Math.random() * 4);

            // Divide the horizontal space.
            const cell = width / count + 2;
            const clouds = Array.from({length: count}, (_, i) => {
                // Limit the cloud size.
                const w = Math.min(random(152, 203));
                return {
                    x: i * cell + random(0, cell - w),
                    // Add some vertical variation to cloud positions within each row.
                    y: top + random(-20, 35),

                    w, h: w * cloudAspect
                };
            });

            rows.push({y: top, clouds});
        }
    }

    // Update the positions of visible clouds and remove clouds outside the screen.
    function draw(cameraY, height) {
        for (const row of rows) {
            for (const cloud of row.clouds) {
                // Set the standing surface height, then work back to the image top and subtract the camera offset to get screen coordinates.
                const y = cloud.y - cloud.h * 0.4 - cameraY;

                if (y + cloud.h < -12 || y > height + 12) {
                    cloud.element?.remove();
                    continue;
                }

                const element = cloud.element || createCloudElement(cloud);
                element.style.width = `${cloud.w}px`;
                element.style.height = `${cloud.h}px`;
                element.style.transform = `translate(${cloud.x}px, ${y}px)`;

                if (!element.isConnected) layer.appendChild(element);
            }
        }
    }

    // Play a super bouncy animation when the player lands on a cloud!
    function pulse(cloud) {
        if (!cloud.element) createCloudElement(cloud);
        cloud.impact.classList.remove('bounce');
        // Restart the animation when it is triggered again.
        void cloud.impact.offsetWidth;
        cloud.impact.classList.add('bounce');
    }

    // Return the cloud's rectangular standing surface along with a reference to the original cloud.
    function cloudBounds(cloud) {
        return {x: cloud.x + cloud.w * 0.1, y: cloud.y, w: cloud.w * 0.8, h: cloud.h * 0.45, cloud};
    }

    // Adjust cloud positions and sizes. This does not work very well, so please do not resize the window while playing...
    function resize(xRatio, yRatio, oldGround, newGround) {
        for (const row of rows) {
            // Measure the distance from the old ground, scale it, and add it to the new ground to preserve the cloud's relative height.
            row.y = newGround + (row.y - oldGround) * yRatio;
            for (const cloud of row.clouds) {
                cloud.x *= xRatio;
                cloud.w *= xRatio;
                cloud.h = cloud.w * cloudAspect;
                cloud.y = newGround + (cloud.y - oldGround) * yRatio;
            }
        }
    }

    // Provide cloud standing surfaces so the game can determine whether the player can land on them.
    function surfaces() {
        return rows.flatMap(row => row.clouds.map(cloudBounds));
    }

    return {generate, resize, surfaces, draw, pulse};
}
