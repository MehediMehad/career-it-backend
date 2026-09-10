import { aiClient } from '../../libs/gemini';
import prisma from '../../libs/prisma';
import { IChatMessage, IChatResponse, IKnowledgeChunk, ISuggestedCourse } from './ai.interface';

/**
 * Generate embedding vector using Gemini Embedding model
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const cleanText = text.replace(/\n+/g, ' ').slice(0, 2048);
    const response = await aiClient.models.embedContent({
      model: 'gemini-embedding-001',
      contents: cleanText,
    });

    const values = response.embeddings?.[0]?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Invalid embedding response from Gemini');
    }

    return values;
  } catch (error: any) {
    console.error('Error generating embedding:', error?.message || error);
    throw error;
  }
};

/**
 * Calculate Cosine Similarity between two numeric vectors
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
};

/**
 * Synchronize all active Courses, Syllabi & Platform FAQs into Vector Knowledge Base
 */
export const syncCourseKnowledge = async (): Promise<{ totalIndexed: number }> => {
  const courses = await prisma.course.findMany({
    where: { isDeleted: false },
    include: {
      category: true,
      instructorProfile: {
        include: {
          user: true,
        },
      },
      milestones: {
        orderBy: { milestoneNumber: 'asc' },
        include: {
          modules: {
            orderBy: { moduleNumber: 'asc' },
            include: {
              lessons: {
                orderBy: { lessonNumber: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  const knowledgeItems: Array<{
    courseId?: string;
    title: string;
    content: string;
    category: string;
    metadata?: any;
  }> = [];

  // General Career IT Platform Info
  knowledgeItems.push({
    title: 'Career IT Platform Overview & Admission Support',
    category: 'platform_faq',
    content: `Career IT is a premier online tech learning and career acceleration platform in Bangladesh. 
We offer industry-aligned professional courses including Full-Stack Web Development, MERN Stack, Next.js, Cyber Security, DevOps, Cloud Architecture, and Software Engineering.
Key Benefits:
- Hands-on real-world industry projects.
- Dedicated mentorship, 1-on-1 doubt clearing, and weekly live Q&A.
- Comprehensive career support, resume building, and job interview prep.
- Verifiable digital certificates upon course and capstone project completion.
- Lifetime access to course recordings and resource repositories.
Admission & Enrollment:
Students can browse available courses on the website, select any course, and click "Enroll in Course" to enroll directly via online payment (bKash, Nagad, Cards, Stripe).`,
  });

  // Course-specific knowledge chunks
  for (const course of courses) {
    const instructorName = course.instructorProfile?.user?.name || 'Industry Veteran';
    const instructorRole = course.instructorProfile?.headline || 'Lead Software Architect';
    const categoryTitle = course.category?.title || 'IT & Software';
    const outcomes = course.learningOutcomes?.length
      ? course.learningOutcomes.join(', ')
      : 'Practical production-grade skills';
    const requirements = course.requirements?.length
      ? course.requirements.join(', ')
      : 'Basic computer literacy and passion for learning';

    // Chunk 1: Overview & Admission details
    const overviewContent = `Course: ${course.title}
Category: ${categoryTitle}
Target Level: ${course.level}
Fee / Price: ৳${course.price} BDT
Rating: ${course.rating}/5.0 (${course.totalReviews} reviews, ${course.totalStudents} enrolled students)
Instructor: ${instructorName} (${instructorRole})
Course Overview: ${course.description}
About Specialization: ${course.about}
Prerequisites & Requirements: ${requirements}
What you will learn & Outcomes: ${outcomes}
Course Link: /courses/${course.id}`;

    knowledgeItems.push({
      courseId: course.id,
      title: `${course.title} - Overview & Enrollment`,
      category: 'course_overview',
      content: overviewContent,
      metadata: {
        courseId: course.id,
        price: Number(course.price),
        level: course.level,
        category: categoryTitle,
      },
    });

    // Chunk 2: Milestones & Curriculum Breakdown
    if (course.milestones?.length) {
      const curriculumSummary = course.milestones
        .map((m, mIdx) => {
          const moduleList = m.modules
            .map((mod) => {
              const lessonTopics = mod.lessons.map((l) => l.title).slice(0, 5).join(', ');
              return `  - Module ${mod.moduleNumber}: ${mod.title} (Topics: ${lessonTopics || 'Practical lessons'})`;
            })
            .join('\n');
          return `Milestone ${mIdx + 1}: ${m.title}\n${moduleList}`;
        })
        .join('\n\n');

      const curriculumContent = `Course Curriculum for: ${course.title}
Milestones and Modules Breakdown:
${curriculumSummary}
Total Lessons: ${course.totalLessons}
Course Page: /courses/${course.id}`;

      knowledgeItems.push({
        courseId: course.id,
        title: `${course.title} - Curriculum & Modules`,
        category: 'course_curriculum',
        content: curriculumContent,
        metadata: {
          courseId: course.id,
          price: Number(course.price),
          level: course.level,
        },
      });
    }
  }

  // Clear existing knowledge base
  await prisma.ragKnowledge.deleteMany({});

  // Generate embeddings and store
  let totalIndexed = 0;
  for (const item of knowledgeItems) {
    try {
      const embedding = await generateEmbedding(`${item.title}\n${item.content}`);
      await prisma.ragKnowledge.create({
        data: {
          courseId: item.courseId || null,
          title: item.title,
          category: item.category,
          content: item.content,
          embedding,
          metadata: item.metadata || {},
        },
      });
      totalIndexed++;
    } catch (err: any) {
      console.error(`Failed to embed knowledge chunk "${item.title}":`, err?.message);
    }
  }

  return { totalIndexed };
};

/**
 * Retrieve Top-K most relevant knowledge chunks using cosine similarity
 */
export const retrieveRelevantKnowledge = async (
  queryText: string,
  topK = 4
): Promise<IKnowledgeChunk[]> => {
  const allChunks = await prisma.ragKnowledge.findMany();

  if (!allChunks.length) {
    // If knowledge base hasn't been synced yet, run auto-sync in background
    syncCourseKnowledge().catch((e) => console.error('Auto sync error:', e));
    return [];
  }

  const queryEmbedding = await generateEmbedding(queryText);

  const scoredChunks: IKnowledgeChunk[] = allChunks.map((chunk) => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    return {
      id: chunk.id,
      courseId: chunk.courseId,
      title: chunk.title,
      content: chunk.content,
      category: chunk.category,
      embedding: chunk.embedding,
      metadata: (chunk.metadata as any) || {},
      similarity,
    };
  });

  // Sort descending by similarity
  scoredChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

  return scoredChunks.slice(0, topK);
};

/**
 * Main AI Counselor Chat Engine
 */
export const chatWithCounselor = async (
  messages: IChatMessage[]
): Promise<IChatResponse> => {
  if (!messages || !messages.length) {
    throw new Error('Messages list cannot be empty');
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const queryText = lastUserMessage?.content || 'Hello';

  // 1. Retrieve RAG Context Chunks
  let relevantChunks: IKnowledgeChunk[] = [];
  try {
    relevantChunks = await retrieveRelevantKnowledge(queryText, 4);
  } catch (err) {
    console.error('RAG Retrieval failed, proceeding with direct context:', err);
  }

  // 2. Fetch list of published courses for quick suggestions
  const publishedCourses = await prisma.course.findMany({
    where: { isPublished: true, isDeleted: false },
    select: {
      id: true,
      title: true,
      price: true,
      level: true,
      image: true,
      category: { select: { title: true } },
    },
    take: 6,
  });

  // Build Context Text
  const contextText = relevantChunks.length
    ? relevantChunks.map((c, i) => `[Source ${i + 1}: ${c.title}]\n${c.content}`).join('\n\n---\n\n')
    : `Career IT is a premier tech education platform with courses in Web Development, Software Engineering, Cyber Security, etc.`;

  // 3. System Prompt for Counselor
  const systemInstruction = `You are "Career IT AI Advisor" (ক্যারিয়ার আইটি এআই কাউন্সেলর), an expert, polite, and professional admission counselor for the tech education platform "Career IT".

STRICT RULES:
1. Keep the entire reply UNDER 40-60 WORDS (maximum 2 to 3 short, friendly sentences). Never write long essays or walls of text.
2. Answer directly and concisely in natural Bengali.
3. Directly recommend the best matching course by stating its name in bold (**Course Name**), fee, and level.
4. Mention that they can click the course card below to view full curriculum and enroll.
5. NEVER write long outlines, full syllabi, bullet lists, or divider lines (---). The interactive card already contains full details.

KNOWLEDGE CONTEXT:
${contextText}
`;

  try {
    const formattedContents = [
      ...messages.slice(-5, -1).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      {
        role: 'user',
        parts: [{ text: queryText }],
      },
    ];

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const reply = response.text || 'দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।';

    // Find suggested courses matching retrieved chunks
    const matchedCourseIds = new Set(
      relevantChunks.map((c) => c.courseId).filter(Boolean) as string[]
    );

    let suggestedCourses: ISuggestedCourse[] = [];
    if (matchedCourseIds.size > 0) {
      suggestedCourses = publishedCourses
        .filter((c) => matchedCourseIds.has(c.id))
        .map((c) => ({
          id: c.id,
          title: c.title,
          price: Number(c.price),
          level: c.level,
          category: c.category?.title,
          image: c.image,
        }));
    }

    if (!suggestedCourses.length && publishedCourses.length > 0) {
      suggestedCourses = publishedCourses.slice(0, 2).map((c) => ({
        id: c.id,
        title: c.title,
        price: Number(c.price),
        level: c.level,
        category: c.category?.title,
        image: c.image,
      }));
    }

    return {
      reply,
      suggestedCourses,
    };
  } catch (error: any) {
    console.error('Gemini chat generation failed:', error?.message || error);
    throw error;
  }
};
