

document.addEventListener('DOMContentLoaded', () => {
    const notificationIcon = document.getElementById('notification-icon');
    const notificationPopup = document.getElementById('notification-popup');

    fetchNotifications();

    notificationIcon.addEventListener('click', () => {
        notificationPopup.classList.toggle('visible');
    });

    function fetchNotifications() {
        fetch('/organizer/notifications')
            .then(response => response.json())
            .then(notifications => {
                const notificationsContainer = document.getElementById('notifications-container');
                notificationsContainer.innerHTML = '';

                notifications.forEach(notification => {
                    const notificationElement = document.createElement('div');
                    notificationElement.className = 'notification';
                    notificationElement.textContent = notification.message;
                    notificationsContainer.appendChild(notificationElement);
                });
            })
            .catch(error => console.error('Error fetching notifications:', error));
    }
});

document.addEventListener('click', (event) => {
    const notificationPopup = document.getElementById('notification-popup');y
    const notificationIcon = document.getElementById('notification-icon');

    if (!notificationPopup.contains(event.target) && !notificationIcon.contains(event.target)) {
        notificationPopup.classList.remove('visible');
    }
});