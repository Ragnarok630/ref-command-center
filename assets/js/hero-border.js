/*
====================================================
K630-REF
Hero Border Animation
Version 630.0.6
====================================================
*/

let heroGlowAnimation = null;

function initHeroBorderGlow() {

    const heroBanner = document.querySelector(".hero-image-banner");
    const heroGlow = document.querySelector(".hero-gold-glow");

    if (!heroBanner || !heroGlow) return;

    if (heroGlowAnimation) {
        cancelAnimationFrame(heroGlowAnimation);
    }

    let progress = 0;

    // lager = trager
    const speed = 0.00065;

    function animate() {

        const width = heroBanner.offsetWidth;
        const height = heroBanner.offsetHeight;

        // glow net buiten de border
        const offset = 2;

        const perimeter = (width * 2) + (height * 2);

        let d = (progress % 1) * perimeter;

        let x = 0;
        let y = 0;

        /*
        ===========================
        TOP
        ===========================
        */

        if (d <= width) {

            x = d;
            y = -offset;

            heroGlow.style.transform =
                "translate(-50%,-50%) rotate(0deg) scaleX(1)";
        }

        /*
        ===========================
        RIGHT
        ===========================
        */

        else if (d <= width + height) {

            x = width + offset;
            y = d - width;

            heroGlow.style.transform =
                "translate(-50%,-50%) rotate(90deg)";
        }

        /*
        ===========================
        BOTTOM
        ===========================
        */

        else if (d <= (width * 2) + height) {

            x = width - (d - width - height);
            y = height + offset;

            heroGlow.style.transform =
                "translate(-50%,-50%) rotate(180deg)";
        }

        /*
        ===========================
        LEFT
        ===========================
        */

        else {

            x = -offset;
            y = height - (d - (width * 2) - height);

            heroGlow.style.transform =
                "translate(-50%,-50%) rotate(270deg)";
        }

        heroGlow.style.left = `${x}px`;
        heroGlow.style.top = `${y}px`;

        progress += speed;

        heroGlowAnimation = requestAnimationFrame(animate);
    }

    animate();
}