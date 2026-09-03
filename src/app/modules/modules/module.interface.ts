export interface IModuleFilterRequest {
  searchTerm?: string;
  courseId?: string;
  milestoneId?: string;
}

export interface ICreateModule {
  moduleNumber: number;
  title: string;
  courseId: string;
  milestoneId: string;
}

export interface IUpdateModule {
  moduleNumber?: number;
  title?: string;
  courseId?: string;
  milestoneId?: string;
}
