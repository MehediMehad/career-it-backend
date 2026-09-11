export interface IChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ISuggestedCourse {
  id: string;
  slug: string;
  title: string;
  price: number;
  level: string;
  category?: string;
  image?: string;
}

export interface IChatResponse {
  reply: string;
  suggestedCourses: ISuggestedCourse[];
}

export interface IKnowledgeChunk {
  id?: string;
  courseId?: string | null;
  title: string;
  content: string;
  category?: string;
  embedding: number[];
  metadata?: Record<string, any>;
  similarity?: number;
}
