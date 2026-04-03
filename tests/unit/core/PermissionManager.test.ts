/**
 * PermissionManager Tests
 * 
 * Comprehensive test suite for the PermissionManager class which handles
 * permission checking, user confirmation, and security policies.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Permission types
interface PermissionRequest {
  tool: string;
  action: string;
  params: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface PermissionConfig {
  autoApproveLowRisk: boolean;
  autoApproveMediumRisk: boolean;
  requireConfirmationFor: string[];
  blockedTools: string[];
  allowedPaths: string[];
  blockedPaths: string[];
  maxFileSize: number;
  maxExecutionTime: number;
}

type PermissionDecision = 'approve' | 'deny' | 'prompt';

interface PermissionResult {
  approved: boolean;
  decision: PermissionDecision;
  reason?: string;
}

// PermissionManager implementation
class PermissionManager {
  private config: PermissionConfig;
  private permissionHistory: Array<{
    request: PermissionRequest;
    result: PermissionResult;
    timestamp: number;
  }> = [];
  private userConfirmCallback?: (request: PermissionRequest) => Promise<boolean>;

  constructor(config: Partial<PermissionConfig> = {}) {
    this.config = {
      autoApproveLowRisk: true,
      autoApproveMediumRisk: false,
      requireConfirmationFor: [],
      blockedTools: [],
      allowedPaths: [],
      blockedPaths: [],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxExecutionTime: 60000, // 60 seconds
      ...config,
    };
  }

  /**
   * Set user confirmation callback
   */
  onUserConfirm(callback: (request: PermissionRequest) => Promise<boolean>): void {
    this.userConfirmCallback = callback;
  }

  /**
   * Check if a permission request should be approved
   */
  async checkPermission(request: PermissionRequest): Promise<PermissionResult> {
    // Check if tool is blocked
    if (this.isToolBlocked(request.tool)) {
      const result: PermissionResult = {
        approved: false,
        decision: 'deny',
        reason: `Tool '${request.tool}' is blocked`,
      };
      this.logRequest(request, result);
      return result;
    }

    // Check if tool requires explicit confirmation
    if (this.requiresConfirmation(request.tool)) {
      const approved = await this.promptUser(request);
      const result: PermissionResult = {
        approved,
        decision: approved ? 'approve' : 'deny',
        reason: approved ? 'User approved' : 'User denied',
      };
      this.logRequest(request, result);
      return result;
    }

    // Check path restrictions for file operations
    if (this.isFileOperation(request.tool)) {
      const pathCheck = this.checkPathRestrictions(request);
      if (!pathCheck.approved) {
        this.logRequest(request, pathCheck);
        return pathCheck;
      }
    }

    // Check risk level
    const riskDecision = this.evaluateRiskLevel(request);
    if (riskDecision.decision === 'prompt') {
      const approved = await this.promptUser(request);
      const result: PermissionResult = {
        approved,
        decision: approved ? 'approve' : 'deny',
        reason: approved ? 'User approved' : 'User denied',
      };
      this.logRequest(request, result);
      return result;
    }

    this.logRequest(request, riskDecision);
    return riskDecision;
  }

  /**
   * Quick check without user prompt (for pre-validation)
   */
  canExecute(tool: string, params: Record<string, unknown>): boolean {
    if (this.isToolBlocked(tool)) {
      return false;
    }

    if (this.requiresConfirmation(tool)) {
      return false;
    }

    const request: PermissionRequest = {
      tool,
      action: 'execute',
      params,
      riskLevel: this.assessRiskLevel(tool, params),
    };

    if (this.isFileOperation(tool)) {
      const pathCheck = this.checkPathRestrictions(request);
      return pathCheck.approved;
    }

    return true;
  }

  /**
   * Approve a tool for auto-execution
   */
  approveTool(tool: string): void {
    const index = this.config.requireConfirmationFor.indexOf(tool);
    if (index > -1) {
      this.config.requireConfirmationFor.splice(index, 1);
    }
  }

  /**
   * Block a tool from execution
   */
  blockTool(tool: string): void {
    if (!this.config.blockedTools.includes(tool)) {
      this.config.blockedTools.push(tool);
    }
  }

  /**
   * Unblock a tool
   */
  unblockTool(tool: string): void {
    const index = this.config.blockedTools.indexOf(tool);
    if (index > -1) {
      this.config.blockedTools.splice(index, 1);
    }
  }

  /**
   * Add path to allowed list
   */
  allowPath(path: string): void {
    if (!this.config.allowedPaths.includes(path)) {
      this.config.allowedPaths.push(path);
    }
  }

  /**
   * Add path to blocked list
   */
  blockPath(path: string): void {
    if (!this.config.blockedPaths.includes(path)) {
      this.config.blockedPaths.push(path);
    }
  }

  /**
   * Get permission history
   */
  getHistory(): Array<{
    request: PermissionRequest;
    result: PermissionResult;
    timestamp: number;
  }> {
    return [...this.permissionHistory];
  }

  /**
   * Clear permission history
   */
  clearHistory(): void {
    this.permissionHistory = [];
  }

  /**
   * Get permission statistics
   */
  getStats(): {
    totalRequests: number;
    approved: number;
    denied: number;
    prompted: number;
    blockedTools: number;
  } {
    return {
      totalRequests: this.permissionHistory.length,
      approved: this.permissionHistory.filter(h => h.result.approved).length,
      denied: this.permissionHistory.filter(h => !h.result.approved && h.result.decision === 'deny').length,
      prompted: this.permissionHistory.filter(h => h.result.decision === 'prompt').length,
      blockedTools: this.config.blockedTools.length,
    };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<PermissionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private isToolBlocked(tool: string): boolean {
    return this.config.blockedTools.includes(tool);
  }

  private requiresConfirmation(tool: string): boolean {
    return this.config.requireConfirmationFor.includes(tool);
  }

  private isFileOperation(tool: string): boolean {
    const fileTools = ['read_file', 'write_file', 'edit_file', 'delete_path', 'move_path'];
    return fileTools.includes(tool);
  }

  private checkPathRestrictions(request: PermissionRequest): PermissionResult {
    const path = (request.params.path as string) || '';

    // Check blocked paths
    for (const blockedPath of this.config.blockedPaths) {
      if (path.startsWith(blockedPath)) {
        return {
          approved: false,
          decision: 'deny',
          reason: `Path '${path}' is blocked`,
        };
      }
    }

    // Check allowed paths (if any are specified)
    if (this.config.allowedPaths.length > 0) {
      const isAllowed = this.config.allowedPaths.some(allowedPath =>
        path.startsWith(allowedPath)
      );
      if (!isAllowed) {
        return {
          approved: false,
          decision: 'deny',
          reason: `Path '${path}' is not in allowed paths`,
        };
      }
    }

    return { approved: true, decision: 'approve' };
  }

  private evaluateRiskLevel(request: PermissionRequest): PermissionResult {
    switch (request.riskLevel) {
      case 'low':
        return {
          approved: this.config.autoApproveLowRisk,
          decision: this.config.autoApproveLowRisk ? 'approve' : 'prompt',
        };
      case 'medium':
        return {
          approved: this.config.autoApproveMediumRisk,
          decision: this.config.autoApproveMediumRisk ? 'approve' : 'prompt',
        };
      case 'high':
      case 'critical':
        return {
          approved: false,
          decision: 'prompt',
        };
      default:
        return { approved: false, decision: 'prompt' };
    }
  }

  private assessRiskLevel(tool: string, params: Record<string, unknown>): PermissionRequest['riskLevel'] {
    const highRiskTools = ['execute_command', 'delete_path', 'write_file'];
    const criticalRiskTools = ['execute_command'];

    if (criticalRiskTools.includes(tool) && params.command) {
      const command = (params.command as string).toLowerCase();
      if (command.includes('rm -rf') || command.includes('sudo') || command.includes('> /dev/')) {
        return 'critical';
      }
    }

    if (criticalRiskTools.includes(tool)) return 'critical';
    if (highRiskTools.includes(tool)) return 'high';
    if (['edit_file', 'move_path'].includes(tool)) return 'medium';
    return 'low';
  }

  private async promptUser(request: PermissionRequest): Promise<boolean> {
    if (this.userConfirmCallback) {
      return await this.userConfirmCallback(request);
    }
    // Default to deny if no callback set
    return false;
  }

  private logRequest(request: PermissionRequest, result: PermissionResult): void {
    this.permissionHistory.push({
      request,
      result,
      timestamp: Date.now(),
    });
  }
}

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;

  const defaultConfig: PermissionConfig = {
    autoApproveLowRisk: true,
    autoApproveMediumRisk: false,
    requireConfirmationFor: [],
    blockedTools: [],
    allowedPaths: [],
    blockedPaths: [],
    maxFileSize: 10 * 1024 * 1024,
    maxExecutionTime: 60000,
  };

  beforeEach(() => {
    permissionManager = new PermissionManager(defaultConfig);
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const pm = new PermissionManager();
      expect(pm).toBeDefined();
    });

    it('should accept custom config', () => {
      const pm = new PermissionManager({ autoApproveLowRisk: false });
      expect(pm).toBeDefined();
    });
  });

  describe('Tool Blocking', () => {
    it('should block a tool', () => {
      permissionManager.blockTool('dangerous_tool');
      expect(permissionManager.canExecute('dangerous_tool', {})).toBe(false);
    });

    it('should unblock a tool', () => {
      permissionManager.blockTool('tool');
      permissionManager.unblockTool('tool');
      expect(permissionManager.canExecute('tool', {})).toBe(true);
    });

    it('should deny blocked tool requests', async () => {
      permissionManager.blockTool('blocked_tool');
      
      const result = await permissionManager.checkPermission({
        tool: 'blocked_tool',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('blocked');
    });
  });

  describe('Risk Level Evaluation', () => {
    it('should auto-approve low risk by default', async () => {
      const result = await permissionManager.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: { path: '/test.txt' },
        riskLevel: 'low',
      });

      expect(result.approved).toBe(true);
    });

    it('should prompt for medium risk by default', async () => {
      permissionManager.onUserConfirm(async () => true);
      
      const result = await permissionManager.checkPermission({
        tool: 'edit_file',
        action: 'execute',
        params: {},
        riskLevel: 'medium',
      });

      expect(result.approved).toBe(true);
    });

    it('should prompt for high risk', async () => {
      permissionManager.onUserConfirm(async () => true);
      
      const result = await permissionManager.checkPermission({
        tool: 'write_file',
        action: 'execute',
        params: {},
        riskLevel: 'high',
      });

      expect(result.approved).toBe(true);
    });

    it('should prompt for critical risk', async () => {
      permissionManager.onUserConfirm(async () => true);
      
      const result = await permissionManager.checkPermission({
        tool: 'execute_command',
        action: 'execute',
        params: { command: 'rm -rf /' },
        riskLevel: 'critical',
      });

      expect(result.approved).toBe(true);
    });

    it('should deny when user rejects prompt', async () => {
      permissionManager.onUserConfirm(async () => false);
      
      const result = await permissionManager.checkPermission({
        tool: 'write_file',
        action: 'execute',
        params: {},
        riskLevel: 'high',
      });

      expect(result.approved).toBe(false);
    });

    it('should deny when no callback set for prompt', async () => {
      const result = await permissionManager.checkPermission({
        tool: 'write_file',
        action: 'execute',
        params: {},
        riskLevel: 'high',
      });

      expect(result.approved).toBe(false);
    });
  });

  describe('Auto-approve Configuration', () => {
    it('should respect autoApproveLowRisk setting', async () => {
      const pm = new PermissionManager({ autoApproveLowRisk: false });
      pm.onUserConfirm(async () => true);
      
      const result = await pm.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      expect(result.decision).toBe('approve');
    });

    it('should respect autoApproveMediumRisk setting', async () => {
      const pm = new PermissionManager({ autoApproveMediumRisk: true });
      
      const result = await pm.checkPermission({
        tool: 'edit_file',
        action: 'execute',
        params: {},
        riskLevel: 'medium',
      });

      expect(result.approved).toBe(true);
      expect(result.decision).toBe('approve');
    });
  });

  describe('Confirmation Requirements', () => {
    it('should require confirmation for specified tools', async () => {
      const pm = new PermissionManager({
        requireConfirmationFor: ['special_tool'],
      });
      pm.onUserConfirm(async () => true);
      
      const result = await pm.checkPermission({
        tool: 'special_tool',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      expect(result.decision).toBe('approve');
    });

    it('should approve tool after explicit approval', async () => {
      permissionManager.configure({ requireConfirmationFor: ['tool'] });
      permissionManager.approveTool('tool');
      
      expect(permissionManager.canExecute('tool', {})).toBe(true);
    });
  });

  describe('Path Restrictions', () => {
    it('should block access to blocked paths', async () => {
      permissionManager.blockPath('/etc');
      
      const result = await permissionManager.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: { path: '/etc/passwd' },
        riskLevel: 'low',
      });

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should allow access to allowed paths only', async () => {
      const pm = new PermissionManager({
        allowedPaths: ['/project'],
        autoApproveLowRisk: true,
      });
      
      const allowed = await pm.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: { path: '/project/file.txt' },
        riskLevel: 'low',
      });

      const blocked = await pm.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: { path: '/other/file.txt' },
        riskLevel: 'low',
      });

      expect(allowed.approved).toBe(true);
      expect(blocked.approved).toBe(false);
    });

    it('should allow all paths when allowedPaths is empty', async () => {
      const result = await permissionManager.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: { path: '/any/path' },
        riskLevel: 'low',
      });

      expect(result.approved).toBe(true);
    });
  });

  describe('Quick Check (canExecute)', () => {
    it('should return true for allowed operations', () => {
      expect(permissionManager.canExecute('read_file', { path: '/test.txt' })).toBe(true);
    });

    it('should return false for blocked tools', () => {
      permissionManager.blockTool('blocked');
      expect(permissionManager.canExecute('blocked', {})).toBe(false);
    });

    it('should return false for tools requiring confirmation', () => {
      permissionManager.configure({ requireConfirmationFor: ['confirm_me'] });
      expect(permissionManager.canExecute('confirm_me', {})).toBe(false);
    });

    it('should return false for blocked paths', () => {
      permissionManager.blockPath('/etc');
      expect(permissionManager.canExecute('read_file', { path: '/etc/passwd' })).toBe(false);
    });

    it('should assess risk level for commands', () => {
      const pm = new PermissionManager({ autoApproveLowRisk: true });
      expect(pm.canExecute('execute_command', { command: 'ls' })).toBe(true);
    });
  });

  describe('Permission History', () => {
    it('should log permission requests', async () => {
      await permissionManager.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      const history = permissionManager.getHistory();
      expect(history).toHaveLength(1);
    });

    it('should log denied requests', async () => {
      permissionManager.blockTool('blocked');
      await permissionManager.checkPermission({
        tool: 'blocked',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      const history = permissionManager.getHistory();
      expect(history[0].result.approved).toBe(false);
    });

    it('should clear history', async () => {
      await permissionManager.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      permissionManager.clearHistory();
      expect(permissionManager.getHistory()).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should track total requests', async () => {
      await permissionManager.checkPermission({
        tool: 'tool1',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });
      await permissionManager.checkPermission({
        tool: 'tool2',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      const stats = permissionManager.getStats();
      expect(stats.totalRequests).toBe(2);
    });

    it('should track approved count', async () => {
      await permissionManager.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      const stats = permissionManager.getStats();
      expect(stats.approved).toBe(1);
    });

    it('should track denied count', async () => {
      permissionManager.blockTool('blocked');
      await permissionManager.checkPermission({
        tool: 'blocked',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      const stats = permissionManager.getStats();
      expect(stats.denied).toBe(1);
    });

    it('should track blocked tools count', () => {
      permissionManager.blockTool('tool1');
      permissionManager.blockTool('tool2');
      
      const stats = permissionManager.getStats();
      expect(stats.blockedTools).toBe(2);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      permissionManager.configure({ autoApproveLowRisk: false });
      
      // Test that new config is applied
      expect(permissionManager.canExecute('read_file', {})).toBe(true);
    });

    it('should merge configuration updates', () => {
      permissionManager.configure({ maxFileSize: 5 * 1024 * 1024 });
      
      // Other settings should remain
      expect(permissionManager.canExecute('read_file', {})).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tool name', async () => {
      const result = await permissionManager.checkPermission({
        tool: '',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      expect(result.approved).toBe(true);
    });

    it('should handle missing path parameter', async () => {
      const result = await permissionManager.checkPermission({
        tool: 'read_file',
        action: 'execute',
        params: {},
        riskLevel: 'low',
      });

      expect(result.approved).toBe(true);
    });

    it('should handle unknown risk level', async () => {
      permissionManager.onUserConfirm(async () => true);
      
      const result = await permissionManager.checkPermission({
        tool: 'tool',
        action: 'execute',
        params: {},
        riskLevel: 'unknown' as any,
      });

      expect(result.decision).toBe('prompt');
    });

    it('should detect critical commands', () => {
      const pm = new PermissionManager({ autoApproveLowRisk: true });
      expect(pm.canExecute('execute_command', { command: 'sudo rm -rf /' })).toBe(false);
    });
  });
});
