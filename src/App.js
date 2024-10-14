import './App.css';
import { useEffect, useState } from 'react';

const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
function App() {
  const [rerender, setRerender] = useState(false);
  const [userData, setUserData] = useState({});
  const [repoName, setRepoName] = useState('');
  const [pullRequests, setPullRequests] = useState([]);
  const [token, setToken] = useState(process.env.REACT_APP_GITHUB_TOKEN);
  const [comment, setComment] = useState('');
  const [prFiles, setPrFiles] = useState([]);

  async function getUserData() {
    try {
      const response = await fetch("http://localhost:4000/getUserData", {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + localStorage.getItem("accessToken")
        }
      });
      const data = await response.json();
      console.log(data);
      setUserData(data);
    } catch (error) {
      console.error('Error fetching user data:', error);
      alert('Failed to fetch user data.');
    }
  }

  async function getRepoInfo() {
    if (!userData.login || !repoName) {
      alert('Please enter both repo owner and repo name.');
      return;
    }

    try {
      const repoResponse = await fetch(`https://api.github.com/repos/${userData.login}/${repoName}`, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + localStorage.getItem("accessToken")
        }
      });

      if (!repoResponse.ok) {
        throw new Error(`Failed to fetch repository information: ${repoResponse.statusText}`);
      }

      let allPullRequests = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const prResponse = await fetch(`https://api.github.com/repos/${userData.login}/${repoName}/pulls?state=all&per_page=100&page=${page}`, {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + localStorage.getItem("accessToken")
          }
        });

        if (!prResponse.ok) {
          throw new Error(`Failed to fetch pull requests: ${prResponse.statusText}`);
        }

        const prData = await prResponse.json();
        if (prData.length === 0) {
          hasMore = false;
        } else {
          allPullRequests = [...allPullRequests, ...prData];
          page += 1;
        }
      }

      setPullRequests(allPullRequests);
    } catch (error) {
      console.error('Error fetching repo data:', error);
      alert(`Failed to fetch repository data: ${error.message}`);
    }
  }

  async function postComment(prNumber) {
    if (!comment) {
      alert('Please enter a comment before submitting.');
      return;
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${userData.login}/${repoName}/issues/${prNumber}/comments`, {
        method: "POST",
        headers: {
          "Authorization": `token ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify({ body: comment })
      });

      if (response.ok) {
        alert('Comment posted successfully!');
        setComment('');
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to post comment: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      alert(error.message);
    }
  }

  async function getPRFiles(prNumber) {
    try {
      const response = await fetch(`https://api.github.com/repos/${userData.login}/${repoName}/pulls/${prNumber}/files`, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + localStorage.getItem("accessToken")
        }
      });
      const filesData = await response.json();
      console.log("Fetched PR Files:", filesData);
      setPrFiles(filesData);
    } catch (error) {
      console.error('Error fetching PR files:', error);
      setPrFiles([]);
    }
};

async function createAutoCommentFile() {
  if (!repoName) {
    alert('Please enter a repository name first.');
    return;
  }

  const fileContent = `name: Auto Comment

on:
  issues:
    types: [opened]
  pull_request:
    types: [opened, closed]

permissions:
  issues: write
  pull-requests: write

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: wow-actions/auto-comment@v1
        with:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          issuesOpened: |
            @{{ author }}
            Thank you for raising an issue. We will investigate the matter and get back to you as soon as possible.
            Please make sure you have provided as much context as possible.

          pullRequestOpened: |
            @{{ author }}
            Thank you for raising your pull request.
            We will review it as soon as possible.

          pullRequestClosed: |
            @{{ author }}
            Your pull request has been closed. Thank you for your contribution!
`.trim();

  try {
    const response = await fetch(`https://api.github.com/repos/${userData.login}/${repoName}/contents/.github/workflows/auto-comment.yml`, {
      method: "PUT",
      headers: {
        "Authorization": `token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Create auto-comment workflow",
        content: btoa(fileContent),
      })
    });

    if (response.ok) {
      alert('Auto comment workflow file created successfully!');
    } else {
      const errorData = await response.json();
      throw new Error(`Failed to create workflow file: ${errorData.message}`);
    }
  } catch (error) {
    console.error('Error creating workflow file:', error);
    alert(`Error: ${error.message}`);
  }
}

function loginWithGitHub() {
  window.location.assign("https://github.com/login/oauth/authorize?client_id=" + CLIENT_ID);
};

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const codeParam = urlParams.get("code");
    console.log(codeParam);
    if (codeParam && (localStorage.getItem("accessToken") === null)) {
      async function getAccessToken() {
        try {
          const response = await fetch("http://localhost:4000/getAccessToken?code=" + codeParam, {
            method: "GET"
          });
          const data = await response.json();
          console.log(data);
          if (data.access_token) {
            localStorage.setItem("accessToken", data.access_token);
            setRerender(!rerender);
          }
        } catch (error) {
          console.error('Error getting access token:', error);
          alert('Failed to get access token.');
        }
      }
      getAccessToken();
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        {localStorage.getItem("accessToken") ? (
          <>
            <h1>GitHub PR Commenter</h1>
            <button onClick={() => { localStorage.removeItem("accessToken"); setRerender(!rerender); }}>
              LogOut
            </button>
            <button onClick={getUserData}>
              Get User Data
            </button>

            {Object.keys(userData).length !== 0 && (
              <>
                <h2>{userData.login}</h2>
                <img width="100px" height="100px" src={userData.avatar_url} alt="User Avatar" />

                <input
                  type="text"
                  placeholder="Repo Name"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                />

                <button onClick={getRepoInfo}>
                  Get Repo Info
                </button>
                <br />
                <button onClick={createAutoCommentFile}>
                  Auto Comment
                </button>
                <h3>Pull Requests</h3>
                {pullRequests.length > 0 ? (
                  pullRequests.map((pr) => (
                    <div key={pr.id}>
                      <h4>{pr.title}</h4>
                      <p><strong>Raised by:</strong> {pr.user?.login}</p>
                      <p><strong>Raised on:</strong> {new Date(pr.created_at).toLocaleDateString()}</p>
                      <p><strong>Message:</strong> {pr.body || 'No message'}</p>

                      <button onClick={() => getPRFiles(pr.number)}>Get PR Files</button>
                      <ul>
                        {prFiles.map((file, index) => (
                          <li key={index}>
                            <p><strong>Filename:</strong> {file.filename}</p>
                            <p><strong>Status:</strong> {file.status}</p>
                            <p><strong>Changes:</strong> +{file.additions} -{file.deletions}</p>
                          </li>
                        ))}
                      </ul>

                      <a href={pr.html_url} target="_blank" rel="noopener noreferrer">View Pull Request</a>
                      <br />
                      <input
                        type="text"
                        placeholder="Type your comment here"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <button onClick={() => postComment(pr.number)}>Comment</button>
                    </div>
                  ))
                ) : (
                  <p>No pull requests found</p>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <h3>User is not logged in</h3>
            <button onClick={loginWithGitHub}>
              Login with GitHub
            </button>
          </>
        )}
      </header>
    </div>
  );
}

export default App;