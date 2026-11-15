import asyncio
import json
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import motor.motor_asyncio
from app.config import settings

logger = logging.getLogger("rag_intelligence.database")

class DatabaseManager:
    def __init__(self):
        self.is_mongo = False
        self.mongo_client = None
        self.db = None
        self._lock = None
        self._local_data: Dict[str, List[Dict[str, Any]]] = {
            "users": [],
            "workspaces": [],
            "documents": [],
            "chat_sessions": [],
            "chat_messages": [],
            "analytics": []
        }
        self._load_local_store()

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def initialize(self):
        """Initializes database engine. Connects to MongoDB if configured, otherwise uses local store."""
        if settings.USE_MONGODB:
            try:
                client = motor.motor_asyncio.AsyncIOMotorClient(
                    settings.MONGODB_URL,
                    serverSelectionTimeoutMS=1000
                )
                await asyncio.wait_for(client.admin.command('ping'), timeout=1.0)
                self.mongo_client = client
                self.db = client[settings.MONGODB_DB_NAME]
                self.is_mongo = True
                logger.info(f"Connected successfully to MongoDB database: {settings.MONGODB_DB_NAME}")
                return
            except Exception as e:
                logger.warning(f"MongoDB connection failed: {e}. Falling back to local store.")
        
        self.is_mongo = False
        self._load_local_store()
        logger.info("Using local persistent storage engine for workspaces, documents & chat.")

    def _load_local_store(self):
        if os.path.exists(settings.LOCAL_DB_FILE):
            try:
                with open(settings.LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                    self._local_data = json.load(f)
                    for key in ["users", "workspaces", "documents", "chat_sessions", "chat_messages", "analytics"]:
                        if key not in self._local_data:
                            self._local_data[key] = []
            except Exception as e:
                logger.error(f"Error loading local store: {e}")
        else:
            self._save_local_store_sync()

    def _save_local_store_sync(self):
        try:
            with open(settings.LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(self._local_data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving local store: {e}")

    async def _save_local_store(self):
        lock = self._get_lock()
        async with lock:
            self._save_local_store_sync()

    # --- Users ---
    async def find_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        email_clean = email.strip().lower()
        if self.is_mongo:
            doc = await self.db.users.find_one({"email": email_clean})
            if doc:
                doc["id"] = str(doc.get("_id", doc.get("id")))
            return doc
        for u in self._local_data["users"]:
            if u.get("email", "").lower() == email_clean:
                return dict(u)
        return None

    async def find_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mongo:
            doc = await self.db.users.find_one({"id": user_id})
            if doc:
                doc["id"] = str(doc.get("_id", doc.get("id")))
            return doc
        for u in self._local_data["users"]:
            if u.get("id") == user_id:
                return dict(u)
        return None

    async def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        user_data["created_at"] = user_data.get("created_at") or datetime.now(timezone.utc).isoformat()
        if self.is_mongo:
            await self.db.users.insert_one(user_data)
            return user_data
        self._local_data["users"].append(user_data)
        await self._save_local_store()
        return user_data

    # --- Workspaces ---
    async def get_workspaces(self, user_id: str) -> List[Dict[str, Any]]:
        if self.is_mongo:
            cursor = self.db.workspaces.find({"user_id": user_id})
            results = []
            async for doc in cursor:
                doc["id"] = str(doc.get("id", doc.get("_id")))
                results.append(doc)
            return results
        return [w for w in self._local_data["workspaces"] if w.get("user_id") == user_id]

    async def get_workspace(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mongo:
            doc = await self.db.workspaces.find_one({"id": workspace_id})
            return doc
        for w in self._local_data["workspaces"]:
            if w.get("id") == workspace_id:
                return dict(w)
        return None

    async def create_workspace(self, workspace_data: Dict[str, Any]) -> Dict[str, Any]:
        workspace_data["created_at"] = workspace_data.get("created_at") or datetime.now(timezone.utc).isoformat()
        if self.is_mongo:
            await self.db.workspaces.insert_one(workspace_data)
            return workspace_data
        self._local_data["workspaces"].append(workspace_data)
        await self._save_local_store()
        return workspace_data

    # --- Documents ---
    async def get_documents(self, workspace_id: str, search: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.is_mongo:
            query: Dict[str, Any] = {"workspace_id": workspace_id}
            if search:
                query["filename"] = {"$regex": search, "$options": "i"}
            cursor = self.db.documents.find(query).sort("created_at", -1)
            results = []
            async for doc in cursor:
                doc["id"] = str(doc.get("id", doc.get("_id")))
                results.append(doc)
            return results
        
        docs = [d for d in self._local_data["documents"] if d.get("workspace_id") == workspace_id]
        if search:
            docs = [d for d in docs if search.lower() in d.get("filename", "").lower()]
        return sorted(docs, key=lambda x: x.get("created_at", ""), reverse=True)

    async def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mongo:
            doc = await self.db.documents.find_one({"id": doc_id})
            if doc:
                doc["id"] = str(doc.get("id", doc.get("_id")))
            return doc
        for d in self._local_data["documents"]:
            if d.get("id") == doc_id:
                return dict(d)
        return None

    async def find_document_by_hash(self, workspace_id: str, file_hash: str) -> Optional[Dict[str, Any]]:
        if self.is_mongo:
            return await self.db.documents.find_one({"workspace_id": workspace_id, "file_hash": file_hash})
        for d in self._local_data["documents"]:
            if d.get("workspace_id") == workspace_id and d.get("file_hash") == file_hash:
                return dict(d)
        return None

    async def create_document(self, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        doc_data["created_at"] = doc_data.get("created_at") or datetime.now(timezone.utc).isoformat()
        doc_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_mongo:
            await self.db.documents.insert_one(doc_data)
            return doc_data
        self._local_data["documents"].append(doc_data)
        await self._save_local_store()
        return doc_data

    async def update_document(self, doc_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_mongo:
            await self.db.documents.update_one({"id": doc_id}, {"$set": update_data})
            return await self.get_document(doc_id)
        for i, d in enumerate(self._local_data["documents"]):
            if d.get("id") == doc_id:
                self._local_data["documents"][i].update(update_data)
                await self._save_local_store()
                return self._local_data["documents"][i]
        return None

    async def delete_document(self, doc_id: str) -> bool:
        if self.is_mongo:
            res = await self.db.documents.delete_one({"id": doc_id})
            return res.deleted_count > 0
        original_len = len(self._local_data["documents"])
        self._local_data["documents"] = [d for d in self._local_data["documents"] if d.get("id") != doc_id]
        if len(self._local_data["documents"]) < original_len:
            await self._save_local_store()
            return True
        return False

    # --- Chat Sessions ---
    async def get_chat_sessions(self, workspace_id: str) -> List[Dict[str, Any]]:
        if self.is_mongo:
            cursor = self.db.chat_sessions.find({"workspace_id": workspace_id}).sort("updated_at", -1)
            results = []
            async for doc in cursor:
                doc["id"] = str(doc.get("id", doc.get("_id")))
                results.append(doc)
            return results
        sessions = [s for s in self._local_data["chat_sessions"] if s.get("workspace_id") == workspace_id]
        return sorted(sessions, key=lambda x: x.get("updated_at", ""), reverse=True)

    async def get_chat_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mongo:
            doc = await self.db.chat_sessions.find_one({"id": session_id})
            if doc:
                doc["id"] = str(doc.get("id", doc.get("_id")))
            return doc
        for s in self._local_data["chat_sessions"]:
            if s.get("id") == session_id:
                return dict(s)
        return None

    async def create_chat_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        session_data["created_at"] = session_data.get("created_at") or now
        session_data["updated_at"] = now
        session_data["message_count"] = 0
        if self.is_mongo:
            await self.db.chat_sessions.insert_one(session_data)
            return session_data
        self._local_data["chat_sessions"].append(session_data)
        await self._save_local_store()
        return session_data

    async def update_chat_session(self, session_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_mongo:
            await self.db.chat_sessions.update_one({"id": session_id}, {"$set": update_data})
            return await self.get_chat_session(session_id)
        for i, s in enumerate(self._local_data["chat_sessions"]):
            if s.get("id") == session_id:
                self._local_data["chat_sessions"][i].update(update_data)
                await self._save_local_store()
                return self._local_data["chat_sessions"][i]
        return None

    async def delete_chat_session(self, session_id: str) -> bool:
        if self.is_mongo:
            await self.db.chat_sessions.delete_one({"id": session_id})
            await self.db.chat_messages.delete_many({"session_id": session_id})
            return True
        self._local_data["chat_sessions"] = [s for s in self._local_data["chat_sessions"] if s.get("id") != session_id]
        self._local_data["chat_messages"] = [m for m in self._local_data["chat_messages"] if m.get("session_id") != session_id]
        await self._save_local_store()
        return True

    async def clear_chat_messages(self, session_id: str) -> bool:
        if self.is_mongo:
            await self.db.chat_messages.delete_many({"session_id": session_id})
            await self.db.chat_sessions.update_one({"id": session_id}, {"$set": {"message_count": 0, "preview": ""}})
            return True
        self._local_data["chat_messages"] = [m for m in self._local_data["chat_messages"] if m.get("session_id") != session_id]
        for s in self._local_data["chat_sessions"]:
            if s.get("id") == session_id:
                s["message_count"] = 0
                s["preview"] = ""
        await self._save_local_store()
        return True

    # --- Chat Messages ---
    async def get_chat_messages(self, session_id: str) -> List[Dict[str, Any]]:
        if self.is_mongo:
            cursor = self.db.chat_messages.find({"session_id": session_id}).sort("timestamp", 1)
            results = []
            async for doc in cursor:
                doc["id"] = str(doc.get("id", doc.get("_id")))
                results.append(doc)
            return results
        messages = [m for m in self._local_data["chat_messages"] if m.get("session_id") == session_id]
        return sorted(messages, key=lambda x: x.get("timestamp", ""))

    async def create_chat_message(self, message_data: Dict[str, Any]) -> Dict[str, Any]:
        message_data["timestamp"] = message_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
        if self.is_mongo:
            await self.db.chat_messages.insert_one(message_data)
        else:
            self._local_data["chat_messages"].append(message_data)
            await self._save_local_store()
        
        # Increment message count on session
        session_id = message_data.get("session_id")
        if session_id:
            await self.increment_session_message_count(session_id, message_data.get("content", "")[:60])
        return message_data

    async def increment_session_message_count(self, session_id: str, preview: str):
        if self.is_mongo:
            await self.db.chat_sessions.update_one(
                {"id": session_id},
                {
                    "$inc": {"message_count": 1},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat(), "preview": preview}
                }
            )
        else:
            for s in self._local_data["chat_sessions"]:
                if s.get("id") == session_id:
                    s["message_count"] = s.get("message_count", 0) + 1
                    s["updated_at"] = datetime.now(timezone.utc).isoformat()
                    s["preview"] = preview
            await self._save_local_store()

    # --- Analytics ---
    async def log_analytics_event(self, event_data: Dict[str, Any]):
        event_data["timestamp"] = event_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
        if self.is_mongo:
            await self.db.analytics.insert_one(event_data)
        else:
            self._local_data["analytics"].append(event_data)
            # keep last 1000 events
            if len(self._local_data["analytics"]) > 1000:
                self._local_data["analytics"] = self._local_data["analytics"][-1000:]
            await self._save_local_store()

    async def get_analytics(self, workspace_id: str) -> Dict[str, Any]:
        docs = await self.get_documents(workspace_id)
        sessions = await self.get_chat_sessions(workspace_id)
        
        total_docs = len(docs)
        total_chunks = sum(d.get("chunk_count", 0) for d in docs)
        storage_bytes = sum(d.get("file_size", 0) for d in docs)
        total_chats = len(sessions)
        
        indexed_count = sum(1 for d in docs if d.get("status") == "indexed")
        processing_count = sum(1 for d in docs if d.get("status") in ["uploading", "processing"])
        failed_count = sum(1 for d in docs if d.get("status") == "failed")
        
        chunks_by_doc = [
            {
                "name": d.get("filename", "Unknown"),
                "chunks": d.get("chunk_count", 0),
                "pages": d.get("page_count", 1)
            }
            for d in docs[:8]
        ]
        
        # Query frequency and citations from analytics events
        events = [e for e in self._local_data["analytics"] if e.get("workspace_id") == workspace_id]
        doc_query_map: Dict[str, Dict[str, int]] = {}
        for ev in events:
            if ev.get("type") == "rag_query":
                for doc_name in ev.get("cited_documents", []):
                    if doc_name not in doc_query_map:
                        doc_query_map[doc_name] = {"query_count": 0, "citation_count": 0}
                    doc_query_map[doc_name]["citation_count"] += 1
                for doc_name in ev.get("retrieved_documents", []):
                    if doc_name not in doc_query_map:
                        doc_query_map[doc_name] = {"query_count": 0, "citation_count": 0}
                    doc_query_map[doc_name]["query_count"] += 1
                    
        frequently_queried = [
            {
                "filename": k,
                "query_count": v["query_count"],
                "citation_count": v["citation_count"]
            }
            for k, v in sorted(doc_query_map.items(), key=lambda x: x[1]["query_count"] + x[1]["citation_count"], reverse=True)
        ][:6]
        
        # If no query events yet, show top uploaded documents with 0 hits
        if not frequently_queried and docs:
            frequently_queried = [
                {"filename": d.get("filename"), "query_count": 0, "citation_count": 0}
                for d in docs[:5]
            ]
            
        # Recent query activity by day
        today = datetime.now(timezone.utc).strftime("%b %d")
        query_history = [
            {"date": today, "queries": sum(1 for e in events if e.get("type") == "rag_query")}
        ]
        
        latencies = [e.get("latency_ms", 0) for e in events if e.get("latency_ms")]
        avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 320.0
        
        return {
            "total_documents": total_docs,
            "total_chunks": total_chunks,
            "total_chats": total_chats,
            "storage_bytes": storage_bytes,
            "status_breakdown": {
                "indexed": indexed_count,
                "processing": processing_count,
                "failed": failed_count
            },
            "chunks_by_doc": chunks_by_doc,
            "query_history": query_history,
            "frequently_queried": frequently_queried,
            "avg_latency_ms": avg_latency
        }

db_manager = DatabaseManager()
