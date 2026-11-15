import pytest
import io
import httpx
from app.main import app, db_manager, seed_demo_data_if_needed

@pytest.mark.anyio
async def test_full_rag_api_lifecycle():
    await db_manager.initialize()
    await seed_demo_data_if_needed()
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        # 2. Login as demo user
        login_res = await client.post("/api/auth/login", json={
            "email": "demo@ragintelligence.ai",
            "password": "password123"
        })
        assert login_res.status_code == 200
        token_data = login_res.json()
        token = token_data["access_token"]
        user_info = token_data["user"]
        headers = {"Authorization": f"Bearer {token}"}
        ws_id = user_info["active_workspace_id"]

        # 3. Upload a sample document (FastAPI will execute background pipeline)
        file_content = (
            "# Transformer Architecture and Attention Mechanisms\n\n"
            "The Transformer model relies entirely on an attention mechanism to draw global dependencies "
            "between input and output. The self-attention mechanism allows the network to model correlations "
            "regardless of positional distance. Multi-head attention allows the model to jointly attend to "
            "information from different representation subspaces at different positions.\n\n"
            "## Computational Efficiency\n"
            "Compared with recurrent layers, self-attention layers connect all positions with a constant number "
            "of sequentially executed operations O(1), whereas recurrent layers require O(n) sequential operations."
        ).encode("utf-8")

        files = [
            ("files", ("transformer_architecture.md", io.BytesIO(file_content), "text/markdown"))
        ]
        upload_res = await client.post(
            f"/api/documents/upload?workspace_id={ws_id}",
            headers=headers,
            files=files
        )
        assert upload_res.status_code == 200
        upload_json = upload_res.json()
        assert len(upload_json["uploaded"]) == 1

        # 4. Search test
        search_res = await client.post(
            "/api/search",
            headers=headers,
            json={
                "query": "self-attention and sequential operations",
                "workspace_id": ws_id,
                "top_k": 3
            }
        )
        assert search_res.status_code == 200
        search_json = search_res.json()
        assert search_json["results_count"] > 0

        # 5. Ask Chat question
        chat_res = await client.post(
            "/api/chat",
            headers=headers,
            json={
                "message": "What is the computational efficiency difference between self-attention and recurrent layers?",
                "workspace_id": ws_id
            }
        )
        assert chat_res.status_code == 200
        chat_data = chat_res.json()
        assert "content" in chat_data
        assert chat_data["role"] == "assistant"
        assert len(chat_data.get("citations", [])) > 0

        # 6. Analytics Dashboard
        analytics_res = await client.get(f"/api/analytics/dashboard?workspace_id={ws_id}", headers=headers)
        assert analytics_res.status_code == 200
        an_data = analytics_res.json()
        assert an_data["total_documents"] >= 1
        assert an_data["total_chunks"] >= 1
