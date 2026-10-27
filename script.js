/**
 * KinoPrime - Online Kinoteatr va Film Portali
 * Universal Player (YouTube/MP4), Xavfsiz Backend API, Sevimlilar, Ko'rishlar va CRUD
 */

// ================= 1. MA'LUMOTLAR BAZASI VA KONSTANTALAR =================
const API_URL = 'api.php';
const DB_NAME = 'KinoPrimeDB';
const DB_VERSION = 2; // Migratsiya uchun yangilandi (views qo'shildi)
const STORE_NAME = 'movies';

const ADMIN_STORAGE_KEY = 'kinoprime_admin_auth';
const ADMIN_TOKEN_KEY = 'kinoprime_admin_token';
const FAVORITES_STORAGE_KEY = 'kinoprime_favorites';

let isPhpBackendAvailable = false;

// Standart namunaviy kinolar (Offline / IndexedDB zaxira rejimi uchun)
const INITIAL_MOVIES = [
    {
        id: 'kino_1',
        title: "Qasoskorlar: Intiho (Avengers Endgame)",
        genre: "Jangari",
        country: "AQSH",
        year: 2024,
        language: "O'zbekcha",
        rating: 8.9,
        quality: "4K Ultra HD",
        duration: "181 daqiqa",
        description: "Tanos butun koinotning yarmini yo'q qilganidan so'ng, omon qolgan Qasoskorlar bor kuchlarini birlashtirib, vaqt bo'ylab sayohat qilishadi va koinotni qutqarishga urinishadi.",
        type: "url",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        posterUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80",
        views: 1420,
        createdAt: Date.now() - 10000
    },
    {
        id: 'kino_2',
        title: "Yulduzlararo (Interstellar)",
        genre: "Fantastika",
        country: "AQSH",
        year: 2023,
        language: "O'zbekcha",
        rating: 8.7,
        quality: "4K Ultra HD",
        duration: "169 daqiqa",
        description: "Yer yuzida hayot xavf ostida qolganda, bir guruh fazogirlar insoniyat uchun yangi sayyora izlash maqsadida qora tuynuk orqali boshqa galaktikaga yo'l oladilar.",
        type: "url",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        posterUrl: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80",
        views: 980,
        createdAt: Date.now() - 20000
    },
    {
        id: 'kino_3',
        title: "Parazitlar (Parasite)",
        genre: "Drama",
        country: "Janubiy Koreya",
        year: 2021,
        language: "O'zbekcha",
        rating: 8.5,
        quality: "Full HD 1080p",
        duration: "132 daqiqa",
        description: "Kambag'al oila a'zolari birin-ketin boy oilaning xonadoniga turli kasb egalari sifatida ishga joylashishadi. Biroq kutilmagan sir ularning rejalarini ostin-ustun qiladi.",
        type: "url",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        posterUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80",
        views: 640,
        createdAt: Date.now() - 30000
    },
    {
        id: 'kino_4',
        title: "O'tgan Kunlar (Yangi Talqin)",
        genre: "Tarixiy",
        country: "O'zbekiston",
        year: 2024,
        language: "O'zbekcha",
        rating: 8.4,
        quality: "4K Ultra HD",
        duration: "145 daqiqa",
        description: "Abdulla Qodiriyning mashhur romani asosida suratga olingan buyuk muhabbat va tarixiy burilishlar haqidagi qahramonlik dramasi.",
        type: "url",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        posterUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
        views: 1120,
        createdAt: Date.now() - 40000
    }
];

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const countReq = store.count();

            countReq.onsuccess = () => {
                if (countReq.result === 0) {
                    const writeTx = db.transaction(STORE_NAME, 'readwrite');
                    const writeStore = writeTx.objectStore(STORE_NAME);
                    INITIAL_MOVIES.forEach(movie => writeStore.add(movie));
                    writeTx.oncomplete = () => resolve(db);
                } else {
                    resolve(db);
                }
            };
        };

        request.onerror = (event) => {
            console.error('IndexedDB xatolik:', event.target.error);
            reject(event.target.error);
        };
    });
}

function updateBackendStatusBadge(isOnline) {
    const badges = document.querySelectorAll('.backend-badge');
    badges.forEach(b => {
        if (isOnline) {
            b.className = 'backend-badge online';
            b.innerHTML = '🟢 Backend: PHP Faol';
            b.title = 'PHP REST API va SQLite ma\'lumotlar bazasi faol ishlamoqda.';
        } else {
            b.className = 'backend-badge offline';
            b.innerHTML = '🟡 Lokal Rejim';
            b.title = 'PHP serverga ulanilmadi. Ma\'lumotlar brauzer xotirasida (IndexedDB) ishlaydi.';
        }
    });
}

function getAdminAuthHeaders() {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
    const headers = {};
    if (token) {
        headers['X-Admin-Token'] = token;
    }
    return headers;
}

// Barcha kinolarni olish
async function getAllMoviesFromDB() {
    try {
        const res = await fetch(`${API_URL}?sort=newest`);
        if (res.ok) {
            const result = await res.json();
            if (result.success && Array.isArray(result.data)) {
                isPhpBackendAvailable = true;
                updateBackendStatusBadge(true);
                return result.data.map(m => ({
                    id: m.id,
                    title: m.title,
                    genre: m.genre,
                    country: m.country,
                    year: Number(m.year),
                    language: m.language,
                    rating: parseFloat(m.rating),
                    quality: m.quality,
                    duration: m.duration,
                    description: m.description,
                    type: m.type,
                    videoUrl: m.video_url,
                    posterUrl: m.poster_url,
                    views: Number(m.views || 0),
                    createdAt: m.created_at * 1000
                }));
            }
        }
    } catch (e) {
        // PHP server bo'lmasa lokal IndexedDB ga o'tadi
    }

    isPhpBackendAvailable = false;
    updateBackendStatusBadge(false);

    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Yangi kino qo'shish
async function addMovieToDB(movieData, formData = null) {
    if (isPhpBackendAvailable && formData) {
        try {
            const res = await fetch(`${API_URL}?action=add`, {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                return result;
            } else {
                throw new Error(result.error || "Server xatosi");
            }
        } catch (err) {
            if (err.message && err.message.includes("Ruxsat")) throw err;
            console.warn('PHP API xatosi, lokal bazaga saqlanadi:', err);
        }
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(movieData);

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Kinoni tahrirlash (Update)
async function updateMovieInDB(movieData, formData = null) {
    if (isPhpBackendAvailable && formData) {
        try {
            const res = await fetch(`${API_URL}?action=edit`, {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                return result;
            } else {
                throw new Error(result.error || "Server xatosi");
            }
        } catch (err) {
            if (err.message && err.message.includes("Ruxsat")) throw err;
            console.warn('PHP API tahrirlash xatosi, lokal bazaga saqlanadi:', err);
        }
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(movieData);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

// Kinoni o'chirish
async function deleteMovieFromDB(id) {
    if (isPhpBackendAvailable) {
        try {
            const res = await fetch(`${API_URL}?action=delete&id=${id}`, {
                method: 'POST',
                headers: getAdminAuthHeaders()
            });
            const result = await res.json();
            if (result.success) {
                return true;
            } else {
                throw new Error(result.error || "O'chirishda xatolik");
            }
        } catch (err) {
            if (err.message && err.message.includes("Ruxsat")) throw err;
            console.warn('PHP API o\'chirish xatosi:', err);
        }
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

// Ko'rishlar sonini oshirish
async function incrementMovieViews(id) {
    if (isPhpBackendAvailable) {
        try {
            fetch(`${API_URL}?action=view&id=${id}`, { method: 'POST' }).catch(() => {});
        } catch (e) {}
    }
}

// ================= 2. YORDAMCHI FUNKSIYALAR VA UNIVERSAL PLAYER =================
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// Video URL formatini aniqlash (YouTube, Vimeo yoki to'g'ridan-to'g'ri MP4)
function parseVideoSource(url) {
    if (!url) return { type: 'empty', src: '' };
    const trimmed = url.trim();

    // YouTube: watch, embed, shorts, youtu.be
    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
        return {
            type: 'youtube',
            src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`
        };
    }

    // Vimeo
    const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
        return {
            type: 'vimeo',
            src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
        };
    }

    return {
        type: 'direct',
        src: trimmed
    };
}

function resolveMediaUrls(movie) {
    let videoSrc = '';
    let posterSrc = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80';

    if (movie.type === 'file') {
        if (movie.videoBlob) {
            videoSrc = URL.createObjectURL(movie.videoBlob);
        } else if (movie.videoUrl) {
            videoSrc = movie.videoUrl;
        }
        if (movie.posterBlob) {
            posterSrc = URL.createObjectURL(movie.posterBlob);
        } else if (movie.posterUrl) {
            posterSrc = movie.posterUrl;
        }
    } else {
        videoSrc = movie.videoUrl || '';
        if (movie.posterUrl && movie.posterUrl.trim() !== '') {
            posterSrc = movie.posterUrl;
        }
    }

    return { videoSrc, posterSrc };
}

// ================= 3. SEVIMLILAR (WATCHLIST / FAVORITES) =================
function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function isMovieFavorite(id) {
    return getFavorites().map(String).includes(String(id));
}

function toggleMovieFavorite(id, title = '') {
    let favs = getFavorites().map(String);
    const strId = String(id);
    let isNowFav = false;

    if (favs.includes(strId)) {
        favs = favs.filter(x => x !== strId);
        showToast(`"${title || 'Kino'}" sevimlilardan olib tashlandi`, 'info');
        isNowFav = false;
    } else {
        favs.push(strId);
        showToast(`"${title || 'Kino'}" sevimlilarga qo'shildi! ❤️`, 'success');
        isNowFav = true;
    }

    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
    updateFavoritesUI();
    filterAndRenderMovies();
    return isNowFav;
}

function updateFavoritesUI() {
    const badge = document.getElementById('favCountBadge');
    if (badge) {
        badge.textContent = getFavorites().length;
    }
}

// ================= 4. BOSH SAHIFA (INDEX.HTML) MANTIQI =================
const moviesContainer = document.getElementById('moviesContainer');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterGenre = document.getElementById('filterGenre');
const filterCountry = document.getElementById('filterCountry');
const filterYear = document.getElementById('filterYear');
const filterLanguage = document.getElementById('filterLanguage');
const filterRating = document.getElementById('filterRating');
const sortOrder = document.getElementById('sortOrder');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const videoCountEl = document.getElementById('videoCount');

// Hero banner
const heroBackdrop = document.getElementById('heroBackdrop');
const heroTitle = document.getElementById('heroTitle');
const heroRating = document.getElementById('heroRating');
const heroYear = document.getElementById('heroYear');
const heroCountry = document.getElementById('heroCountry');
const heroGenre = document.getElementById('heroGenre');
const heroLang = document.getElementById('heroLang');
const heroQuality = document.getElementById('heroQuality');
const heroDesc = document.getElementById('heroDesc');
const heroWatchBtn = document.getElementById('heroWatchBtn');

// Nav quick filters
const navAllMovies = document.getElementById('navAllMovies');
const navTopRated = document.getElementById('navTopRated');
const navNewPremiers = document.getElementById('navNewPremiers');
const navMostViewed = document.getElementById('navMostViewed');
const navFavorites = document.getElementById('navFavorites');

// Modal player elements
const watchModal = document.getElementById('watchModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalVideoPlayer = document.getElementById('modalVideoPlayer');
const modalIframePlayer = document.getElementById('modalIframePlayer');
const modalTitle = document.getElementById('modalTitle');
const modalRating = document.getElementById('modalRating');
const modalQuality = document.getElementById('modalQuality');
const modalLanguage = document.getElementById('modalLanguage');
const modalGenre = document.getElementById('modalGenre');
const modalYear = document.getElementById('modalYear');
const modalCountry = document.getElementById('modalCountry');
const modalDuration = document.getElementById('modalDuration');
const modalGenreFull = document.getElementById('modalGenreFull');
const modalDescription = document.getElementById('modalDescription');
const modalDownloadBtn = document.getElementById('modalDownloadBtn');
const modalViews = document.getElementById('modalViews');
const modalViewsTag = document.getElementById('modalViewsTag');
const modalFavBtn = document.getElementById('modalFavBtn');

let allMovies = [];
let featuredMovie = null;
let currentModalMovie = null;
let viewOnlyFavorites = false;

async function initIndexPage() {
    if (!moviesContainer) return;

    updateFavoritesUI();

    try {
        allMovies = await getAllMoviesFromDB();
        setupHeroBanner();
        filterAndRenderMovies();
    } catch (err) {
        console.error('Kinolarni yuklashda xatolik:', err);
        showToast("Kinolarni yuklashda xatolik yuz berdi!", "error");
    }

    // Filtrlar hodisalari
    const filterElements = [filterGenre, filterCountry, filterYear, filterLanguage, filterRating, sortOrder];
    filterElements.forEach(el => {
        if (el) {
            el.addEventListener('change', () => filterAndRenderMovies());
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const hasText = Boolean(searchInput.value.trim());
            if (clearSearchBtn) {
                clearSearchBtn.style.display = hasText ? 'block' : 'none';
            }
            filterAndRenderMovies();
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                clearSearchBtn.style.display = 'none';
                searchInput.focus();
                filterAndRenderMovies();
            }
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (clearSearchBtn) clearSearchBtn.style.display = 'none';
            if (filterGenre) filterGenre.value = 'all';
            if (filterCountry) filterCountry.value = 'all';
            if (filterYear) filterYear.value = 'all';
            if (filterLanguage) filterLanguage.value = 'all';
            if (filterRating) filterRating.value = 'all';
            if (sortOrder) sortOrder.value = 'newest';
            viewOnlyFavorites = false;
            updateActiveNavLink(navAllMovies);
            filterAndRenderMovies();
            showToast("Barcha filtrlar tozalandi", "info");
        });
    }

    // Nav tezkor tugmalari
    function updateActiveNavLink(activeEl) {
        document.querySelectorAll('.nav-menu .nav-link').forEach(l => l.classList.remove('active'));
        if (activeEl) activeEl.classList.add('active');
    }

    if (navAllMovies) {
        navAllMovies.addEventListener('click', (e) => {
            e.preventDefault();
            viewOnlyFavorites = false;
            updateActiveNavLink(navAllMovies);
            filterAndRenderMovies();
        });
    }

    if (navTopRated) {
        navTopRated.addEventListener('click', (e) => {
            e.preventDefault();
            viewOnlyFavorites = false;
            if (filterRating) filterRating.value = '8.0';
            if (sortOrder) sortOrder.value = 'ratingDesc';
            updateActiveNavLink(navTopRated);
            filterAndRenderMovies();
            document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (navNewPremiers) {
        navNewPremiers.addEventListener('click', (e) => {
            e.preventDefault();
            viewOnlyFavorites = false;
            if (filterYear) filterYear.value = '2024';
            if (sortOrder) sortOrder.value = 'newest';
            updateActiveNavLink(navNewPremiers);
            filterAndRenderMovies();
            document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (navMostViewed) {
        navMostViewed.addEventListener('click', (e) => {
            e.preventDefault();
            viewOnlyFavorites = false;
            if (sortOrder) sortOrder.value = 'viewsDesc';
            updateActiveNavLink(navMostViewed);
            filterAndRenderMovies();
            document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (navFavorites) {
        navFavorites.addEventListener('click', (e) => {
            e.preventDefault();
            viewOnlyFavorites = true;
            updateActiveNavLink(navFavorites);
            filterAndRenderMovies();
            document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Modalni yopish
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }

    if (watchModal) {
        watchModal.addEventListener('click', (e) => {
            if (e.target === watchModal) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && watchModal && watchModal.style.display !== 'none') {
            closeModal();
        }
    });

    if (heroWatchBtn) {
        heroWatchBtn.addEventListener('click', () => {
            if (featuredMovie) {
                openMoviePlayer(featuredMovie);
            }
        });
    }

    if (modalFavBtn) {
        modalFavBtn.addEventListener('click', () => {
            if (currentModalMovie) {
                const isNowFav = toggleMovieFavorite(currentModalMovie.id, currentModalMovie.title);
                modalFavBtn.classList.toggle('active', isNowFav);
                modalFavBtn.innerHTML = isNowFav ? '❤️ Sevimlilarda' : '🤍 Sevimlilarga';
            }
        });
    }
}

function setupHeroBanner() {
    if (!heroBackdrop || allMovies.length === 0) return;

    featuredMovie = [...allMovies].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    if (!featuredMovie) return;

    const { posterSrc } = resolveMediaUrls(featuredMovie);
    heroBackdrop.style.backgroundImage = `url('${posterSrc}')`;
    if (heroTitle) heroTitle.textContent = featuredMovie.title;
    if (heroRating) heroRating.textContent = `⭐ ${featuredMovie.rating || 8.0} IMDb`;
    if (heroYear) heroYear.textContent = featuredMovie.year || 2024;
    if (heroCountry) heroCountry.textContent = featuredMovie.country || 'AQSH';
    if (heroGenre) heroGenre.textContent = featuredMovie.genre || 'Jangari';
    if (heroLang) heroLang.textContent = featuredMovie.language || "O'zbekcha";
    if (heroQuality) heroQuality.textContent = featuredMovie.quality || '4K Ultra HD';
    if (heroDesc) heroDesc.textContent = featuredMovie.description || '';
}

function filterAndRenderMovies() {
    if (!moviesContainer) return;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const genre = filterGenre ? filterGenre.value : 'all';
    const country = filterCountry ? filterCountry.value : 'all';
    const yearVal = filterYear ? filterYear.value : 'all';
    const language = filterLanguage ? filterLanguage.value : 'all';
    const ratingVal = filterRating ? filterRating.value : 'all';
    const sort = sortOrder ? sortOrder.value : 'newest';
    const favList = getFavorites().map(String);

    const filtered = allMovies.filter(m => {
        if (viewOnlyFavorites && !favList.includes(String(m.id))) {
            return false;
        }

        if (query) {
            const titleMatch = m.title && m.title.toLowerCase().includes(query);
            const descMatch = m.description && m.description.toLowerCase().includes(query);
            const genreMatch = m.genre && m.genre.toLowerCase().includes(query);
            if (!titleMatch && !descMatch && !genreMatch) return false;
        }

        if (genre !== 'all' && m.genre !== genre) return false;
        if (country !== 'all' && m.country !== country) return false;

        if (yearVal !== 'all') {
            if (yearVal === 'old') {
                if (Number(m.year) > 2019) return false;
            } else {
                if (String(m.year) !== yearVal) return false;
            }
        }

        if (language !== 'all') {
            if (!m.language || !m.language.includes(language)) return false;
        }

        if (ratingVal !== 'all') {
            const minRating = parseFloat(ratingVal);
            if (parseFloat(m.rating || 0) < minRating) return false;
        }

        return true;
    });

    // Saralash
    filtered.sort((a, b) => {
        if (sort === 'viewsDesc') return (b.views || 0) - (a.views || 0);
        if (sort === 'ratingDesc') return (b.rating || 0) - (a.rating || 0);
        if (sort === 'yearDesc') return (b.year || 0) - (a.year || 0);
        if (sort === 'titleAsc') return a.title.localeCompare(b.title);
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (videoCountEl) {
        videoCountEl.textContent = `${filtered.length} ta kino topildi`;
    }

    moviesContainer.innerHTML = '';

    if (filtered.length === 0) {
        moviesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${viewOnlyFavorites ? '❤️' : '🎬'}</div>
                <div class="empty-title">${viewOnlyFavorites ? 'Sevimlilar ro\'yxati bo\'sh' : 'Kino topilmadi'}</div>
                <p class="empty-desc">${viewOnlyFavorites ? 'Hozircha hech qanday kinoni sevimlilarga qo\'shmadingiz.' : 'Tanlangan parametrlar bo\'yicha kino topilmadi. Filtrlarni o\'zgartirib ko\'ring.'}</p>
            </div>
        `;
        return;
    }

    filtered.forEach(movie => {
        const { posterSrc } = resolveMediaUrls(movie);
        const safeTitle = escapeHTML(movie.title);
        const safeGenre = escapeHTML(movie.genre || 'Kino');
        const safeCountry = escapeHTML(movie.country || 'AQSH');
        const safeYear = escapeHTML(movie.year || 2024);
        const safeRating = escapeHTML(movie.rating || '8.0');
        const safeQuality = escapeHTML(movie.quality || 'Full HD');
        const safeLang = escapeHTML(movie.language || "O'zbekcha");
        const safeViews = (movie.views || 0).toLocaleString();
        const isFav = isMovieFavorite(movie.id);

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="poster-wrapper">
                <img src="${posterSrc}" alt="${safeTitle}" class="poster-img" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450?text=Kino+Poster'">
                <div class="poster-overlay-top">
                    <span class="quality-tag">${safeQuality}</span>
                    <span class="rating-badge">⭐ ${safeRating}</span>
                </div>
                <button type="button" class="card-fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Sevimlilardan o\'chirish' : 'Sevimlilarga qo\'shish'}">
                    ${isFav ? '❤️' : '🤍'}
                </button>
                <div class="play-hover-btn">▶</div>
            </div>
            <div class="movie-card-content">
                <h4 class="movie-card-title" title="${safeTitle}">${safeTitle}</h4>
                <div class="movie-card-meta">
                    <span>${safeYear} • ${safeCountry}</span>
                    <span>👁️ ${safeViews}</span>
                </div>
                <div class="movie-card-tags">
                    <span class="badge">${safeGenre}</span>
                    <span class="lang-tag">${safeLang}</span>
                </div>
            </div>
        `;

        // Yurakchani bosganda kino ochilib ketmasligi uchun event propagation to'xtatiladi
        const favBtn = card.querySelector('.card-fav-btn');
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMovieFavorite(movie.id, movie.title);
        });

        card.addEventListener('click', () => openMoviePlayer(movie));
        moviesContainer.appendChild(card);
    });
}

// Universal Kinoteatr Pleyerini ochish
function openMoviePlayer(movie) {
    if (!watchModal) return;

    currentModalMovie = movie;
    const { videoSrc } = resolveMediaUrls(movie);
    const parsed = parseVideoSource(videoSrc);

    // Ko'rishlar sonini oshiramiz
    movie.views = (movie.views || 0) + 1;
    incrementMovieViews(movie.id);

    modalTitle.textContent = movie.title;
    modalRating.textContent = `⭐ ${movie.rating || 8.0} IMDb`;
    modalQuality.textContent = movie.quality || '4K Ultra HD';
    modalLanguage.textContent = movie.language || "O'zbekcha";
    modalGenre.textContent = movie.genre || 'Kino';
    modalGenreFull.textContent = movie.genre || 'Kino';
    modalYear.textContent = movie.year || '2024';
    modalCountry.textContent = movie.country || 'AQSH';
    modalDuration.textContent = movie.duration || '120 daqiqa';
    modalDescription.textContent = movie.description || "Ushbu film haqida to'liq ma'lumot tez orada taqdim etiladi.";

    if (modalViews) modalViews.textContent = movie.views.toLocaleString();
    if (modalViewsTag) modalViewsTag.textContent = `👁️ ${movie.views.toLocaleString()} ko'rildi`;

    const isFav = isMovieFavorite(movie.id);
    if (modalFavBtn) {
        modalFavBtn.classList.toggle('active', isFav);
        modalFavBtn.innerHTML = isFav ? '❤️ Sevimlilarda' : '🤍 Sevimlilarga';
    }

    // Yuklab olish tugmasi (faqat to'g'ridan-to'g'ri fayllar uchun)
    if (parsed.type === 'direct') {
        modalDownloadBtn.style.display = 'inline-flex';
        modalDownloadBtn.href = videoSrc;
        modalDownloadBtn.setAttribute('download', `${movie.title}.mp4`);
    } else {
        modalDownloadBtn.style.display = 'none';
    }

    // Universal video yoki iframe pleyer
    if (parsed.type === 'youtube' || parsed.type === 'vimeo') {
        if (modalVideoPlayer) {
            modalVideoPlayer.pause();
            modalVideoPlayer.style.display = 'none';
        }
        if (modalIframePlayer) {
            modalIframePlayer.style.display = 'block';
            modalIframePlayer.src = parsed.src;
        }
    } else {
        if (modalIframePlayer) {
            modalIframePlayer.style.display = 'none';
            modalIframePlayer.src = '';
        }
        if (modalVideoPlayer) {
            modalVideoPlayer.style.display = 'block';
            modalVideoPlayer.src = parsed.src;
            modalVideoPlayer.play().catch(() => {});
        }
    }

    watchModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Izohlarni yuklash va tomosha tarixiga yozish
    loadMovieComments(movie.id);
    recordWatchHistory(movie);
}

function closeModal() {
    if (!watchModal) return;
    if (modalVideoPlayer) {
        modalVideoPlayer.pause();
        modalVideoPlayer.src = '';
    }
    if (modalIframePlayer) {
        modalIframePlayer.src = '';
    }
    watchModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentModalMovie = null;
    filterAndRenderMovies(); // Ko'rishlar yangilanishi uchun
}

// ================= 5. ADMIN PANEL (ADMIN.HTML) MANTIQI =================
const adminAuthSection = document.getElementById('adminAuthSection');
const adminDashboard = document.getElementById('adminDashboard');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPasswordInput = document.getElementById('adminPassword');
const logoutBtn = document.getElementById('logoutBtn');

const tabUrlBtn = document.getElementById('tabUrlBtn');
const tabFileBtn = document.getElementById('tabFileBtn');
const uploadModeInput = document.getElementById('uploadMode');
const urlFields = document.getElementById('urlFields');
const fileFields = document.getElementById('fileFields');
const videoUrlInput = document.getElementById('videoUrlInput');
const posterUrlInput = document.getElementById('posterUrlInput');
const videoFileInput = document.getElementById('videoFile');
const posterFileInput = document.getElementById('posterFile');
const uploadForm = document.getElementById('uploadForm');
const adminVideoList = document.getElementById('adminVideoList');
const adminVideoCount = document.getElementById('adminVideoCount');

// Edit Modal elementlari
const editModal = document.getElementById('editModal');
const editModalCloseBtn = document.getElementById('editModalCloseBtn');
const editForm = document.getElementById('editForm');
const editMovieId = document.getElementById('editMovieId');
const editVideoTitle = document.getElementById('editVideoTitle');
const editVideoGenre = document.getElementById('editVideoGenre');
const editVideoCountry = document.getElementById('editVideoCountry');
const editVideoYear = document.getElementById('editVideoYear');
const editVideoLanguage = document.getElementById('editVideoLanguage');
const editVideoRating = document.getElementById('editVideoRating');
const editVideoQuality = document.getElementById('editVideoQuality');
const editVideoDuration = document.getElementById('editVideoDuration');
const editVideoDescription = document.getElementById('editVideoDescription');
const editVideoUrl = document.getElementById('editVideoUrl');
const editPosterUrl = document.getElementById('editPosterUrl');

let adminLoadedMovies = [];

function checkAdminAuth() {
    if (!adminAuthSection || !adminDashboard) return;

    const isAuthenticated = sessionStorage.getItem(ADMIN_STORAGE_KEY) === 'true';

    if (isAuthenticated) {
        adminAuthSection.style.display = 'none';
        adminDashboard.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'block';
        loadAdminMovies();
    } else {
        adminAuthSection.style.display = 'block';
        adminDashboard.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

function initAdminPage() {
    if (!adminAuthSection) return;

    checkAdminAuth();

    // Kirish (Backend token orqali)
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const entered = adminPasswordInput.value;

            try {
                const formData = new FormData();
                formData.append('password', entered);

                const res = await fetch(`${API_URL}?action=login`, {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        sessionStorage.setItem(ADMIN_STORAGE_KEY, 'true');
                        if (data.token) {
                            sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
                        }
                        showToast("Admin panelga muvaffaqiyatli kirdingiz!", "success");
                        checkAdminAuth();
                        return;
                    }
                }
            } catch (err) {
                // Offline rejim tekshiruvi
            }

            // Fallback (Offline rejim)
            if (entered === 'admin123') {
                sessionStorage.setItem(ADMIN_STORAGE_KEY, 'true');
                showToast("Lokal admin rejimiga kirdingiz!", "success");
                checkAdminAuth();
            } else {
                showToast("Noto'g'ri maxfiy parol! Standart parol: admin123", "error");
                adminPasswordInput.value = '';
                adminPasswordInput.focus();
            }
        });
    }

    // Chiqish
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                fetch(`${API_URL}?action=logout`, { method: 'POST' }).catch(() => {});
            } catch (e) {}

            sessionStorage.removeItem(ADMIN_STORAGE_KEY);
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            showToast("Admin paneldan chiqildi.", "info");
            checkAdminAuth();
        });
    }

    // Tab almashtirish
    if (tabUrlBtn && tabFileBtn) {
        tabUrlBtn.addEventListener('click', () => {
            tabUrlBtn.classList.add('active');
            tabFileBtn.classList.remove('active');
            uploadModeInput.value = 'url';
            urlFields.style.display = 'block';
            fileFields.style.display = 'none';
            videoUrlInput.setAttribute('required', 'required');
            videoFileInput.removeAttribute('required');
        });

        tabFileBtn.addEventListener('click', () => {
            tabFileBtn.classList.add('active');
            tabUrlBtn.classList.remove('active');
            uploadModeInput.value = 'file';
            urlFields.style.display = 'none';
            fileFields.style.display = 'block';
            videoFileInput.setAttribute('required', 'required');
            videoUrlInput.removeAttribute('required');
        });
    }

    // Yangi kino qo'shish formasi
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('videoTitle').value.trim();
            const genre = document.getElementById('videoGenre').value;
            const country = document.getElementById('videoCountry').value;
            const year = parseInt(document.getElementById('videoYear').value, 10) || 2024;
            const language = document.getElementById('videoLanguage').value;
            const rating = parseFloat(document.getElementById('videoRating').value) || 8.0;
            const quality = document.getElementById('videoQuality').value;
            const duration = document.getElementById('videoDuration').value.trim() || '120 daqiqa';
            const description = document.getElementById('videoDescription').value.trim();
            const mode = uploadModeInput.value;

            const submitBtn = document.getElementById('uploadSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Saqlanmoqda...';

            try {
                const newMovie = {
                    id: 'kino_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    title,
                    genre,
                    country,
                    year,
                    language,
                    rating,
                    quality,
                    duration,
                    description,
                    type: mode,
                    views: 0,
                    createdAt: Date.now()
                };

                const formData = new FormData();
                formData.append('title', title);
                formData.append('genre', genre);
                formData.append('country', country);
                formData.append('year', year);
                formData.append('language', language);
                formData.append('rating', rating);
                formData.append('quality', quality);
                formData.append('duration', duration);
                formData.append('description', description);
                formData.append('type', mode);

                if (mode === 'url') {
                    const videoUrl = videoUrlInput.value.trim();
                    const posterUrl = posterUrlInput.value.trim();

                    if (!videoUrl) {
                        showToast("Iltimos, video URL manzilini kiriting!", "error");
                        submitBtn.disabled = false;
                        submitBtn.textContent = '📤 Kinoni Kinoteatrga Joylash';
                        return;
                    }

                    newMovie.videoUrl = videoUrl;
                    newMovie.posterUrl = posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80';
                    formData.append('video_url', videoUrl);
                    formData.append('poster_url', newMovie.posterUrl);
                } else {
                    const videoFile = videoFileInput.files[0];
                    const posterFile = posterFileInput.files[0];

                    if (!videoFile) {
                        showToast("Iltimos, video faylni tanlang!", "error");
                        submitBtn.disabled = false;
                        submitBtn.textContent = '📤 Kinoni Kinoteatrga Joylash';
                        return;
                    }

                    newMovie.videoBlob = videoFile;
                    formData.append('video_file', videoFile);
                    if (posterFile) {
                        newMovie.posterBlob = posterFile;
                        formData.append('poster_file', posterFile);
                    }
                }

                await addMovieToDB(newMovie, formData);
                showToast("Kino muvaffaqiyatli saqlandi!", "success");

                uploadForm.reset();
                if (mode === 'file') {
                    tabFileBtn.click();
                } else {
                    tabUrlBtn.click();
                }

                await loadAdminMovies();
            } catch (err) {
                console.error('Kino saqlashda xatolik:', err);
                showToast(err.message || "Xatolik: kinoni saqlab bo'lmadi!", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Kinoni Kinoteatrga Joylash';
            }
        });
    }

    // Kinoni Tahrirlash (Edit Modal)
    if (editModalCloseBtn) {
        editModalCloseBtn.addEventListener('click', closeEditModal);
    }

    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditModal();
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = editMovieId.value;
            const title = editVideoTitle.value.trim();
            const genre = editVideoGenre.value;
            const country = editVideoCountry.value;
            const year = parseInt(editVideoYear.value, 10) || 2024;
            const language = editVideoLanguage.value;
            const rating = parseFloat(editVideoRating.value) || 8.0;
            const quality = editVideoQuality.value;
            const duration = editVideoDuration.value.trim();
            const description = editVideoDescription.value.trim();
            const videoUrl = editVideoUrl.value.trim();
            const posterUrl = editPosterUrl.value.trim();

            const submitBtn = document.getElementById('editSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Saqlanmoqda...';

            try {
                const formData = new FormData();
                formData.append('id', id);
                formData.append('title', title);
                formData.append('genre', genre);
                formData.append('country', country);
                formData.append('year', year);
                formData.append('language', language);
                formData.append('rating', rating);
                formData.append('quality', quality);
                formData.append('duration', duration);
                formData.append('description', description);
                formData.append('type', 'url');
                formData.append('video_url', videoUrl);
                formData.append('poster_url', posterUrl);

                // Mavjud obyektni yangilaymiz
                const existing = adminLoadedMovies.find(m => String(m.id) === String(id));
                const updatedMovie = {
                    ...(existing || {}),
                    id,
                    title,
                    genre,
                    country,
                    year,
                    language,
                    rating,
                    quality,
                    duration,
                    description,
                    videoUrl: videoUrl || (existing ? existing.videoUrl : ''),
                    posterUrl: posterUrl || (existing ? existing.posterUrl : '')
                };

                await updateMovieInDB(updatedMovie, formData);
                showToast("Kino muvaffaqiyatli tahrirlandi!", "success");
                closeEditModal();
                await loadAdminMovies();
            } catch (err) {
                console.error('Tahrirlashda xatolik:', err);
                showToast(err.message || "Tahrirlashda xatolik yuz berdi!", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '💾 O\'zgarishlarni Saqlash';
            }
        });
    }
}

function openEditModal(movie) {
    if (!editModal) return;

    editMovieId.value = movie.id;
    editVideoTitle.value = movie.title || '';
    editVideoGenre.value = movie.genre || 'Jangari';
    editVideoCountry.value = movie.country || 'AQSH';
    editVideoYear.value = movie.year || 2024;
    editVideoLanguage.value = movie.language || "O'zbekcha";
    editVideoRating.value = movie.rating || 8.0;
    editVideoQuality.value = movie.quality || 'Full HD 1080p';
    editVideoDuration.value = movie.duration || '120 daqiqa';
    editVideoDescription.value = movie.description || '';
    editVideoUrl.value = movie.videoUrl || '';
    editPosterUrl.value = movie.posterUrl || '';

    editModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    if (!editModal) return;
    editModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

async function loadAdminMovies() {
    if (!adminVideoList) return;

    try {
        adminLoadedMovies = await getAllMoviesFromDB();

        if (adminVideoCount) {
            adminVideoCount.textContent = `${adminLoadedMovies.length} ta kino`;
        }

        adminVideoList.innerHTML = '';

        if (adminLoadedMovies.length === 0) {
            adminVideoList.innerHTML = '<p class="empty-desc">Hozircha hech qanday kino mavjud emas.</p>';
            return;
        }

        adminLoadedMovies.forEach(movie => {
            const { posterSrc } = resolveMediaUrls(movie);
            const safeTitle = escapeHTML(movie.title);
            const safeGenre = escapeHTML(movie.genre || 'Kino');
            const safeCountry = escapeHTML(movie.country || 'AQSH');
            const safeYear = escapeHTML(movie.year || 2024);
            const safeRating = escapeHTML(movie.rating || 8.0);
            const safeViews = (movie.views || 0).toLocaleString();
            const typeLabel = movie.type === 'file' ? '📁 Lokal Fayl' : '🔗 URL Havola';

            const item = document.createElement('div');
            item.className = 'admin-item';
            item.innerHTML = `
                <div class="admin-item-info">
                    <img src="${posterSrc}" alt="Poster" class="admin-item-thumb" onerror="this.src='https://via.placeholder.com/60x80?text=No+Img'">
                    <div class="admin-item-text">
                        <div class="admin-item-title" title="${safeTitle}">${safeTitle}</div>
                        <div class="admin-item-meta">
                            <span>⭐ ${safeRating}</span>
                            <span>•</span>
                            <span>🎭 ${safeGenre}</span>
                            <span>•</span>
                            <span>🌍 ${safeCountry} (${safeYear})</span>
                            <span>•</span>
                            <span>👁️ ${safeViews}</span>
                            <span>•</span>
                            <span>${typeLabel}</span>
                        </div>
                    </div>
                </div>
                <div class="admin-item-actions">
                    <button type="button" class="edit-btn" data-id="${movie.id}">✏️ Tahrirlash</button>
                    <button type="button" class="delete-btn" data-id="${movie.id}">🗑️ O'chirish</button>
                </div>
            `;

            // Tahrirlash tugmasi
            const editBtn = item.querySelector('.edit-btn');
            editBtn.addEventListener('click', () => openEditModal(movie));

            // O'chirish tugmasi
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async () => {
                const confirmed = confirm(`"${movie.title}" kinosini rostdan ham o'chirmoqchimisiz?`);
                if (confirmed) {
                    try {
                        await deleteMovieFromDB(movie.id);
                        showToast("Kino muvaffaqiyatli o'chirildi!", "info");
                        await loadAdminMovies();
                    } catch (err) {
                        console.error('O\'chirishda xatolik:', err);
                        showToast(err.message || "Kinoni o'chirishda xatolik yuz berdi!", "error");
                    }
                }
            });

            adminVideoList.appendChild(item);
        });
    } catch (err) {
        console.error('Admin kinolarni yuklashda xatolik:', err);
    }
}

// ================= 6. IZOHLAR (COMMENTS) VA TOMOSHA TARIXI (HISTORY) =================
const addCommentForm = document.getElementById('addCommentForm');
const commentRatingInput = document.getElementById('commentRating');
const commentTextInput = document.getElementById('commentText');
const movieCommentsList = document.getElementById('movieCommentsList');
const movieCommentsCount = document.getElementById('movieCommentsCount');
const navUserCabinetBtn = document.getElementById('navUserCabinetBtn');

const USER_STORAGE_KEY = 'kinoprime_user';
const USER_TOKEN_KEY = 'kinoprime_user_token';
const HISTORY_STORAGE_KEY = 'kinoprime_watch_history';

function getUserAuthHeaders() {
    const token = sessionStorage.getItem(USER_TOKEN_KEY) || '';
    const headers = {};
    if (token) headers['X-User-Token'] = token;
    return headers;
}

function getLocalUser() {
    try {
        return JSON.parse(sessionStorage.getItem(USER_STORAGE_KEY));
    } catch (e) {
        return null;
    }
}

// Bosh sahifadagi foydalanuvchi tugmasi holatini yangilash
async function updateNavUserButton() {
    if (!navUserCabinetBtn) return;

    let user = getLocalUser();

    if (isPhpBackendAvailable && !user) {
        try {
            const res = await fetch(`${API_URL}?action=user_me`, { headers: getUserAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    user = data.user;
                    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
                }
            }
        } catch (e) {}
    }

    if (user && user.name) {
        navUserCabinetBtn.innerHTML = `👤 ${escapeHTML(user.name)}`;
        navUserCabinetBtn.title = "Kabinetga o'tish";
    } else {
        navUserCabinetBtn.innerHTML = `👤 Kirish / Kabinet`;
        navUserCabinetBtn.title = "Kirish yoki ro'yxatdan o'tish";
    }
}

// Kinoning izohlarini yuklash
async function loadMovieComments(movieId) {
    if (!movieCommentsList || !movieId) return;

    movieCommentsList.innerHTML = '<p class="empty-desc">Fikrlar yuklanmoqda...</p>';

    let comments = [];

    if (isPhpBackendAvailable) {
        try {
            const res = await fetch(`${API_URL}?action=get_comments&movie_id=${movieId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    comments = data.data;
                }
            }
        } catch (e) {
            console.warn('Izohlarni olishda xatolik:', e);
        }
    } else {
        // Lokal izohlar (localStorage)
        try {
            const localStore = JSON.parse(localStorage.getItem('kinoprime_local_comments') || '{}');
            comments = localStore[movieId] || [];
        } catch (e) {
            comments = [];
        }
    }

    if (movieCommentsCount) {
        movieCommentsCount.textContent = comments.length;
    }

    movieCommentsList.innerHTML = '';

    if (comments.length === 0) {
        movieCommentsList.innerHTML = '<p class="empty-desc">Ushbu kino haqida birinchi bo\'lib fikr qoldiring!</p>';
        return;
    }

    comments.forEach(c => {
        const item = document.createElement('div');
        item.className = 'comment-item';
        const dateStr = c.created_at ? new Date(c.created_at * 1000).toLocaleDateString() : 'Yaqinda';
        const safeName = escapeHTML(c.user_name || 'Tomoshabin');
        const safeText = escapeHTML(c.comment_text);
        const avatar = c.user_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(safeName)}`;

        item.innerHTML = `
            <img src="${avatar}" alt="${safeName}" class="comment-user-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=User'">
            <div class="comment-body">
                <div class="comment-top-row">
                    <span class="comment-user-name">${safeName}</span>
                    <div class="comment-meta-info">
                        <span class="comment-rating-tag">⭐ ${c.rating || 10}/10</span>
                        <span class="comment-date">${dateStr}</span>
                    </div>
                </div>
                <p class="comment-text">${safeText}</p>
            </div>
        `;
        movieCommentsList.appendChild(item);
    });
}

// Yangi izoh qo'shish
if (addCommentForm) {
    addCommentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentModalMovie) return;

        const rating = parseInt(commentRatingInput.value, 10) || 10;
        const text = commentTextInput.value.trim();

        if (!text) return;

        const user = getLocalUser();

        if (isPhpBackendAvailable) {
            try {
                const formData = new FormData();
                formData.append('movie_id', currentModalMovie.id);
                formData.append('rating', rating);
                formData.append('comment_text', text);
                if (user) {
                    formData.append('user_name', user.name);
                }

                const res = await fetch(`${API_URL}?action=add_comment`, {
                    method: 'POST',
                    headers: getUserAuthHeaders(),
                    body: formData
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        showToast("Fikringiz uchun rahmat!", "success");
                        commentTextInput.value = '';
                        await loadMovieComments(currentModalMovie.id);
                        return;
                    }
                }
            } catch (err) {
                console.warn('Izoh yuborishda xatolik:', err);
            }
        }

        // Lokal saqlash (offline)
        try {
            const localStore = JSON.parse(localStorage.getItem('kinoprime_local_comments') || '{}');
            if (!localStore[currentModalMovie.id]) localStore[currentModalMovie.id] = [];
            localStore[currentModalMovie.id].unshift({
                user_name: user ? user.name : 'Mehmon',
                user_avatar: user ? user.avatar_url : 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest',
                rating: rating,
                comment_text: text,
                created_at: Math.floor(Date.now() / 1000)
            });
            localStorage.setItem('kinoprime_local_comments', JSON.stringify(localStore));
            showToast("Fikringiz saqlandi!", "success");
            commentTextInput.value = '';
            await loadMovieComments(currentModalMovie.id);
        } catch (e) {}
    });
}

// Tomosha tarixiga yozish
function recordWatchHistory(movie) {
    if (!movie) return;

    if (isPhpBackendAvailable) {
        try {
            const fd = new FormData();
            fd.append('movie_id', movie.id);
            fetch(`${API_URL}?action=add_history`, {
                method: 'POST',
                headers: getUserAuthHeaders(),
                body: fd
            }).catch(() => {});
        } catch (e) {}
    }

    // Lokal tarix
    try {
        let history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
        history = history.filter(h => String(h.id) !== String(movie.id));
        history.unshift({
            id: movie.id,
            title: movie.title,
            genre: movie.genre,
            country: movie.country,
            year: movie.year,
            rating: movie.rating,
            quality: movie.quality,
            language: movie.language,
            posterUrl: movie.posterUrl,
            watchedAt: Date.now()
        });
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
    } catch (e) {}
}

// ================= 7. FOYDALANUVCHI PROFILI (PROFILE.HTML) MANTIQI =================
const authSection = document.getElementById('authSection');
const cabinetSection = document.getElementById('cabinetSection');
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const userLoginForm = document.getElementById('userLoginForm');
const userRegisterForm = document.getElementById('userRegisterForm');
const userLogoutBtn = document.getElementById('userLogoutBtn');

const userProfileAvatar = document.getElementById('userProfileAvatar');
const userProfileName = document.getElementById('userProfileName');
const userProfileEmail = document.getElementById('userProfileEmail');
const userProfileRole = document.getElementById('userProfileRole');
const userProfileDate = document.getElementById('userProfileDate');

const updateProfileForm = document.getElementById('updateProfileForm');
const editProfileName = document.getElementById('editProfileName');
const editProfileAvatar = document.getElementById('editProfileAvatar');
const oldPasswordInput = document.getElementById('oldPasswordInput');
const newPasswordInput = document.getElementById('newPasswordInput');

const cabinetFavGrid = document.getElementById('cabinetFavGrid');
const cabinetHistoryGrid = document.getElementById('cabinetHistoryGrid');
const userFavCount = document.getElementById('userFavCount');
const userHistoryCount = document.getElementById('userHistoryCount');
const cabinetFavCountBadge = document.getElementById('cabinetFavCountBadge');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

async function initProfilePage() {
    if (!authSection || !cabinetSection) return;

    let user = getLocalUser();

    // Agar backend mavjud bo'lsa, foydalanuvchini serverdan tekshiramiz
    if (isPhpBackendAvailable) {
        try {
            const res = await fetch(`${API_URL}?action=user_me`, { headers: getUserAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    user = data.user;
                    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
                } else if (!user) {
                    user = null;
                }
            }
        } catch (e) {}
    }

    if (user && user.name) {
        authSection.style.display = 'none';
        cabinetSection.style.display = 'flex';
        renderCabinetData(user);
    } else {
        authSection.style.display = 'block';
        cabinetSection.style.display = 'none';
    }

    // Kirish / Ro'yxatdan o'tish tablari
    if (tabLoginBtn && tabRegisterBtn) {
        tabLoginBtn.addEventListener('click', () => {
            tabLoginBtn.classList.add('active');
            tabRegisterBtn.classList.remove('active');
            userLoginForm.style.display = 'block';
            userRegisterForm.style.display = 'none';
        });

        tabRegisterBtn.addEventListener('click', () => {
            tabRegisterBtn.classList.add('active');
            tabLoginBtn.classList.remove('active');
            userRegisterForm.style.display = 'block';
            userLoginForm.style.display = 'none';
        });
    }

    // Kirish formasi
    if (userLoginForm) {
        userLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            const submitBtn = document.getElementById('loginSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Kirilmoqda...';

            if (isPhpBackendAvailable) {
                try {
                    const fd = new FormData();
                    fd.append('email', email);
                    fd.append('password', password);

                    const res = await fetch(`${API_URL}?action=user_login`, {
                        method: 'POST',
                        body: fd
                    });

                    const data = await res.json();
                    if (data.success) {
                        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
                        if (data.token) sessionStorage.setItem(USER_TOKEN_KEY, data.token);
                        showToast(`Xush kelibsiz, ${data.user.name}!`, "success");
                        initProfilePage();
                        return;
                    } else {
                        showToast(data.error || "Kirishda xatolik!", "error");
                    }
                } catch (err) {
                    showToast("Server bilan ulanishda xatolik!", "error");
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Kirish';
                }
            } else {
                // Lokal kirish (Demo)
                const mockUser = {
                    id: 1,
                    name: email.split('@')[0],
                    email: email,
                    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
                    role: 'user',
                    created_at: Math.floor(Date.now() / 1000)
                };
                sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
                showToast("Lokal hisob bilan muvaffaqiyatli kirdingiz!", "success");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Kirish';
                initProfilePage();
            }
        });
    }

    // Ro'yxatdan o'tish formasi
    if (userRegisterForm) {
        userRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;

            const submitBtn = document.getElementById('regSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Yaratilmoqda...';

            if (isPhpBackendAvailable) {
                try {
                    const fd = new FormData();
                    fd.append('name', name);
                    fd.append('email', email);
                    fd.append('password', password);

                    const res = await fetch(`${API_URL}?action=register`, {
                        method: 'POST',
                        body: fd
                    });

                    const data = await res.json();
                    if (data.success) {
                        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
                        if (data.token) sessionStorage.setItem(USER_TOKEN_KEY, data.token);
                        showToast("Akkaunt muvaffaqiyatli yaratildi!", "success");
                        initProfilePage();
                        return;
                    } else {
                        showToast(data.error || "Ro'yxatdan o'tishda xatolik!", "error");
                    }
                } catch (err) {
                    showToast("Server bilan ulanishda xatolik!", "error");
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Ro'yxatdan O'tish";
                }
            } else {
                const mockUser = {
                    id: Date.now(),
                    name: name,
                    email: email,
                    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
                    role: 'user',
                    created_at: Math.floor(Date.now() / 1000)
                };
                sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
                showToast("Akkaunt muvaffaqiyatli yaratildi!", "success");
                submitBtn.disabled = false;
                submitBtn.textContent = "Ro'yxatdan O'tish";
                initProfilePage();
            }
        });
    }

    // Chiqish (Logout)
    if (userLogoutBtn) {
        userLogoutBtn.addEventListener('click', async () => {
            if (isPhpBackendAvailable) {
                try {
                    fetch(`${API_URL}?action=user_logout`, { method: 'POST', headers: getUserAuthHeaders() }).catch(() => {});
                } catch (e) {}
            }
            sessionStorage.removeItem(USER_STORAGE_KEY);
            sessionStorage.removeItem(USER_TOKEN_KEY);
            showToast("Akkauntdan chiqildi.", "info");
            initProfilePage();
        });
    }

    // Kabinet Tablari almashtirish
    const cabTabBtns = document.querySelectorAll('.cab-tab-btn');
    cabTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            cabTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabId = btn.dataset.tab;
            document.querySelectorAll('.cabinet-tab-content').forEach(c => c.style.display = 'none');
            const target = document.getElementById(tabId);
            if (target) target.style.display = 'block';
        });
    });

    // Profilni tahrirlash formasi
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = editProfileName.value.trim();
            const newAvatar = editProfileAvatar.value.trim();
            const oldPass = oldPasswordInput.value;
            const newPass = newPasswordInput.value;

            const saveBtn = document.getElementById('saveProfileBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saqlanmoqda...';

            if (isPhpBackendAvailable) {
                try {
                    const fd = new FormData();
                    fd.append('name', newName);
                    fd.append('avatar_url', newAvatar);
                    if (newPass) {
                        fd.append('old_password', oldPass);
                        fd.append('new_password', newPass);
                    }

                    const res = await fetch(`${API_URL}?action=update_profile`, {
                        method: 'POST',
                        headers: getUserAuthHeaders(),
                        body: fd
                    });

                    const data = await res.json();
                    if (data.success) {
                        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
                        showToast("Profil muvaffaqiyatli yangilandi!", "success");
                        oldPasswordInput.value = '';
                        newPasswordInput.value = '';
                        renderCabinetData(data.user);
                    } else {
                        showToast(data.error || "Yangilashda xatolik!", "error");
                    }
                } catch (err) {
                    showToast("Xatolik yuz berdi!", "error");
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "💾 O'zgarishlarni Saqlash";
                }
            } else {
                user.name = newName;
                if (newAvatar) user.avatar_url = newAvatar;
                sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
                showToast("Profil yangilandi!", "success");
                saveBtn.disabled = false;
                saveBtn.textContent = "💾 O'zgarishlarni Saqlash";
                renderCabinetData(user);
            }
        });
    }

    // Tarixni tozalash
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            localStorage.removeItem(HISTORY_STORAGE_KEY);
            if (cabinetHistoryGrid) {
                cabinetHistoryGrid.innerHTML = '<p class="empty-desc">Tomosha tarixi tozalandi.</p>';
            }
            if (userHistoryCount) userHistoryCount.textContent = '0';
            showToast("Tarix tozalandi.", "info");
        });
    }
}

// Foydalanuvchi ma'lumotlarini kabinetga chiqarish
async function renderCabinetData(user) {
    if (userProfileName) userProfileName.textContent = user.name;
    if (userProfileEmail) userProfileEmail.textContent = user.email;
    if (userProfileAvatar) {
        userProfileAvatar.src = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`;
    }
    if (editProfileName) editProfileName.value = user.name || '';
    if (editProfileAvatar) editProfileAvatar.value = user.avatar_url || '';

    // Sevimlilarni yuklash
    loadCabinetFavorites();

    // Tarixni yuklash
    loadCabinetHistory();
}

async function loadCabinetFavorites() {
    if (!cabinetFavGrid) return;

    const all = await getAllMoviesFromDB();
    const favIds = getFavorites().map(String);
    const favMovies = all.filter(m => favIds.includes(String(m.id)));

    if (userFavCount) userFavCount.textContent = favMovies.length;
    if (cabinetFavCountBadge) cabinetFavCountBadge.textContent = `${favMovies.length} ta kino`;

    cabinetFavGrid.innerHTML = '';

    if (favMovies.length === 0) {
        cabinetFavGrid.innerHTML = '<p class="empty-desc">Hozircha hech qanday kino sevimlilar ro\'yxatiga qo\'shilmagan.</p>';
        return;
    }

    favMovies.forEach(movie => {
        const { posterSrc } = resolveMediaUrls(movie);
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="poster-wrapper">
                <img src="${posterSrc}" alt="${escapeHTML(movie.title)}" class="poster-img" onerror="this.src='https://via.placeholder.com/300x450?text=Kino'">
                <div class="poster-overlay-top">
                    <span class="quality-tag">${escapeHTML(movie.quality || 'HD')}</span>
                    <span class="rating-badge">⭐ ${escapeHTML(movie.rating || 8.0)}</span>
                </div>
                <div class="play-hover-btn">▶</div>
            </div>
            <div class="movie-card-content">
                <h4 class="movie-card-title">${escapeHTML(movie.title)}</h4>
                <div class="movie-card-meta">
                    <span>${movie.year || 2024} • ${escapeHTML(movie.country || 'AQSH')}</span>
                    <span>👁️ ${movie.views || 0}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => openMoviePlayer(movie));
        cabinetFavGrid.appendChild(card);
    });
}

function loadCabinetHistory() {
    if (!cabinetHistoryGrid) return;

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    } catch (e) {
        history = [];
    }

    if (userHistoryCount) userHistoryCount.textContent = history.length;

    cabinetHistoryGrid.innerHTML = '';

    if (history.length === 0) {
        cabinetHistoryGrid.innerHTML = '<p class="empty-desc">Tomosha tarixi bo\'sh. Saytdagi kinolarni tomosha qilsangiz, ular shu yerda ko\'rinadi.</p>';
        return;
    }

    history.forEach(movie => {
        const poster = movie.posterUrl || 'https://via.placeholder.com/300x450?text=Kino';
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="poster-wrapper">
                <img src="${poster}" alt="${escapeHTML(movie.title)}" class="poster-img" onerror="this.src='https://via.placeholder.com/300x450?text=Kino'">
                <div class="poster-overlay-top">
                    <span class="quality-tag">${escapeHTML(movie.quality || 'HD')}</span>
                    <span class="rating-badge">⭐ ${escapeHTML(movie.rating || 8.0)}</span>
                </div>
                <div class="play-hover-btn">▶</div>
            </div>
            <div class="movie-card-content">
                <h4 class="movie-card-title">${escapeHTML(movie.title)}</h4>
                <div class="movie-card-meta">
                    <span>${movie.year || 2024}</span>
                    <span>🕒 Ko'rildi</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            const found = allMovies.find(m => String(m.id) === String(movie.id)) || movie;
            openMoviePlayer(found);
        });
        cabinetHistoryGrid.appendChild(card);
    });
}

// ================= 8. DASTURNI ISHGA TUSHIRISH (BOOTSTRAP) =================
document.addEventListener('DOMContentLoaded', async () => {
    // Agar bosh sahifada bo'lsa
    if (document.getElementById('moviesContainer')) {
        await initIndexPage();
    }
    // Agar admin sahifada bo'lsa
    if (document.getElementById('adminAuthSection')) {
        initAdminPage();
    }
    // Agar profil sahifasida bo'lsa
    if (document.getElementById('authSection')) {
        await initProfilePage();
    }
    // Navbardagi foydalanuvchi tugmasi
    updateNavUserButton();
});


