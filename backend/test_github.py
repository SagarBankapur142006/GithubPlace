import requests
res = requests.get("https://api.github.com/users/SagarBankapur142006/repos")
if res.ok:
    repos = res.json()
    for repo in repos:
        if "extension" in repo['name']:
            print(repo['name'], repo['default_branch'], repo['description'])
else:
    print("FAILED", res.status_code)
