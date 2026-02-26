import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic()

SYSTEM_PROMPT = "You are a helpful personal assistant."


def send_message(conversation_history):
    response = client.messages.create(
        model="claude-sonnet-4-0",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=conversation_history
    )
    return response.content[0].text
