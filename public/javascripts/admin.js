function showAddUserForm() {
    document.getElementById('mainContent').innerHTML = `
        <h2>Add User</h2>
        <form id="addUserForm" action="/admin/add-user" method="POST">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
            <br>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
            <br>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
            <br>
            <label for="role">Role:</label>
            <select id="role" name="role" required>
                <option value="organizer">Organizer</option>
                <option value="user">User</option>
            </select>
            <br>
            <button type="submit">Add User</button>
        </form>
    `;
}

function showAllUsers() {
    fetch('/admin/users')
        .then(response => response.json())
        .then(data => {
            let html = `
                <h2>All Users</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            data.forEach(user => {
                html += `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.role}</td>
                        <td>${user.status}</td>
                        <td>
                            <button onclick="blockUser(${user.id})">Block</button>
                            <button onclick="deleteUser(${user.id})">Delete</button>
                        </td>
                    </tr>
                `;
            });
            html += `
                    </tbody>
                </table>
            `;
            document.getElementById('mainContent').innerHTML = html;
        })
        .catch(error => console.error('Error fetching users:', error));
}

function blockUser(userId) {
    fetch(`/admin/block-user/${userId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            showAllUsers();
        })
        .catch(error => console.error('Error blocking user:', error));
}

function deleteUser(userId) {
    fetch(`/admin/delete-user/${userId}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            showAllUsers();
        })
        .catch(error => console.error('Error deleting user:', error));
}

function showStatistics() {
    document.getElementById('statistics').style.display = 'block';
    fetch('/admin/stats')
        .then(response => response.json())
        .then(data => {
            // Update basic stats table
            let html = `
                <tr>
                    <td>${data.totalUsers}</td>
                    <td>${data.totalOrganizers}</td>
                    <td>${data.totalEvents}</td>
                    <td>${data.totalRegistrations}</td>
                </tr>
            `;
            document.getElementById('stats-table').innerHTML = html;

            // Render Events Per Month Chart
            const ctx1 = document.getElementById('eventsPerMonthChart').getContext('2d');
            const eventsPerMonthChart = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: data.eventsPerMonth.months,
                    datasets: [{
                        label: 'Number of Events',
                        data: data.eventsPerMonth.eventCounts,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                }
            });

            // Render User vs Organizer Chart
            const ctx2 = document.getElementById('userVsOrganizerChart').getContext('2d');
            const userVsOrganizerChart = new Chart(ctx2, {
                type: 'pie',
                data: {
                    labels: ['Users', 'Organizers'],
                    datasets: [{
                        label: 'Count',
                        data: [data.userVsOrganizer.users, data.userVsOrganizer.organizers],
                        backgroundColor: ['rgba(54, 162, 235, 0.2)', 'rgba(255, 99, 132, 0.2)'],
                        borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 99, 132, 1)'],
                        borderWidth: 1
                    }]
                }
            });

            // Render Top Rated Events Chart
            const ctx3 = document.getElementById('topRatedEventsChart').getContext('2d');
            const topRatedEventsChart = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: data.topRatedEvents.names,
                    datasets: [{
                        label: 'Average Rating',
                        data: data.topRatedEvents.ratings,
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1
                    }]
                }
            });

            // Render Events with Highest Registrations Chart
            const ctx4 = document.getElementById('topRegisteredEventsChart').getContext('2d');
            const topRegisteredEventsChart = new Chart(ctx4, {
                type: 'bar',
                data: {
                    labels: data.topRegisteredEvents.names,
                    datasets: [{
                        label: 'Number of Registrations',
                        data: data.topRegisteredEvents.counts,
                        backgroundColor: 'rgba(255, 159, 64, 0.2)',
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1
                    }]
                }
            });
        })
        .catch(error => console.error('Error fetching statistics:', error));
}

function showLookupData() {
    fetch('/admin/lookup-data')
        .then(response => response.json())
        .then(data => {
            let html = `
                <h2>Manage Lookup Data</h2>
                <div>
                    <h3>Categories</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            data.categories.forEach(category => {
                html += `
                    <tr>
                        <td>${category.id}</td>
                        <td>${category.name}</td>
                        <td>
                            <button onclick="editLookupData(${category.id}, 'category', '${category.name}')">Edit</button>
                            <button onclick="deleteLookupData(${category.id}, 'category')">Delete</button>
                        </td>
                    </tr>
                `;
            });
            html += `
                        </tbody>
                    </table>
                    <button onclick="addLookupData('category')">Add New Category</button>
                </div>

                <div>
                    <h3>Locations</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            data.locations.forEach(location => {
                html += `
                    <tr>
                        <td>${location.id}</td>
                        <td>${location.name}</td>
                        <td>
                            <button onclick="editLookupData(${location.id}, 'location', '${location.name}')">Edit</button>
                            <button onclick="deleteLookupData(${location.id}, 'location')">Delete</button>
                        </td>
                    </tr>
                `;
            });
            html += `
                        </tbody>
                    </table>
                    <button onclick="addLookupData('location')">Add New Location</button>
                </div>
            `;
            document.getElementById('mainContent').innerHTML = html;
        })
        .catch(error => console.error('Error fetching lookup data:', error));
}

function addLookupData(type) {
    const name = prompt('Enter the name:');
    if (name) {
        fetch('/admin/lookup-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, name })
        })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
                showLookupData();
            })
            .catch(error => console.error('Error adding lookup data:', error));
    }
}

function editLookupData(id, type, currentName) {
    const name = prompt('Edit the name:', currentName);
    if (name) {
        fetch(`/admin/lookup-data/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, name })
        })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
                showLookupData();
            })
            .catch(error => console.error('Error updating lookup data:', error));
    }
}

function deleteLookupData(id, type) {
    if (confirm('Are you sure you want to delete this item?')) {
        fetch(`/admin/lookup-data/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type })
        })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
                showLookupData();
            })
            .catch(error => console.error('Error deleting lookup data:', error));
    }
}

// Function to view all events
function viewAllEvents() {
    fetch('/admin/events')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(events => {
            // Generate the HTML table for the events
            let eventTable = `
                <table border="1">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Date</th>
                            <th>Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${events.map(event => `
                            <tr>
                                <td>${event.id}</td>
                                <td>${event.name}</td>
                                <td>${event.date}</td>
                                <td>${event.location}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            document.getElementById('mainContent').innerHTML = eventTable;
        })
        .catch(error => {
            console.error('Error fetching events:', error);
            document.getElementById('mainContent').innerHTML = 'Error loading events.';
        });
}


// Function to view recent event registrations
function viewRecentRegistrations() {
    fetch('/admin/registrations/recent')
        .then(response => response.json())
        .then(registrations => {
            // Limit the number of registrations displayed to 15
            const recentRegistrations = registrations.slice(0, 15);

            let registrationTable = '<table border="1"><thead><tr><th>ID</th><th>User Name</th><th>Event Name</th><th>Registration Date</th></tr></thead><tbody>';
            recentRegistrations.forEach(registration => {
                registrationTable += `<tr><td>${registration.registration_id}</td><td>${registration.user_name}</td><td>${registration.event_name}</td><td>${new Date(registration.registration_date).toLocaleString()}</td></tr>`;
            });
            registrationTable += '</tbody></table>';
            document.getElementById('mainContent').innerHTML = registrationTable;
        })
        .catch(error => console.error('Error fetching recent registrations:', error));
}


// Function to view best and worst reviews
function viewReviews() {
    fetch('/admin/reviews')
        .then(response => response.json())
        .then(data => {
            console.log('Fetched reviews data:', data); // Debugging statement

            let reviewTable = `
                <h2>Best Reviews</h2>
                <table border="1">
                    <thead><tr><th>ID</th><th>User Name</th><th>Event Name</th><th>Rating</th><th>Review</th></tr></thead>
                    <tbody>${data.bestReviews.map(review => `
                        <tr>
                            <td>${review.id || 'N/A'}</td>
                            <td>${review.user_name || 'N/A'}</td>
                            <td>${review.event_name || 'N/A'}</td>
                            <td>${review.rating || 'N/A'}</td>
                            <td>${review.review || 'No review'}</td>
                        </tr>`).join('')}</tbody>
                </table>
                <h2>Worst Reviews</h2>
                <table border="1">
                    <thead><tr><th>ID</th><th>User Name</th><th>Event Name</th><th>Rating</th><th>Review</th></tr></thead>
                    <tbody>${data.worstReviews.map(review => `
                        <tr>
                            <td>${review.id || 'N/A'}</td>
                            <td>${review.user_name || 'N/A'}</td>
                            <td>${review.event_name || 'N/A'}</td>
                            <td>${review.rating || 'N/A'}</td>
                            <td>${review.review || 'No review'}</td>
                        </tr>`).join('')}</tbody>
                </table>
            `;
            document.getElementById('mainContent').innerHTML = reviewTable;
        })
        .catch(error => console.error('Error fetching reviews:', error));
}

const socket = io();

const room = 'adminRoom';
socket.emit('joinRoom', room);

// Listen for messages
socket.on('message', (msg) => {
    console.log('New message:', msg);
});

// Send message
function sendMessage(content) {
    const msg = {
        room: room,
        content: content,
        senderId: '<%= user.id %>'
    };
    socket.emit('chatMessage', msg);
}

document.getElementById('messageIcon').addEventListener('click', () => {
    const messageContent = prompt('Enter your message:');
    if (messageContent) {
        sendMessage(messageContent);
    }
});

document.getElementById('sendMessage').addEventListener('click', () => {
    const messageContent = document.getElementById('messageInput').value;
    if (messageContent) {
        sendMessage(messageContent);
        document.getElementById('messageInput').value = '';
    }
});