/**
 * Database MCP Server
 * 
 * This file contains a built-in MCP server for database operations.
 * Supports SQLite and PostgreSQL databases.
 */

import { createMCPServer, createToolResult } from '../MCPServer';
import {
  Tool,
  CallToolResult,
  ServerCapabilities,
} from '../types';

/**
 * Database server options
 */
export interface DatabaseServerOptions {
  /**
   * Database type
   */
  type: 'sqlite' | 'postgresql';

  /**
   * Database connection string or file path
   */
  connection: string;

  /**
   * Server name
   */
  name?: string;

  /**
   * Server version
   */
  version?: string;

  /**
   * Read-only mode
   */
  readOnly?: boolean;
}

/**
 * Create a database MCP server
 */
export function createDatabaseServer(options: DatabaseServerOptions) {
  const readOnly = options.readOnly || false;

  const server = createMCPServer({
    name: options.name || `database-${options.type}`,
    version: options.version || '1.0.0',
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
    },
  });

  // Database connection placeholder
  let db: any = null;

  // Initialize database connection
  const initDb = async () => {
    if (db) return db;

    if (options.type === 'sqlite') {
      const { Database } = await import('better-sqlite3');
      db = new Database(options.connection, { readonly: readOnly });
    } else if (options.type === 'postgresql') {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: options.connection });
      await client.connect();
      db = client;
    }

    return db;
  };

  // Execute query helper
  const executeQuery = async (sql: string, params: unknown[] = []): Promise<unknown> => {
    const database = await initDb();

    if (options.type === 'sqlite') {
      if (sql.trim().toLowerCase().startsWith('select')) {
        return database.prepare(sql).all(...params);
      } else {
        return database.prepare(sql).run(...params);
      }
    } else if (options.type === 'postgresql') {
      const result = await database.query(sql, params);
      return result.rows;
    }

    throw new Error('Unsupported database type');
  };

  // Register query tool
  server.registerTool(
    {
      name: 'query',
      description: `Execute a SQL query on the ${options.type} database`,
      inputSchema: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'SQL query to execute',
          },
          params: {
            type: 'array',
            items: { type: 'string' },
            description: 'Query parameters',
          },
        },
        required: ['sql'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const sql = args.sql as string;
        const params = (args.params as string[]) || [];

        // Security: Check for write operations in read-only mode
        if (readOnly) {
          const writeOps = ['insert', 'update', 'delete', 'drop', 'create', 'alter'];
          const firstWord = sql.trim().split(/\s+/)[0].toLowerCase();
          if (writeOps.includes(firstWord)) {
            return createToolResult(
              [
                {
                  type: 'text',
                  text: 'Write operations are disabled in read-only mode',
                },
              ],
              true
            );
          }
        }

        const result = await executeQuery(sql, params);

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Query error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register list_tables tool
  server.registerTool(
    {
      name: 'list_tables',
      description: 'List all tables in the database',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async (): Promise<CallToolResult> => {
      try {
        let sql: string;

        if (options.type === 'sqlite') {
          sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
        } else if (options.type === 'postgresql') {
          sql = "SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name";
        } else {
          throw new Error('Unsupported database type');
        }

        const result = await executeQuery(sql);

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error listing tables: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register describe_table tool
  server.registerTool(
    {
      name: 'describe_table',
      description: 'Get the schema of a table',
      inputSchema: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: 'Table name',
          },
        },
        required: ['table'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const table = args.table as string;
        let sql: string;

        if (options.type === 'sqlite') {
          sql = `PRAGMA table_info(${table})`;
        } else if (options.type === 'postgresql') {
          sql = `
            SELECT 
              column_name as name,
              data_type as type,
              is_nullable as nullable,
              column_default as default_value
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
          `;
        } else {
          throw new Error('Unsupported database type');
        }

        const params = options.type === 'postgresql' ? [table] : [];
        const result = await executeQuery(sql, params);

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error describing table: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register get_table_data tool
  server.registerTool(
    {
      name: 'get_table_data',
      description: 'Get data from a table',
      inputSchema: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: 'Table name',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of rows to return',
          },
          offset: {
            type: 'number',
            description: 'Number of rows to skip',
          },
          where: {
            type: 'string',
            description: 'WHERE clause',
          },
          order_by: {
            type: 'string',
            description: 'ORDER BY clause',
          },
        },
        required: ['table'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const table = args.table as string;
        const limit = Math.min((args.limit as number) || 100, 1000);
        const offset = (args.offset as number) || 0;

        let sql = `SELECT * FROM ${table}`;

        if (args.where) {
          sql += ` WHERE ${args.where}`;
        }

        if (args.order_by) {
          sql += ` ORDER BY ${args.order_by}`;
        }

        if (options.type === 'sqlite') {
          sql += ` LIMIT ${limit} OFFSET ${offset}`;
        } else if (options.type === 'postgresql') {
          sql += ` LIMIT ${limit} OFFSET ${offset}`;
        }

        const result = await executeQuery(sql);

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error getting table data: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register insert_data tool
  server.registerTool(
    {
      name: 'insert_data',
      description: 'Insert data into a table',
      inputSchema: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: 'Table name',
          },
          data: {
            type: 'object',
            description: 'Data to insert (key-value pairs)',
          },
        },
        required: ['table', 'data'],
      },
    },
    async (args): Promise<CallToolResult> => {
      if (readOnly) {
        return createToolResult(
          [
            {
              type: 'text',
              text: 'Write operations are disabled in read-only mode',
            },
          ],
          true
        );
      }

      try {
        const table = args.table as string;
        const data = args.data as Record<string, unknown>;

        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) =>
          options.type === 'postgresql' ? `$${i + 1}` : '?'
        );

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;

        const result = await executeQuery(sql, values as string[]);

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error inserting data: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register update_data tool
  server.registerTool(
    {
      name: 'update_data',
      description: 'Update data in a table',
      inputSchema: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: 'Table name',
          },
          data: {
            type: 'object',
            description: 'Data to update (key-value pairs)',
          },
          where: {
            type: 'string',
            description: 'WHERE clause',
          },
        },
        required: ['table', 'data', 'where'],
      },
    },
    async (args): Promise<CallToolResult> => {
      if (readOnly) {
        return createToolResult(
          [
            {
              type: 'text',
              text: 'Write operations are disabled in read-only mode',
            },
          ],
          true
        );
      }

      try {
        const table = args.table as string;
        const data = args.data as Record<string, unknown>;
        const where = args.where as string;

        const setClause = Object.keys(data)
          .map((key, i) => `${key} = ${options.type === 'postgresql' ? `$${i + 1}` : '?'}`)
          .join(', ');

        const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
        const values = Object.values(data) as string[];

        const result = await executeQuery(sql, values);

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error updating data: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register delete_data tool
  server.registerTool(
    {
      name: 'delete_data',
      description: 'Delete data from a table',
      inputSchema: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: 'Table name',
          },
          where: {
            type: 'string',
            description: 'WHERE clause',
          },
        },
        required: ['table', 'where'],
      },
    },
    async (args): Promise<CallToolResult> => {
      if (readOnly) {
        return createToolResult(
          [
            {
              type: 'text',
              text: 'Write operations are disabled in read-only mode',
            },
          ],
          true
        );
      }

      try {
        const table = args.table as string;
        const where = args.where as string;

        const sql = `DELETE FROM ${table} WHERE ${where}`;
        const result = await executeQuery(sql);

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error deleting data: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register get_database_info tool
  server.registerTool(
    {
      name: 'get_database_info',
      description: 'Get information about the database',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async (): Promise<CallToolResult> => {
      try {
        const info: Record<string, unknown> = {
          type: options.type,
          connection: options.connection,
          readOnly,
        };

        if (options.type === 'sqlite') {
          const database = await initDb();
          const version = database.prepare('SELECT sqlite_version() as version').get();
          info.version = (version as any).version;
        } else if (options.type === 'postgresql') {
          const result = await executeQuery('SELECT version()');
          info.version = (result as any[])[0]?.version;
        }

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(info, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error getting database info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  server.initialize();

  return server;
}

export default createDatabaseServer;
