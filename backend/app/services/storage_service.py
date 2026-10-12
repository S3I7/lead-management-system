import os
import uuid
import zipfile
from io import BytesIO
from fastapi import UploadFile, HTTPException
from app.core.config import settings

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

class StorageService:
    @staticmethod
    def validate_and_save_story_file(file: UploadFile) -> tuple[str, str, str, int]:
        """
        Validates story file type (DOCX or PDF) by magic bytes,
        checks size, and saves to storage directory.
        Returns: (file_url, saved_filename, detected_mime_type, file_size)
        """
        content = file.file.read(settings.MAX_FILE_SIZE_BYTES + 1)  # never buffer more than the limit
        file_size = len(content)
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="The submitted file is empty.")
        
        if file_size > settings.MAX_FILE_SIZE_BYTES:
            max_mb = settings.MAX_FILE_SIZE_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=400, 
                detail=f"File exceeds maximum allowed size of {max_mb:.0f}MB."
            )
        
        # Validate magic bytes
        detected_mime = None
        extension = ""
        
        # Check PDF signature: %PDF-
        if content.startswith(b"%PDF-"):
            detected_mime = "application/pdf"
            extension = ".pdf"
        # Check DOCX: zip signature PK\x03\x04 and contains word/document.xml or [Content_Types].xml
        elif content.startswith(b"PK\x03\x04"):
            try:
                with zipfile.ZipFile(BytesIO(content)) as z:
                    namelist = z.namelist()
                    # word/document.xml is what makes it a Word file (xlsx/pptx/plain zips also start with PK)
                    if "[Content_Types].xml" in namelist and "word/document.xml" in namelist:
                        detected_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        extension = ".docx"
            except Exception:
                detected_mime = None
                
        if not detected_mime:
            raise HTTPException(
                status_code=400,
                detail="Invalid file format. Only genuine PDF and DOCX files are accepted. File content must match format specification."
            )
            
        unique_filename = f"{uuid.uuid4().hex}{extension}"
        target_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
        
        with open(target_path, "wb") as f:
            f.write(content)
            
        # File URL relative or download endpoint
        file_url = f"/api/v1/submissions/files/{unique_filename}"
        
        original = os.path.basename((file.filename or "").replace("\\", "/")).strip()[:200] or f"story{extension}"
        return file_url, original, detected_mime, file_size

    @staticmethod
    def delete_file(file_url: str) -> None:
        try:
            os.remove(os.path.join(settings.UPLOAD_DIR, os.path.basename(file_url)))
        except FileNotFoundError:
            pass

    @staticmethod
    def get_file_path(filename: str) -> str:
        # Prevent path traversal
        clean_name = os.path.basename(filename)
        path = os.path.join(settings.UPLOAD_DIR, clean_name)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Requested file not found.")
        return path
