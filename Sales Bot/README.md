# NFT Sales Discord Bot

A Discord bot that monitors NFT sales on Ethereum and posts real-time updates to a Discord channel. The bot tracks single purchases and sweep events (mini, big, and huge sweeps) with embedded NFT images.

## Features

- **Real-time Sales Monitoring**: Polls OpenSea API every 30 seconds for new sales
- **Sweep Detection**: Categorizes purchases into:
  - Single buys (1 NFT)
  - Mini sweeps (2-5 NFTs)
  - Big sweeps (6-10 NFTs)
  - Huge sweeps (11+ NFTs)
- **Rich Embeds**: Posts formatted Discord embeds with NFT images
- **Error Handling**: Robust error handling and logging
- **Modular Design**: Easy to extend and customize

## Setup

### Prerequisites

- Python 3.8 or higher
- Discord Bot Token
- OpenSea API Key (optional but recommended for higher rate limits)

### Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create a Discord Bot:**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to the "Bot" section and create a bot
   - Copy the bot token
   - Enable "Message Content Intent" under Privileged Gateway Intents
   - Invite the bot to your server with appropriate permissions

4. **Get your Discord Channel ID:**
   - Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
   - Right-click on the channel where you want sales posted
   - Click "Copy ID"

5. **Get your NFT Contract Address:**
   - Find your NFT collection's contract address on OpenSea or Etherscan

6. **Get OpenSea API Key (Optional):**
   - Visit https://docs.opensea.io/reference/api-overview
   - Sign up for an API key to get higher rate limits

7. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your values:
   ```
   DISCORD_BOT_TOKEN=your_actual_bot_token
   DISCORD_CHANNEL_ID=your_actual_channel_id
   NFT_CONTRACT_ADDRESS=0xYourContractAddress
   OPENSEA_API_KEY=your_api_key_optional
   POLL_INTERVAL_SECONDS=30
   ```

### Running the Bot

```bash
python bot.py
```

The bot will connect to Discord and start monitoring sales. You should see a confirmation message in your logs when it's ready.

## Configuration

### Environment Variables

- `DISCORD_BOT_TOKEN`: Your Discord bot token (required)
- `DISCORD_CHANNEL_ID`: The Discord channel ID where sales will be posted (required)
- `NFT_CONTRACT_ADDRESS`: Ethereum contract address of your NFT collection (required)
- `OPENSEA_API_KEY`: OpenSea API key for higher rate limits (optional)
- `POLL_INTERVAL_SECONDS`: How often to poll for new sales (default: 30)

## Project Structure

```
.
├── bot.py              # Main bot file with Discord integration
├── sales_fetcher.py    # Module for fetching sales from OpenSea API
├── requirements.txt    # Python dependencies
├── .env.example        # Example environment variables
└── README.md          # This file
```

## How It Works

1. The bot connects to Discord using your bot token
2. Every 30 seconds (configurable), it polls the OpenSea API for new sales
3. Sales are grouped by transaction hash to identify sweeps
4. For each sale, the bot:
   - Fetches NFT images from OpenSea metadata
   - Creates a formatted Discord embed
   - Posts to the configured channel
5. Processed sales are tracked to avoid duplicates

## Extending the Bot

The code is modular and easy to extend:

- **Add new event types**: Modify `get_sweep_category()` in `bot.py`
- **Customize embeds**: Edit `create_sale_embed()` in `bot.py`
- **Change API source**: Modify `SalesFetcher` class in `sales_fetcher.py`
- **Add commands**: Use discord.py's command framework

## Troubleshooting

### Bot doesn't connect
- Check that `DISCORD_BOT_TOKEN` is correct
- Ensure the bot has been invited to your server

### No sales appearing
- Verify `NFT_CONTRACT_ADDRESS` is correct
- Check that `DISCORD_CHANNEL_ID` is correct
- Ensure the bot has permission to send messages in the channel
- Check logs for API errors

### Rate limiting
- Add an OpenSea API key to increase rate limits
- Increase `POLL_INTERVAL_SECONDS` to poll less frequently

### Images not showing
- Some NFTs may not have images in their metadata
- Check OpenSea API rate limits
- Verify the contract address is correct

## License

This project is provided as-is for educational and personal use.

