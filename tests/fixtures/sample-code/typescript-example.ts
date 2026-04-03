/**
 * TypeScript Example Module
 * Sample code for testing TypeScript-related functionality
 */

export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  createdAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  age?: number;
}

export class UserService {
  private users: Map<string, User> = new Map();

  /**
   * Create a new user
   */
  createUser(input: CreateUserInput): User {
    const user: User = {
      id: this.generateId(),
      name: input.name,
      email: input.email,
      age: input.age,
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Get user by ID
   */
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  /**
   * Update user
   */
  updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  /**
   * Delete user
   */
  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  /**
   * List all users
   */
  listUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Search users by name
   */
  searchUsers(query: string): User[] {
    return this.listUsers().filter(user =>
      user.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Utility functions
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function formatUserName(user: User): string {
  return user.name.trim().replace(/\s+/g, ' ');
}

// Constants
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Enums
export enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
}

// Type guards
export function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'email' in obj
  );
}
