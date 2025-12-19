# Railway Deployment Guide

## Step-by-Step Instructions

### Step 1: Create a GitHub Repository (if you don't have one)

1. Go to https://github.com and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name it something like "nft-sales-bot"
4. Make it **Private** (to keep your tokens safe)
5. Click "Create repository"

### Step 2: Push Your Code to GitHub

Open terminal in your project directory and run:

```bash
cd "/Users/durkle/Sales Bot"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - NFT Sales Bot"

# Add your GitHub repository as remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Sign Up for Railway

1. Go to https://railway.app
2. Click "Start a New Project" or "Login"
3. Sign up with GitHub (recommended) - this makes deployment easier

### Step 4: Create a New Project on Railway

1. Once logged in, click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository (nft-sales-bot)
4. Railway will automatically detect it's a Python project

### Step 5: Configure Environment Variables

1. In your Railway project, click on your service
2. Go to the "Variables" tab
3. Add these environment variables (click "New Variable" for each):

   ```
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   DISCORD_CHANNEL_ID=your_channel_id_here
   NFT_CONTRACT_ADDRESS=your_contract_address_here
   OPENSEA_API_KEY=your_opensea_api_key_here
   POLL_INTERVAL_SECONDS=10
   ```

4. Make sure to click "Add" after each variable

### Step 6: Configure the Service

1. In Railway, go to your service settings
2. Under "Start Command", it should auto-detect: `python3 bot.py`
3. If not, set it to: `python3 bot.py`
4. The Procfile will handle this automatically

### Step 7: Deploy

1. Railway will automatically deploy when you push to GitHub
2. Or click "Deploy" in the Railway dashboard
3. Watch the logs to see if it connects successfully
4. You should see: "has connected to Discord!" in the logs

### Step 8: Verify It's Working

1. Check the Railway logs - you should see polling messages
2. Check your Discord channel - the bot should be online
3. Wait for a sale to test, or the bot will start monitoring automatically

## Troubleshooting

- **Bot not connecting?** Check that DISCORD_BOT_TOKEN is correct
- **No sales appearing?** Verify NFT_CONTRACT_ADDRESS and DISCORD_CHANNEL_ID
- **Build errors?** Check that requirements.txt is correct
- **Bot offline?** Check Railway logs for errors

## Updating the Bot

To update your bot:
1. Make changes locally
2. Commit and push to GitHub: `git add . && git commit -m "Update" && git push`
3. Railway will automatically redeploy

