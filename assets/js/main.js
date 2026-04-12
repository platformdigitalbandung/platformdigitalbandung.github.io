// Import Modules
import { initNavigation } from './modules/navigation.js';
import { initScrollAnimations } from './modules/animations.js';

// DOM Content Loaded wrapper
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Mobile Navigation & Header behaviors
    initNavigation();

    // 2. Initialize Scroll Reveal Animations
    initScrollAnimations();
    
    // Future expansion: we can easily add more modules here
    // e.g. initForms(), initCarousels()
});
