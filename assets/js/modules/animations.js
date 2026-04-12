export const initScrollAnimations = () => {
    // Select all elements that have 'reveal-' class
    const revealElements = document.querySelectorAll('.reveal-left, .reveal-right, .reveal-bottom, .reveal-zoom');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const revealPoint = 100; // Activation point

        revealElements.forEach(element => {
            const revealTop = element.getBoundingClientRect().top;
            
            if (revealTop < windowHeight - revealPoint) {
                element.classList.add('active');
            }
        });
    };

    // Trigger once on load
    revealOnScroll();

    // Trigger on scroll
    window.addEventListener('scroll', revealOnScroll);
};
