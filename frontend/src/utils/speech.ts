// Speech-to-Text and Text-to-Speech Utilities for AI Voice Assistant

export const cleanTextForSpeech = (text: string): string => {
  return text
    // Remove doc citation tags e.g. [Doc: resume.pdf, Page: 1]
    .replace(/\[Doc:[^\]]+\]/gi, '')
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code ticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove header markers #, ##, etc.
    .replace(/#{1,6}\s+/g, '')
    // Remove blockquote markers >
    .replace(/^>\s+/gm, '')
    // Remove markdown bullet points
    .replace(/^[-•*]\s+/gm, '')
    // Remove multiple newlines with a period and space
    .replace(/\n\s*\n/g, '. ')
    .replace(/\n/g, ' ')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();
};

export const isSpeechSynthesisSupported = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

export const isSpeechRecognitionSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
};

export class VoiceAssistant {
  private static synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;

  static speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    if (!this.synth) return;

    // Stop any ongoing speech
    this.stop();

    const clean = cleanTextForSpeech(text);
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = options?.rate || 1.0;
    utterance.pitch = options?.pitch || 1.0;

    // Select the best natural-sounding voice
    const voices = this.synth.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Neural') ||
          v.name.includes('Samantha') ||
          v.name.includes('Jenny')) &&
        v.lang.startsWith('en')
    ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      options?.onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      options?.onError?.(e);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  static stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  static isSpeaking(): boolean {
    return !!this.synth && (this.synth.speaking || this.currentUtterance !== null);
  }

  static getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }
}

export const createSpeechRecognizer = (
  onTranscript: (transcript: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
) => {
  if (!isSpeechRecognitionSupported()) {
    onError('Speech recognition is not supported in this browser.');
    return null;
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      onTranscript(finalTranscript, true);
    } else if (interimTranscript) {
      onTranscript(interimTranscript, false);
    }
  };

  recognition.onerror = (event: any) => {
    onError(event.error || 'Speech recognition error');
  };

  recognition.onend = () => {
    onEnd();
  };

  return recognition;
};
