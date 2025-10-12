// Используем встроенный в Node.js fetch (доступен в Netlify Functions)
const OWNER = 'kyiv14';
const REPO = 'read24';
const PATH = 'client/playlist/'; // Папка, куда сохраняем

exports.handler = async (event, context) => {
    // Проверка метода и получение токена
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        console.error("GITHUB_TOKEN is missing!");
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: GitHub token missing.' }) };
    }

    try {
        // Получение данных из тела запроса
        const { filename, fileContent } = JSON.parse(event.body);

        if (!filename || !fileContent) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing filename or content.' }) };
        }

        // Кодирование контента в Base64 (требование GitHub API)
        const contentBase64 = Buffer.from(fileContent).toString('base64');
        const fullPath = `${PATH}${filename}`;

        // 1. Поиск существующего SHA (если файл уже есть, он нужен для обновления)
        let sha = null;
        const getFileUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${fullPath}`;
        
        const fileResponse = await fetch(getFileUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (fileResponse.ok) {
            // Файл существует, получаем его SHA
            const fileData = await fileResponse.json();
            sha = fileData.sha;
        } else if (fileResponse.status !== 404) {
            // Если ошибка, но не 404 (файл не найден), то это проблема
            throw new Error(`Failed to check file existence: ${fileResponse.status} - ${fileResponse.statusText}`);
        }

        // 2. Отправка PUT-запроса на GitHub API для создания/обновления файла
        const commitBody = {
            message: `feat: Update ${filename} from read24 editor`,
            content: contentBase64,
            sha: sha, // Передаем SHA только при обновлении
        };

        const commitResponse = await fetch(getFileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify(commitBody),
        });

        if (!commitResponse.ok) {
            const errorText = await commitResponse.text();
            throw new Error(`GitHub API error: ${commitResponse.status} - ${errorText}`);
        }
        
        const result = await commitResponse.json();

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'File committed successfully', 
                content: result.content
            }),
        };

    } catch (error) {
        console.error('Error in save-playlist function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
        };
    }
};