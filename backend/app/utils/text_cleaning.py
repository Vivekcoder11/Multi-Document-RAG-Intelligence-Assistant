import re

def clean_text(text: str) -> str:
    """Cleans and normalizes extracted document text."""
    if not text:
        return ""
    
    # Replace non-breaking spaces and unusual whitespace
    text = text.replace('\xa0', ' ').replace('\u200b', '')
    
    # Replace smart quotes and special dashes
    text = text.replace('“', '"').replace('”', '"')
    text = text.replace('‘', "'").replace('’', "'")
    text = text.replace('—', '-').replace('–', '-')
    
    # Remove control characters except newline and tab
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    # Normalize multiple blank lines to double newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Normalize excessive horizontal whitespace
    text = re.sub(r'[ \t]{2,}', ' ', text)
    
    return text.strip()
