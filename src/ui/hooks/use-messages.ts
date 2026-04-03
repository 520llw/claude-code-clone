/**
 * Messages Hook
 * 
 * Custom hook for managing chat messages.
 */

import { useState, useCallback } from 'react';
import type { Message } from '@types/index';

// ============================================================================
// Hook Interface
// ============================================================================

interface UseMessagesReturn {
  messages: Message[];
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  getMessageById: (id: string) => Message | undefined;
  getLastMessage: () => Message | undefined;
  getMessagesByRole: (role: Message['role']) => Message[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMessages(initialMessages: Message[] = []): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  
  /**
   * Add a new message
   */
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  /**
   * Update an existing message
   */
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === id ? { ...msg, ...updates } : msg
      )
    );
  }, []);
  
  /**
   * Remove a message
   */
  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);
  
  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  /**
   * Get a message by ID
   */
  const getMessageById = useCallback((id: string) => {
    return messages.find(msg => msg.id === id);
  }, [messages]);
  
  /**
   * Get the last message
   */
  const getLastMessage = useCallback(() => {
    return messages[messages.length - 1];
  }, [messages]);
  
  /**
   * Get messages by role
   */
  const getMessagesByRole = useCallback((role: Message['role']) => {
    return messages.filter(msg => msg.role === role);
  }, [messages]);
  
  return {
    messages,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    getMessageById,
    getLastMessage,
    getMessagesByRole,
  };
}

export default useMessages;
