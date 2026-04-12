export const initNavigation = () => {
    /*=============== SHOW MENU ===============*/
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    const navClose = document.getElementById('nav-close');

    /* Menu Show */
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.add('show-menu');
        });
    }

    /* Menu Hidden */
    if (navClose) {
        navClose.addEventListener('click', () => {
            navMenu.classList.remove('show-menu');
        });
    }

    /*=============== REMOVE MENU MOBILE ===============*/
    const navLink = document.querySelectorAll('.nav-link');

    const linkAction = () => {
        const navMenu = document.getElementById('nav-menu');
        // When we click on each nav-link, we remove the show-menu class
        navMenu.classList.remove('show-menu');
    };
    navLink.forEach(n => n.addEventListener('click', linkAction));

    /*=============== CHANGE BACKGROUND HEADER ===============*/
    const blurHeader = () => {
        const header = document.getElementById('header');
        // When the scroll is greater than 50 viewport height, add the blur class to the header tag
        this.scrollY >= 50 ? header.classList.add('blur') 
                           : header.classList.remove('blur');
    };
    window.addEventListener('scroll', blurHeader);

    /*=============== SCROLL SECTIONS ACTIVE LINK ===============*/
    const sections = document.querySelectorAll('section[id]');
    
    const scrollActive = () => {
        const scrollY = window.pageYOffset;

        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 100;
            const sectionId = current.getAttribute('id');
            const sectionsClass = document.querySelector('.nav-menu a[href*=' + sectionId + ']');

            if (sectionsClass) {
                if(scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                    sectionsClass.classList.add('active-link');
                } else {
                    sectionsClass.classList.remove('active-link');
                }
            }
        });
    };
    window.addEventListener('scroll', scrollActive);
};
