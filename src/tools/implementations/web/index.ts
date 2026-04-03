/**
 * @fileoverview Web Tools Index
 * 
 * This module exports all web tools for the Claude Code Clone.
 * 
 * @module web
 * @version 1.0.0
 * @author Claude Code Clone
 */

export { WebSearchTool, WebSearchInputSchema, WebSearchOutputSchema, WebSearchResultItemSchema } from './WebSearchTool';
export type { WebSearchInput, WebSearchOutput, WebSearchResultItem } from './WebSearchTool';

export { WebFetchTool, WebFetchInputSchema, WebFetchOutputSchema } from './WebFetchTool';
export type { WebFetchInput, WebFetchOutput } from './WebFetchTool';

export { APITool, APIInputSchema, APIOutputSchema } from './APITool';
export type { APIInput, APIOutput } from './APITool';
