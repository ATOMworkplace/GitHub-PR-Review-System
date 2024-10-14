require('dotenv').config();
var express = require('express');
var cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
var bodyParser = require('body-parser');
const { EventEmitter } = require('events');

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
var app = express();
app.use(cors());
app.use(bodyParser.json());

// Route to get GitHub OAuth access token
app.get('/getAccessToken', async function (req, res) {
    console.log(req.query.code);
    const params = `?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${req.query.code}`;

    try {
        const response = await fetch(`https://github.com/login/oauth/access_token${params}`, {
            method: "POST",
            headers: {
                "Accept": "application/json"
            }
        });
        const data = await response.json();
        console.log(data);
        res.json(data);
    } catch (error) {
        console.error('Error fetching access token:', error);
        res.status(500).json({ error: 'Failed to fetch access token.' });
    }
});

// Route to get GitHub user data
app.get('/getUserData', async function (req, res) {
    const authHeader = req.get("Authorization");

    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header is missing.' });
    }

    try {
        const response = await fetch("https://api.github.com/user", {
            method: "GET",
            headers: {
                "Authorization": authHeader
            }
        });
        const data = await response.json();
        console.log(data);
        res.json(data);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to fetch user data.' });
    }
});

// Function to comment on a PR
async function commentOnPR(owner, repo, prNumber, comment) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
        method: "POST",
        headers: {
            "Authorization": `token ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ body: comment })
    });

    if (!response.ok) {
        throw new Error('Failed to add comment');
    }

    return response.json();
}

// Route to create auto-comment workflow file
app.post('/createWorkflow', async function (req, res) {
    const { owner, repo } = req.body;

    if (!owner || !repo) {
        return res.status(400).json({ error: 'Owner and repository name are required.' });
    }

    const path = ".github/workflows/auto-comment.yml";
    const fileContent = `
name: Auto Comment
on: [pull_request]
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: wow-actions/auto-comment@v1
        with:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          pullRequestOpened: |
            👋 @\${{ author }}
            Thank you for raising your pull request.
            Please make sure you have followed our contributing guidelines. We will review it as soon as possible
`;

    // Encode the file content in Base64 (required by GitHub API)
    const contentEncoded = Buffer.from(fileContent).toString('base64');

    const payload = {
        message: "Create auto-comment workflow",
        content: contentEncoded,
        branch: "main"
    };

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: "PUT",
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Failed to create workflow file');
        }

        const data = await response.json();
        console.log('Workflow file created:', data);
        res.json({ message: 'Workflow file created successfully!' });
    } catch (error) {
        console.error('Error creating workflow file:', error);
        res.status(500).json({ error: 'Failed to create workflow file.' });
    }
});
// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, function () {
    console.log(`Server is running on port ${PORT}`);
});