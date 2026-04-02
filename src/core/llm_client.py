"""
Claude Code Agent System - LLM Client

This module provides LLM client implementations for interacting with
various language model APIs (Anthropic, OpenAI, Azure OpenAI).
Supports both streaming and non-streaming chat completions.
"""

from __future__ import annotations

import asyncio
import json
import os
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Dict, List, Optional, Type, Union

import httpx
from pydantic import BaseModel

from .types import (
    LLMConfig,
    LLMEvent,
    Message,
    MessageRole,
    ToolCall,
    ToolDefinition,
)


# =============================================================================
# Base LLM Client
# =============================================================================

class BaseLLMClient(ABC):
    """Abstract base class for LLM clients."""
    
    def __init__(self, config: LLMConfig):
        """
        Initialize the LLM client.
        
        Args:
            config: LLM configuration including API key, model, etc.
        """
        self.config = config
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.config.timeout,
                headers=self._get_headers(),
            )
        return self._client
    
    @abstractmethod
    def _get_headers(self) -> Dict[str, str]:
        """Get HTTP headers for API requests."""
        pass
    
    @abstractmethod
    def _build_request_body(
        self,
        messages: List[Message],
        tools: Optional[List[ToolDefinition]] = None,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """Build the request body for the API."""
        pass
    
    @abstractmethod
    def _parse_stream_chunk(self, chunk: str) -> Optional[LLMEvent]:
        """Parse a streaming chunk into an LLMEvent."""
        pass
    
    @abstractmethod
    def _parse_response(self, response: Dict[str, Any]) -> Message:
        """Parse the API response into a Message."""
        pass
    
    async def stream_chat(
        self,
        messages: List[Message],
        tools: Optional[List[ToolDefinition]] = None,
    ) -> AsyncIterator[LLMEvent]:
        """
        Stream chat completion from the LLM.
        
        Args:
            messages: List of messages in the conversation
            tools: Optional list of available tools
            
        Yields:
            LLMEvent objects representing streaming events
        """
        client = await self._get_client()
        body = self._build_request_body(messages, tools, stream=True)
        
        try:
            async with client.stream(
                "POST",
                self._get_chat_endpoint(),
                json=body,
            ) as response:
                response.raise_for_status()
                
                async for line in response.aiter_lines():
                    if not line or line.strip() == "":
                        continue
                    
                    # Handle SSE format
                    if line.startswith("data: "):
                        data = line[6:]  # Remove "data: " prefix
                        
                        if data == "[DONE]":
                            yield LLMEvent(type="done", is_complete=True)
                            return
                        
                        try:
                            event = self._parse_stream_chunk(data)
                            if event:
                                yield event
                        except Exception as e:
                            yield LLMEvent(type="error", error=str(e))
                            return
        
        except httpx.HTTPError as e:
            yield LLMEvent(type="error", error=f"HTTP error: {e}")
        except Exception as e:
            yield LLMEvent(type="error", error=f"Unexpected error: {e}")
    
    async def chat(
        self,
        messages: List[Message],
        tools: Optional[List[ToolDefinition]] = None,
    ) -> Message:
        """
        Non-streaming chat completion from the LLM.
        
        Args:
            messages: List of messages in the conversation
            tools: Optional list of available tools
            
        Returns:
            The completed message from the LLM
        """
        client = await self._get_client()
        body = self._build_request_body(messages, tools, stream=False)
        
        for attempt in range(self.config.max_retries):
            try:
                response = await client.post(
                    self._get_chat_endpoint(),
                    json=body,
                )
                response.raise_for_status()
                data = response.json()
                return self._parse_response(data)
            
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:  # Rate limit
                    wait_time = 2 ** attempt  # Exponential backoff
                    await asyncio.sleep(wait_time)
                    continue
                raise
            except Exception:
                if attempt == self.config.max_retries - 1:
                    raise
                await asyncio.sleep(1)
        
        raise RuntimeError("Max retries exceeded")
    
    @abstractmethod
    def _get_chat_endpoint(self) -> str:
        """Get the chat completion API endpoint URL."""
        pass
    
    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
    
    async def __aenter__(self) -> BaseLLMClient:
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, *args: Any) -> None:
        """Async context manager exit."""
        await self.close()


# =============================================================================
# Anthropic Client
# =============================================================================

class AnthropicClient(BaseLLMClient):
    """Client for Anthropic's Claude API."""
    
    DEFAULT_BASE_URL = "https://api.anthropic.com"
    API_VERSION = "2023-06-01"
    
    def __init__(self, config: Optional[LLMConfig] = None):
        """
        Initialize Anthropic client.
        
        Args:
            config: LLM configuration. If not provided, uses environment variables.
        """
        if config is None:
            config = LLMConfig(
                api_key=os.environ.get("ANTHROPIC_API_KEY"),
                model="claude-3-sonnet-20240229",
            )
        
        if not config.base_url:
            config.base_url = self.DEFAULT_BASE_URL
        
        super().__init__(config)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get Anthropic API headers."""
        return {
            "x-api-key": self.config.api_key or "",
            "anthropic-version": self.API_VERSION,
            "content-type": "application/json",
        }
    
    def _get_chat_endpoint(self) -> str:
        """Get Anthropic messages endpoint."""
        base = self.config.base_url.rstrip("/")
        return f"{base}/v1/messages"
    
    def _convert_messages(self, messages: List[Message]) -> List[Dict[str, Any]]:
        """Convert messages to Anthropic format."""
        result = []
        for msg in messages:
            if msg.role == MessageRole.SYSTEM:
                # System messages handled separately in Anthropic
                continue
            
            anthropic_msg: Dict[str, Any] = {"role": msg.role.value}
            
            if msg.content:
                anthropic_msg["content"] = msg.content
            
            if msg.tool_calls:
                anthropic_msg["content"] = [
                    {
                        "type": "tool_use",
                        "id": tc.id,
                        "name": tc.name,
                        "input": tc.arguments,
                    }
                    for tc in msg.tool_calls
                ]
            
            result.append(anthropic_msg)
        
        return result
    
    def _get_system_message(self, messages: List[Message]) -> Optional[str]:
        """Extract system message content if present."""
        for msg in messages:
            if msg.role == MessageRole.SYSTEM and msg.content:
                return msg.content
        return None
    
    def _convert_tools(self, tools: List[ToolDefinition]) -> List[Dict[str, Any]]:
        """Convert tools to Anthropic format."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": {
                    "type": "object",
                    "properties": {
                        p.name: {
                            "type": p.type,
                            "description": p.description,
                            **({"enum": p.enum} if p.enum else {}),
                        }
                        for p in tool.parameters
                    },
                    "required": [p.name for p in tool.parameters if p.required],
                },
            }
            for tool in tools
        ]
    
    def _build_request_body(
        self,
        messages: List[Message],
        tools: Optional[List[ToolDefinition]] = None,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """Build Anthropic request body."""
        body: Dict[str, Any] = {
            "model": self.config.model,
            "messages": self._convert_messages(messages),
            "max_tokens": self.config.max_tokens or 4096,
            "temperature": self.config.temperature,
            "stream": stream,
        }
        
        system = self._get_system_message(messages)
        if system:
            body["system"] = system
        
        if tools:
            body["tools"] = self._convert_tools(tools)
        
        return body
    
    def _parse_stream_chunk(self, chunk: str) -> Optional[LLMEvent]:
        """Parse Anthropic streaming chunk."""
        try:
            data = json.loads(chunk)
            event_type = data.get("type")
            
            if event_type == "content_block_delta":
                delta = data.get("delta", {})
                delta_type = delta.get("type")
                
                if delta_type == "text_delta":
                    return LLMEvent(
                        type="content",
                        content=delta.get("text", ""),
                    )
                elif delta_type == "thinking_delta":
                    return LLMEvent(
                        type="thinking",
                        thinking=delta.get("thinking", ""),
                    )
            
            elif event_type == "content_block_start":
                content_block = data.get("content_block", {})
                block_type = content_block.get("type")
                
                if block_type == "tool_use":
                    return LLMEvent(
                        type="tool_call",
                        tool_call=ToolCall(
                            id=content_block.get("id", ""),
                            name=content_block.get("name", ""),
                            arguments=content_block.get("input", {}),
                        ),
                    )
            
            elif event_type == "message_stop":
                return LLMEvent(type="done", is_complete=True)
            
            return None
        
        except json.JSONDecodeError:
            return None
    
    def _parse_response(self, response: Dict[str, Any]) -> Message:
        """Parse Anthropic response into Message."""
        content_blocks = response.get("content", [])
        text_parts = []
        tool_calls = []
        
        for block in content_blocks:
            block_type = block.get("type")
            
            if block_type == "text":
                text_parts.append(block.get("text", ""))
            elif block_type == "tool_use":
                tool_calls.append(
                    ToolCall(
                        id=block.get("id", ""),
                        name=block.get("name", ""),
                        arguments=block.get("input", {}),
                    )
                )
        
        return Message(
            role=MessageRole.ASSISTANT,
            content="\n".join(text_parts) if text_parts else None,
            tool_calls=tool_calls if tool_calls else None,
        )


# =============================================================================
# OpenAI Client
# =============================================================================

class OpenAIClient(BaseLLMClient):
    """Client for OpenAI's API (and OpenAI-compatible APIs)."""
    
    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    
    def __init__(self, config: Optional[LLMConfig] = None):
        """
        Initialize OpenAI client.
        
        Args:
            config: LLM configuration. If not provided, uses environment variables.
        """
        if config is None:
            config = LLMConfig(
                api_key=os.environ.get("OPENAI_API_KEY"),
                model="gpt-4",
            )
        
        if not config.base_url:
            config.base_url = self.DEFAULT_BASE_URL
        
        super().__init__(config)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get OpenAI API headers."""
        return {
            "authorization": f"Bearer {self.config.api_key or ''}",
            "content-type": "application/json",
        }
    
    def _get_chat_endpoint(self) -> str:
        """Get OpenAI chat completions endpoint."""
        base = self.config.base_url.rstrip("/")
        return f"{base}/chat/completions"
    
    def _build_request_body(
        self,
        messages: List[Message],
        tools: Optional[List[ToolDefinition]] = None,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """Build OpenAI request body."""
        body: Dict[str, Any] = {
            "model": self.config.model,
            "messages": [msg.to_openai_format() for msg in messages],
            "temperature": self.config.temperature,
            "stream": stream,
        }
        
        if self.config.max_tokens:
            body["max_tokens"] = self.config.max_tokens
        
        if tools:
            body["tools"] = [tool.to_openai_format() for tool in tools]
        
        return body
    
    def _parse_stream_chunk(self, chunk: str) -> Optional[LLMEvent]:
        """Parse OpenAI streaming chunk."""
        try:
            data = json.loads(chunk)
            
            if data.get("choices"):
                choice = data["choices"][0]
                delta = choice.get("delta", {})
                
                # Check for tool calls
                if delta.get("tool_calls"):
                    tool_call_data = delta["tool_calls"][0]
                    return LLMEvent(
                        type="tool_call",
                        tool_call=ToolCall(
                            id=tool_call_data.get("id", ""),
                            name=tool_call_data.get("function", {}).get("name", ""),
                            arguments=tool_call_data.get("function", {}).get("arguments", ""),
                        ),
                    )
                
                # Check for content
                if delta.get("content"):
                    return LLMEvent(
                        type="content",
                        content=delta["content"],
                    )
                
                # Check for finish reason
                if choice.get("finish_reason"):
                    return LLMEvent(type="done", is_complete=True)
            
            return None
        
        except json.JSONDecodeError:
            return None
    
    def _parse_response(self, response: Dict[str, Any]) -> Message:
        """Parse OpenAI response into Message."""
        choice = response["choices"][0]
        message_data = choice["message"]
        
        tool_calls = None
        if message_data.get("tool_calls"):
            tool_calls = [
                ToolCall(
                    id=tc["id"],
                    name=tc["function"]["name"],
                    arguments=tc["function"]["arguments"],
                )
                for tc in message_data["tool_calls"]
            ]
        
        return Message(
            role=MessageRole.ASSISTANT,
            content=message_data.get("content"),
            tool_calls=tool_calls,
        )


# =============================================================================
# LLM Client Factory
# =============================================================================

class LLMClient:
    """
    Factory and unified interface for LLM clients.
    
    Usage:
        # Anthropic (default)
        client = LLMClient.anthropic()
        
        # OpenAI
        client = LLMClient.openai()
        
        # From config
        config = LLMConfig(provider="anthropic", model="claude-3-opus")
        client = LLMClient.from_config(config)
    """
    
    @staticmethod
    def anthropic(
        api_key: Optional[str] = None,
        model: str = "claude-3-sonnet-20240229",
        **kwargs: Any,
    ) -> AnthropicClient:
        """Create an Anthropic client."""
        config = LLMConfig(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"),
            model=model,
            provider="anthropic",
            **kwargs,
        )
        return AnthropicClient(config)
    
    @staticmethod
    def openai(
        api_key: Optional[str] = None,
        model: str = "gpt-4",
        base_url: Optional[str] = None,
        **kwargs: Any,
    ) -> OpenAIClient:
        """Create an OpenAI client."""
        config = LLMConfig(
            api_key=api_key or os.environ.get("OPENAI_API_KEY"),
            model=model,
            base_url=base_url,
            provider="openai",
            **kwargs,
        )
        return OpenAIClient(config)
    
    @staticmethod
    def from_config(config: LLMConfig) -> BaseLLMClient:
        """Create a client from configuration."""
        if config.provider == "anthropic":
            return AnthropicClient(config)
        elif config.provider in ("openai", "azure"):
            return OpenAIClient(config)
        else:
            raise ValueError(f"Unknown provider: {config.provider}")


# =============================================================================
# Convenience Functions
# =============================================================================

async def stream_chat(
    messages: List[Message],
    tools: Optional[List[ToolDefinition]] = None,
    config: Optional[LLMConfig] = None,
) -> AsyncIterator[LLMEvent]:
    """
    Convenience function for streaming chat without creating a client.
    
    Args:
        messages: List of messages
        tools: Optional list of tools
        config: Optional LLM config (uses Anthropic default if not provided)
        
    Yields:
        LLMEvent objects
    """
    client = LLMClient.from_config(config or LLMConfig())
    try:
        async for event in client.stream_chat(messages, tools):
            yield event
    finally:
        await client.close()


async def chat(
    messages: List[Message],
    tools: Optional[List[ToolDefinition]] = None,
    config: Optional[LLMConfig] = None,
) -> Message:
    """
    Convenience function for non-streaming chat without creating a client.
    
    Args:
        messages: List of messages
        tools: Optional list of tools
        config: Optional LLM config (uses Anthropic default if not provided)
        
    Returns:
        Completed message from LLM
    """
    client = LLMClient.from_config(config or LLMConfig())
    try:
        return await client.chat(messages, tools)
    finally:
        await client.close()


__all__ = [
    "BaseLLMClient",
    "AnthropicClient",
    "OpenAIClient",
    "LLMClient",
    "stream_chat",
    "chat",
]
