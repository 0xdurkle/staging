"""
Discord Bot for NFT Sales Monitoring
Monitors OpenSea sales and posts real-time updates to Discord
"""

import os
import asyncio
import logging
from datetime import datetime
from typing import Optional, List, Dict

import discord
from discord.ext import tasks
from dotenv import load_dotenv

from sales_fetcher import SalesFetcher, SaleEvent

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Bot configuration
BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')
CHANNEL_ID = int(os.getenv('DISCORD_CHANNEL_ID', '0'))
CONTRACT_ADDRESS = os.getenv('NFT_CONTRACT_ADDRESS')
OPENSEA_API_KEY = os.getenv('OPENSEA_API_KEY', '')
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL_SECONDS', '10'))

# Initialize Discord client
intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)

# Initialize sales fetcher
sales_fetcher = SalesFetcher(
    contract_address=CONTRACT_ADDRESS,
    api_key=OPENSEA_API_KEY
)

# Track processed sales to avoid duplicates
processed_sales: set = set()


def get_sweep_category(count: int) -> str:
    """Determine the sweep category based on NFT count."""
    if count == 1:
        return "single"
    elif 2 <= count <= 5:
        return "mini"
    elif 6 <= count <= 10:
        return "big"
    else:  # 11+
        return "huge"


def format_price(price_wei: int) -> str:
    """Convert wei to ETH and format."""
    eth_price = price_wei / 1e18
    return f"{eth_price:.4f}".rstrip('0').rstrip('.')


async def create_sale_embed(sale: SaleEvent, nft_images: List[str]) -> discord.Embed:
    """Create a Discord embed for a sale event."""
    count = sale.token_count
    category = get_sweep_category(count)
    
    # Set title and color based on category
    if category == "single":
        title = f"🎨 User {sale.buyer[:10]}... bought NFT #{sale.token_id}!"
        color = discord.Color.blue()
        description = f"**Price:** {format_price(sale.total_price)} ETH"
    elif category == "mini":
        title = f"⚡ Mini sweep! User {sale.buyer[:10]}... grabbed {count} NFTs!"
        color = discord.Color.green()
        description = f"**Total Price:** {format_price(sale.total_price)} ETH"
    elif category == "big":
        title = f"🔥 Big sweep alert! User {sale.buyer[:10]}... swept {count} NFTs!"
        color = discord.Color.orange()
        description = f"**Total Price:** {format_price(sale.total_price)} ETH"
    else:  # huge
        title = f"💥 Huge sweep! User {sale.buyer[:10]}... dominated with {count} NFTs!"
        color = discord.Color.red()
        description = f"**Total Price:** {format_price(sale.total_price)} ETH"
    
    embed = discord.Embed(
        title=title,
        description=description,
        color=color,
        timestamp=datetime.utcnow()
    )
    
    # Add transaction hash
    if sale.tx_hash:
        embed.add_field(
            name="Transaction",
            value=f"[View on Etherscan](https://etherscan.io/tx/{sale.tx_hash})",
            inline=False
        )
    
    # Add images
    if nft_images:
        # Use first image as embed image
        embed.set_image(url=nft_images[0])
        
        # If multiple images, add them as fields (Discord limits to 1 embed image)
        if len(nft_images) > 1:
            image_links = "\n".join([f"[NFT #{sale.token_ids[i]}]({img})" for i, img in enumerate(nft_images[:10])])
            if len(nft_images) > 10:
                image_links += f"\n... and {len(nft_images) - 10} more"
            embed.add_field(
                name="NFT Images",
                value=image_links,
                inline=False
            )
    
    embed.set_footer(text="NFT Sales Monitor")
    
    return embed


async def process_sales(sales: List[SaleEvent], channel: discord.TextChannel):
    """Process and post sales to Discord channel."""
    for sale in sales:
        # Create unique identifier for this sale
        sale_id = f"{sale.tx_hash}_{sale.token_id if sale.token_count == 1 else sale.token_ids[0]}"
        
        if sale_id in processed_sales:
            continue
        
        try:
            # Fetch NFT images
            logger.info(f"Fetching images for sale: {sale_id}")
            nft_images = await sales_fetcher.fetch_nft_images(sale.token_ids)
            
            # Create and send embed
            embed = await create_sale_embed(sale, nft_images)
            await channel.send(embed=embed)
            
            # Mark as processed
            processed_sales.add(sale_id)
            logger.info(f"Posted sale: {sale_id}")
            
            # Small delay to avoid rate limiting (reduced for speed)
            await asyncio.sleep(0.3)
            
        except Exception as e:
            logger.error(f"Error processing sale {sale_id}: {e}", exc_info=True)


@tasks.loop(seconds=POLL_INTERVAL)
async def poll_sales():
    """Poll for new sales every POLL_INTERVAL seconds."""
    if not client.is_ready():
        return
    
    channel = client.get_channel(CHANNEL_ID)
    if channel is None:
        logger.error(f"Channel with ID {CHANNEL_ID} not found!")
        return
    
    try:
        logger.info("Polling for new sales...")
        sales = await sales_fetcher.fetch_recent_sales()
        
        if sales:
            logger.info(f"Found {len(sales)} new sale(s)")
            await process_sales(sales, channel)
        else:
            logger.debug("No new sales found")
            
    except Exception as e:
        logger.error(f"Error polling sales: {e}", exc_info=True)


@client.event
async def on_ready():
    """Called when the bot is ready."""
    logger.info(f'{client.user} has connected to Discord!')
    logger.info(f'Monitoring contract: {CONTRACT_ADDRESS}')
    logger.info(f'Channel ID: {CHANNEL_ID}')
    
    # Start polling task
    if not poll_sales.is_running():
        poll_sales.start()
        logger.info("Started sales polling task")


@client.event
async def on_error(event, *args, **kwargs):
    """Handle errors."""
    logger.error(f"Error in event {event}", exc_info=True)


def main():
    """Main entry point."""
    # Validate configuration
    if not BOT_TOKEN:
        logger.error("DISCORD_BOT_TOKEN not set in environment variables!")
        return
    
    if not CHANNEL_ID:
        logger.error("DISCORD_CHANNEL_ID not set in environment variables!")
        return
    
    if not CONTRACT_ADDRESS:
        logger.error("NFT_CONTRACT_ADDRESS not set in environment variables!")
        return
    
    # Run the bot
    try:
        client.run(BOT_TOKEN)
    except Exception as e:
        logger.error(f"Failed to start bot: {e}", exc_info=True)


if __name__ == "__main__":
    main()

