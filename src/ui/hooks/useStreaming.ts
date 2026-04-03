/**
 * Streaming response hook for Claude Code Clone
 * @module hooks/useStreaming
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { StreamingState, StreamingOptions } from '../types/index.js';

/**
 * Default streaming options
 */
const DEFAULT_OPTIONS: Required<StreamingOptions> = {
  chunkSize: 1,
  delay: 30,
  smooth: true,
  onChunk: () => {},
  onComplete: () => {},
  onError: () => {},
};

/**
 * Hook for managing streaming text content
 * @param options - Streaming configuration options
 * @returns Streaming state and control functions
 */
export function useStreaming(options: StreamingOptions = {}): {
  state: StreamingState;
  start: (content: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  isStreaming: boolean;
  isPaused: boolean;
  content: string;
  progress: number;
} {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    content: '',
    speed: 0,
    estimatedTimeRemaining: undefined,
    progress: 0,
  });
  
  const [isPaused, setIsPaused] = useState(false);
  const contentRef = useRef('');
  const targetContentRef = useRef('');
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastChunkTimeRef = useRef<number>(0);
  const positionRef = useRef(0);
  
  /**
   * Clear animation timeout
   */
  const clearAnimation = useCallback(() => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
  }, []);
  
  /**
   * Start streaming content
   */
  const start = useCallback((content: string) => {
    clearAnimation();
    
    targetContentRef.current = content;
    contentRef.current = '';
    positionRef.current = 0;
    startTimeRef.current = Date.now();
    lastChunkTimeRef.current = Date.now();
    setIsPaused(false);
    
    setState({
      isStreaming: true,
      content: '',
      speed: 0,
      estimatedTimeRemaining: (content.length / opts.chunkSize) * opts.delay,
      progress: 0,
    });
    
    const streamChunk = () => {
      if (isPaused) return;
      
      const target = targetContentRef.current;
      const currentPos = positionRef.current;
      
      if (currentPos >= target.length) {
        // Streaming complete
        setState(prev => ({
          ...prev,
          isStreaming: false,
          progress: 1,
          estimatedTimeRemaining: 0,
        }));
        opts.onComplete();
        return;
      }
      
      // Calculate chunk size
      let chunkSize = opts.chunkSize;
      if (opts.smooth) {
        // Vary chunk size for more natural feel
        chunkSize = Math.max(1, opts.chunkSize + Math.floor(Math.random() * 3) - 1);
      }
      
      // Get next chunk
      const chunk = target.slice(currentPos, currentPos + chunkSize);
      positionRef.current = currentPos + chunk.length;
      
      // Update content
      contentRef.current += chunk;
      
      // Calculate speed
      const now = Date.now();
      const timeDelta = now - lastChunkTimeRef.current;
      const speed = timeDelta > 0 ? (chunk.length / timeDelta) * 1000 : 0;
      lastChunkTimeRef.current = now;
      
      // Calculate progress
      const progress = positionRef.current / target.length;
      
      // Calculate estimated time remaining
      const elapsed = now - startTimeRef.current;
      const avgSpeed = positionRef.current / elapsed;
      const remaining = target.length - positionRef.current;
      const estimatedTimeRemaining = avgSpeed > 0 ? remaining / avgSpeed : undefined;
      
      setState({
        isStreaming: true,
        content: contentRef.current,
        speed,
        estimatedTimeRemaining,
        progress,
      });
      
      opts.onChunk(chunk);
      
      // Schedule next chunk
      let nextDelay = opts.delay;
      if (opts.smooth) {
        // Add slight variation to delay
        nextDelay = opts.delay + Math.floor(Math.random() * 20) - 10;
      }
      
      animationRef.current = setTimeout(streamChunk, Math.max(10, nextDelay));
    };
    
    // Start streaming
    streamChunk();
  }, [clearAnimation, isPaused, opts]);
  
  /**
   * Stop streaming
   */
  const stop = useCallback(() => {
    clearAnimation();
    setState(prev => ({
      ...prev,
      isStreaming: false,
    }));
  }, [clearAnimation]);
  
  /**
   * Pause streaming
   */
  const pause = useCallback(() => {
    setIsPaused(true);
    clearAnimation();
  }, [clearAnimation]);
  
  /**
   * Resume streaming
   */
  const resume = useCallback(() => {
    if (!state.isStreaming || positionRef.current >= targetContentRef.current.length) {
      return;
    }
    
    setIsPaused(false);
    
    const streamChunk = () => {
      if (isPaused) return;
      
      const target = targetContentRef.current;
      const currentPos = positionRef.current;
      
      if (currentPos >= target.length) {
        setState(prev => ({
          ...prev,
          isStreaming: false,
          progress: 1,
        }));
        opts.onComplete();
        return;
      }
      
      const chunk = target.slice(currentPos, currentPos + opts.chunkSize);
      positionRef.current = currentPos + chunk.length;
      contentRef.current += chunk;
      
      const progress = positionRef.current / target.length;
      
      setState(prev => ({
        ...prev,
        content: contentRef.current,
        progress,
      }));
      
      opts.onChunk(chunk);
      
      animationRef.current = setTimeout(streamChunk, opts.delay);
    };
    
    streamChunk();
  }, [state.isStreaming, isPaused, opts]);
  
  /**
   * Reset streaming state
   */
  const reset = useCallback(() => {
    clearAnimation();
    contentRef.current = '';
    targetContentRef.current = '';
    positionRef.current = 0;
    setIsPaused(false);
    setState({
      isStreaming: false,
      content: '',
      speed: 0,
      estimatedTimeRemaining: undefined,
      progress: 0,
    });
  }, [clearAnimation]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAnimation();
    };
  }, [clearAnimation]);
  
  return {
    state,
    start,
    stop,
    pause,
    resume,
    reset,
    isStreaming: state.isStreaming,
    isPaused,
    content: state.content,
    progress: state.progress || 0,
  };
}

/**
 * Hook for simulating typing effect
 * @param text - Text to type
 * @param options - Typing options
 * @returns Typed text and control functions
 */
export function useTypewriter(
  text: string,
  options: {
    speed?: number;
    enabled?: boolean;
    onComplete?: () => void;
  } = {}
): {
  displayedText: string;
  isTyping: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
} {
  const { speed = 50, enabled = true, onComplete } = options;
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  const start = useCallback(() => {
    if (!enabled) return;
    
    clear();
    indexRef.current = 0;
    setDisplayedText('');
    setIsTyping(true);
    
    const type = () => {
      if (indexRef.current < text.length) {
        const nextChar = text[indexRef.current];
        indexRef.current++;
        setDisplayedText(prev => prev + nextChar);
        
        // Variable typing speed for realism
        const variableSpeed = speed + Math.random() * 30 - 15;
        timeoutRef.current = setTimeout(type, Math.max(10, variableSpeed));
      } else {
        setIsTyping(false);
        onComplete?.();
      }
    };
    
    type();
  }, [text, speed, enabled, onComplete, clear]);
  
  const stop = useCallback(() => {
    clear();
    setIsTyping(false);
  }, [clear]);
  
  const reset = useCallback(() => {
    clear();
    indexRef.current = 0;
    setDisplayedText('');
    setIsTyping(false);
  }, [clear]);
  
  useEffect(() => {
    if (enabled) {
      start();
    }
    return clear;
  }, [text, enabled]);
  
  return { displayedText, isTyping, start, stop, reset };
}

/**
 * Hook for word-by-word streaming
 * @param options - Streaming options
 * @returns Word streaming controls
 */
export function useWordStreaming(options: StreamingOptions = {}): {
  words: string[];
  currentWordIndex: number;
  visibleWords: string[];
  start: (text: string) => void;
  stop: () => void;
  isStreaming: boolean;
} {
  const opts = { ...DEFAULT_OPTIONS, delay: 100, ...options };
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  const start = useCallback((text: string) => {
    clear();
    
    const wordList = text.split(/(\s+)/).filter(Boolean);
    setWords(wordList);
    setCurrentWordIndex(0);
    setIsStreaming(true);
    
    let index = 0;
    
    const streamNext = () => {
      if (index < wordList.length) {
        setCurrentWordIndex(index);
        index++;
        opts.onChunk(wordList[index - 1]);
        timeoutRef.current = setTimeout(streamNext, opts.delay);
      } else {
        setIsStreaming(false);
        opts.onComplete();
      }
    };
    
    streamNext();
  }, [clear, opts]);
  
  const stop = useCallback(() => {
    clear();
    setIsStreaming(false);
  }, [clear]);
  
  useEffect(() => {
    return clear;
  }, [clear]);
  
  const visibleWords = useMemo(() => 
    words.slice(0, currentWordIndex + 1),
    [words, currentWordIndex]
  );
  
  return {
    words,
    currentWordIndex,
    visibleWords,
    start,
    stop,
    isStreaming,
  };
}

/**
 * Hook for line-by-line streaming
 * @param options - Streaming options
 * @returns Line streaming controls
 */
export function useLineStreaming(options: StreamingOptions = {}): {
  lines: string[];
  currentLineIndex: number;
  visibleLines: string[];
  start: (text: string) => void;
  stop: () => void;
  isStreaming: boolean;
} {
  const opts = { ...DEFAULT_OPTIONS, delay: 200, ...options };
  const [lines, setLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  const start = useCallback((text: string) => {
    clear();
    
    const lineList = text.split('\n');
    setLines(lineList);
    setCurrentLineIndex(0);
    setIsStreaming(true);
    
    let index = 0;
    
    const streamNext = () => {
      if (index < lineList.length) {
        setCurrentLineIndex(index);
        index++;
        opts.onChunk(lineList[index - 1] + '\n');
        timeoutRef.current = setTimeout(streamNext, opts.delay);
      } else {
        setIsStreaming(false);
        opts.onComplete();
      }
    };
    
    streamNext();
  }, [clear, opts]);
  
  const stop = useCallback(() => {
    clear();
    setIsStreaming(false);
  }, [clear]);
  
  useEffect(() => {
    return clear;
  }, [clear]);
  
  const visibleLines = useMemo(() => 
    lines.slice(0, currentLineIndex + 1),
    [lines, currentLineIndex]
  );
  
  return {
    lines,
    currentLineIndex,
    visibleLines,
    start,
    stop,
    isStreaming,
  };
}

/**
 * Hook for measuring streaming performance
 * @returns Performance metrics
 */
export function useStreamingMetrics(): {
  recordChunk: (size: number) => void;
  getMetrics: () => {
    totalChunks: number;
    totalBytes: number;
    averageChunkSize: number;
    averageSpeed: number;
    peakSpeed: number;
  };
  reset: () => void;
} {
  const metricsRef = useRef({
    chunks: 0,
    bytes: 0,
    chunkSizes: [] as number[],
    speeds: [] as number[],
    peakSpeed: 0,
    lastTime: Date.now(),
  });
  
  const recordChunk = useCallback((size: number) => {
    const now = Date.now();
    const timeDelta = now - metricsRef.current.lastTime;
    const speed = timeDelta > 0 ? (size / timeDelta) * 1000 : 0;
    
    metricsRef.current.chunks++;
    metricsRef.current.bytes += size;
    metricsRef.current.chunkSizes.push(size);
    metricsRef.current.speeds.push(speed);
    metricsRef.current.peakSpeed = Math.max(metricsRef.current.peakSpeed, speed);
    metricsRef.current.lastTime = now;
  }, []);
  
  const getMetrics = useCallback(() => {
    const { chunks, bytes, chunkSizes, speeds, peakSpeed } = metricsRef.current;
    
    const averageChunkSize = chunkSizes.length > 0
      ? chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length
      : 0;
    
    const averageSpeed = speeds.length > 0
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : 0;
    
    return {
      totalChunks: chunks,
      totalBytes: bytes,
      averageChunkSize,
      averageSpeed,
      peakSpeed,
    };
  }, []);
  
  const reset = useCallback(() => {
    metricsRef.current = {
      chunks: 0,
      bytes: 0,
      chunkSizes: [],
      speeds: [],
      peakSpeed: 0,
      lastTime: Date.now(),
    };
  }, []);
  
  return { recordChunk, getMetrics, reset };
}

export default useStreaming;
