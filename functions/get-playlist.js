// netlify/functions/get-playlist.js

const fetch = require('node-fetch');

// Настройки вашего репозитория, предоставленные пользователем:
const GITHUB_USERNAME = 'kyiv14';
const GITHUB_REPO = 'read24';
const GITHUB_PATH_PREFIX = 'client/playlist/'; // Папка, где хранится файл, включая конечный слеш.
const GITHUB_BRANCH = 'main'; // Или master

// ВАЖНО: GitHub Token должен быть установлен как переменная окружения (например, GITHUB_TOKEN) в настройках Netlify.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 

exports.handler = async (event) => {
    
    // --- 1. ИЗВЛЕЧЕНИЕ ID ПОЛЬЗОВАТЕЛЯ И ПРОВЕРКА ---
    // Ожидаемый путь: /api/playlist/fnl3iY4FwJhBfRCskEQYt9x8TGP2/latest.m3u
    const pathSegments = event.path.split('/').filter(s => s.length > 0); 
    // ID находится на предпоследней позиции, 'latest.m3u' на последней
    const userId = pathSegments[pathSegments.length - 2]; 
    
    // Проверка на корректность извлеченного ID
    if (!userId || userId.includes('.') || userId.length < 5) {
        return {
            statusCode: 400,
            body: `Error: Invalid user ID format found in path: ${userId}`
        };
    }
    
    // --- 2. ФОРМИРОВАНИЕ ИМЕНИ ФАЙЛА ---
    // Имя файла, которое ожидается на GitHub
    const filename = `playlist_${userId}_latest.m3u`;
    const githubFilePath = `${GITHUB_PATH_PREFIX}${filename}`; // client/playlist/playlist_USER_ID_latest.m3u
    
    // --- 3. ЗАПРОС КОНТЕНТА ФАЙЛА С GITHUB ---
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${githubFilePath}?ref=${GITHUB_BRANCH}`;

    try {
        if (!GITHUB_TOKEN) {
             throw new Error("GitHub Token is not configured. Check Netlify Environment variables.");
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw', // Запрашиваем "сырой" контент
                'User-Agent': 'Netlify-Playlist-Fetcher' 
            },
        });
        
        if (response.status === 404) {
             return { statusCode: 404, body: `Playlist not found on GitHub at path: ${githubFilePath}` };
        }

        if (!response.ok) {
            console.error(`GitHub API Error: ${response.status} - ${response.statusText}`);
            return { statusCode: response.status, body: 'Error fetching file from GitHub.' };
        }
        
        // Получаем "сырой" контент плейлиста
        const playlistContent = await response.text(); 

        // --- 4. ОТДАЧА КОНТЕНТА ---
        return {
            statusCode: 200,
            headers: {
                // Это критически важно для плееров, чтобы они понимали, что это плейлист
                'Content-Type': 'application/x-mpegURL', 
                // Не кешируем, чтобы плеер всегда получал самую свежую версию
                'Cache-Control': 'no-cache, no-store, must-revalidate', 
            },
            body: playlistContent,
        };

    } catch (error) {
        console.error("Error in get-playlist function:", error);
        return {
            statusCode: 500,
            body: `Internal Server Error: ${error.message}`
        };
    }
};