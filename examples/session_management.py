"""
Session management example for Claude Code Agent System.

This example demonstrates:
1. Creating and saving sessions
2. Loading sessions
3. Session persistence
"""

import asyncio
from pathlib import Path
import sys
import tempfile

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core import Session, SessionManager, create_session


async def main():
    """Run session management example."""
    print("=" * 60)
    print("Claude Code Agent - Session Management Example")
    print("=" * 60)
    print()
    
    # Create a temporary directory for session storage
    with tempfile.TemporaryDirectory() as tmpdir:
        storage_dir = Path(tmpdir)
        
        # Example 1: Basic Session Operations
        print("-" * 60)
        print("Example 1: Basic Session Operations")
        print("-" * 60)
        
        # Create a session
        session = Session.create(
            metadata={"user": "example_user", "project": "demo"}
        )
        print(f"Created session: {session.session_id}")
        print(f"Created at: {session.created_at}")
        print()
        
        # Add messages
        session.add_user_message("Hello, AI!")
        session.add_assistant_message("Hello! How can I help you today?")
        session.add_user_message("What's the weather like?")
        
        print(f"Message count: {session.get_message_count()}")
        print("Messages:")
        for msg in session.get_messages():
            print(f"  [{msg.role.value}]: {msg.content}")
        print()
        
        # Save session
        save_path = storage_dir / "session.json"
        session.save(save_path)
        print(f"Session saved to: {save_path}")
        print()
        
        # Load session
        loaded_session = Session.load(save_path)
        print(f"Loaded session: {loaded_session.session_id}")
        print(f"Message count: {loaded_session.get_message_count()}")
        print()
        
        # Example 2: Session Manager
        print("-" * 60)
        print("Example 2: Session Manager")
        print("-" * 60)
        
        manager = SessionManager(storage_dir=storage_dir, auto_save=True)
        
        # Create multiple sessions
        session1 = manager.create_session(metadata={"task": "coding"})
        session1.add_user_message("Write a Python function")
        
        session2 = manager.create_session(metadata={"task": "debugging"})
        session2.add_user_message("Fix this bug")
        
        session3 = manager.create_session(metadata={"task": "refactoring"})
        session3.add_user_message("Refactor this code")
        
        print(f"Created {len(manager.list_sessions())} sessions")
        
        # List all sessions
        print("\nAll sessions:")
        for info in manager.list_sessions():
            print(f"  - {info['session_id'][:8]}... ({info['message_count']} messages)")
        
        # Set active session
        manager.set_active_session(session1.session_id)
        active = manager.get_active_session()
        print(f"\nActive session: {active.session_id[:8]}...")
        
        # Checkpoint (auto-save)
        manager.checkpoint()
        print("Session checkpointed")
        
        # Delete a session
        manager.delete_session(session2.session_id)
        print(f"\nDeleted session2, remaining: {len(manager.list_sessions())}")
        
        # Example 3: Session Metadata
        print()
        print("-" * 60)
        print("Example 3: Session Metadata")
        print("-" * 60)
        
        session = Session.create()
        
        # Set metadata
        session.set_metadata("project", "MyProject")
        session.set_metadata("language", "Python")
        session.set_metadata("version", "3.10")
        
        # Get metadata
        print(f"Project: {session.get_metadata('project')}")
        print(f"Language: {session.get_metadata('language')}")
        print(f"All metadata: {session.metadata}")
        
        # Convert to dict
        print(f"\nSession info: {session.to_dict()}")
    
    print()
    print("=" * 60)
    print("Session management example complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
