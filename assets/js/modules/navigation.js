export const initNavigation = () => {
    // Bottom Navigation Logic for Super App
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent default anchor click behavior
            
            // Remove active class from all
            navItems.forEach(n => n.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // If it's the scan button, we can maybe trigger an alert or modal instead of just changing color
            if(this.classList.contains('scan-btn')) {
                // Future: open camera/QR modal
                console.log('Open QR Scanner');
            }
        });
    });
};
