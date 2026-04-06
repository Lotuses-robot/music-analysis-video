# 发布到 GitHub

在 **已安装 [Git for Windows](https://git-scm.com/download/win)** 的前提下，在项目根目录 `music-analysis-video` 打开终端（PowerShell 即可），按顺序执行。

## 1. 在 GitHub 上新建仓库

1. 打开 <https://github.com/new>  
2. **Repository name** 自定（例如 `music-analysis-video`）  
3. 选 **Public** 或 **Private**  
4. **不要**勾选 “Add a README / .gitignore / license”（本地已有文件，避免冲突）  
5. 点 **Create repository**，记下页面上的仓库地址，例如：  
   `https://github.com/<你的用户名>/music-analysis-video.git`

## 2. 本地初始化并首次提交

```powershell
cd C:\Users\robot\Projects\music-analysis-video

git init
git branch -M main
git add -A
git status
git commit -m "Initial commit: Remotion music analysis video scaffold"
```

若提示需要身份：

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

再执行一次 `git commit`。

## 3. 关联远程并推送

把下面 URL 换成 **你的** 仓库地址：

```powershell
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

- 若使用 **HTTPS**，GitHub 会要求登录；建议使用 **Personal Access Token** 代替密码，或改用 GitHub Desktop。  
- 若已配置 **SSH**，可改为：  
  `git remote add origin git@github.com:<用户名>/<仓库名>.git`

## 4. 可选：用 GitHub CLI 一条龙

若已安装 [`gh`](https://cli.github.com/) 且已 `gh auth login`：

```powershell
cd C:\Users\robot\Projects\music-analysis-video
git init
git branch -M main
git add -A
git commit -m "Initial commit: Remotion music analysis video scaffold"
gh repo create music-analysis-video --private --source=. --remote=origin --push
```

把 `music-analysis-video`、`--private` 按需要改成你的仓库名和可见性。

## 不会上传的内容

见仓库根目录 [`.gitignore`](../../.gitignore)：`node_modules/`、`out/` 等不会进仓库。协作者克隆后需执行 `npm install`。

## 与 Wiki 的关系

整体设计说明仍见 [README](README.md) 及各专题页；本页只负责 **版本托管与推送**。
