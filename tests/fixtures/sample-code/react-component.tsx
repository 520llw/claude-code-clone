/**
 * React Component Example
 * Sample React component for testing
 */

import React, { useState, useCallback, useEffect } from 'react';

// Types
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface TodoListProps {
  initialTodos?: Todo[];
  onTodoChange?: (todos: Todo[]) => void;
}

// Component
export const TodoList: React.FC<TodoListProps> = ({
  initialTodos = [],
  onTodoChange,
}) => {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Notify parent of changes
  useEffect(() => {
    onTodoChange?.(todos);
  }, [todos, onTodoChange]);

  // Add new todo
  const addTodo = useCallback(() => {
    if (!inputValue.trim()) return;

    const newTodo: Todo = {
      id: `todo_${Date.now()}`,
      text: inputValue.trim(),
      completed: false,
      createdAt: new Date(),
    };

    setTodos(prev => [...prev, newTodo]);
    setInputValue('');
  }, [inputValue]);

  // Toggle todo completion
  const toggleTodo = useCallback((id: string) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  // Delete todo
  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  // Clear completed
  const clearCompleted = useCallback(() => {
    setTodos(prev => prev.filter(todo => !todo.completed));
  }, []);

  // Filtered todos
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  // Stats
  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.filter(t => t.completed).length;

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  };

  return (
    <div className="todo-list">
      <h1>Todo List</h1>

      {/* Input */}
      <div className="todo-input">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="What needs to be done?"
          className="todo-input__field"
        />
        <button
          onClick={addTodo}
          disabled={!inputValue.trim()}
          className="todo-input__button"
        >
          Add
        </button>
      </div>

      {/* Filters */}
      <div className="todo-filters">
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'active' : ''}
        >
          All ({todos.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={filter === 'active' ? 'active' : ''}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={filter === 'completed' ? 'active' : ''}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Todo List */}
      <ul className="todo-items">
        {filteredTodos.map(todo => (
          <li
            key={todo.id}
            className={`todo-item ${todo.completed ? 'completed' : ''}`}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              className="todo-item__checkbox"
            />
            <span className="todo-item__text">{todo.text}</span>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="todo-item__delete"
              aria-label="Delete todo"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {/* Empty state */}
      {filteredTodos.length === 0 && (
        <p className="todo-empty">
          {filter === 'all'
            ? 'No todos yet. Add one above!'
            : `No ${filter} todos.`}
        </p>
      )}

      {/* Actions */}
      {completedCount > 0 && (
        <button onClick={clearCompleted} className="todo-clear">
          Clear completed ({completedCount})
        </button>
      )}
    </div>
  );
};

// Styles (CSS-in-JS or separate CSS file)
export const todoListStyles = `
  .todo-list {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
  }

  .todo-input {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  .todo-input__field {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .todo-input__button {
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .todo-input__button:disabled {
    background: #ccc;
  }

  .todo-filters {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  .todo-filters button {
    padding: 5px 15px;
    border: 1px solid #ddd;
    background: white;
    cursor: pointer;
  }

  .todo-filters button.active {
    background: #007bff;
    color: white;
  }

  .todo-items {
    list-style: none;
    padding: 0;
  }

  .todo-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-bottom: 1px solid #eee;
  }

  .todo-item.completed .todo-item__text {
    text-decoration: line-through;
    color: #999;
  }

  .todo-item__text {
    flex: 1;
  }

  .todo-item__delete {
    background: none;
    border: none;
    color: #ff4444;
    font-size: 20px;
    cursor: pointer;
  }

  .todo-empty {
    text-align: center;
    color: #999;
    padding: 20px;
  }

  .todo-clear {
    margin-top: 20px;
    padding: 10px 20px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
`;

export default TodoList;
