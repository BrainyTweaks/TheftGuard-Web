// ==========================================
// 1. FIREBASE SETUP & GLOBAL VARIABLES
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyCgs1XEForas7sCQvyvth6oB75GOu1k4c4",
    authDomain: "theftguard-iot.firebaseapp.com",
    databaseURL: "https://theftguard-iot-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "theftguard-iot",
    storageBucket: "theftguard-iot.firebasestorage.app",
    messagingSenderId: "466492128446",
    appId: "1:466492128446:web:bbdc92edfe4141736df2ef"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

let currentUserUid = null;
let currentDeviceRef = null; 

// ==========================================
// 2. DEVICE PAIRING & LIVE LISTENER
// ==========================================

function loadPairedDevice() {
    document.getElementById('nav-pair').style.display = 'inline-block'; 
    database.ref('users/' + currentUserUid + '/paired_device').once('value').then((snapshot) => {
        const macAddress = snapshot.val();
        if (macAddress) {
            document.getElementById('pairedDeviceLabel').innerText = "✅ Connected to: " + macAddress;
            document.getElementById('macInput').value = macAddress;
            startListeningToDevice(macAddress);
        } else {
            document.getElementById('pairedDeviceLabel').innerText = "⚠️ No device paired yet. Please enter your hardware MAC.";
        }
    });
}

function pairDevice() {
    const mac = document.getElementById('macInput').value.trim().toUpperCase();
    if (!mac) return alert("Please enter a valid MAC address.");
    database.ref('users/' + currentUserUid + '/paired_device').set(mac).then(() => {
        alert("Device paired successfully!");
        document.getElementById('pairedDeviceLabel').innerText = "✅ Connected to: " + mac;
        startListeningToDevice(mac); 
        bootstrap.Modal.getInstance(document.getElementById('pairingModal')).hide();
    });
}

function startListeningToDevice(macAddress) {
    if (currentDeviceRef) currentDeviceRef.off(); 
    currentDeviceRef = database.ref('live_grid/' + macAddress);
    
    currentDeviceRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            let poleVal = parseFloat(data.pole).toFixed(2);
            let houseVal = parseFloat(data.house).toFixed(2);
            
            document.getElementById('poleCurrent').innerText = poleVal + " A";
            document.getElementById('houseCurrent').innerText = houseVal + " A";
            
            const banner = document.getElementById('theftAlertBanner');
            if (poleVal - houseVal > 1.0) {
                // Highlight load and source cards
                document.querySelectorAll('.card-custom')[0].classList.add('theft-active');
                document.querySelectorAll('.card-custom')[2].classList.add('theft-active'); 
                banner.style.display = "block"; 
            } else {
                document.querySelectorAll('.card-custom').forEach(el => el.classList.remove('theft-active'));
                banner.style.display = "none"; 
            }
        }
    });
}

// ==========================================
// 3. FIREBASE AUTHENTICATION (WITH PERSISTENCE)
// ==========================================

auth.onAuthStateChanged((user) => {
    if (user && user.emailVerified) {
        currentUserUid = user.uid; 
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userProfile').style.display = 'flex';
        const username = user.displayName ? user.displayName.toUpperCase() : user.email.split('@')[0].toUpperCase();
        document.getElementById('userNameDisplay').innerText = username;
        loadPairedDevice(); 
    } else if (user && !user.emailVerified) {
        auth.signOut();
    }
});

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const registerBtn = document.getElementById('registerBtn');

    if (!email || !password) return alert("Please enter both an email and a password.");
    if (!isValidEmail(email)) return alert("Please enter a valid email address.");
    if (password.length < 6) return alert("Firebase requires passwords to be at least 6 characters long.");

    registerBtn.innerText = "Creating..."; registerBtn.disabled = true;

    auth.createUserWithEmailAndPassword(email, password).then((userCredential) => {
        userCredential.user.sendEmailVerification().then(() => {
            alert("Account created! A verification link has been sent. Please verify before logging in.");
            auth.signOut();
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            registerBtn.innerText = "Create Account"; registerBtn.disabled = false;
            document.getElementById('loginEmail').value = ""; document.getElementById('loginPassword').value = "";
        });
    }).catch((error) => {
        alert("Registration Failed: " + error.message);
        registerBtn.innerText = "Create Account"; registerBtn.disabled = false;
    });
}

function handleLogin(e) {
    e.preventDefault(); 
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.getElementById('loginSubmitBtn');

    if (!isValidEmail(email)) return alert("Please enter a valid email address.");
    loginBtn.innerText = "Verifying..."; loginBtn.disabled = true;

    auth.signInWithEmailAndPassword(email, password).then((userCredential) => {
        if (!userCredential.user.emailVerified) {
            alert("Access Denied: Please verify your email address first.");
            auth.signOut(); loginBtn.innerText = "Login"; loginBtn.disabled = false; return;
        }
        currentUserUid = userCredential.user.uid; 
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userProfile').style.display = 'flex';
        const username = userCredential.user.displayName ? userCredential.user.displayName.toUpperCase() : userCredential.user.email.split('@')[0].toUpperCase();
        document.getElementById('userNameDisplay').innerText = username;
        loadPairedDevice(); 
        loginBtn.innerText = "Login"; loginBtn.disabled = false;
    }).catch((error) => {
        alert("Login Failed: " + error.message);
        loginBtn.innerText = "Login"; loginBtn.disabled = false;
    });
}

function handleForgotPassword() {
    let email = document.getElementById('loginEmail').value.trim();
    if (!email) email = prompt("Please enter your registered email address:");
    if (!email) return; 
    if (!isValidEmail(email)) return alert("Please enter a valid email address.");
    auth.sendPasswordResetEmail(email).then(() => {
        alert("A password reset link has been sent to " + email);
    }).catch((error) => alert("Error sending reset email: " + error.message));
}

function handleLogout() {
    showPage('dashboard'); 
    auth.signOut().then(() => {
        currentUserUid = null;
        if (currentDeviceRef) currentDeviceRef.off(); 
        document.getElementById('userProfile').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('nav-pair').style.display = 'none'; 
        document.getElementById('poleCurrent').innerText = "0.0 A";
        document.getElementById('houseCurrent').innerText = "0.0 A";
        document.querySelectorAll('.card-custom').forEach(el => el.classList.remove('theft-active'));
        document.getElementById('theftAlertBanner').style.display = "none";
        document.getElementById('loginEmail').value = ""; document.getElementById('loginPassword').value = "";
        document.getElementById('macInput').value = ""; document.getElementById('pairedDeviceLabel').innerText = "No device paired yet.";
    });
}

// ==========================================
// 4. ACCOUNT SETTINGS & NAVIGATION
// ==========================================

function changeUsername() {
    const newName = document.getElementById('newUsernameInput').value.trim();
    if (!newName) return alert("Please enter a valid username.");
    const user = auth.currentUser;
    if (user) {
        user.updateProfile({ displayName: newName }).then(() => {
            alert("Username updated!");
            document.getElementById('userNameDisplay').innerText = newName.toUpperCase();
            document.getElementById('newUsernameInput').value = ""; 
        }).catch((error) => alert("Error: " + error.message));
    }
}

function sendPasswordReset() {
    const user = auth.currentUser;
    if (user) {
        auth.sendPasswordResetEmail(user.email).then(() => alert("Reset email sent!"))
        .catch((error) => alert("Error: " + error.message));
    }
}

function showPage(pageId) {
    document.getElementById('dashboardPage').style.display = 'none';
    document.getElementById('costPage').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'none';
    document.getElementById(pageId + 'Page').style.display = 'block';

    document.getElementById('nav-dash').classList.remove('active');
    document.getElementById('nav-cost').classList.remove('active');
    
    if(pageId === 'dashboard') document.getElementById('nav-dash').classList.add('active');
    if(pageId === 'cost') {
        document.getElementById('nav-cost').classList.add('active');
        renderCostChart();
    }
}

function calculateCost() {
    const units = 190.2; 
    const rate = document.getElementById('unitRate').value;
    const total = (units * rate).toFixed(2);
    document.getElementById('calculatedTotal').innerText = "₹ " + total;
}

function renderCostChart() {
    const ctxCost = document.getElementById('costChart').getContext('2d');
    if (window.costChartInstance) { window.costChartInstance.destroy(); }
    window.costChartInstance = new Chart(ctxCost, {
        type: 'bar',
        data: { labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'], datasets: [{ label: 'Bill (₹)', data: [1100, 1250, 1180, 1340, 1290, 1425], backgroundColor: '#30d158', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { position: 'right', grid: { color: '#333' }, ticks: { color: '#8e8e93' } }, x: { grid: { display: false }, ticks: { color: '#8e8e93' } } } }
    });
}

// ==========================================
// 5. CHARTS INITIALIZATION & ONLOAD
// ==========================================

const chartOptions = {
    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { 
        y: { position: 'right', grid: { color: '#333' }, ticks: { color: '#8e8e93', font: {size: 10} } }, 
        x: { grid: { display: false }, ticks: { color: '#8e8e93', font: { size: 9 }, autoSkip: false, minRotation: 0, maxRotation: 0 } } 
    }
};

const usageCtx = document.getElementById('usageChart').getContext('2d');
let usageChart = new Chart(usageCtx, { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#0a84ff', borderRadius: 4, barPercentage: 0.8 }] }, options: JSON.parse(JSON.stringify(chartOptions)) });

const sourceCtx = document.getElementById('sourceChart').getContext('2d');
let sourceChart = new Chart(sourceCtx, { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#ffcc00', borderRadius: 4, barPercentage: 0.8 }] }, options: JSON.parse(JSON.stringify(chartOptions)) });

window.onload = function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const lastDayOfMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const minDate = `${year}-${month}-01`;
    const maxDate = `${year}-${month}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // Usage Chart Setup
    document.getElementById('daySelect').value = todayStr;
    const hourDateInput = document.getElementById('hourDateSelect');
    hourDateInput.value = todayStr; hourDateInput.min = minDate; hourDateInput.max = maxDate;
    
    // Source Chart Setup
    document.getElementById('sourceDaySelect').value = todayStr;
    const sourceHourDateInput = document.getElementById('sourceHourDateSelect');
    sourceHourDateInput.value = todayStr; sourceHourDateInput.min = minDate; sourceHourDateInput.max = maxDate;
    
    // Populate 24 hour dropdowns
    const hourSelect = document.getElementById('hourTimeSelect');
    const sourceHourSelect = document.getElementById('sourceHourTimeSelect');
    for(let i=0; i<24; i++) {
        let opt1 = document.createElement('option'); let opt2 = document.createElement('option');
        opt1.value = i; opt2.value = i;
        let displayHour = i % 12 || 12; let ampm = i >= 12 ? 'PM' : 'AM';
        opt1.text = `${displayHour}:00 ${ampm}`; opt2.text = `${displayHour}:00 ${ampm}`;
        hourSelect.appendChild(opt1); sourceHourSelect.appendChild(opt2);
    }
    document.getElementById('hourTimeSelect').value = now.getHours();
    document.getElementById('sourceHourTimeSelect').value = now.getHours();

    setView('week', document.querySelectorAll('.view-tab')[3]); 
    setSourceView('week', document.querySelectorAll('.source-tab')[3]); 
};

// ==========================================
// 6. LOAD USAGE CHART LOGIC (BLUE)
// ==========================================

function setView(mode, element) {
    document.querySelectorAll('.view-tabs:first-of-type .view-tab').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    
    document.getElementById('weekSubSelector').style.display = 'none';
    document.getElementById('monthSelectorWrapper').style.display = 'none';
    document.getElementById('daySelectorWrapper').style.display = 'none';
    document.getElementById('hourSelectorWrapper').style.display = 'none';
    usageChart.options.scales.x.grid.display = false;

    if (mode === 'minute') { document.getElementById('timeLabel').innerText = "Live Usage (Last 60 Minutes)"; updateMinuteData(); }
    else if (mode === 'hour') { document.getElementById('hourSelectorWrapper').style.display = 'flex'; updateHourData(); }
    else if (mode === 'day') { document.getElementById('daySelectorWrapper').style.display = 'block'; updateDayData(); } 
    else if (mode === 'week') { document.getElementById('weekSubSelector').style.display = 'flex'; setSubWeek(7, document.querySelectorAll('.sub-pill')[3]); }
    else if (mode === 'month') { document.getElementById('monthSelectorWrapper').style.display = 'block'; updateMonthData(); }
    else if (mode === 'year') {
        let labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let data = Array.from({length: 12}, () => Math.random() * 100 + 50);
        let total = data.reduce((a, b) => a + b, 0);
        document.getElementById('timeLabel').innerText = "Year 2026";
        document.getElementById('totalUsageDisplay').innerText = total.toFixed(1) + " kWh";
        document.getElementById('avgLabel').innerText = "Total: 1.2 MWh";
        usageChart.data.labels = labels; usageChart.data.datasets[0].data = data; usageChart.update();
    }
}

function setSubWeek(weekNum, element) {
    document.querySelectorAll('.sub-pill:not(.source-pill)').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let data = Array.from({length: 7}, () => Math.random() * 10 + weekNum);
    let total = data.reduce((a, b) => a + b, 0);
    document.getElementById('timeLabel').innerText = weekNum === 7 ? "9 Feb - 15 Feb (Week 7)" : `Week ${weekNum}`;
    document.getElementById('totalUsageDisplay').innerText = total.toFixed(1) + " kWh";
    document.getElementById('avgLabel').innerText = "Daily Avg: " + (total/7).toFixed(1) + " kWh";
    usageChart.data.labels = days; usageChart.data.datasets[0].data = data; usageChart.update();
}

function updateDayData() {
    const dateStr = new Date(document.getElementById('daySelect').value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let labels = Array.from({length: 24}, (_, i) => i < 10 ? "0" + i : i);
    let data = Array.from({length: 24}, () => Math.random() * 2.5);
    let total = data.reduce((a, b) => a + b, 0);
    document.getElementById('timeLabel').innerText = `Usage on ${dateStr}`;
    document.getElementById('totalUsageDisplay').innerText = total.toFixed(1) + " kWh";
    document.getElementById('avgLabel').innerText = "Peak: 8 PM";
    usageChart.data.labels = labels; usageChart.data.datasets[0].data = data; usageChart.update();
}

function updateMonthData() {
    const select = document.getElementById('monthSelect');
    let labels = Array.from({length: 30}, (_, i) => (i+1).toString());
    let data = Array.from({length: 30}, () => Math.random() * 10 + 2);
    let total = data.reduce((a, b) => a + b, 0);
    document.getElementById('timeLabel').innerText = `Usage for ${select.options[select.selectedIndex].text}`;
    document.getElementById('totalUsageDisplay').innerText = total.toFixed(1) + " kWh";
    document.getElementById('avgLabel').innerText = "Daily Avg: " + (total/30).toFixed(1) + " kWh";
    usageChart.data.labels = labels; usageChart.data.datasets[0].data = data; usageChart.update();
}

function updateMinuteData() {
    let labels = [], data = [], now = new Date();
    for(let i = 59; i >= 0; i--) {
        let pastTime = new Date(now.getTime() - (i * 60000));
        let mins = pastTime.getMinutes().toString().padStart(2, '0');
        labels.push(mins === '00' ? `${pastTime.getHours() % 12 || 12}:00` : mins);
        data.push(Math.random() * 1.0 + 0.5); 
    }
    document.getElementById('totalUsageDisplay').innerText = data.reduce((a, b) => a + b, 0).toFixed(2) + " kWh";
    document.getElementById('avgLabel').innerText = "Updating in real-time...";
    
    usageChart.options.scales.x.grid.display = true;
    usageChart.options.scales.x.grid.drawOnChartArea = true;
    usageChart.options.scales.x.grid.color = (context) => (context.index !== undefined && labels[context.index].includes(':00')) ? 'rgba(255, 255, 255, 0.4)' : 'transparent';
    usageChart.options.scales.x.grid.borderDash = [5, 5]; 
    
    usageChart.data.labels = labels; usageChart.data.datasets[0].data = data; usageChart.update();
}

function updateHourData() {
    const dateStr = new Date(document.getElementById('hourDateSelect').value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let h = parseInt(document.getElementById('hourTimeSelect').value);
    let displayHour = h % 12 || 12, ampm = h >= 12 ? 'PM' : 'AM';
    let labels = Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0'));
    let data = Array.from({length: 60}, () => Math.random() * 1.5);
    
    document.getElementById('timeLabel').innerText = `Usage on ${dateStr} (${displayHour}:00 ${ampm} - ${displayHour}:59 ${ampm})`;
    document.getElementById('totalUsageDisplay').innerText = data.reduce((a, b) => a + b, 0).toFixed(2) + " kWh";
    document.getElementById('avgLabel').innerText = "Hourly Total";
    usageChart.data.labels = labels; usageChart.data.datasets[0].data = data; usageChart.update();
}

// ==========================================
// 7. SOURCE POWER CHART LOGIC (YELLOW)
// ==========================================

function setSourceView(mode, element) {
    document.querySelectorAll('.source-tab').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    
    document.getElementById('sourceWeekSubSelector').style.display = 'none';
    document.getElementById('sourceMonthSelectorWrapper').style.display = 'none';
    document.getElementById('sourceDaySelectorWrapper').style.display = 'none';
    document.getElementById('sourceHourSelectorWrapper').style.display = 'none';
    sourceChart.options.scales.x.grid.display = false;

    if (mode === 'minute') { document.getElementById('sourceTimeLabel').innerText = "Live Source (Last 60 Minutes)"; updateSourceMinuteData(); }
    else if (mode === 'hour') { document.getElementById('sourceHourSelectorWrapper').style.display = 'flex'; updateSourceHourData(); }
    else if (mode === 'day') { document.getElementById('sourceDaySelectorWrapper').style.display = 'block'; updateSourceDayData(); } 
    else if (mode === 'week') { document.getElementById('sourceWeekSubSelector').style.display = 'flex'; setSourceSubWeek(7, document.querySelectorAll('.source-pill')[3]); }
    else if (mode === 'month') { document.getElementById('sourceMonthSelectorWrapper').style.display = 'block'; updateSourceMonthData(); }
    else if (mode === 'year') {
        let labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let data = Array.from({length: 12}, () => Math.random() * 105 + 50); // slightly higher for source
        let total = data.reduce((a, b) => a + b, 0);
        document.getElementById('sourceTimeLabel').innerText = "Year 2026";
        document.getElementById('sourceTotalDisplay').innerText = total.toFixed(1) + " kWh";
        document.getElementById('sourceAvgLabel').innerText = "Total: 1.3 MWh";
        sourceChart.data.labels = labels; sourceChart.data.datasets[0].data = data; sourceChart.update();
    }
}

function setSourceSubWeek(weekNum, element) {
    document.querySelectorAll('.source-pill').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let data = Array.from({length: 7}, () => Math.random() * 11 + weekNum);
    let total = data.reduce((a, b) => a + b, 0);
    document.getElementById('sourceTimeLabel').innerText = weekNum === 7 ? "9 Feb - 15 Feb (Week 7)" : `Week ${weekNum}`;
    document.getElementById('sourceTotalDisplay').innerText = total.toFixed(1) + " kWh";
    document.getElementById('sourceAvgLabel').innerText = "Daily Avg: " + (total/7).toFixed(1) + " kWh";
    sourceChart.data.labels = days; sourceChart.data.datasets[0].data = data; sourceChart.update();
}

function updateSourceDayData() {
    const dateStr = new Date(document.getElementById('sourceDaySelect').value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let labels = Array.from({length: 24}, (_, i) => i < 10 ? "0" + i : i);
    let data = Array.from({length: 24}, () => Math.random() * 2.8);
    let total = data.reduce((a, b) => a + b, 0);
    document.getElementById('sourceTimeLabel').innerText = `Source on ${dateStr}`;
    document.getElementById('sourceTotalDisplay').innerText = total.toFixed(1) + " kWh";
    document.getElementById('sourceAvgLabel').innerText = "Peak: 8 PM";
    sourceChart.data.labels = labels; sourceChart.data.datasets[0].data = data; sourceChart.update();
}

function updateSourceMonthData() {
    const select = document.getElementById('sourceMonthSelect');
    let labels = Array.from({length: 30}, (_, i) => (i+1).toString());
    let data = Array.from({length: 30}, () => Math.random() * 11 + 2);
    let total = data.reduce((a, b) => a + b, 0);
    document.getElementById('sourceTimeLabel').innerText = `Source for ${select.options[select.selectedIndex].text}`;
    document.getElementById('sourceTotalDisplay').innerText = total.toFixed(1) + " kWh";
    document.getElementById('sourceAvgLabel').innerText = "Daily Avg: " + (total/30).toFixed(1) + " kWh";
    sourceChart.data.labels = labels; sourceChart.data.datasets[0].data = data; sourceChart.update();
}

function updateSourceMinuteData() {
    let labels = [], data = [], now = new Date();
    for(let i = 59; i >= 0; i--) {
        let pastTime = new Date(now.getTime() - (i * 60000));
        let mins = pastTime.getMinutes().toString().padStart(2, '0');
        labels.push(mins === '00' ? `${pastTime.getHours() % 12 || 12}:00` : mins);
        data.push(Math.random() * 1.2 + 0.6); 
    }
    document.getElementById('sourceTotalDisplay').innerText = data.reduce((a, b) => a + b, 0).toFixed(2) + " kWh";
    document.getElementById('sourceAvgLabel').innerText = "Updating in real-time...";
    
    sourceChart.options.scales.x.grid.display = true;
    sourceChart.options.scales.x.grid.drawOnChartArea = true;
    sourceChart.options.scales.x.grid.color = (context) => (context.index !== undefined && labels[context.index].includes(':00')) ? 'rgba(255, 255, 255, 0.4)' : 'transparent';
    sourceChart.options.scales.x.grid.borderDash = [5, 5]; 
    
    sourceChart.data.labels = labels; sourceChart.data.datasets[0].data = data; sourceChart.update();
}

function updateSourceHourData() {
    const dateStr = new Date(document.getElementById('sourceHourDateSelect').value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let h = parseInt(document.getElementById('sourceHourTimeSelect').value);
    let displayHour = h % 12 || 12, ampm = h >= 12 ? 'PM' : 'AM';
    let labels = Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0'));
    let data = Array.from({length: 60}, () => Math.random() * 1.8);
    
    document.getElementById('sourceTimeLabel').innerText = `Source on ${dateStr} (${displayHour}:00 ${ampm} - ${displayHour}:59 ${ampm})`;
    document.getElementById('sourceTotalDisplay').innerText = data.reduce((a, b) => a + b, 0).toFixed(2) + " kWh";
    document.getElementById('sourceAvgLabel').innerText = "Hourly Total";
    sourceChart.data.labels = labels; sourceChart.data.datasets[0].data = data; sourceChart.update();
}