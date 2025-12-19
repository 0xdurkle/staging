"""
Sales Fetcher Module
Handles fetching NFT sales data from OpenSea API
"""

import os
import asyncio
import aiohttp
import logging
from typing import List, Optional, Dict
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# OpenSea API endpoints
OPENSEA_API_BASE = "https://api.opensea.io/api/v1"
OPENSEA_API_V2_BASE = "https://api.opensea.io/v2"


@dataclass
class SaleEvent:
    """Represents a single sale event."""
    tx_hash: str
    buyer: str
    seller: str
    token_id: Optional[str] = None  # For single buys
    token_ids: Optional[List[str]] = None  # For sweeps
    token_count: int = 1
    total_price: int = 0  # Price in wei
    timestamp: Optional[datetime] = None


class SalesFetcher:
    """Fetches NFT sales data from OpenSea API."""
    
    def __init__(self, contract_address: str, api_key: Optional[str] = None):
        """
        Initialize the sales fetcher.
        
        Args:
            contract_address: Ethereum contract address of the NFT collection
            api_key: Optional OpenSea API key for higher rate limits
        """
        self.contract_address = contract_address.lower()
        self.api_key = api_key
        self.last_fetch_time = datetime.utcnow() - timedelta(minutes=2)
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self.session is None or self.session.closed:
            headers = {}
            if self.api_key:
                headers["X-API-KEY"] = self.api_key
            
            self.session = aiohttp.ClientSession(headers=headers)
        return self.session
    
    async def close(self):
        """Close the aiohttp session."""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def fetch_recent_sales(self) -> List[SaleEvent]:
        """
        Fetch recent sales from OpenSea API.
        
        Returns:
            List of SaleEvent objects
        """
        try:
            session = await self._get_session()
            
            # Use OpenSea Events API
            url = f"{OPENSEA_API_BASE}/events"
            params = {
                "asset_contract_address": self.contract_address,
                "event_type": "successful",
                "only_opensea": "false",
                "occurred_after": int(self.last_fetch_time.timestamp()),
                "limit": 50
            }
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    sales = self._parse_sales_response(data)
                    self.last_fetch_time = datetime.utcnow()
                    return sales
                elif response.status == 429:
                    logger.warning("Rate limited by OpenSea API. Consider adding API key.")
                    return []
                else:
                    logger.error(f"OpenSea API error: {response.status} - {await response.text()}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching sales: {e}", exc_info=True)
            return []
    
    def _parse_sales_response(self, data: Dict) -> List[SaleEvent]:
        """Parse OpenSea API response into SaleEvent objects."""
        sales = []
        
        if "asset_events" not in data:
            return sales
        
        # Group events by transaction hash to identify sweeps
        tx_groups: Dict[str, List[Dict]] = {}
        
        for event in data.get("asset_events", []):
            tx_hash = event.get("transaction", {}).get("transaction_hash")
            if not tx_hash:
                continue
            
            if tx_hash not in tx_groups:
                tx_groups[tx_hash] = []
            tx_groups[tx_hash].append(event)
        
        # Process each transaction
        for tx_hash, events in tx_groups.items():
            if not events:
                continue
            
            # Get buyer and seller from first event
            first_event = events[0]
            buyer = first_event.get("winner_account", {}).get("address", "Unknown")
            seller = first_event.get("seller", {}).get("address", "Unknown")
            
            # Collect all token IDs in this transaction
            token_ids = []
            total_price = 0
            
            for event in events:
                # Get token ID
                asset = event.get("asset")
                if asset:
                    token_id = asset.get("token_id")
                    if token_id:
                        token_ids.append(str(token_id))
                
                # Get price
                payment_token = event.get("payment_token", {})
                if payment_token.get("symbol") == "ETH" or payment_token.get("name") == "Ether":
                    total_price_str = event.get("total_price", "0")
                    try:
                        total_price += int(total_price_str)
                    except (ValueError, TypeError):
                        pass
            
            if not token_ids:
                continue
            
            # Create sale event
            sale = SaleEvent(
                tx_hash=tx_hash,
                buyer=buyer,
                seller=seller,
                token_id=token_ids[0] if len(token_ids) == 1 else None,
                token_ids=token_ids if len(token_ids) > 1 else None,
                token_count=len(token_ids),
                total_price=total_price,
                timestamp=datetime.utcnow()
            )
            
            sales.append(sale)
        
        return sales
    
    async def _fetch_single_image(self, session: aiohttp.ClientSession, token_id: str) -> Optional[str]:
        """Fetch image for a single token ID."""
        try:
            url = f"{OPENSEA_API_BASE}/asset/{self.contract_address}/{token_id}"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    # Try different image fields
                    image_url = (
                        data.get("image_url") or
                        data.get("image_original_url") or
                        data.get("image_preview_url") or
                        data.get("collection", {}).get("image_url")
                    )
                    return image_url
                elif response.status == 429:
                    logger.warning(f"Rate limited while fetching image for token {token_id}")
                    return None
                else:
                    logger.debug(f"Could not fetch image for token {token_id}: {response.status}")
                    return None
        except Exception as e:
            logger.debug(f"Error fetching image for token {token_id}: {e}")
            return None
    
    async def fetch_nft_images(self, token_ids: List[str]) -> List[str]:
        """
        Fetch NFT images from OpenSea API in parallel for faster updates.
        
        Args:
            token_ids: List of token IDs to fetch images for
            
        Returns:
            List of image URLs
        """
        images = []
        
        try:
            session = await self._get_session()
            # Limit to 20 tokens and fetch in parallel (batched to avoid rate limits)
            token_ids = token_ids[:20]
            
            # Fetch images in parallel batches of 5 to balance speed and rate limits
            batch_size = 5
            for i in range(0, len(token_ids), batch_size):
                batch = token_ids[i:i + batch_size]
                tasks = [self._fetch_single_image(session, token_id) for token_id in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, str) and result:
                        images.append(result)
                    elif isinstance(result, Exception):
                        logger.debug(f"Exception fetching image: {result}")
                
                # Small delay between batches to avoid rate limits
                if i + batch_size < len(token_ids):
                    await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error fetching NFT images: {e}", exc_info=True)
        
        return images

