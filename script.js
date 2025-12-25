document.addEventListener('DOMContentLoaded', () => {
    // Google Sheet URL (CSV Format)
    const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1QPeJW0LbygqAyXF2Nhsu5fkRosaPrwK-JgP9L00o7hs/export?format=csv';

    function fetchData() {
        console.log("Fetching live data...");
        // Cache busting to ensure we get the latest data
        const syncUrl = SHEET_CSV_URL + '&t=' + Date.now();

        function cleanAmount(str) {
            if (!str) return 0;
            // Aggressive clean: keep only digits and the LAST decimal separator
            let cleaned = str.replace(/[^0-9,.]/g, '').replace(',', '.');
            return parseFloat(cleaned) || 0;
        }

        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            const sep = line.includes(';') ? ';' : ',';
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') inQuotes = !inQuotes;
                else if (line[i] === sep && !inQuotes) { result.push(current.trim()); current = ''; }
                else current += line[i];
            }
            result.push(current.trim());
            return result.map(v => v.replace(/^"(.*)"$/, '$1').trim());
        }

        fetch(syncUrl)
            .then(response => response.text())
            .then(csvText => {
                const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
                if (lines.length === 0) return;
                const rows = lines.map(line => parseCSVLine(line));

                // Dynamically find column indices
                const headers = rows[0].map(h => h.toLowerCase());
                const montantIdx = headers.findIndex(h => h.includes('montant')) !== -1 ? headers.findIndex(h => h.includes('montant')) : 1;
                const goalIdx = headers.findIndex(h => h.includes('objectif')) !== -1 ? headers.findIndex(h => h.includes('objectif')) : 2;
                const expenseIdx = headers.findIndex(h => h.includes('dépense')) !== -1 ? headers.findIndex(h => h.includes('dépense')) : 3;
                const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('mise')) !== -1 ? headers.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('mise')) : -1;

                let lastUpdateValue = "";

                let totalCollected = 0;
                let goalAmount = 50000;
                let fixedExpenses = "4 000 $";

                if (rows.length > 1) {
                    // Goal & Expenses from the first DATA row
                    if (rows[1][goalIdx]) goalAmount = cleanAmount(rows[1][goalIdx]) || 50000;
                    if (rows[1][expenseIdx]) fixedExpenses = rows[1][expenseIdx];

                    // Sum Column 'montant'
                    for (let i = 1; i < rows.length; i++) {
                        if (rows[i][montantIdx]) {
                            totalCollected += cleanAmount(rows[i][montantIdx]);
                        }
                        // Track potentially latest date
                        if (dateIdx !== -1 && rows[i][dateIdx]) {
                            lastUpdateValue = rows[i][dateIdx];
                        }
                    }
                }

                // Date & Time Formatting
                let displayDate = "";
                try {
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, '0');
                    const mm = String(now.getMinutes()).padStart(2, '0');
                    const timeStr = `${hh}:${mm}`;

                    const options = { day: 'numeric', month: 'long', year: 'numeric' };
                    const dateStr = now.toLocaleDateString('fr-FR', options);

                    // Clean the value from the sheet to prevent hidden characters
                    const cleanDateValue = (lastUpdateValue || "").replace(/[\r\n]/g, "").trim();

                    if (cleanDateValue.length > 0) {
                        displayDate = "Dernière mise à jour : " + cleanDateValue + " à " + timeStr;
                    } else {
                        displayDate = "Dernière actualisation : " + dateStr + " à " + timeStr;
                    }
                } catch (e) {
                    console.error("Date formatting error:", e);
                    displayDate = "Données actualisées";
                }

                const lastUpdateEl = document.getElementById('last-update');
                if (lastUpdateEl) {
                    lastUpdateEl.innerHTML = `<span>${displayDate}</span>`;
                    lastUpdateEl.style.display = 'block';
                    lastUpdateEl.style.visibility = 'visible';
                }

                const remaining = Math.max(0, goalAmount - totalCollected);
                const percentage = Math.min(100, (totalCollected / goalAmount) * 100);

                // Update DOM elements with safety checks
                const goalEl = document.getElementById('goal-amount');
                const remainingEl = document.getElementById('remaining-amount');
                const expensesEl = document.getElementById('expenses-amount');
                const progressAmountEl = document.querySelector('.amount');
                const goalLabelEl = document.querySelector('.goal-label');

                if (goalEl) goalEl.innerHTML = formatQuebecCurrency(goalAmount, true) + ' $';
                if (remainingEl) remainingEl.innerHTML = formatQuebecCurrency(remaining, true) + ' $';
                if (expensesEl) {
                    const expVal = cleanAmount(fixedExpenses);
                    expensesEl.innerHTML = formatQuebecCurrency(expVal, true) + ' / mois';
                }

                if (progressAmountEl) {
                    const prevTarget = parseFloat(progressAmountEl.getAttribute('data-target')) || 0;
                    progressAmountEl.setAttribute('data-target', totalCollected);
                    animateValue(progressAmountEl, prevTarget, totalCollected, 2000);
                }

                if (goalLabelEl) goalLabelEl.innerHTML = 'sur ' + formatQuebecCurrency(goalAmount, true) + ' $';

                // Update Progress Ring
                const circle = document.querySelector('.progress-ring__circle');
                if (circle) {
                    const circumference = circle.getTotalLength();
                    const offset = circumference - (percentage / 100) * circumference;

                    circle.style.strokeDasharray = `${circumference} ${circumference}`;
                    circle.style.transition = 'stroke-dashoffset 1.5s ease-in-out';
                    circle.style.strokeDashoffset = offset;
                }
            })
            .catch(error => console.error('Error fetching data:', error));
    }

    // Initial fetch
    fetchData();

    // Auto-sync every 30 seconds
    setInterval(fetchData, 30000);


    // Circular Progress Animation (Initial Placeholder removed, logic moved to fetch)
    const circle = document.querySelector('.progress-ring__circle');
    if (circle) {
        const circumference = circle.getTotalLength();
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference;
    }


    // Generate QR Codes with a small delay to ensure DOM is ready
    setTimeout(() => {
        // Generate Donation QR Code
        const donationQR = document.getElementById("qrcode");
        if (donationQR) {
            new QRCode(donationQR, {
                text: "Don.acmrn@gmail.com",
                width: 64,
                height: 64,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        // Generate Site QR Code (Desktop)
        const siteQR = document.getElementById("site-qrcode");
        if (siteQR) {
            new QRCode(siteQR, {
                text: "https://acm-rn.github.io/Mosquee-RN/",
                width: 100,
                height: 100,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }, 500);

    // Initial theme load
    const savedTheme = localStorage.getItem('theme') || 'night';
    document.documentElement.setAttribute('data-theme', savedTheme === 'day' ? 'light' : 'dark');
    updateThemeIcon(savedTheme);
});

function formatQuebecCurrency(number, isHtml = false) {
    const formatted = new Intl.NumberFormat('fr-CA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);

    // Quebec format is already space-separated thousands and comma decimal
    if (isHtml) {
        // Find the comma and wrap the decimal part in a span
        const lastCommaIndex = formatted.lastIndexOf(',');
        if (lastCommaIndex !== -1) {
            const main = formatted.substring(0, lastCommaIndex);
            const decimals = formatted.substring(lastCommaIndex); // Includes the comma
            return `${main}<span class="cents">${decimals}</span>`;
        }
    }
    return formatted;
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'day' : 'night';
    const newTheme = currentTheme === 'day' ? 'night' : 'day';
    document.documentElement.setAttribute('data-theme', newTheme === 'day' ? 'light' : 'dark');
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.className = theme === 'day' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

/* Sharing Functions */
function getShareText() {
    return encodeURIComponent("Faites un don pour la Mosquée de Rouyn-Noranda : https://acm-rn.github.io/Mosquee-RN/");
}

function shareWhatsApp() {
    window.open(`https://wa.me/?text=${getShareText()}`, '_blank');
}

function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
}

function copySiteLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        alert("Lien copié !");
    });
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentVal = easeOutQuart * (end - start) + start;
        obj.innerHTML = formatQuebecCurrency(currentVal, true);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function copyEmail() {
    const emailText = document.getElementById('donation-email').innerText;
    const tooltip = document.getElementById('copy-tooltip');
    navigator.clipboard.writeText(emailText).then(() => {
        tooltip.classList.add('show');
        setTimeout(() => {
            tooltip.classList.remove('show');
        }, 2000);
    });
}

/* Quran Verses Popup Logic */
const verses = [
    {
        arabic: "(مَّثَلُ الَّذِينَ يُنفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ أَنبَتَتْ سَبْعَ سَنَابِلَ فِي كُلِّ سُنبُلَةٍ مِّائَةُ حَبَّةٍ ۗ وَاللَّهُ يُضَاعِفُ لِمَن يَشَاءُ ۗ وَاللَّهُ وَاسِعٌ عَلِيمٌ)",
        french: "Ceux qui dépensent leurs biens dans le sentier d'Allah ressemblent à un grain d'où naissent sept épis, à cent grains l'épi. Car Allah multiplie la récompense à qui Il veut et la grâce d'Allah est immense, et Il est Omniscient.",
        ref: "Sourate Al-Baqarah, 2:261"
    },
    {
        arabic: "لَن تَنَالُوا الْبِرَّ حَتَّىٰ تُنفِقُوا مِمَّا تُحِبُّونَ ۚ وَمَا تُنفِقُوا مِن شَيْءٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ",
        french: "Vous n'atteindrez la vraie piété que si vous faites largesses de ce que vous chérissez. Tout ce que vous faites comme dépense, Allah le sait parfaitement.",
        ref: "Sourate Al-Imran, 3:92"
    },
    {
        arabic: "الَّذِينَ يُنفِقُونَ أَمْوَالَهُم بِاللَّيْلِ وَالنَّهَارِ سِرًّا وَعَلَانِيَةً فَلَهُمْ أَجْرُهُمْ عِندَ رَبِّهِمْ وَلَا خَوْفٌ عَلَيْهِمْ وَلَا هُمْ يَحْزَنُونَ",
        french: "Ceux qui, de nuit et de jour, en secret et ouvertement, dépensent leurs biens (dans les bonnes oeuvres), ont leur salaire auprès de leur Seigneur. Il n'y a aucune crainte à avoir pour eux, et ils ne seront point affligés.",
        ref: "Sourate Al-Baqarah, 2:274"
    },
    {
        arabic: "وَمَا أَنفَقْتُم مِّن شَيْءٍ فَهُوَ يُخْلِفُهُ ۖ وَهُوَ خَيْرُ الرَّازِقِينَ",
        french: "Et toute dépense que vous faites (dans le bien), Il la remplace, et c'est Lui le Meilleur des donateurs.",
        ref: "Sourate Saba, 34:39"
    }
];

function showOverlay() {
    const overlay = document.getElementById('quran-overlay');
    const arabicEl = document.getElementById('verse-arabic');
    const frenchEl = document.getElementById('verse-french');
    const refEl = document.getElementById('verse-ref');

    const verse = verses[Math.floor(Math.random() * verses.length)];

    arabicEl.innerText = verse.arabic;
    frenchEl.innerText = verse.french;
    refEl.innerText = verse.ref;

    overlay.classList.remove('hidden');

    // Auto hide after 30 seconds
    setTimeout(closeOverlay, 30000);
}

function closeOverlay() {
    const overlay = document.getElementById('quran-overlay');
    overlay.classList.add('hidden');
}

// Initial call to set interval (2 minutes)
setInterval(showOverlay, 120000);

// Uncomment to test popup immediately
// setTimeout(showOverlay, 3000);
