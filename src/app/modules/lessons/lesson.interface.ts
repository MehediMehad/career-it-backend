import type { LessonTypeEnum, VideoProviderEnum } from '@prisma/client';

export interface ICreateLesson {
  lessonNumber: number;
  title: string;
  lessonType: LessonTypeEnum;
  videoProvider?: VideoProviderEnum;
  videoKey?: string;
  videoUrl?: string;
  duration?: number;
  isFreePreview?: boolean;
  moduleId: string;
}

export interface IUpdateLesson {
  lessonNumber?: number;
  title?: string;
  lessonType?: LessonTypeEnum;
  videoProvider?: VideoProviderEnum;
  videoKey?: string;
  videoUrl?: string;
  duration?: number;
  isFreePreview?: boolean;
}

export interface ILessonFilterRequest {
  searchTerm?: string;
  moduleId?: string;
  lessonType?: LessonTypeEnum;
  isFreePreview?: boolean | string;
}

export interface ILessonPlaybackResponse {
  type: VideoProviderEnum;
  playbackUrl: string;
  expiresIn?: number;
  expiresAt?: string;
}

export interface IReorderLessonItem {
  id: string;
  lessonNumber: number;
}

export interface IReorderLessonsPayload {
  moduleId: string;
  items: IReorderLessonItem[];
}

