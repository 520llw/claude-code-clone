/**
 * Layout components for Claude Code Clone
 * @module components/layout
 */

export { 
  Header, 
  MinimalHeader, 
  NavigationHeader 
} from './Header.js';
export { 
  Footer, 
  StatusBar, 
  VimFooter 
} from './Footer.js';
export { 
  Sidebar, 
  FileSidebar 
} from './Sidebar.js';
export { 
  MainArea, 
  ScrollableArea, 
  PaddedArea, 
  ContentPanel 
} from './MainArea.js';

// Re-export types
export type { HeaderProps, HeaderAction } from './Header.js';
export type { FooterProps, FooterStatusItem } from './Footer.js';
export type { SidebarProps, SidebarSection, SidebarItem } from './Sidebar.js';
export type { MainAreaProps, ScrollPosition } from './MainArea.js';
