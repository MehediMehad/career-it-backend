import { GoogleGenAI } from '@google/genai';
import config from '../../configs';

export const aiClient = new GoogleGenAI({
  apiKey: config.gemini.apiKey,
});

