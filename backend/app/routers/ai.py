from fastapi import APIRouter, HTTPException, Depends
import os
from google import genai
from google.genai import types
from app.schemas import AiChatRequest, AiChatResponse, AiChatSessionSchema, AiChatMessageSchema
from sqlalchemy.orm import Session
from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User, AiChatSession, AiChatMessage
from typing import List

router = APIRouter()

SYSTEM_INSTRUCTION = """Bạn là trợ lý giảng dạy môn Cơ sở dữ liệu. 
Bạn đóng vai trò hướng dẫn, gợi ý người dùng giải bài tập, tuyệt đối không được đưa code SQL cho người dùng copy, tuyệt đối không gợi ý code, mà hãy gợi ý hướng suy nghĩ để giải quyết vấn đề. 
Nếu người dùng yêu cầu code, hãy khéo léo từ chối và gợi ý phương pháp hoặc từ khóa SQL liên quan.
Dựa vào ngữ cảnh bài tập (tiêu đề, mô tả, yêu cầu, các bảng) và đoạn code hiện tại của sinh viên, hãy đưa ra gợi ý hướng giải quyết bài tập.
Trả lời ngắn gọn, súc tích và dễ hiểu."""


@router.post("/chat", response_model=AiChatResponse)
async def chat_with_ai(
    request: AiChatRequest, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")

    try:
        # Determine session or create new one
        if request.session_id:
            session = db.query(AiChatSession).filter(
                AiChatSession.id == request.session_id, 
                AiChatSession.user_id == current_user.id
            ).first()
            if not session:
                raise HTTPException(status_code=404, detail="Chat session not found")
        else:
            session = AiChatSession(user_id=current_user.id, problem_id=request.problem_context.id)
            db.add(session)
            db.commit()
            db.refresh(session)
            
        # Save user message
        user_msg = AiChatMessage(session_id=session.id, role="user", content=request.user_message)
        db.add(user_msg)
        db.commit()

        client = genai.Client(api_key=api_key)
        
        # Build context
        problem = request.problem_context
        context_str = f"Problem: {problem.title}\nDescription: {problem.description}\nRequirements: {problem.requirements}\n"
        context_str += "Tables:\n"
        for t in problem.tables:
            context_str += f"- {t.name} (Columns: {', '.join(t.columns)})\n"
        
        context_str += f"\nStudent's current SQL draft:\n```sql\n{request.code_draft}\n```"

        # Prepare messages from DB history
        history_msgs = db.query(AiChatMessage).filter(AiChatMessage.session_id == session.id).order_by(AiChatMessage.created_at).all()
        
        messages = []
        for msg in history_msgs:
            if msg.role == "user" and msg.id == user_msg.id:
                # The latest user message gets the context injected
                current_msg = f"Context:\n{context_str}\n\nUser Question: {msg.content}"
                messages.append(types.Content(role="user", parts=[types.Part.from_text(text=current_msg)]))
            else:
                role = "model" if msg.role == "ai" else "user"
                messages.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.content)]))
                
        # Call Gemini API
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=messages,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
            ),
        )
        
        # Save AI response
        ai_msg = AiChatMessage(session_id=session.id, role="ai", content=response.text)
        db.add(ai_msg)
        db.commit()
        
        return AiChatResponse(response=response.text, session_id=session.id)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{problem_id}", response_model=List[AiChatSessionSchema])
def get_chat_sessions(
    problem_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(AiChatSession).filter(
        AiChatSession.user_id == current_user.id,
        AiChatSession.problem_id == problem_id
    ).order_by(AiChatSession.created_at.desc()).all()
    return sessions

@router.get("/sessions/messages/{session_id}", response_model=List[AiChatMessageSchema])
def get_chat_messages(
    session_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    session = db.query(AiChatSession).filter(
        AiChatSession.id == session_id,
        AiChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    messages = db.query(AiChatMessage).filter(
        AiChatMessage.session_id == session_id
    ).order_by(AiChatMessage.created_at).all()
    
    return messages
